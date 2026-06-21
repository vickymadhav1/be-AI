import type { Request, Response } from 'express';
import {
  createSession,
  deleteSession,
  endSession,
  getSessionById,
  listSessions,
} from '../services/session.service';
import { sendSuccess } from '../utils/api-response';
import { getRouteParam } from '../utils/request';
import type { CreateSessionDto } from '../validators/session.validator';

export const create = async (request: Request, response: Response): Promise<void> => {
  sendSuccess(
    response,
    201,
    await createSession(request.user!.id, request.body as CreateSessionDto),
    'Session started',
  );
};

export const list = async (request: Request, response: Response): Promise<void> => {
  sendSuccess(response, 200, await listSessions(request.user!.id));
};

export const getById = async (request: Request, response: Response): Promise<void> => {
  sendSuccess(
    response,
    200,
    await getSessionById(request.user!.id, getRouteParam(request, 'id')),
  );
};

export const end = async (request: Request, response: Response): Promise<void> => {
  sendSuccess(
    response,
    200,
    await endSession(request.user!.id, getRouteParam(request, 'id')),
    'Session ended',
  );
};

export const remove = async (request: Request, response: Response): Promise<void> => {
  await deleteSession(request.user!.id, getRouteParam(request, 'id'));
  sendSuccess(response, 200, null, 'Session deleted');
};
