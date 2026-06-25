import { z } from 'zod';

export const createInvisibleOrderSchema = z.object({
  planId: z.string().trim().min(1).optional(),
});

export const verifyInvisiblePaymentSchema = z.object({
  razorpayOrderId: z.string().trim().min(1),
  razorpayPaymentId: z.string().trim().min(1),
  razorpaySignature: z.string().trim().min(1),
});

export const failInvisiblePaymentSchema = z.object({
  razorpayOrderId: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(500).default('Payment failed or cancelled'),
});

export const deductInvisibleCreditsSchema = z.object({
  minutes: z.number().int().positive().max(60).default(1),
});

export const invisibleProtectionSchema = z.object({
  enabled: z.boolean(),
});

export type CreateInvisibleOrderDto = z.infer<typeof createInvisibleOrderSchema>;
export type VerifyInvisiblePaymentDto = z.infer<typeof verifyInvisiblePaymentSchema>;
export type FailInvisiblePaymentDto = z.infer<typeof failInvisiblePaymentSchema>;
export type DeductInvisibleCreditsDto = z.infer<typeof deductInvisibleCreditsSchema>;
export type InvisibleProtectionDto = z.infer<typeof invisibleProtectionSchema>;
