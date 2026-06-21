import { prisma } from '../config/db';
import { AppError } from '../utils/app-error';
import type { CreateSessionDto } from '../validators/session.validator';

const sessionInclude = {
  transcripts: { orderBy: { createdAt: 'asc' as const } },
  suggestions: { orderBy: { createdAt: 'asc' as const } },
  screenContexts: {
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
} as const;

export const createSession = (userId: string, input: CreateSessionDto) =>
  prisma.interviewSession.create({
    data: { userId, ...input },
    include: sessionInclude,
  });

export const listSessions = (userId: string) =>
  prisma.interviewSession.findMany({
    where: { userId },
    include: {
      _count: { select: { transcripts: true, suggestions: true } },
    },
    orderBy: { startedAt: 'desc' },
  });

export const getSessionById = async (userId: string, sessionId: string) => {
  const session = await prisma.interviewSession.findFirst({
    where: { id: sessionId, userId },
    include: sessionInclude,
  });

  if (!session) {
    throw new AppError(404, 'Session was not found', 'SESSION_NOT_FOUND');
  }

  return session;
};

export const endSession = async (userId: string, sessionId: string) => {
  await getSessionById(userId, sessionId);
  return prisma.interviewSession.update({
    where: { id: sessionId },
    data: { status: 'completed', endedAt: new Date() },
    include: sessionInclude,
  });
};

export const deleteSession = async (userId: string, sessionId: string) => {
  await getSessionById(userId, sessionId);
  await prisma.interviewSession.delete({ where: { id: sessionId } });
};
