import { z } from 'zod';

export const DEFAULT_CONFIDENCE = 0.8;

export const normalizeConfidence = (value: unknown): number => {
  const confidence = Number(value);
  return Number.isFinite(confidence)
    ? Math.max(0, Math.min(1, confidence))
    : DEFAULT_CONFIDENCE;
};

// AI providers occasionally return confidence as a string, null, or NaN.
// Normalize before validation so an otherwise valid answer is never discarded.
export const confidenceSchema = z
  .preprocess(normalizeConfidence, z.coerce.number().default(DEFAULT_CONFIDENCE))
  .transform(normalizeConfidence)
  .catch(DEFAULT_CONFIDENCE);
