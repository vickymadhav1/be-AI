import { Router } from 'express';
import multer from 'multer';
import { addTextContext, capture } from '../controllers/screen.controller';
import { authenticateJwt } from '../middleware/jwt-auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/async-handler';
import { screenCaptureSchema, textContextSchema } from '../validators/screen.validator';

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => callback(null, file.mimetype.startsWith('image/')),
});

console.log('SCREEN ROUTER LOADED')
console.log(screenCaptureSchema.shape)

export const screenRouter = Router();
screenRouter.use(authenticateJwt);
screenRouter.post(
  '/analyze',
  imageUpload.single('image'),
  validateRequest({ body: screenCaptureSchema }),
  asyncHandler(capture),
);
screenRouter.post(
  '/context',
  validateRequest({ body: textContextSchema }),
  asyncHandler(addTextContext),
);
