import { prisma } from '../config/db';
import type { CreateInterviewDto } from '../validators/interview.validator';
import { AppError } from '../utils/app-error';

const interviewDetailsInclude = {
  questions: {
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

export const createInterview = (userId: string, input: CreateInterviewDto) => {
  return prisma.interview.create({
    data: {
      ...input,
      userId,
    },
    include: interviewDetailsInclude,
  });
};

export const listInterviews = (userId: string) => {
  return prisma.interview.findMany({
    where: { userId },
    include: {
      _count: {
        select: { questions: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getInterviewById = async (userId: string, interviewId: string) => {
  const interview = await prisma.interview.findFirst({
    where: {
      id: interviewId,
      userId,
    },
    include: interviewDetailsInclude,
  });

  if (!interview) {
    throw new AppError(404, 'Interview was not found', 'INTERVIEW_NOT_FOUND');
  }

  return interview;
};

export const deleteInterview = async (userId: string, interviewId: string) => {
  await getInterviewById(userId, interviewId);
  await prisma.interview.delete({ where: { id: interviewId } });
};
