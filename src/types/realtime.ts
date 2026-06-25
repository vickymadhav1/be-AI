import type { Server, Socket } from 'socket.io';
import type { JwtPayload } from './auth';

export interface SuggestionResult {
  question: string;
  answer: string;
  keyPoints: string[];
  confidence: number;
}

export interface InterviewStartPayload {
  sessionId: string;
  sourceId?: string;
  sourceName?: string;
  activeMeetingApp?: string;
  activeWindowTitle?: string;
}

export interface ClientToServerEvents {
  'session:join': (
    payload: { sessionId: string },
    acknowledge?: (response: SocketAck) => void,
  ) => void;
  'session:start': (
    payload: { title?: string; company?: string; role?: string },
    acknowledge?: (response: SocketAck) => void,
  ) => void;
  'session:end': (
    payload: { sessionId: string },
    acknowledge?: (response: SocketAck) => void,
  ) => void;
  'transcript:new': (
    payload: {
      sessionId: string;
      speaker: 'interviewer' | 'candidate' | 'system';
      text: string;
    },
    acknowledge?: (response: SocketAck) => void,
  ) => void;
  'assistant:request': (
    payload: { sessionId: string; question: string },
    acknowledge?: (response: SocketAck) => void,
  ) => void;
  'interview:start': (
    payload: InterviewStartPayload,
    acknowledge?: (response: SocketAck) => void,
  ) => void;
  'interview:stop': (
    payload: { sessionId: string },
    acknowledge?: (response: SocketAck) => void,
  ) => void;
}

export interface ServerToClientEvents {
  'session:started': (session: unknown) => void;
  'session:ended': (session: unknown) => void;
  'transcript:stored': (transcript: unknown) => void;
  'assistant:response': (suggestion: unknown) => void;
  'transcript:update': (transcript: unknown) => void;
  'question:detected': (question: unknown) => void;
  'answer:generated': (suggestion: unknown) => void;
  'screen:updated': (context: unknown) => void;
  'interview:started': (payload: {
    success: boolean;
    activeMeetingApp: string;
    activeWindowTitle: string;
  }) => void;
  'interview:stopped': (payload: { success: boolean }) => void;
  'server:error': (error: { message: string; code?: string }) => void;
}

export interface SocketData {
  auth: JwtPayload;
}

export interface SocketAck {
  success: boolean;
  data?: unknown;
  message?: string;
}

export type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

export type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;
