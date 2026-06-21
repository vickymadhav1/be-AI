import { Router } from 'express';
import { suggest } from '../controllers/assistant.controller';
import { authenticateJwt } from '../middleware/jwt-auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/async-handler';
import { suggestSchema } from '../validators/assistant.validator';

export const assistantRouter = Router();
assistantRouter.use(authenticateJwt);
assistantRouter.post('/suggest', validateRequest({ body: suggestSchema }), asyncHandler(suggest));
