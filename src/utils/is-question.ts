const questionStarters =
  /^(how|what|why|when|where|who|which|can|could|would|will|do|does|did|is|are|have|has|tell me( about)?|can you explain|how would you|what happens if|output of|explain|describe|difference between|create|write|implement|build|design|solve|fix( this code)?|find (the )?bug|debug( this)?|show me|walk me through|give me|compare|define|demonstrate)\b/i;

export const isQuestion = (text: string): boolean => {
  const normalized = text.trim();
  return normalized.endsWith('?') || questionStarters.test(normalized) || isCodingPrompt(normalized);
};
import { isCodingPrompt } from './coding-prompt';
