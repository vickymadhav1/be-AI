import type { NextFunction, Request, Response } from 'express';
import { createCorrelationId, logger } from '../utils/logger';

const safeHeader = (value: string | string[] | undefined) =>
  typeof value === 'string' && value.length <= 128 ? value : undefined;

export const requestContext = (request: Request, response: Response, next: NextFunction): void => {
  const requestId = safeHeader(request.headers['x-request-id']) ?? createCorrelationId();
  const sessionId = safeHeader(request.headers['x-session-id']);
  const lifecycleId = safeHeader(request.headers['x-lifecycle-id']);
  const requestLogger = logger.child({ requestId, sessionId, lifecycleId });
  const startedAt = performance.now();

  response.setHeader('X-Request-ID', requestId);
  response.on('finish', () => {
    requestLogger.info('HTTP request completed', {
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      durationMs: Math.round(performance.now() - startedAt),
    });
  });
  response.locals.requestId = requestId;
  response.locals.logger = requestLogger;
  next();
};
