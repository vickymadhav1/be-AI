import type { Response } from 'express';

export const sendSuccess = <T>(
  response: Response,
  statusCode: number,
  data: T,
  message?: string,
): void => {
  response.status(statusCode).json({
    success: true,
    ...(message ? { message } : {}),
    data,
  });
};
