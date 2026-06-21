import { z } from 'zod';

export const createSessionSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  company: z.string().trim().min(2).max(120).optional(),
  role: z.string().trim().min(2).max(120).optional(),
});

export const sessionIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export type CreateSessionDto = z.infer<typeof createSessionSchema>;
