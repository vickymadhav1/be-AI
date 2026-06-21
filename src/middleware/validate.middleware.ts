import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

export interface RequestSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export const validateRequest =
  (schemas: RequestSchemas) =>
  (request: Request, _response: Response, next: NextFunction): void => {
    try {
      if (schemas.body) {
        request.body = schemas.body.parse(request.body);
      }

      if (schemas.params) {
        request.params = schemas.params.parse(request.params) as typeof request.params;
      }

      if (schemas.query) {
        request.query = schemas.query.parse(request.query) as typeof request.query;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
