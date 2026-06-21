import { z } from 'zod';

export const firebaseAuthSchema = z.object({
  idToken: z.string().trim().min(1, 'idToken cannot be empty').optional(),
});

export type FirebaseAuthDto = z.infer<typeof firebaseAuthSchema>;
