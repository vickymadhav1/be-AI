const codeSignals =
  /\b(function|func|package|const|let|var|class|import|export|SELECT|CREATE\s+TABLE|public\s+static|def|interface|async|await|return|using\s+System)\b|console\s*\.\s*log|fmt\s*\.\s*Print|=\s*>|[{}]/i;

export const containsCode = (content: string): boolean => codeSignals.test(content);

const codeLine =
  /\b(function|func|package|const|let|var|class|import|export|return|if|else|for|while|SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE|public\s+static|def|interface|async|await)\b|console\s*\.\s*log|fmt\s*\.\s*Print|=\s*>|[{}[\]();]/i;

/**
 * Pulls code-like lines out of noisy OCR while retaining braces and continuation
 * lines between the first and last strong code signal.
 */
export const extractCode = (content: string): string => {
  const lines = content
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .split(/\r?\n/)
    .map((line) => line.trimEnd());
  const indexes = lines
    .map((line, index) => (codeLine.test(line) ? index : -1))
    .filter((index) => index >= 0);

  if (indexes.length === 0) return '';

  const first = Math.max(0, indexes[0]! - 1);
  const last = Math.min(lines.length - 1, indexes[indexes.length - 1]! + 1);
  return lines
    .slice(first, last + 1)
    .filter((line) => line.trim() && (codeLine.test(line) || /^[\s)}\],.]+$/.test(line)))
    .join('\n')
    .trim();
};

const languageSignals: Array<{ language: string; patterns: RegExp[] }> = [
  { language: 'SQL', patterns: [/\b(SELECT|INSERT|UPDATE|DELETE|CREATE\s+TABLE|JOIN|GROUP\s+BY)\b/i, /\bFROM\s+[\w.]+/i] },
  { language: 'Java', patterns: [/\bpublic\s+static\s+void\s+main\b/, /System\.out\.println/, /\b(extends|implements)\b/] },
  { language: 'C#', patterns: [/\busing\s+System\b/, /Console\.WriteLine/, /\bnamespace\s+\w+/] },
  { language: 'Go', patterns: [/\bpackage\s+main\b/, /\bfunc\s+\w+\s*\(/, /fmt\.Print/, /\bgo\s+\w+\s*\(/] },
  { language: 'Python', patterns: [/\bdef\s+\w+\s*\(/, /\bprint\s*\(/, /\belif\b/, /\bfrom\s+\w+\s+import\b/, /:\s*(?:#.*)?$/m] },
  { language: 'Vue', patterns: [/<template[\s>]/, /<script\s+setup/, /\bdefineComponent\b/, /\b(ref|computed)\s*\(/, /\bv-(?:if|for|model)\b/] },
  { language: 'react', patterns: [/\b(useState|useEffect|useMemo|useCallback)\s*\(/, /\bReact\./, /\bcreateRoot\s*\(/, /from\s+['"]react['"]/, /(?:const|function)\s+[A-Z]\w*[^\n]*(?:=>|\()[\s\S]{0,200}return\s*\(\s*</, /return\s*\(\s*</] },
  { language: 'TypeScript', patterns: [/\binterface\s+\w+/, /\btype\s+\w+\s*=/, /:\s*(?:string|number|boolean|unknown|never)\b/, /\bas\s+const\b/, /<\w+(?:,\s*\w+)*>/] },
  { language: 'Node.js', patterns: [/\brequire\s*\(/, /\bmodule\.exports\b/, /\bprocess\.env\b/, /\bexpress\s*\(/, /\bnode:/] },
  { language: 'HTML', patterns: [/<(?:html|head|body|div|section|form|button)[\s>]/i, /<!DOCTYPE\s+html>/i] },
  { language: 'CSS', patterns: [/[.#][\w-]+\s*\{[^}]*\}/s, /\b(?:display|color|margin|padding|font-size)\s*:/] },
  { language: 'JavaScript', patterns: [/\b(function|const|let|var)\b/, /console\s*\.\s*log/, /=\s*>/, /\b(?:map|filter|reduce)\s*\(/] },
];

export const detectLanguageDetails = (content: string): { language: string; confidence: number } => {
  const reactSignals = [
    /from\s+['"]react['"]/,
    /\bReact\./,
    /\b(useState|useEffect|useMemo|useCallback)\s*\(/,
    /\bcreateRoot\s*\(/,
  ].filter((pattern) => pattern.test(content)).length;
  if (reactSignals > 0) {
    return { language: 'react', confidence: Math.min(0.99, 0.82 + reactSignals * 0.05) };
  }

  const scored = languageSignals
    .map(({ language, patterns }) => ({
      language,
      matches: patterns.filter((pattern) => pattern.test(content)).length,
      total: patterns.length,
    }))
    .filter(({ matches }) => matches > 0)
    .sort((a, b) => (b.matches / b.total) - (a.matches / a.total) || b.matches - a.matches);

  const best = scored[0];
  if (!best) return { language: '', confidence: 0 };
  return {
    language: best.language,
    confidence: Math.min(0.99, 0.55 + (best.matches / best.total) * 0.44),
  };
};

export const detectLanguage = (content: string): string => detectLanguageDetails(content).language;
