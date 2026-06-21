import type { User } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  firebaseUid: string;
  email: string;
}

export interface FirebaseRequestContext {
  firebaseUid: string;
  email: string;
  name: string | null;
  photo: string | null;
  user: User;
}
