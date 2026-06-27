import { z } from 'zod';

export const supportRequestSchema = z.object({
  type: z.enum(['support', 'bug', 'feature']),
  email: z.string().trim().email('A valid email is required'),
  message: z.string().trim().min(1, 'Message is required'),
  diagnostics: z.record(z.string(), z.unknown()),
});

export type SupportRequestDto = z.infer<typeof supportRequestSchema>;
