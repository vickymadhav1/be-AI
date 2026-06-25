import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { authRouter } from './routes/auth.routes';
import { healthRouter } from './routes/health.routes';
import { interviewRouter } from './routes/interview.routes';
import { questionRouter } from './routes/question.routes';
import { userRouter } from './routes/user.routes';
import { assistantRouter } from './routes/assistant.routes';
import { sessionRouter } from './routes/session.routes';
import { transcriptRouter } from './routes/transcript.routes';
import { screenRouter } from './routes/screen.routes';
import { invisibleSubscriptionRouter } from './routes/invisible-subscription.routes';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.CORS_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(
  '/api',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
);

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/user', userRouter);
app.use('/api/interviews', interviewRouter);
app.use('/api/questions', questionRouter);
app.use('/api/sessions', sessionRouter);
app.use('/api/transcripts', transcriptRouter);
app.use('/api/assistant', assistantRouter);
app.use('/api/screens', screenRouter);
app.use('/api/invisible', invisibleSubscriptionRouter);

app.use(notFoundHandler);
app.use(errorHandler);
