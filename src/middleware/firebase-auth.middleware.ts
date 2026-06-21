import type { NextFunction, Request, Response } from 'express';
import { firebaseAuth } from '../config/firebase';
import { findOrCreateFirebaseUser } from '../services/user.service';
import { AppError } from '../utils/app-error';

const getBearerToken = (authorization?: string): string | null => {
  if (!authorization?.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim() || null;
};

export const authenticateFirebase = async (
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const bodyToken =
      typeof request.body?.idToken === 'string' ? request.body.idToken.trim() : null;
    const idToken = bodyToken || getBearerToken(request.headers.authorization);

    if (!idToken) {
      throw new AppError(
        401,
        'A Firebase ID token is required in the request body or Authorization header',
        'FIREBASE_TOKEN_REQUIRED',
      );
    }

    // checkRevoked=true rejects tokens for disabled users and revoked sessions.
    const decodedToken = await firebaseAuth.verifyIdToken(idToken, true);
    const user = await findOrCreateFirebaseUser(decodedToken);

    request.firebase = {
      firebaseUid: decodedToken.uid,
      email: user.email,
      name: user.name,
      photo: user.photo,
      user,
    };

    next();
  } catch (error) {
    next(error);
  }
};
