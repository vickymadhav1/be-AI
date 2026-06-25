import { prisma } from '../config/db';
import { AppError } from '../utils/app-error';
import { getInvisiblePlan, listInvisiblePlans } from './invisible-plan.service';
import {
  createRazorpayOrder,
  getRazorpayKeyId,
  verifyRazorpaySignature,
} from './razorpay.service';

const deriveStatus = async (subscription: Awaited<ReturnType<typeof findLatestSubscription>>) => {
  if (!subscription) return null;
  const normalizedStatus = subscription.remainingCredits > 0 ? 'active' : 'exhausted';
  if (subscription.status !== normalizedStatus) {
    return prisma.invisibleSubscription.update({
      where: { id: subscription.id },
      data: { status: normalizedStatus },
    });
  }
  return subscription;
};

const findLatestSubscription = (userId: string) =>
  prisma.invisibleSubscription.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

const findLatestPayment = (userId: string) =>
  prisma.paymentRecord.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

const serializeSubscription = async (userId: string) => {
  const plan = getInvisiblePlan();
  const subscription = await deriveStatus(await findLatestSubscription(userId));
  const latestPayment = await findLatestPayment(userId);
  const pendingPayment = latestPayment?.status === 'pending' ? latestPayment : null;
  const active = subscription?.status === 'active';
  const remainingCredits = subscription?.remainingCredits ?? 0;
  const status =
    subscription?.status ??
    (pendingPayment ? 'pending' : latestPayment?.status === 'failed' ? 'failed' : 'inactive');

  return {
    active,
    status,
    plan,
    plans: listInvisiblePlans(),
    totalCredits: subscription?.totalCredits ?? 0,
    remainingCredits,
    creditsUsed: subscription?.creditsUsed ?? 0,
    totalMinutes: subscription ? subscription.totalCredits / plan.creditsPerMinute : plan.totalCredits / plan.creditsPerMinute,
    remainingMinutes: remainingCredits / plan.creditsPerMinute,
    creditsPerMinute: subscription?.creditsPerMinute ?? plan.creditsPerMinute,
    purchaseDate: subscription?.purchaseDate ?? null,
    lastUsedAt: subscription?.lastUsedAt ?? null,
    paymentId: subscription?.paymentId ?? latestPayment?.razorpayPaymentId ?? null,
    orderId: subscription?.orderId ?? latestPayment?.razorpayOrderId ?? null,
  };
};

export const getInvisibleSubscriptionStatus = (userId: string) => {
  return serializeSubscription(userId);
};

export const createInvisibleSubscriptionOrder = async (userId: string, planId?: string) => {
  const plan = getInvisiblePlan(planId);
  const amountInPaise = plan.amount * 100;
  const order = await createRazorpayOrder({
    amount: amountInPaise,
    currency: plan.currency,
    receipt: `inv_${userId.slice(0, 12)}_${Date.now()}`,
    notes: { userId, planId: plan.id },
  });

  await prisma.paymentRecord.create({
    data: {
      userId,
      planId: plan.id,
      amount: plan.amount,
      currency: plan.currency,
      status: 'pending',
      razorpayOrderId: order.id,
    },
  });

  return {
    keyId: getRazorpayKeyId(),
    order,
    plan,
    subscription: await serializeSubscription(userId),
  };
};

export const markInvisiblePaymentFailed = async (
  userId: string,
  orderId: string,
  reason: string,
) => {
  await prisma.paymentRecord.updateMany({
    where: { userId, razorpayOrderId: orderId },
    data: { status: 'failed', failureReason: reason },
  });
  await prisma.invisibleSubscription.updateMany({
    where: { userId, orderId, status: 'pending' },
    data: { status: 'failed' },
  });
  return serializeSubscription(userId);
};

