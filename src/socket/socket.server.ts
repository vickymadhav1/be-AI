import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { createSession, endSession } from '../services/session.service';
import { getSessionById } from '../services/session.service';
import { createSuggestion } from '../services/suggestion.service';
import { createTranscript } from '../services/transcript.service';
import {
  createLiveVoiceQuestion,
  createLiveVoiceSuggestion,
  looksLikeLiveQuestion,
} from '../services/voice-intelligence.service';
import type { RealtimeServer, RealtimeSocket, SocketAck } from '../types/realtime';
import { isQuestion } from '../utils/is-question';
import { verifyAccessToken } from '../services/token.service';
import { setRealtimeServer } from './realtime.gateway';

const meetingAppPatterns: Array<{ name: string; pattern: RegExp }> = [
  { name: 'Microsoft Teams', pattern: /microsoft teams|teams/i },
  { name: 'Zoom', pattern: /\bzoom\b|zoom meeting/i },
  { name: 'Google Meet', pattern: /google meet|meet\.google|meet -/i },
  { name: 'Cisco Webex', pattern: /webex|cisco webex/i },
  { name: 'Slack Huddles', pattern: /slack|huddle/i },
  { name: 'Discord', pattern: /discord/i },
  { name: 'Skype', pattern: /skype/i },
];

const detectMeetingApp = (value: string): string => {
  return meetingAppPatterns.find(({ pattern }) => pattern.test(value))?.name ?? '';
};

const toError = (error: unknown) => ({
  message: error instanceof Error ? error.message : 'Unexpected realtime server error',
  code:
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code)
      : undefined,
});

const respond = (acknowledge: ((response: SocketAck) => void) | undefined, data: unknown) =>
  acknowledge?.({ success: true, data });

interface VoiceState {
  inFlight: boolean;
  sequence: number;
  lastGeneratedText: string;
  pendingText: string;
  lastStartedAt: number;
}

const voiceStates = new Map<string, VoiceState>();

const getVoiceState = (sessionId: string): VoiceState => {
  const existing = voiceStates.get(sessionId);
  if (existing) return existing;
  const created = {
    inFlight: false,
    sequence: 0,
    lastGeneratedText: '',
    pendingText: '',
    lastStartedAt: 0,
  };
  voiceStates.set(sessionId, created);
  return created;
};

