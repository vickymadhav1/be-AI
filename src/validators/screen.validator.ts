import { z } from 'zod';

export const screenCaptureSchema = z.object({
  sessionId: z.string().trim().min(1),
  sourceId: z.string().trim().optional(),
  sourceName: z.string().trim().optional(),
  activeMeetingApp: z.string().trim().optional(),
  activeWindowTitle: z.string().trim().optional(),
});

export const textContextSchema = z.object({
  sessionId: z.string().trim().min(1),
  source: z.enum(['editor', 'clipboard']),
  content: z.string().trim().min(1).max(50_000),
});

export type TextContextDto = z.infer<typeof textContextSchema>;
