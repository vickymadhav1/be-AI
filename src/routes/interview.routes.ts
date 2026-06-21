import { Router } from 'express';
import {
  create,
  getById,
  list,
  remove,
} from '../controllers/interview.controller';
import {
  generate,
  listForInterview,
} from '../controllers/question.controller';
import { authenticateJwt } from '../middleware/jwt-auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/async-handler';
import { idParamsSchema } from '../validators/common.validator';
import { createInterviewSchema } from '../validators/interview.validator';

export const interviewRouter = Router();

interviewRouter.use(authenticateJwt);
interviewRouter.post(
  '/',
  validateRequest({ body: createInterviewSchema }),
  asyncHandler(create),
);
interviewRouter.get('/', asyncHandler(list));
interviewRouter.post(
  '/:id/questions/generate',
  validateRequest({ params: idParamsSchema }),
  asyncHandler(generate),
);
interviewRouter.get(
  '/:id/questions',
  validateRequest({ params: idParamsSchema }),
  asyncHandler(listForInterview),
);
interviewRouter.get(
  '/:id',
  validateRequest({ params: idParamsSchema }),
  asyncHandler(getById),
);
interviewRouter.delete(
  '/:id',
  validateRequest({ params: idParamsSchema }),
  asyncHandler(remove),
);
