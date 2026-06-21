import { z } from 'zod';

export const screenCaptureSchema = z.object({
  sessionId: z.string().trim().min(1),
});

export const textContextSchema = z.object({
  sessionId: z.string().trim().min(1),
  source: z.enum(['editor', 'clipboard']),
  content: z.string().trim().min(1).max(50_000),
});

export type TextContextDto = z.infer<typeof textContextSchema>;
