import { prisma } from '../config/db';
import type { MockQuestionContext } from '../types/interview';
import { AppError } from '../utils/app-error';
import { getInterviewById } from './interview.service';

const buildMockQuestions = (context: MockQuestionContext): string[] => {
  const role = context.role;

  if (context.interviewType === 'behavioral' || context.interviewType === 'hr') {
    return [
      `Tell me about a difficult challenge you handled as a ${role}.`,
      'Describe a time you received critical feedback and how you responded.',
      'How do you prioritize competing deadlines with multiple stakeholders?',
      `Why are you interested in this ${role} opportunity?`,
      'What professional achievement are you most proud of and why?',
    ];
  }

  if (context.interviewType === 'system-design') {
    return [
      `Design a scalable service commonly used by a ${role}.`,
      'How would you identify bottlenecks and plan capacity for this system?',
      'Explain your data consistency, caching, and failure recovery decisions.',
      'How would you monitor the system and define service-level objectives?',
      'What trade-offs would change if traffic increased by one hundred times?',
    ];
  }

  return [
    `Explain a core technical concept a ${role} with ${context.experience} years of experience should understand deeply.`,
    `How would you diagnose and improve performance in a ${context.difficulty} production problem?`,
    'Describe how you structure maintainable code and enforce quality in a team.',
    'Walk through a recent technical decision, its alternatives, and its trade-offs.',
    'How do you test, monitor, and safely release a significant application change?',
  ];
};

export const generateQuestions = async (userId: string, interviewId: string) => {
  const interview = await getInterviewById(userId, interviewId);
  const questions = buildMockQuestions(interview);

  // Replace prior generated questions atomically so repeated generation stays deterministic.
  return prisma.$transaction(async (transaction) => {
    await transaction.interviewQuestion.deleteMany({ where: { interviewId } });

    await transaction.interviewQuestion.createMany({
      data: questions.map((question) => ({
        interviewId,
        question,
      })),
    });

    return transaction.interviewQuestion.findMany({
      where: { interviewId },
      orderBy: { createdAt: 'asc' },
    });
  });
};

export const listQuestions = async (userId: string, interviewId: string) => {
  await getInterviewById(userId, interviewId);

  return prisma.interviewQuestion.findMany({
    where: { interviewId },
    orderBy: { createdAt: 'asc' },
  });
};

export const getQuestionById = async (userId: string, questionId: string) => {
  const question = await prisma.interviewQuestion.findFirst({
    where: {
      id: questionId,
      interview: { userId },
    },
    include: {
      interview: {
        select: {
          id: true,
          title: true,
          role: true,
        },
      },
    },
  });

  if (!question) {
    throw new AppError(404, 'Question was not found', 'QUESTION_NOT_FOUND');
  }

  return question;
};

export const saveQuestionAnswer = async (
  userId: string,
  questionId: string,
  answer: string,
) => {
  await getQuestionById(userId, questionId);

  return prisma.interviewQuestion.update({
    where: { id: questionId },
    data: { answer },
  });
};
