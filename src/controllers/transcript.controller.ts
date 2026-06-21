import type { Request, Response } from 'express';
import {
  createTranscript,
  getTranscriptById,
  listSessionTranscripts,
} from '../services/transcript.service';
import { sendSuccess } from '../utils/api-response';
import { getRouteParam } from '../utils/request';
import type { CreateTranscriptDto } from '../validators/transcript.validator';
import type { TranscribeAudioDto } from '../validators/transcript.validator';
import { transcribeAudio } from '../services/ai/transcription-orchestrator.service';
import { createSuggestion } from '../services/suggestion.service';
import { isQuestion } from '../utils/is-question';
import { AppError } from '../utils/app-error';
import { emitToSession } from '../socket/realtime.gateway';

export const create = async (request: Request, response: Response): Promise<void> => {
  sendSuccess(
    response,
    201,
    await createTranscript(request.user!.id, request.body as CreateTranscriptDto),
    'Transcript stored',
  );
};

export const listForSession = async (
  request: Request,
  response: Response,
): Promise<void> => {
  sendSuccess(
    response,
    200,
    await listSessionTranscripts(request.user!.id, getRouteParam(request, 'id')),
  );
};

export const getById = async (request: Request, response: Response): Promise<void> => {
  sendSuccess(
    response,
    200,
    await getTranscriptById(request.user!.id, getRouteParam(request, 'id')),
  );
};

export const transcribe = async (request: Request, response: Response): Promise<void> => {
  if (!request.file) {
    throw new AppError(400, 'An audio file is required', 'AUDIO_REQUIRED');
  }

  const input = request.body as TranscribeAudioDto;
  const text = await transcribeAudio(
    request.file.buffer,
    request.file.originalname || 'audio.webm',
    request.file.mimetype || 'audio/webm',
  );
  const transcript = await createTranscript(request.user!.id, {
    sessionId: input.sessionId,
    speaker: input.speaker,
    text,
  });
  emitToSession(input.sessionId, 'transcript:update', transcript);

  let suggestion = null;
  let suggestionError: string | null = null;

  if (input.speaker === 'interviewer' && isQuestion(text)) {
    emitToSession(input.sessionId, 'question:detected', {
      question: text,
      source: 'transcript',
    });
    try {
      suggestion = await createSuggestion(request.user!.id, input.sessionId, text);
      emitToSession(input.sessionId, 'answer:generated', suggestion);
    } catch (error) {
      console.error('Suggestion generation failed after transcription', error);
      suggestionError = 'AI providers are temporarily unavailable. The interview will continue.';
    }
  }

  sendSuccess(
    response,
    201,
    { transcript, suggestion, suggestionError },
    'Audio transcribed',
  );
};