export const verifyInvisibleSubscriptionPayment = async (
  userId: string,
  input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
) => {
  const payment = await prisma.paymentRecord.findFirst({
    where: { userId, razorpayOrderId: input.razorpayOrderId },
  });

  if (!payment) {
    throw new AppError(404, 'Payment order was not found', 'PAYMENT_ORDER_NOT_FOUND');
  }

  if (payment.status === 'successful') {
    return serializeSubscription(userId);
  }

  if (!verifyRazorpaySignature({
    orderId: input.razorpayOrderId,
    paymentId: input.razorpayPaymentId,
    signature: input.razorpaySignature,
  })) {
    await markInvisiblePaymentFailed(userId, input.razorpayOrderId, 'Invalid signature');
    throw new AppError(400, 'Payment verification failed', 'PAYMENT_SIGNATURE_INVALID');
  }

  const plan = getInvisiblePlan(payment.planId);
  const purchaseDate = new Date();
  const existingSubscription = await deriveStatus(await findLatestSubscription(userId));

  await prisma.$transaction(async (transaction) => {
    await transaction.paymentRecord.update({
      where: { id: payment.id },
      data: {
        status: 'successful',
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.razorpaySignature,
      },
    });

    if (existingSubscription) {
      await transaction.invisibleSubscription.update({
        where: { id: existingSubscription.id },
        data: {
          planId: plan.id,
          planName: plan.name,
          status: 'active',
          totalCredits: existingSubscription.totalCredits + plan.totalCredits,
          remainingCredits: existingSubscription.remainingCredits + plan.totalCredits,
          totalMinutes: (existingSubscription.totalCredits + plan.totalCredits) / plan.creditsPerMinute,
          creditsPerMinute: plan.creditsPerMinute,
          purchaseDate,
          paymentId: input.razorpayPaymentId,
          orderId: input.razorpayOrderId,
          expiresAt: null,
        },
      });
      return;
    }

    await transaction.invisibleSubscription.create({
      data: {
        userId,
        planId: plan.id,
        planName: plan.name,
        status: 'active',
        totalCredits: plan.totalCredits,
        remainingCredits: plan.totalCredits,
        creditsUsed: 0,
        totalMinutes: plan.totalCredits / plan.creditsPerMinute,
        creditsPerMinute: plan.creditsPerMinute,
        purchaseDate,
        paymentId: input.razorpayPaymentId,
        orderId: input.razorpayOrderId,
      },
    });
  });

  return serializeSubscription(userId);
};

export const deductInvisibleCredits = async (userId: string, minutes = 1) => {
  const subscription = await deriveStatus(await findLatestSubscription(userId));
  if (!subscription || subscription.status !== 'active') {
    throw new AppError(409, 'Invisible subscription is not active', 'INVISIBLE_NOT_ACTIVE');
  }

  const creditsToDeduct = subscription.creditsPerMinute * Math.max(1, minutes);
  const remainingCredits = Math.max(0, subscription.remainingCredits - creditsToDeduct);
  const deductedCredits = subscription.remainingCredits - remainingCredits;
  await prisma.invisibleSubscription.update({
    where: { id: subscription.id },
    data: {
      remainingCredits,
      creditsUsed: subscription.creditsUsed + deductedCredits,
      lastUsedAt: new Date(),
      status: remainingCredits <= 0 ? 'exhausted' : 'active',
    },
  });

  return serializeSubscription(userId);
};

export const verifyInvisibleProtectionAccess = async (
  userId: string,
  enabled: boolean,
) => {
  if (!enabled) {
    console.info('[Invisible] Protection Disabled', { userId });
    return serializeSubscription(userId);
  }

  const subscription = await deriveStatus(await findLatestSubscription(userId));
  if (!subscription || subscription.status !== 'active' || subscription.remainingCredits <= 0) {
    throw new AppError(
      409,
      'An active Invisible subscription with remaining credits is required',
      'INVISIBLE_PROTECTION_NOT_ALLOWED',
    );
  }

  console.info('[Invisible] Subscription Verified', { userId });
  console.info('[Invisible] Protection Enabled', { userId });
  return serializeSubscription(userId);
};
