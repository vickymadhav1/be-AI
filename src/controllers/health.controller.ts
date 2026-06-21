import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/db';
import { aiOrchestrator } from '../services/ai';

export const getHealth = async (
  _request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    // A real query ensures the API does not report healthy while Neon is unavailable.
    await prisma.$queryRaw`SELECT 1`;

    response.status(200).json({
      status: 'ok',
      database: 'connected',
      aiProviders: aiOrchestrator.getProviderStatuses(),
    });
  } catch (error) {
    next(Object.assign(new Error('Database connection failed'), { statusCode: 503, cause: error }));
  }
};

export const getAiHealth = async (
  _request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    response.status(200).json({
      status: 'ok',
      aiProviders: await aiOrchestrator.healthCheck(),
    });
  } catch (error) {
    next(error);
  }
};
