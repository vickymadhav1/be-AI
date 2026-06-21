import type { RealtimeServer } from '../types/realtime';

let realtimeServer: RealtimeServer | null = null;

export const setRealtimeServer = (server: RealtimeServer): void => {
  realtimeServer = server;
};

export const emitToSession = (
  sessionId: string,
  event: 'transcript:update' | 'question:detected' | 'answer:generated' | 'screen:updated',
  payload: unknown,
): void => {
  realtimeServer?.to(sessionId).emit(event, payload);
};
