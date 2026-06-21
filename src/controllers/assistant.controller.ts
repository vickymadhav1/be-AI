import type { Request, Response } from 'express';
import { createSuggestion, listSessionSuggestions } from '../services/suggestion.service';
import { sendSuccess } from '../utils/api-response';
import { getRouteParam } from '../utils/request';
import type { SuggestDto } from '../validators/assistant.validator';

export const suggest = async (request: Request, response: Response): Promise<void> => {
  const input = request.body as SuggestDto;
  sendSuccess(
    response,
    201,
    await createSuggestion(request.user!.id, input.sessionId, input.question),
    'Suggestion generated',
  );
};

export const listForSession = async (
  request: Request,
  response: Response,
): Promise<void> => {
  sendSuccess(
    response,
    200,
    await listSessionSuggestions(request.user!.id, getRouteParam(request, 'id')),
  );
};