const emitAnswerChunks = async (
  io: RealtimeServer,
  sessionId: string,
  sequence: number,
  suggestion: Awaited<ReturnType<typeof createLiveVoiceSuggestion>>,
) => {
  const words = suggestion.answer.trim().split(/\s+/).filter(Boolean);
  let answer = '';

  for (let index = 0; index < words.length; index += 8) {
    answer = [...words.slice(0, index + 8)].join(' ');
    io.to(sessionId).emit('voice:answer:chunk', {
      sessionId,
      sequence,
      question: suggestion.question,
      answer,
      provider: suggestion.provider,
      confidence: suggestion.confidence,
      done: index + 8 >= words.length,
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
};

const fail = (
  socket: RealtimeSocket,
  acknowledge: ((response: SocketAck) => void) | undefined,
  error: unknown,
) => {
  const payload = toError(error);
  acknowledge?.({ success: false, message: payload.message });
  socket.emit('server:error', payload);
};

export const attachSocketServer = (httpServer: HttpServer): RealtimeServer => {
  const io: RealtimeServer = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGINS, credentials: true },
    transports: ['websocket', 'polling'],
  });
  setRealtimeServer(io);

  io.use((socket, next) => {
    try {
      const token =
        typeof socket.handshake.auth.token === 'string' ? socket.handshake.auth.token : '';
      socket.data.auth = verifyAccessToken(token);
      next();
    } catch {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.auth.sub;

    socket.on('session:join', async ({ sessionId }, acknowledge) => {
      try {
        await getSessionById(userId, sessionId);
        await socket.join(sessionId);
        respond(acknowledge, { sessionId });
      } catch (error) {
        fail(socket, acknowledge, error);
      }
    });

    socket.on('session:start', async (payload, acknowledge) => {
      try {
        const session = await createSession(userId, payload);
        await socket.join(session.id);
        socket.emit('session:started', session);
        respond(acknowledge, session);
      } catch (error) {
        fail(socket, acknowledge, error);
      }
    });

    socket.on('session:end', async ({ sessionId }, acknowledge) => {
      try {
        const session = await endSession(userId, sessionId);
        voiceStates.delete(sessionId);
        io.to(sessionId).emit('session:ended', session);
        respond(acknowledge, session);
      } catch (error) {
        fail(socket, acknowledge, error);
      }
    });

    socket.on('transcript:new', async (payload, acknowledge) => {
      try {
        const transcript = await createTranscript(userId, payload);
        await socket.join(payload.sessionId);
        io.to(payload.sessionId).emit('transcript:stored', transcript);
        io.to(payload.sessionId).emit('transcript:update', transcript);
        respond(acknowledge, transcript);

        if (payload.speaker === 'interviewer' && isQuestion(payload.text)) {
          io.to(payload.sessionId).emit('question:detected', {
            question: payload.text,
            source: 'transcript',
          });
          const suggestion = await createSuggestion(userId, payload.sessionId, payload.text);
          io.to(payload.sessionId).emit('assistant:response', suggestion);
          io.to(payload.sessionId).emit('answer:generated', suggestion);
        }
      } catch (error) {
        fail(socket, acknowledge, error);
      }
    });

    socket.on('voice:partial', async (payload, acknowledge) => {
      try {
        await getSessionById(userId, payload.sessionId);
        await socket.join(payload.sessionId);

        const text = payload.text.trim().replace(/\s+/g, ' ');
        if (!text) {
          respond(acknowledge, { ignored: true });
          return;
        }

        console.info('[Speech] Partial Transcript Received', {
          sessionId: payload.sessionId,
          isFinal: payload.isFinal,
          source: payload.source,
          length: text.length,
        });

        io.to(payload.sessionId).emit('voice:partial', {
          sessionId: payload.sessionId,
          text,
          isFinal: payload.isFinal,
          source: payload.source,
          confidence: payload.confidence ?? 0.7,
        });
        respond(acknowledge, { accepted: true });

        if (!looksLikeLiveQuestion(text)) return;

        const state = getVoiceState(payload.sessionId);
        const changedEnough =
          Math.abs(text.length - state.lastGeneratedText.length) >= 12 ||
          !text.startsWith(state.lastGeneratedText);
        const cooldownComplete = Date.now() - state.lastStartedAt > 1_200;

        if (state.inFlight || (!payload.isFinal && !changedEnough) || !cooldownComplete) {
          state.pendingText = text;
          return;
        }

        const runVoiceIntelligence = async (questionText: string): Promise<void> => {
          const activeState = getVoiceState(payload.sessionId);
          activeState.inFlight = true;
          activeState.pendingText = '';
          activeState.lastStartedAt = Date.now();
          activeState.lastGeneratedText = questionText;
          activeState.sequence += 1;
          const sequence = activeState.sequence;

          try {
            console.info('[Speech] Speaker Identified', {
              sessionId: payload.sessionId,
              speaker: 'interviewer',
              confidence: payload.confidence ?? 0.7,
            });
            const question = await createLiveVoiceQuestion({
              userId,
              sessionId: payload.sessionId,
              text: questionText,
              source: payload.source,
              confidence: payload.confidence,
            });
            console.info('[Speech] Question Classification Updated', {
              sessionId: payload.sessionId,
              type: question.classification.type,
            });
            io.to(payload.sessionId).emit('voice:question', {
              ...question,
              sequence,
            });
            console.info('[AI] Streaming Response Started', {
              sessionId: payload.sessionId,
              sequence,
            });
            const suggestion = await createLiveVoiceSuggestion({
              userId,
              sessionId: payload.sessionId,
              text: questionText,
              source: payload.source,
              confidence: payload.confidence,
            });
            await emitAnswerChunks(io, payload.sessionId, sequence, suggestion);
            io.to(payload.sessionId).emit('voice:answer:complete', {
              id: `voice-${payload.sessionId}-${sequence}`,
              sessionId: payload.sessionId,
              sequence,
              question: suggestion.question,
              answer: suggestion.answer,
              code: suggestion.code || null,
              output: suggestion.output || null,
              language: suggestion.language || null,
              complexity: suggestion.complexity || null,
              rootCause: suggestion.rootCause || null,
              fix: suggestion.fix || null,
              analysisMode: suggestion.analysisMode,
              promptDebug: suggestion.promptDebug,
              keyPoints: suggestion.keyPoints,
              confidence: suggestion.confidence,
              provider: suggestion.provider,
              type: suggestion.type,
              createdAt: new Date().toISOString(),
              live: true,
            });
          } catch (error) {
            fail(socket, undefined, error);
          } finally {
            const activeState = getVoiceState(payload.sessionId);
            activeState.inFlight = false;
            const nextText = activeState.pendingText;
            if (nextText && nextText !== questionText) {
              void runVoiceIntelligence(nextText);
            }
          }
        };

        void runVoiceIntelligence(text);
      } catch (error) {
        fail(socket, acknowledge, error);
      }
    });

    socket.on('assistant:request', async ({ sessionId, question }, acknowledge) => {
      try {
        io.to(sessionId).emit('question:detected', {
          question,
          source: 'manual',
        });
        const suggestion = await createSuggestion(userId, sessionId, question);
        io.to(sessionId).emit('assistant:response', suggestion);
        io.to(sessionId).emit('answer:generated', suggestion);
        respond(acknowledge, suggestion);
      } catch (error) {
        fail(socket, acknowledge, error);
      }
    });

    socket.on('interview:start', async (payload, acknowledge) => {
      try {
        console.info('[Interview] Start Request', {
          sessionId: payload.sessionId,
          sourceId: payload.sourceId,
          sourceName: payload.sourceName,
        });
        if (payload.stealthMode) {
          console.info('[Interview] Running in Stealth Mode', {
            sessionId: payload.sessionId,
          });
          console.info(`[Stealth] Platform: ${payload.stealthPlatform || 'Unknown'}`);
          console.info(`[Stealth] Meeting: ${payload.activeMeetingApp || 'Not detected'}`);
          console.info(
            payload.stealthProtectionSupported === false
              ? '[Stealth] Capture Protection Limited'
              : '[Stealth] Capture Protection Active',
          );
          console.info('[Stealth] Viewer Visibility Protection Applied');
          console.info('[OCR] Active');
          console.info('[Socket] Connected');
          console.info('[AI] Processing Continues');
        }
        await getSessionById(userId, payload.sessionId);
        await socket.join(payload.sessionId);

        const activeWindowTitle =
          payload.activeWindowTitle || payload.sourceName || '';
        const activeMeetingApp =
          payload.activeMeetingApp ||
          detectMeetingApp(`${payload.sourceName ?? ''} ${activeWindowTitle}`);

        console.info('[Interview] Active Window Detected', {
          activeWindowTitle: activeWindowTitle || 'not detected',
        });
        console.info(
          `[Interview] Meeting App: ${activeMeetingApp || 'None detected'}`,
        );

        const response = {
          success: true,
          activeMeetingApp,
          activeWindowTitle,
        };
        io.to(payload.sessionId).emit('interview:started', response);
        respond(acknowledge, response);
      } catch (error) {
        fail(socket, acknowledge, error);
      }
    });

    socket.on('interview:stop', async ({ sessionId }, acknowledge) => {
      try {
        console.info('[Interview] Stop Request', { sessionId });
        await getSessionById(userId, sessionId);
        voiceStates.delete(sessionId);
        console.info('[Interview] Analysis Pipeline Stopped', { sessionId });
        const response = { success: true };
        io.to(sessionId).emit('interview:stopped', response);
        respond(acknowledge, response);
      } catch (error) {
        fail(socket, acknowledge, error);
      }
    });
  });

  return io;
};
