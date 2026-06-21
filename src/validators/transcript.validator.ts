import { z } from 'zod';

export const createTranscriptSchema = z.object({
  sessionId: z.string().trim().min(1),
  speaker: z.enum(['interviewer', 'candidate', 'system']),
  text: z.string().trim().min(1).max(10_000),
});

export const transcriptIdParamsSchema = z.object({
  id: z.string().trim().min(1),
});

export const transcribeAudioSchema = z.object({
  sessionId: z.string().trim().min(1),
  speaker: z.enum(['interviewer', 'candidate']),
});

export type CreateTranscriptDto = z.infer<typeof createTranscriptSchema>;
export type TranscribeAudioDto = z.infer<typeof transcribeAudioSchema>;
