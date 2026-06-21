import type { Request, Response } from 'express';
import { createAccessToken } from '../services/token.service';
import { AppError } from '../utils/app-error';

export const exchangeFirebaseToken = (request: Request, response: Response): void => {
  if (!request.firebase) {
    throw new AppError(
      401,
      'Firebase authentication was not completed',
      'FIREBASE_AUTH_INCOMPLETE',
    );
  }

  const user = request.firebase.user;
  const token = createAccessToken(user);

  response.status(200).json({
    success: true,
    user,
    token,
  });
};
