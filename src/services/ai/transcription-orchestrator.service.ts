import { env } from '../../config/env';
import { AppError } from '../../utils/app-error';
import { aiOrchestrator } from './ai-orchestrator.service';
import { getProviderErrorMessage, getProviderErrorStatus } from './provider-errors';
import { type ProviderName, validateProviderKey } from './provider-config';

interface TranscriptionInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
}

const providerOrder: ProviderName[] = [
  'groq',
  'gemini',
  'openrouter',
  'together',
  'huggingface',
];

const keys = {
  groq: validateProviderKey('groq', env.GROQ_API_KEY).key,
  gemini: validateProviderKey('gemini', env.GEMINI_API_KEY).key,
  openrouter: validateProviderKey('openrouter', env.OPENROUTER_API_KEY).key,
  together: validateProviderKey('together', env.TOGETHER_API_KEY).key,
  huggingface: validateProviderKey('huggingface', env.HUGGINGFACE_API_KEY).key,
};

const withTimeout = () => AbortSignal.timeout(env.AI_PROVIDER_TIMEOUT_MS);

const toArrayBuffer = (buffer: Buffer): ArrayBuffer => {
  const bytes = new Uint8Array(buffer.byteLength);
  bytes.set(buffer);
  return bytes.buffer;
};

const parseJson = async (response: Response) => {
  const body = await response.text();
  if (!response.ok) {
    const error = new Error(body || response.statusText) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body ? JSON.parse(body) as Record<string, unknown> : {};
};

const multipartTranscription = async (
  url: string,
  key: string,
  model: string,
  input: TranscriptionInput,
) => {
  const form = new FormData();
  form.append('file', new Blob([toArrayBuffer(input.buffer)], { type: input.mimeType }), input.filename);
  form.append('model', model);
  form.append('language', 'en');
  form.append('response_format', 'json');
  const payload = await parseJson(await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: withTimeout(),
  }));
  return String(payload.text ?? '').trim();
};

const transcribers: Record<ProviderName, (input: TranscriptionInput) => Promise<string>> = {
  groq: async (input) => multipartTranscription(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    keys.groq!,
    env.GROQ_TRANSCRIPTION_MODEL,
    input,
  ),
  gemini: async (input) => {
    const payload = await parseJson(await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_TRANSCRIPTION_MODEL}:generateContent?key=${keys.gemini}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: 'Transcribe this interview audio exactly. Return transcript text only.' },
            { inlineData: { mimeType: input.mimeType, data: input.buffer.toString('base64') } },
          ] }],
          generationConfig: { temperature: 0 },
        }),
        signal: withTimeout(),
      },
    ));
    const candidates = payload.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined;
    return String(candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
  },
  openrouter: async (input) => {
    const format = input.mimeType.includes('wav') ? 'wav' : 'webm';
    const payload = await parseJson(await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${keys.openrouter}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:5173',
        'X-Title': 'Interview Mate AI',
      },
      body: JSON.stringify({
        model: env.OPENROUTER_TRANSCRIPTION_MODEL,
        messages: [{ role: 'user', content: [
          { type: 'text', text: 'Transcribe this interview audio exactly. Return transcript text only.' },
          { type: 'input_audio', input_audio: { data: input.buffer.toString('base64'), format } },
        ] }],
        temperature: 0,
      }),
      signal: withTimeout(),
    }));
    const choices = payload.choices as Array<{ message?: { content?: string } }> | undefined;
    return String(choices?.[0]?.message?.content ?? '').trim();
  },
  together: async (input) => multipartTranscription(
    'https://api.together.xyz/v1/audio/transcriptions',
    keys.together!,
    env.TOGETHER_TRANSCRIPTION_MODEL,
    input,
  ),
  huggingface: async (input) => {
    const payload = await parseJson(await fetch(
      `https://router.huggingface.co/hf-inference/models/${env.HUGGINGFACE_TRANSCRIPTION_MODEL}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${keys.huggingface}`,
          'Content-Type': input.mimeType,
        },
        body: toArrayBuffer(input.buffer),
        signal: withTimeout(),
      },
    ));
    return String(payload.text ?? '').trim();
  },
};

export const transcribeAudio = async (
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string> => {
  if (buffer.length < 1_000) {
    throw new AppError(422, 'No speech was detected in the audio segment', 'NO_SPEECH');
  }

  for (const provider of providerOrder) {
    if (!keys[provider] || !aiOrchestrator.beginExternalRequest(provider)) continue;
    try {
      const text = await transcribers[provider]({ buffer, filename, mimeType });
      if (!text) {
        aiOrchestrator.recordExternalSuccess(provider);
        throw new AppError(422, 'No speech was detected in the audio segment', 'NO_SPEECH');
      }
      aiOrchestrator.recordExternalSuccess(provider);
      console.info(`[Transcription] completed with ${provider}`);
      return text;
    } catch (error) {
      if (error instanceof AppError && error.code === 'NO_SPEECH') throw error;
      aiOrchestrator.recordExternalFailure(provider, error);
      console.warn(`[Transcription] ${provider} failed; trying next provider`, {
        status: getProviderErrorStatus(error),
        message: getProviderErrorMessage(error),
      });
    }
  }

  throw new AppError(
    503,
    'Transcription providers are temporarily unavailable. The interview will continue.',
    'TRANSCRIPTION_PROVIDERS_EXHAUSTED',
  );
};
