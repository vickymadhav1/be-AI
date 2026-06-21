export type ProviderName = 'groq' | 'gemini' | 'openrouter' | 'together' | 'huggingface';

export type ProviderHealthStatus =
  | 'healthy'
  | 'invalid_key'
  | 'rate_limited'
  | 'offline'
  | 'disabled';

export const sanitizeApiKey = (value?: string): string | undefined => {
  if (!value) return undefined;
  const cleaned = value
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/,+$/g, '')
    .trim();
  return cleaned || undefined;
};

const keyPatterns: Record<ProviderName, RegExp> = {
  groq: /^gsk_[A-Za-z0-9_-]{20,}$/,
  gemini: /^AIza[A-Za-z0-9_-]{20,}$/,
  openrouter: /^sk-or-v1-[A-Za-z0-9_-]{20,}$/,
  together: /^(?:key_|tgp_v1_)[A-Za-z0-9_-]{16,}$/,
  huggingface: /^hf_[A-Za-z0-9]{20,}$/,
};

export const validateProviderKey = (
  provider: ProviderName,
  rawValue?: string,
): { key?: string; valid: boolean; reason?: string } => {
  const key = sanitizeApiKey(rawValue);
  if (!key) return { valid: false, reason: 'Missing API key' };
  if (!keyPatterns[provider].test(key)) {
    return { valid: false, reason: 'Malformed API key' };
  }
  return { key, valid: true };
};
