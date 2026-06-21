import { Router } from 'express';
import { exchangeFirebaseToken } from '../controllers/auth.controller';
import { authenticateFirebase } from '../middleware/firebase-auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { firebaseAuthSchema } from '../validators/auth.validator';

export const authRouter = Router();

authRouter.post(
  '/firebase',
  validateRequest({ body: firebaseAuthSchema }),
  authenticateFirebase,
  exchangeFirebaseToken,
);
