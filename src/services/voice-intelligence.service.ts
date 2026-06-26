import type { QuestionClassification, QuestionType } from '../types/copilot';
import { classifyQuestion } from './question-classifier.service';
import { createSuggestionDraft } from './suggestion.service';
import { isQuestion } from '../utils/is-question';

export interface VoicePartialInput {
  userId: string;
  sessionId: string;
  text: string;
  source: 'system' | 'microphone' | 'unknown';
  confidence?: number;
}

export interface VoiceQuestionDraft {
  sessionId: string;
  question: string;
  source: 'voice';
  audioSource: VoicePartialInput['source'];
  classification: QuestionClassification;
  confidence: number;
  partial: boolean;
}

const typeRules: Array<{ type: QuestionType; pattern: RegExp }> = [
  { type: 'CODING_PROMPT', pattern: /\b(write|implement|create|solve|algorithm|function|program)\b/i },
  { type: 'DEBUGGING', pattern: /\b(debug|bug|fix|error|exception|wrong|failing)\b/i },
  { type: 'SYSTEM_DESIGN', pattern: /\b(system design|architecture|scale|distributed|load balancer)\b/i },
  { type: 'BEHAVIORAL', pattern: /\b(tell me about a time|conflict|leadership|challenge|strength|weakness)\b/i },
  { type: 'SQL', pattern: /\b(sql|query|join|database|index)\b/i },
  { type: 'CODING', pattern: /\b(code|javascript|typescript|react|node|array|string|closure|promise)\b/i },
];

export const looksLikeLiveQuestion = (text: string): boolean => {
  const normalized = text.trim();
  if (normalized.split(/\s+/).length < 3) return false;
  return isQuestion(normalized) || typeRules.some(({ pattern }) => pattern.test(normalized));
};

export const classifyLiveQuestion = async (
  text: string,
): Promise<QuestionClassification> => {
  const matched = typeRules.find(({ pattern }) => pattern.test(text));
  if (matched) return { type: matched.type, confidence: 0.84 };

  try {
    return await classifyQuestion(text);
  } catch {
    return { type: 'THEORY', confidence: 0.62 };
  }
};

export const createLiveVoiceQuestion = async (
  input: VoicePartialInput,
): Promise<VoiceQuestionDraft> => {
  const classification = await classifyLiveQuestion(input.text);
  return {
    sessionId: input.sessionId,
    question: input.text,
    source: 'voice',
    audioSource: input.source,
    classification,
    confidence: Math.max(0.4, Math.min(1, input.confidence ?? classification.confidence)),
    partial: true,
  };
};

export const createLiveVoiceSuggestion = async (input: VoicePartialInput) =>
  createSuggestionDraft(input.userId, input.sessionId, input.text);
