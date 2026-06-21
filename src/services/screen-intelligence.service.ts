interface ScreenIntelligenceInput {
  detectedQuestion: string;
  codeDetected: boolean;
  errors: string;
  terminalOutput: string;
  latestTranscript: string;
  latestSuggestionQuestion: string;
}

/**
 * Applies the copilot context priority:
 * visible question -> visible code -> visible errors/output -> spoken context.
 */
export const resolveScreenIntelligenceQuestion = (
  input: ScreenIntelligenceInput,
): string => {
  if (input.detectedQuestion.trim()) return input.detectedQuestion.trim();

  if (input.codeDetected) {
    return 'Analyze the visible code without a spoken question. Predict the output if determinable, explain its behavior and complexity, identify potential bugs and optimizations, and list likely interview questions as key points.';
  }

  if (input.errors.trim() || input.terminalOutput.trim()) {
    return 'Analyze the visible error or terminal output. Explain the root cause and provide the most likely fix using the visible context.';
  }

  return input.latestTranscript.trim() || input.latestSuggestionQuestion.trim();
};
