export const questionTypes = [
  'THEORY',
  'CODING',
  'CODING_PROMPT',
  'SYNTAX',
  'DEBUGGING',
  'SYSTEM_DESIGN',
  'SQL',
  'BEHAVIORAL',
  'OUTPUT',
  'OPTIMIZATION',
] as const;

export type QuestionType = (typeof questionTypes)[number];

export const analysisModes = [
  'GENERAL',
  'OUTPUT',
  'BUG_FIX',
  'OPTIMIZATION',
  'LINE_BY_LINE',
] as const;

export type AnalysisMode = (typeof analysisModes)[number];

export interface QuestionClassification {
  type: QuestionType;
  confidence: number;
}

export interface CopilotContext {
  question: string;
  latestTranscript: string;
  transcriptHistory: string[];
  screenContext: string;
  screenCode: string;
  screenLanguage: string;
  terminalOutput: string;
  screenErrors: string;
  analysisMode: AnalysisMode;
}

export interface CopilotResponse {
  provider: string;
  type: QuestionType;
  question: string;
  answer: string;
  code: string;
  output: string;
  language: string;
  complexity: string;
  rootCause: string;
  fix: string;
  keyPoints: string[];
  confidence: number;
  analysisMode: AnalysisMode;
  promptDebug: string;
}

export interface ScreenAnalysis {
  content: string;
  code: string;
  language: string;
  terminalOutput: string;
  errors: string;
  detectedQuestion: string;
  codeDetected: boolean;
}
