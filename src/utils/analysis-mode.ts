import type { AnalysisMode } from '../types/copilot';
import { getCodeAnalysisIntent } from '../services/output-analysis.service';

export const detectAnalysisMode = (question: string): AnalysisMode => {
  const codeIntent = getCodeAnalysisIntent(question);
  if (codeIntent.mode !== 'GENERAL') return codeIntent.mode;
  if (/\b(find (the )?bug|what('s| is) wrong|fix|failing|error|debug)\b/i.test(question)) {
    return 'BUG_FIX';
  }
  if (/\b(optimi[sz]e|improve this|better complexity|more efficient)\b/i.test(question)) {
    return 'OPTIMIZATION';
  }
  if (/\b(explain (this|the) (code|function|snippet)|line by line|walk me through)\b/i.test(question)) {
    return 'LINE_BY_LINE';
  }
  return 'GENERAL';
};
