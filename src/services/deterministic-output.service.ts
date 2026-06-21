interface DeterministicOutput {
  answer: string;
  output: string;
  complexity: string;
  keyPoints: string[];
  confidence: number;
}

const applyOperation = (
  value: number,
  operator: string,
  operand: number,
): number | null => {
  if (operator === '+') return value + operand;
  if (operator === '-') return value - operand;
  if (operator === '*') return value * operand;
  if (operator === '/' && operand !== 0) return value / operand;
  return null;
};

/**
 * Handles a small set of common interview snippets without executing arbitrary
 * screen-captured code. This also provides a useful fallback during AI limits.
 */
export const analyzeDeterministicOutput = (
  code: string,
  language: string,
): DeterministicOutput | null => {
  if (!/JavaScript|TypeScript|React|Vue|Node\.js/i.test(language)) return null;

  const arrayMatch = code.match(
    /(?:const|let|var)\s+(\w+)\s*=\s*\[\s*([-+.\d,\s]+)\s*\]/,
  );
  if (!arrayMatch) return null;

  const variableName = arrayMatch[1]!;
  const values = arrayMatch[2]!
    .split(',')
    .map((value) => Number(value.trim()));
  if (!values.length || values.some((value) => !Number.isFinite(value))) return null;

  const escapedVariable = variableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mapMatch = code.match(
    new RegExp(
      `${escapedVariable}\\.map\\(\\s*(\\w+)\\s*=>\\s*\\1\\s*([+\\-*/])\\s*(-?\\d+(?:\\.\\d+)?)\\s*\\)`,
    ),
  );
  if (!mapMatch) return null;

  const operator = mapMatch[2]!;
  const operand = Number(mapMatch[3]);
  const output = values.map((value) => applyOperation(value, operator, operand));
  if (output.some((value) => value === null)) return null;

  const explanation: Record<string, string> = {
    '+': `adds ${operand} to`,
    '-': `subtracts ${operand} from`,
    '*': `multiplies`,
    '/': `divides`,
  };
  const operationDescription =
    operator === '*'
      ? `multiplies each element by ${operand}`
      : operator === '/'
        ? `divides each element by ${operand}`
        : `${explanation[operator]} each element`;

  return {
    output: JSON.stringify(output),
    answer: `map() returns a new array where the callback ${operationDescription}.`,
    complexity: 'Time: O(n). Space: O(n) for the new mapped array.',
    keyPoints: [
      'map() does not mutate the original array.',
      `The callback applies "${operator} ${operand}" to every element.`,
      'A likely follow-up is how map() differs from forEach().',
    ],
    confidence: 0.99,
  };
};
