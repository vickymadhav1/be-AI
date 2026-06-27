import { Router } from 'express';
import { submitRequest } from '../controllers/support.controller';
import { authenticateJwt } from '../middleware/jwt-auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/async-handler';
import { supportRequestSchema } from '../validators/support.validator';

export const supportRouter = Router();

supportRouter.use(authenticateJwt);
supportRouter.post('/', validateRequest({ body: supportRequestSchema }), asyncHandler(submitRequest));
