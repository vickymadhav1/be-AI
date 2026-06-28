import type { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { FirebaseAuthError } from 'firebase-admin/auth';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { ZodError } from 'zod';
import { AppError } from '../utils/app-error';

export const notFoundHandler = (request: Request, response: Response): void => {
  response.status(404).json({
    success: false,
    message: `Route ${request.method} ${request.originalUrl} was not found`,
  });
};

// Express recognizes error middleware by its four-argument signature.
export const errorHandler = (
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction,
): void => {
  if (error instanceof ZodError) {
    response.status(400).json({
      success: false,
      message: 'Request validation failed',
      errors: error.issues,
    });
    return;
  }

  if (error instanceof AppError) {
    response.status(error.statusCode).json({
      success: false,
      message: error.message,
      ...(error.code ? { code: error.code } : {}),
      ...(error.details ? { details: error.details } : {}),
    });
    return;
  }

  if (error instanceof FirebaseAuthError) {
    response.status(401).json({
      success: false,
      message: 'The Firebase ID token is invalid, expired, or revoked',
    });
    return;
  }

  if (error instanceof TokenExpiredError || error instanceof JsonWebTokenError) {
    response.status(401).json({
      success: false,
      message: 'The access token is invalid or expired',
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    response.status(409).json({
      success: false,
      message: 'A user with this unique account information already exists',
    });
    return;
  }

  const requestLogger = response.locals.logger as
    | { error: (message: unknown, ...details: unknown[]) => void }
    | undefined;
  (requestLogger ?? console).error('Unhandled HTTP request error', error);

  response.status(500).json({
    success: false,
    message: 'An unexpected server error occurred',
  });
};
