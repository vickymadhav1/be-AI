import { prisma } from '../config/db';
import { AppError } from '../utils/app-error';
import type { CreateSessionDto } from '../validators/session.validator';
import { getInvisibleSubscriptionStatus } from './invisible-subscription.service';

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

const elapsedSeconds = (startedAt: Date | null, endedAt: Date): number =>
  startedAt
    ? Math.max(0, Math.floor((endedAt.getTime() - startedAt.getTime()) / 1_000))
    : 0;

export const startSessionRuntime = (userId: string, sessionId: string) =>
  prisma.$transaction(async (transaction) => {
    const session = await transaction.interviewSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new AppError(404, 'Session was not found', 'SESSION_NOT_FOUND');
    }
    if (session.status !== 'active') {
      throw new AppError(409, 'The interview session is not active', 'SESSION_NOT_ACTIVE');
    }
    if (session.interviewRunning) return session;

    return transaction.interviewSession.update({
      where: { id: sessionId },
      data: {
        interviewRunning: true,
        activeRunStartedAt: new Date(),
      },
    });
  });

export const stopSessionRuntime = (userId: string, sessionId: string) =>
  prisma.$transaction(async (transaction) => {
    const session = await transaction.interviewSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new AppError(404, 'Session was not found', 'SESSION_NOT_FOUND');
    }
    if (!session.interviewRunning) return session;

    const stoppedAt = new Date();
    return transaction.interviewSession.update({
      where: { id: sessionId },
      data: {
        interviewRunning: false,
        activeRunStartedAt: null,
        interviewDurationSeconds:
          session.interviewDurationSeconds +
          elapsedSeconds(session.activeRunStartedAt, stoppedAt),
      },
    });
  });

export const recoverInterruptedSessionRuntimes = async (): Promise<number> => {
  const interrupted = await prisma.interviewSession.findMany({
    where: { interviewRunning: true },
  });
  if (!interrupted.length) return 0;

  const recoveredAt = new Date();
  await prisma.$transaction(
    interrupted.map((session) =>
      prisma.interviewSession.update({
        where: { id: session.id },
        data: {
          interviewRunning: false,
          activeRunStartedAt: null,
          interviewDurationSeconds:
            session.interviewDurationSeconds +
            elapsedSeconds(session.activeRunStartedAt, recoveredAt),
        },
      }),
    ),
  );
  return interrupted.length;
};

export const endSession = (userId: string, sessionId: string) =>
  prisma.$transaction(async (transaction) => {
    const session = await transaction.interviewSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new AppError(404, 'Session was not found', 'SESSION_NOT_FOUND');
    }

    const endedAt = new Date();
    return transaction.interviewSession.update({
      where: { id: sessionId },
      data: {
        status: 'completed',
        endedAt,
        interviewRunning: false,
        activeRunStartedAt: null,
        interviewDurationSeconds:
          session.interviewDurationSeconds +
          (session.interviewRunning
            ? elapsedSeconds(session.activeRunStartedAt, endedAt)
            : 0),
      },
      include: sessionInclude,
    });
  });

export const getDashboardStatistics = async (
  userId: string,
  dayStart: Date,
  dayEnd: Date,
) => {
  const [subscription, sessions, suggestionCount, confidence, suggestionTypes] =
    await Promise.all([
      getInvisibleSubscriptionStatus(userId),
      prisma.interviewSession.findMany({
        where: { userId },
        select: {
          id: true,
          status: true,
          startedAt: true,
          endedAt: true,
          interviewRunning: true,
          activeRunStartedAt: true,
          interviewDurationSeconds: true,
        },
      }),
      prisma.suggestion.count({ where: { session: { userId } } }),
      prisma.suggestion.aggregate({
        where: { session: { userId } },
        _avg: { confidence: true },
      }),
      prisma.suggestion.groupBy({
        by: ['type'],
        where: { session: { userId } },
        _count: { _all: true },
      }),
    ]);

  const now = new Date();
  const completed = sessions.filter((session) => session.status === 'completed');
  const today = sessions.filter(
    (session) => session.startedAt >= dayStart && session.startedAt < dayEnd,
  );
  const runningSession = sessions
    .filter((session) => session.interviewRunning && session.activeRunStartedAt)
    .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())[0];
  const durationWithActiveRun = (session: (typeof sessions)[number]): number =>
    session.interviewDurationSeconds +
    (session.interviewRunning
      ? elapsedSeconds(session.activeRunStartedAt, now)
      : 0);
  const typeCounts = new Map(
    suggestionTypes.map((entry) => [entry.type, entry._count._all]),
  );
  const countTypes = (types: string[]) =>
    types.reduce((total, type) => total + (typeCounts.get(type) ?? 0), 0);

  return {
    wallet: {
      creditsRemaining: subscription.remainingCredits,
      minutesRemaining: Math.floor(subscription.remainingMinutes),
      creditsUsed: subscription.creditsUsed,
      totalInterviewMinutes: Math.floor(
        completed.reduce(
          (total, session) => total + session.interviewDurationSeconds,
          0,
        ) / 60,
      ),
      todayUsageMinutes: Math.floor(
        today.reduce(
          (total, session) => total + durationWithActiveRun(session),
          0,
        ) / 60,
      ),
      currentSessionMinutes: runningSession?.activeRunStartedAt
        ? Math.floor(elapsedSeconds(runningSession.activeRunStartedAt, now) / 60)
        : 0,
    },
    interviews: {
      total: sessions.length,
      today: today.length,
      completed: completed.length,
      codingChallenges: countTypes([
        'CODING',
        'CODING_PROMPT',
        'SYNTAX',
        'DEBUGGING',
        'SQL',
        'OUTPUT',
        'OPTIMIZATION',
      ]),
      behavioralQuestions: countTypes(['BEHAVIORAL']),
      systemDesignQuestions: countTypes(['SYSTEM_DESIGN']),
      suggestionsGenerated: suggestionCount,
      averageConfidence:
        confidence._avg.confidence === null
          ? null
          : Math.round(confidence._avg.confidence * 100),
    },
    currentSession: {
      running: Boolean(runningSession),
      sessionId: runningSession?.id ?? null,
    },
  };
};

export const clearSessionData = (userId: string, sessionId: string) =>
  prisma.$transaction(async (transaction) => {
    const session = await transaction.interviewSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new AppError(404, 'Session was not found', 'SESSION_NOT_FOUND');
    }
    if (session.status !== 'active') {
      throw new AppError(
        409,
        'The interview session is not active',
        'SESSION_NOT_ACTIVE',
      );
    }

    const transcripts = await transaction.transcript.deleteMany({
      where: { sessionId },
    });
    const suggestions = await transaction.suggestion.deleteMany({
      where: { sessionId },
    });
    const screenContexts = await transaction.screenContext.deleteMany({
      where: { sessionId },
    });

    return {
      session: {
        ...session,
        transcripts: [],
        suggestions: [],
        screenContexts: [],
      },
      cleared: {
        transcripts: transcripts.count,
        suggestions: suggestions.count,
        screenContexts: screenContexts.count,
      },
    };
  });

export const deleteSession = async (userId: string, sessionId: string) => {
  await getSessionById(userId, sessionId);
  await prisma.interviewSession.delete({ where: { id: sessionId } });
};
