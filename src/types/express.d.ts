import type { User } from '@prisma/client';
import type { FirebaseRequestContext, JwtPayload } from './auth';

declare global {
  namespace Express {
    interface Request {
      firebase?: FirebaseRequestContext;
      auth?: JwtPayload;
      user?: User;
    }
  }
}

export {};
