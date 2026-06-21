import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncController = (
  request: Request,
  response: Response,
  next: NextFunction,
) => Promise<void>;

// Keeps controller code focused on application behavior and forwards rejections centrally.
export const asyncHandler = (controller: AsyncController): RequestHandler => {
  return (request, response, next) => {
    void controller(request, response, next).catch(next);
  };
};
