import { z } from 'zod';

export const suggestSchema = z.object({
  sessionId: z.string().trim().min(1),
  question: z.string().trim().min(2).max(10_000),
});

export type SuggestDto = z.infer<typeof suggestSchema>;
