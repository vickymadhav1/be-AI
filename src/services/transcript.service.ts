import { prisma } from '../config/db';
import { AppError } from '../utils/app-error';
import type { CreateTranscriptDto } from '../validators/transcript.validator';
import { getSessionById } from './session.service';

export const createTranscript = async (userId: string, input: CreateTranscriptDto) => {
  const session = await getSessionById(userId, input.sessionId);

  if (session.status !== 'active') {
    throw new AppError(409, 'Transcripts can only be added to active sessions', 'SESSION_ENDED');
  }

  return prisma.transcript.create({ data: input });
};

export const listSessionTranscripts = async (userId: string, sessionId: string) => {
  await getSessionById(userId, sessionId);
  return prisma.transcript.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
  });
};

export const getTranscriptById = async (userId: string, transcriptId: string) => {
  const transcript = await prisma.transcript.findFirst({
    where: { id: transcriptId, session: { userId } },
  });

  if (!transcript) {
    throw new AppError(404, 'Transcript was not found', 'TRANSCRIPT_NOT_FOUND');
  }

  return transcript;
};
