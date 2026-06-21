const imperativeCodingPattern =
  /^(?:please\s+)?(?:map\s+(?:the\s+)?data|reverse\s+(?:a\s+|the\s+)?string|find\s+duplicates?|sort\s+(?:an?\s+|the\s+)?array|flatten\s+(?:an?\s+|the\s+)?array|implement\b|create\s+(?:a\s+)?function\b|write\s+(?:the\s+)?code\b|write\s+(?:a\s+)?program\b|predict\s+(?:the\s+)?output\b|solve\b|build\s+(?:a\s+)?function\b)/i;

export const isCodingPrompt = (text: string): boolean =>
  imperativeCodingPattern.test(text.trim());

export const extractCodingPrompt = (content: string): string =>
  content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => isCodingPrompt(line)) ?? '';
