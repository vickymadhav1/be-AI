import { z } from 'zod';

export const answerQuestionSchema = z.object({
  answer: z.string().trim().min(1, 'Answer is required').max(10_000),
});

export type AnswerQuestionDto = z.infer<typeof answerQuestionSchema>;
