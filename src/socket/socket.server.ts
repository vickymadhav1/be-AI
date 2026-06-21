import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { createSession, endSession } from '../services/session.service';
import { getSessionById } from '../services/session.service';
import { createSuggestion } from '../services/suggestion.service';
import { createTranscript } from '../services/transcript.service';
import type { RealtimeServer, RealtimeSocket, SocketAck } from '../types/realtime';
import { isQuestion } from '../utils/is-question';
import { verifyAccessToken } from '../services/token.service';
import { setRealtimeServer } from './realtime.gateway';

const toError = (error: unknown) => ({
  message: error instanceof Error ? error.message : 'Unexpected realtime server error',
  code:
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code)
      : undefined,
});

const respond = (acknowledge: ((response: SocketAck) => void) | undefined, data: unknown) =>
  acknowledge?.({ success: true, data });

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
  });

  return io;
};
