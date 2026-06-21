import type { Request, Response } from 'express';
import {
  createInterview,
  deleteInterview,
  getInterviewById,
  listInterviews,
} from '../services/interview.service';
import { AppError } from '../utils/app-error';
import { sendSuccess } from '../utils/api-response';
import { getRouteParam } from '../utils/request';
import type { CreateInterviewDto } from '../validators/interview.validator';

const requireUserId = (request: Request): string => {
  if (!request.user) {
    throw new AppError(401, 'Authentication is required', 'AUTH_REQUIRED');
  }

  return request.user.id;
};

export const create = async (request: Request, response: Response): Promise<void> => {
  const interview = await createInterview(
    requireUserId(request),
    request.body as CreateInterviewDto,
  );
  sendSuccess(response, 201, interview, 'Interview created');
};

export const list = async (request: Request, response: Response): Promise<void> => {
  const interviews = await listInterviews(requireUserId(request));
  sendSuccess(response, 200, interviews);
};

export const getById = async (request: Request, response: Response): Promise<void> => {
  const interview = await getInterviewById(
    requireUserId(request),
    getRouteParam(request, 'id'),
  );
  sendSuccess(response, 200, interview);
};

export const remove = async (request: Request, response: Response): Promise<void> => {
  await deleteInterview(requireUserId(request), getRouteParam(request, 'id'));
  sendSuccess(response, 200, null, 'Interview deleted');
};
