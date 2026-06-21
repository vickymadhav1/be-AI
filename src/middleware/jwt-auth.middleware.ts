import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../config/db';
import { verifyAccessToken } from '../services/token.service';
import { AppError } from '../utils/app-error';

const getBearerToken = (authorization?: string): string | null => {
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim() || null;
};

export const authenticateJwt = async (
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const token = getBearerToken(request.headers.authorization);

    if (!token) {
      throw new AppError(401, 'An access token is required', 'ACCESS_TOKEN_REQUIRED');
    }

    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user) {
      throw new AppError(
        401,
        'The user for this access token no longer exists',
        'ACCESS_TOKEN_USER_NOT_FOUND',
      );
    }

    request.auth = payload;
    request.user = user;
    next();
  } catch (error) {
    next(error);
  }
};
