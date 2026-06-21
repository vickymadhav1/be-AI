import type { AnalysisMode, QuestionType } from '../types/copilot';

const outputPattern =
  /\b(what is (the )?(output|result)|what happens|what will (this|it|the code) print|output of this|result of (the )?given code|predict (the )?output|expected output|what does (this|it) return)\b/i;

const optimizationPattern =
  /\b(optimi[sz]e|improve this|improve the solution|better complexity|more efficient)\b/i;

export const getCodeAnalysisIntent = (
  question: string,
): { mode: AnalysisMode; type?: QuestionType } => {
  if (outputPattern.test(question)) {
    return { mode: 'OUTPUT', type: 'OUTPUT' };
  }
  if (optimizationPattern.test(question)) {
    return { mode: 'OPTIMIZATION', type: 'OPTIMIZATION' };
  }
  return { mode: 'GENERAL' };
};
