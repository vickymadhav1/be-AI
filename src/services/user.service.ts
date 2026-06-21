import type { DecodedIdToken } from 'firebase-admin/auth';
import { prisma } from '../config/db';
import { AppError } from '../utils/app-error';

const getRequiredEmail = (token: DecodedIdToken): string => {
  if (!token.email) {
    throw new AppError(
      400,
      'The Firebase account does not contain an email address',
      'FIREBASE_EMAIL_REQUIRED',
    );
  }

  return token.email.toLowerCase();
};

export const getUserProfile = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new AppError(404, 'User was not found', 'USER_NOT_FOUND');
  }

  return user;
};

export const getUserCredits = async (userId: string): Promise<number> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });

  if (!user) {
    throw new AppError(404, 'User was not found', 'USER_NOT_FOUND');
  }

  return user.credits;
};

export const findOrCreateFirebaseUser = async (token: DecodedIdToken) => {
  const email = getRequiredEmail(token);
  const name = token.name ?? null;
  const photo = token.picture ?? null;

  // Upsert makes repeated sign-ins idempotent and refreshes mutable profile fields.
  return prisma.user.upsert({
    where: { firebaseUid: token.uid },
    create: {
      firebaseUid: token.uid,
      email,
      name,
      photo,
    },
    update: {
      email,
      name,
      photo,
    },
  });
};
