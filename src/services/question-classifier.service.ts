import type { QuestionClassification, QuestionType } from '../types/copilot';
import { aiProvider } from './ai';
import { getCodeAnalysisIntent } from './output-analysis.service';
import { isCodingPrompt } from '../utils/coding-prompt';

const rules: Array<{ type: QuestionType; pattern: RegExp }> = [
  {
    type: 'CODING_PROMPT',
    pattern: /\b(map the data|reverse (a |the )?string|find duplicates?|sort (an? |the )?array|flatten (an? |the )?array|implement|create (a )?function|write (the )?code|write (a )?program|predict (the )?output)\b/i,
  },
  {
    type: 'DEBUGGING',
    pattern: /\b(find (the )?bug|fix (this|the) code|what('s| is) wrong|why is this failing|stack trace|exception|error|debug)\b/i,
  },
  {
    type: 'SQL',
    pattern: /\b(sql|query|join|select|database query|group by|stored procedure|index)\b/i,
  },
  {
    type: 'SYSTEM_DESIGN',
    pattern: /\b(system design|design a|scalable|architecture|load balancer|distributed|high availability)\b/i,
  },
  {
    type: 'SYNTAX',
    pattern: /\b(syntax|useeffect|hook syntax|declaration syntax|how to declare)\b/i,
  },
  {
    type: 'CODING',
    pattern:
      /\b(write (a )?(code|program|function)|implement|create (a )?function|algorithm|fibonacci|reverse string|javascript code|react component|coding solution|solve this|what (will|does|is) (this|the|it)( code)? (print|output)|what is the output|explain (this|the) (code|function|snippet)|optimi[sz]e (this|it)|improve (this|it))\b/i,
  },
  {
    type: 'BEHAVIORAL',
    pattern: /\b(tell me about a time|describe a time|conflict|leadership|strength|weakness|challenge)\b/i,
  },
];

export const classifyQuestion = async (
  question: string,
  hasVisibleCode = false,
): Promise<QuestionClassification> => {
  if (isCodingPrompt(question)) {
    return { type: 'CODING_PROMPT', confidence: 0.99 };
  }
  if (hasVisibleCode) {
    const intent = getCodeAnalysisIntent(question);
    if (intent.type) return { type: intent.type, confidence: 0.99 };
    if (/\b(find (the )?bug|what('s| is) wrong|fix|failing|error|debug)\b/i.test(question)) {
      return { type: 'DEBUGGING', confidence: 0.99 };
    }
    if (/\b(syntax|write syntax|show syntax)\b/i.test(question)) {
      return { type: 'SYNTAX', confidence: 0.99 };
    }
    if (/\b(write|create|implement|solve|explain|this code|this function|this snippet|this query)\b/i.test(question)) {
      return { type: 'CODING', confidence: 0.99 };
    }
  }
  const matched = rules.find(({ pattern }) => pattern.test(question));

  if (matched) {
    return { type: matched.type, confidence: 0.98 };
  }

  return aiProvider.classifyQuestion(question);
};
