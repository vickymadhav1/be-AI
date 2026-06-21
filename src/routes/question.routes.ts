import { Router } from 'express';
import { answer, getById } from '../controllers/question.controller';
import { authenticateJwt } from '../middleware/jwt-auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/async-handler';
import { questionIdParamsSchema } from '../validators/common.validator';
import { answerQuestionSchema } from '../validators/question.validator';

export const questionRouter = Router();

questionRouter.use(authenticateJwt);
questionRouter.get(
  '/:questionId',
  validateRequest({ params: questionIdParamsSchema }),
  asyncHandler(getById),
);
questionRouter.post(
  '/:questionId/answer',
  validateRequest({
    params: questionIdParamsSchema,
    body: answerQuestionSchema,
  }),
  asyncHandler(answer),
);
