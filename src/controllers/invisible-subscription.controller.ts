import type { Request, Response } from 'express';
import { sendSuccess } from '../utils/api-response';
import {
  createInvisibleSubscriptionOrder,
  deductInvisibleCredits,
  getInvisibleSubscriptionStatus,
  markInvisiblePaymentFailed,
  verifyInvisibleProtectionAccess,
  verifyInvisibleSubscriptionPayment,
} from '../services/invisible-subscription.service';
import type {
  CreateInvisibleOrderDto,
  DeductInvisibleCreditsDto,
  FailInvisiblePaymentDto,
  InvisibleProtectionDto,
  VerifyInvisiblePaymentDto,
} from '../validators/invisible-subscription.validator';

export const getStatus = async (request: Request, response: Response): Promise<void> => {
  sendSuccess(
    response,
    200,
    await getInvisibleSubscriptionStatus(request.user!.id),
  );
};

export const createOrder = async (request: Request, response: Response): Promise<void> => {
  const input = request.body as CreateInvisibleOrderDto;
  sendSuccess(
    response,
    201,
    await createInvisibleSubscriptionOrder(request.user!.id, input.planId),
    'Razorpay order created',
  );
};

export const verifyPayment = async (request: Request, response: Response): Promise<void> => {
  sendSuccess(
    response,
    200,
    await verifyInvisibleSubscriptionPayment(
      request.user!.id,
      request.body as VerifyInvisiblePaymentDto,
    ),
    'Payment verified',
  );
};

export const failPayment = async (request: Request, response: Response): Promise<void> => {
  const input = request.body as FailInvisiblePaymentDto;
  sendSuccess(
    response,
    200,
    await markInvisiblePaymentFailed(request.user!.id, input.razorpayOrderId, input.reason),
    'Payment marked as failed',
  );
};

export const deductCredits = async (request: Request, response: Response): Promise<void> => {
  const input = request.body as DeductInvisibleCreditsDto;
  sendSuccess(
    response,
    200,
    await deductInvisibleCredits(request.user!.id, input.minutes),
    'Invisible credits deducted',
  );
};

export const setProtection = async (request: Request, response: Response): Promise<void> => {
  const input = request.body as InvisibleProtectionDto;
  sendSuccess(
    response,
    200,
    await verifyInvisibleProtectionAccess(request.user!.id, input.enabled),
    input.enabled ? 'Invisible protection enabled' : 'Invisible protection disabled',
  );
};
