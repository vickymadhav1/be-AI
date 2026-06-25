import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
import { AppError } from '../utils/app-error';

export interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

const missingRazorpayVariables = (): string[] => {
  const missing: string[] = [];
  if (!env.RAZORPAY_KEY_ID) missing.push('RAZORPAY_KEY_ID');
  if (!env.RAZORPAY_KEY_SECRET) missing.push('RAZORPAY_KEY_SECRET');
  return missing;
};

export const logRazorpayConfigStatus = (): void => {
  const missing = missingRazorpayVariables();
  console.info(`[Razorpay] Key ID Loaded: ${env.RAZORPAY_KEY_ID ? 'Yes' : 'No'}`);
  console.info(`[Razorpay] Key Secret Loaded: ${env.RAZORPAY_KEY_SECRET ? 'Yes' : 'No'}`);
  console.info(`[Razorpay] Environment: ${env.NODE_ENV}`);
  console.info('[Razorpay] Order Service Initialized');
  if (missing.length) {
    throw new Error(`Missing Razorpay configuration:\n\n${missing.join('\n')}`);
  }
};

const requireRazorpayConfig = () => {
  const missing = missingRazorpayVariables();
  if (missing.length) {
    throw new AppError(
      503,
      `Missing Razorpay configuration:\n\n${missing.join('\n')}`,
      'RAZORPAY_NOT_CONFIGURED',
      { missing },
    );
  }

  const keyId = env.RAZORPAY_KEY_ID!;
  const keySecret = env.RAZORPAY_KEY_SECRET!;

  return {
    keyId,
    keySecret,
  };
};

export const getRazorpayKeyId = (): string => requireRazorpayConfig().keyId;

export const createRazorpayOrder = async (input: {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}): Promise<RazorpayOrderResponse> => {
  const { keyId, keySecret } = requireRazorpayConfig();
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      receipt: input.receipt,
      notes: input.notes,
    }),
  });

  const payload = await response.json() as Partial<RazorpayOrderResponse> & {
    error?: { description?: string };
  };

  if (!response.ok || !payload.id || !payload.amount || !payload.currency) {
    throw new AppError(
      502,
      payload.error?.description ?? 'Razorpay order creation failed',
      'RAZORPAY_ORDER_FAILED',
      payload,
    );
  }

  return {
    id: payload.id,
    amount: payload.amount,
    currency: payload.currency,
    receipt: String(payload.receipt ?? input.receipt),
    status: String(payload.status ?? 'created'),
  };
};

export const verifyRazorpaySignature = (input: {
  orderId: string;
  paymentId: string;
  signature: string;
}): boolean => {
  const { keySecret } = requireRazorpayConfig();
  const expected = createHmac('sha256', keySecret)
    .update(`${input.orderId}|${input.paymentId}`)
    .digest('hex');

  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(input.signature);

  return expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer);
};
