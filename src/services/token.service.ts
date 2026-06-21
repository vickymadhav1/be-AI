import jwt, { JsonWebTokenError, type SignOptions } from 'jsonwebtoken';
import type { User } from '@prisma/client';
import { env } from '../config/env';
import type { JwtPayload } from '../types/auth';

export const createAccessToken = (user: User): string => {
  const payload: Omit<JwtPayload, 'sub'> = {
    firebaseUid: user.firebaseUid,
    email: user.email,
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: 'interview-mate-ai',
    audience: 'interview-mate-ai-web',
  });
};

export const verifyAccessToken = (token: string): JwtPayload => {
  const payload = jwt.verify(token, env.JWT_SECRET, {
    issuer: 'interview-mate-ai',
    audience: 'interview-mate-ai-web',
  });

  if (
    typeof payload === 'string' ||
    typeof payload.sub !== 'string' ||
    typeof payload.firebaseUid !== 'string' ||
    typeof payload.email !== 'string'
  ) {
    throw new JsonWebTokenError('Access token payload is invalid');
  }

  return payload as JwtPayload;
};
