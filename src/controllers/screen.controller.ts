import type { Request, Response } from 'express';
import { createSuggestion } from '../services/suggestion.service';
import {
  screenContextService,
} from '../services/screen-context.service';
import { emitToSession } from '../socket/realtime.gateway';
import { AppError } from '../utils/app-error';
import { sendSuccess } from '../utils/api-response';
import type { TextContextDto } from '../validators/screen.validator';
import { isQuestion } from '../utils/is-question';
import { prisma } from '../config/db';
import { resolveScreenIntelligenceQuestion } from '../services/screen-intelligence.service';

export const capture = async (request: Request, response: Response): Promise<void> => {
  if (!request.file) {
    throw new AppError(400, 'A screenshot is required', 'SCREENSHOT_REQUIRED');
  }

  const sessionId = String(request.body.sessionId);
  const result = await screenContextService.analyzeScreenshot(
    request.user!.id,
    sessionId,
    request.file.buffer,
    request.file.mimetype,
  );
  emitToSession(sessionId, 'screen:updated', result.context);

  let suggestion = null;
  let latestTranscript = '';
  let latestSuggestionQuestion = '';
  if (result.intelligenceChanged && !result.detectedQuestion.trim() && !result.context.codeDetected) {
    const [transcriptRecord, suggestionRecord] = await Promise.all([
      prisma.transcript.findFirst({
        where: { sessionId, speaker: 'interviewer' },
        orderBy: { createdAt: 'desc' },
        select: { text: true },
      }),
      prisma.suggestion.findFirst({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
        select: { question: true },
      }),
    ]);
    latestTranscript = transcriptRecord?.text || '';
    latestSuggestionQuestion = suggestionRecord?.question || '';
  }

  const activeQuestion = resolveScreenIntelligenceQuestion({
    detectedQuestion: result.detectedQuestion,
    codeDetected: result.context.codeDetected,
    errors: result.context.errors,
    terminalOutput: result.context.terminalOutput,
    latestTranscript,
    latestSuggestionQuestion,
  });

  if (result.intelligenceChanged && activeQuestion) {
    emitToSession(sessionId, 'question:detected', {
      question: activeQuestion,
      source: 'screen',
    });
    suggestion = await createSuggestion(
      request.user!.id,
      sessionId,
      activeQuestion,
    );
    emitToSession(sessionId, 'answer:generated', suggestion);
  }

  sendSuccess(response, 201, { ...result, suggestion });
};

export const addTextContext = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const input = request.body as TextContextDto;
  const context = await screenContextService.storeTextContext(
    request.user!.id,
    input.sessionId,
    input.source,
    input.content,
  );
  emitToSession(input.sessionId, 'screen:updated', context);

  let suggestion = null;
  if (isQuestion(input.content)) {
    emitToSession(input.sessionId, 'question:detected', {
      question: input.content,
      source: input.source,
    });
    suggestion = await createSuggestion(
      request.user!.id,
      input.sessionId,
      input.content,
    );
    emitToSession(input.sessionId, 'answer:generated', suggestion);
  }

  sendSuccess(response, 201, { context, suggestion });
};
