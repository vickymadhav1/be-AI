import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from './env';

const credential = env.GOOGLE_APPLICATION_CREDENTIALS
  ? applicationDefault()
  : cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY,
    });

// Firebase Admin is initialized once, even when ts-node-dev reloads modules.
const firebaseApp =
  getApps()[0] ??
  initializeApp({
    credential,
  });

export const firebaseAuth = getAuth(firebaseApp);
