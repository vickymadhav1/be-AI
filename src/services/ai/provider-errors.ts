import { AppError } from '../../utils/app-error';

const retryableCodes = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_BODY_TIMEOUT',
]);

export const getProviderErrorStatus = (error: unknown): number | undefined => {
  const candidate = error as {
    status?: number;
    statusCode?: number;
    response?: { status?: number };
  };
  return candidate.status ?? candidate.statusCode ?? candidate.response?.status;
};

export const getProviderErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  return String(error);
};

export const isProviderRetryableError = (error: unknown): boolean => {
  const status = getProviderErrorStatus(error);
  const message = getProviderErrorMessage(error).toLowerCase();
  const code = (error as { code?: string }).code;

  if (status === 429 || (status !== undefined && status >= 500)) return true;
  if (code && retryableCodes.has(code)) return true;

  return (
    message.includes('quota exceeded') ||
    message.includes('rate limit exceeded') ||
    message.includes('rate_limit') ||
    message.includes('timeout') ||
    message.includes('network') ||
    message.includes('fetch failed') ||
    message.includes('socket hang up')
  );
};

export const providerUnavailableError = (message: string, details?: unknown) =>
  new AppError(503, message, 'AI_PROVIDER_UNAVAILABLE', details);
