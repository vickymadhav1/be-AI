import { Router } from 'express';
import {
  dashboardStatistics,
  end,
  create,
  getById,
  list,
  remove,
} from '../controllers/session.controller';
import { listForSession as listSuggestions } from '../controllers/assistant.controller';
import { listForSession as listTranscripts } from '../controllers/transcript.controller';
import { authenticateJwt } from '../middleware/jwt-auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/async-handler';
import { createSessionSchema, sessionIdParamsSchema } from '../validators/session.validator';

export const sessionRouter = Router();
sessionRouter.use(authenticateJwt);
sessionRouter.post('/', validateRequest({ body: createSessionSchema }), asyncHandler(create));
sessionRouter.get('/', asyncHandler(list));
sessionRouter.get('/dashboard-statistics', asyncHandler(dashboardStatistics));
sessionRouter.get('/:id/transcripts', validateRequest({ params: sessionIdParamsSchema }), asyncHandler(listTranscripts));
sessionRouter.get('/:id/suggestions', validateRequest({ params: sessionIdParamsSchema }), asyncHandler(listSuggestions));
sessionRouter.patch('/:id/end', validateRequest({ params: sessionIdParamsSchema }), asyncHandler(end));
sessionRouter.get('/:id', validateRequest({ params: sessionIdParamsSchema }), asyncHandler(getById));
sessionRouter.delete('/:id', validateRequest({ params: sessionIdParamsSchema }), asyncHandler(remove));
