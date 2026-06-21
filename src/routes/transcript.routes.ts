import { Router } from 'express';
import multer from 'multer';
import { create, getById, transcribe } from '../controllers/transcript.controller';
import { authenticateJwt } from '../middleware/jwt-auth.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/async-handler';
import { createTranscriptSchema, transcriptIdParamsSchema, transcribeAudioSchema } from '../validators/transcript.validator';

export const transcriptRouter = Router();
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => {
    callback(null, file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm');
  },
});

transcriptRouter.use(authenticateJwt);
transcriptRouter.post(
  '/transcribe',
  audioUpload.single('audio'),
  validateRequest({ body: transcribeAudioSchema }),
  asyncHandler(transcribe),
);
transcriptRouter.post('/', validateRequest({ body: createTranscriptSchema }), asyncHandler(create));
transcriptRouter.get('/:id', validateRequest({ params: transcriptIdParamsSchema }), asyncHandler(getById));
