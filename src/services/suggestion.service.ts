import { prisma } from '../config/db';
import { aiProvider } from './ai';
import { getSessionById } from './session.service';
import { classifyQuestion } from './question-classifier.service';
import { detectAnalysisMode } from '../utils/analysis-mode';
import { analyzeDeterministicOutput } from './deterministic-output.service';
import { normalizeConfidence } from '../utils/confidence';

export const createSuggestion = async (
  userId: string,
  sessionId: string,
  question: string,
) => {
  const generated = await createSuggestionDraft(userId, sessionId, question);

  return prisma.suggestion.create({
    data: {
      sessionId,
      provider: generated.provider,
      question,
      type: generated.type,
      answer: generated.answer,
      code: generated.code || null,
      output: generated.output || null,
      language: generated.language || null,
      complexity: generated.complexity || null,
      rootCause: generated.rootCause || null,
      fix: generated.fix || null,
      analysisMode: generated.analysisMode,
      promptDebug: generated.promptDebug,
      keyPoints: generated.keyPoints,
      confidence: generated.answer.trim()
        ? Math.max(0.7, normalizeConfidence(generated.confidence))
        : normalizeConfidence(generated.confidence),
    },
  });
};

export const createSuggestionDraft = async (
  userId: string,
  sessionId: string,
  question: string,
) => {
  await getSessionById(userId, sessionId);

  const [transcriptHistory, screenContext] = await Promise.all([
    
    prisma.transcript.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { speaker: true, text: true },
    }),
    
    prisma.screenContext.findFirst({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      select: {
        content: true,
        code: true,
        language: true,
        terminalOutput: true,
        errors: true,
      },
    }),
    
  ]);
  console.log('LATEST_SCREEN_CONTEXT', {
  // id: screenContext?.id,
  language: screenContext?.language,
  codeLength: screenContext?.code?.length,
  contentLength: screenContext?.content?.length,
  codePreview: screenContext?.code?.slice(0, 200),
})
  const analysisMode = detectAnalysisMode(question);
  const classification = await classifyQuestion(
    question,
    Boolean(screenContext?.code?.trim()),
  );
  const history = transcriptHistory
    .reverse()
    .map((item) => `${item.speaker}: ${item.text}`);
  const context = {
    question,
    latestTranscript: history[history.length - 1] ?? question,
    transcriptHistory: history,
    screenContext: screenContext?.content ?? '',
    screenCode: screenContext?.code ?? '',
    screenLanguage: screenContext?.language ?? '',
    terminalOutput: screenContext?.terminalOutput ?? '',
    screenErrors: screenContext?.errors ?? '',
    analysisMode,
  };
  const deterministic =
    analysisMode === 'OUTPUT'
      ? analyzeDeterministicOutput(context.screenCode, context.screenLanguage)
      : null;
  const generated = deterministic
      ? {
        provider: 'local',
        type: classification.type,
        question,
        answer: deterministic.answer,
        code: context.screenCode,
        output: deterministic.output,
        language: context.screenLanguage,
        complexity: deterministic.complexity,
        rootCause: '',
        fix: '',
        keyPoints: deterministic.keyPoints,
        confidence: deterministic.confidence,
        analysisMode,
        promptDebug:
          'Deterministic local output analysis used for a recognized safe JavaScript array map pattern.',
      }
    : await aiProvider.generateCopilotResponse(context, classification);

  console.info('[AI Prompt] generated', {
    provider: generated.provider,
    question,
    detectedLanguage: context.screenLanguage || 'unknown',
    hasCode: Boolean(context.screenCode.trim()),
    length: generated.promptDebug.length,
    sessionId,
  });

  return generated;
};

export const listSessionSuggestions = async (userId: string, sessionId: string) => {
  await getSessionById(userId, sessionId);
  return prisma.suggestion.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });
};
