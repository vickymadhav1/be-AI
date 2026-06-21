import type {
  CopilotContext,
  CopilotResponse,
  QuestionClassification,
  ScreenAnalysis,
} from '../../types/copilot';

export interface AIProvider {
  generateInterviewAnswer(question: string): Promise<string>;
  generateKeyPoints(question: string): Promise<string[]>;
  generateConfidence(question: string): Promise<number>;
  classifyQuestion(question: string): Promise<QuestionClassification>;
  generateCopilotResponse(
    context: CopilotContext,
    classification: QuestionClassification,
  ): Promise<CopilotResponse>;
  generateAnswer(
    context: CopilotContext,
    classification: QuestionClassification,
  ): Promise<CopilotResponse>;
  generateCode(
    context: CopilotContext,
    classification: QuestionClassification,
  ): Promise<CopilotResponse>;
  generateDebugSolution(
    context: CopilotContext,
    classification: QuestionClassification,
  ): Promise<CopilotResponse>;
  generateOutputPrediction(
    context: CopilotContext,
    classification: QuestionClassification,
  ): Promise<CopilotResponse>;
  analyzeScreen(image: Buffer, mimeType: string): Promise<ScreenAnalysis>;
}
