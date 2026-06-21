import { Router } from 'express';
import { getAiHealth, getHealth } from '../controllers/health.controller';

export const healthRouter = Router();

healthRouter.get('/', getHealth);
healthRouter.get('/ai', getAiHealth);
