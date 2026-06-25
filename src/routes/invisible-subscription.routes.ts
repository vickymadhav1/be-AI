import { Router } from 'express';
import {
  createOrder,
  deductCredits,
  failPayment,
  getStatus,
  setProtection,
  verifyPayment,
} from '../controllers/invisible-subscription.controller';
import { authenticateJwt } from '../middleware/jwt-auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/async-handler';
import {
  createInvisibleOrderSchema,
  deductInvisibleCreditsSchema,
  failInvisiblePaymentSchema,
  invisibleProtectionSchema,
  verifyInvisiblePaymentSchema,
} from '../validators/invisible-subscription.validator';

export const invisibleSubscriptionRouter = Router();

invisibleSubscriptionRouter.use(authenticateJwt);
invisibleSubscriptionRouter.get('/subscription', asyncHandler(getStatus));
invisibleSubscriptionRouter.post(
  '/orders',
  validateRequest({ body: createInvisibleOrderSchema }),
  asyncHandler(createOrder),
);
invisibleSubscriptionRouter.post(
  '/payments/verify',
  validateRequest({ body: verifyInvisiblePaymentSchema }),
  asyncHandler(verifyPayment),
);
invisibleSubscriptionRouter.post(
  '/payments/fail',
  validateRequest({ body: failInvisiblePaymentSchema }),
  asyncHandler(failPayment),
);
invisibleSubscriptionRouter.post(
  '/credits/deduct',
  validateRequest({ body: deductInvisibleCreditsSchema }),
  asyncHandler(deductCredits),
);
invisibleSubscriptionRouter.post(
  '/protection',
  validateRequest({ body: invisibleProtectionSchema }),
  asyncHandler(setProtection),
);
