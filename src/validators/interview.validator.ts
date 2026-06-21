import { z } from 'zod';

export const createInterviewSchema = z.object({
  title: z.string().trim().min(2).max(120),
  role: z.string().trim().min(2).max(120),
  experience: z.number().int().min(0).max(60),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  interviewType: z.enum(['technical', 'behavioral', 'hr', 'system-design', 'mixed']),
});

export type CreateInterviewDto = z.infer<typeof createInterviewSchema>;
