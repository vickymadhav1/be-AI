import { Router } from 'express';
import { getCredits, getProfile } from '../controllers/user.controller';
import { authenticateJwt } from '../middleware/jwt-auth.middleware';
import { asyncHandler } from '../utils/async-handler';

export const userRouter = Router();

userRouter.use(authenticateJwt);
userRouter.get('/profile', asyncHandler(getProfile));
userRouter.get('/me', asyncHandler(getProfile));
userRouter.get('/credits', asyncHandler(getCredits));
