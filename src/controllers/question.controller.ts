import type { Request, Response } from 'express';
import {
  generateQuestions,
  getQuestionById,
  listQuestions,
  saveQuestionAnswer,
} from '../services/question.service';
import { AppError } from '../utils/app-error';
import { sendSuccess } from '../utils/api-response';
import { getRouteParam } from '../utils/request';
import type { AnswerQuestionDto } from '../validators/question.validator';

const requireUserId = (request: Request): string => {
  if (!request.user) {
    throw new AppError(401, 'Authentication is required', 'AUTH_REQUIRED');
  }

  return request.user.id;
};

export const generate = async (request: Request, response: Response): Promise<void> => {
  const questions = await generateQuestions(
    requireUserId(request),
    getRouteParam(request, 'id'),
  );
  sendSuccess(response, 201, questions, 'Questions generated');
};

export const listForInterview = async (
  request: Request,
  response: Response,
): Promise<void> => {
  const questions = await listQuestions(
    requireUserId(request),
    getRouteParam(request, 'id'),
  );
  sendSuccess(response, 200, questions);
};

export const getById = async (request: Request, response: Response): Promise<void> => {
  const question = await getQuestionById(
    requireUserId(request),
    getRouteParam(request, 'questionId'),
  );
  sendSuccess(response, 200, question);
};

export const answer = async (request: Request, response: Response): Promise<void> => {
  const { answer } = request.body as AnswerQuestionDto;
  const question = await saveQuestionAnswer(
    requireUserId(request),
    getRouteParam(request, 'questionId'),
    answer,
  );
  sendSuccess(response, 200, question, 'Answer saved');
};
