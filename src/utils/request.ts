import type { Request } from 'express';
import { AppError } from './app-error';

export const getRouteParam = (request: Request, name: string): string => {
  const value = request.params[name];

  if (typeof value !== 'string' || !value) {
    throw new AppError(400, `Route parameter "${name}" is required`, 'INVALID_ROUTE_PARAM');
  }

  return value;
};
