import type { Request, Response } from 'express';
import { getUserCredits, getUserProfile } from '../services/user.service';
import { AppError } from '../utils/app-error';
import { sendSuccess } from '../utils/api-response';

const requireUserId = (request: Request): string => {
  if (!request.user) {
    throw new AppError(401, 'Authentication is required', 'AUTH_REQUIRED');
  }

  return request.user.id;
};

export const getProfile = async (request: Request, response: Response): Promise<void> => {
  const user = await getUserProfile(requireUserId(request));
  sendSuccess(response, 200, user);
};

export const getCredits = async (request: Request, response: Response): Promise<void> => {
  const credits = await getUserCredits(requireUserId(request));

  response.status(200).json({
    success: true,
    credits,
  });
};
