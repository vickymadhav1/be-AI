import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Resolve from this module instead of process.cwd(), so npm, nodemon, Electron,
// and parent-directory launches all load the same backend environment file.
loadDotenv({
  path: path.resolve(__dirname, '../../.env'),
  quiet: true,
});

const optionalString = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const cleaned = value.trim().replace(/^['"]|['"]$/g, '').replace(/,+$/g, '').trim();
    return cleaned || undefined;
  },
  z.string().optional(),
);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(8000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    DIRECT_URL: z.string().min(1, 'DIRECT_URL is required'),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(5),
    DATABASE_CONNECT_TIMEOUT_MS: z.coerce.number().int().positive().default(15000),
    DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must contain at least 32 characters'),
    JWT_EXPIRES_IN: z.string().default('7d'),
    GOOGLE_APPLICATION_CREDENTIALS: optionalString,
    FIREBASE_PROJECT_ID: optionalString,
    FIREBASE_CLIENT_EMAIL: z.preprocess((value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),z.email('FIREBASE_CLIENT_EMAIL must be valid').optional()),
    FIREBASE_PRIVATE_KEY: optionalString,
    CORS_ORIGIN: z.string().default('http://localhost:5173,http://localhost:47831'),
    GROQ_API_KEY: optionalString,
    GROQ_MODEL: z.string().default('llama-3.3-70b-versatile'),
    GROQ_TRANSCRIPTION_MODEL: z.string().default('whisper-large-v3-turbo'),
    GROQ_VISION_MODEL: z.string().default('meta-llama/llama-4-scout-17b-16e-instruct'),
    GEMINI_API_KEY: optionalString,
    GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
    GEMINI_TRANSCRIPTION_MODEL: z.string().default('gemini-2.0-flash'),
    OPENROUTER_API_KEY: optionalString,
    OPENROUTER_MODEL: z.string().default('deepseek/deepseek-chat-v3-0324'),
    OPENROUTER_TRANSCRIPTION_MODEL: z.string().default('google/gemini-2.0-flash-001'),
    TOGETHER_API_KEY: optionalString,
    TOGETHER_MODEL: z.string().default('Qwen/Qwen2.5-Coder-32B-Instruct'),
    TOGETHER_TRANSCRIPTION_MODEL: z.string().default('openai/whisper-large-v3'),
    HUGGINGFACE_API_KEY: optionalString,
    HUGGINGFACE_MODEL: z.string().default('Qwen/Qwen2.5-Coder-32B-Instruct'),
    HUGGINGFACE_TRANSCRIPTION_MODEL: z.string().default('openai/whisper-large-v3'),
    OPENAI_API_KEY: optionalString,
    OPENAI_MODEL: z.string().default('gpt-5'),
    OPENAI_CODING_MODEL: optionalString,
    OPENAI_DEFAULT_MODEL:optionalString,
    OPENAI_DEBUGGING_MODEL: optionalString,
    OPENAI_VISION_MODEL: optionalString,
    OPENAI_TRANSCRIPTION_MODEL: z.string().default('gpt-4o-transcribe'),
    AI_PROVIDER_PRIORITY: z.string().default('openai,groq,gemini,openrouter,together,huggingface'),
    AI_PROVIDER_TIMEOUT_MS: z.coerce.number().int().positive().default(25000),
    AI_PROVIDER_COOLDOWN_MS: z.coerce.number().int().positive().default(60000),
    RAZORPAY_KEY_ID: optionalString,
    RAZORPAY_KEY_SECRET: optionalString,
  })
  .superRefine((value, context) => {
    const hasCredentialFile = Boolean(value.GOOGLE_APPLICATION_CREDENTIALS);
    const hasInlineCredentials = Boolean(
      value.FIREBASE_PROJECT_ID &&
        value.FIREBASE_CLIENT_EMAIL &&
        value.FIREBASE_PRIVATE_KEY,
    );

    if (!hasCredentialFile && !hasInlineCredentials) {
      context.addIssue({
        code: 'custom',
        path: ['GOOGLE_APPLICATION_CREDENTIALS'],
        message:
          'Set GOOGLE_APPLICATION_CREDENTIALS or provide all FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY values',
      });
    }
  });

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = {
  ...parsed.data,
  CORS_ORIGINS: parsed.data.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
  AI_PROVIDER_PRIORITIES: parsed.data.AI_PROVIDER_PRIORITY.split(',') .map((provider) => provider.trim().toLowerCase()).filter(Boolean),
  // Environment files store newlines as "\n"; Firebase expects real line breaks.
  FIREBASE_PRIVATE_KEY: parsed.data.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};
