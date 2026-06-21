import { z } from 'zod';

export const idParamsSchema = z.object({
  id: z.string().trim().min(1, 'Interview id is required'),
});

export const questionIdParamsSchema = z.object({
  questionId: z.string().trim().min(1, 'Question id is required'),
});
