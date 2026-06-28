export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogContext {
  correlationId?: string;
  requestId?: string;
  sessionId?: string;
  lifecycleId?: string;
  ipcChannel?: string;
}

const sensitiveKeyPattern =
  /authorization|token|secret|api[-_]?key|signature|password|email|question|answer|content|code|prompt|transcript|ocr|screenshot|image|audio|terminaloutput|output|keypoints|rootcause|fix/i;
const bearerPattern = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi;
const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const nativeConsole = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  table: console.table.bind(console),
};
let consoleInstalled = false;

export const createCorrelationId = (prefix = 'req') =>
  `${prefix}_${Date.now().toString(36)}_${crypto.randomUUID()}`;

const redactString = (value: string) =>
  value.replace(bearerPattern, 'Bearer [REDACTED]').replace(jwtPattern, '[REDACTED_TOKEN]').replace(emailPattern, '[REDACTED_EMAIL]');

export const redactLogValue = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (typeof value === 'string') return redactString(value);
  if (value instanceof Error) return { name: value.name, message: redactString(value.message) };
  if (!value || typeof value !== 'object') return value;
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item, seen));
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    sensitiveKeyPattern.test(key) ? '[REDACTED]' : redactLogValue(item, seen),
  ]));
};

const write = (level: LogLevel, message: unknown, details: unknown[], context: LogContext = {}) => {
  nativeConsole[level](JSON.stringify({
    timestamp: new Date().toISOString(),
    runtime: 'backend',
    level,
    ...context,
    message: redactLogValue(message),
    ...(details.length ? { details: details.map((item) => redactLogValue(item)) } : {}),
  }));
};

export const logger = {
  debug: (message: unknown, ...details: unknown[]) => write('debug', message, details),
  info: (message: unknown, ...details: unknown[]) => write('info', message, details),
  warn: (message: unknown, ...details: unknown[]) => write('warn', message, details),
  error: (message: unknown, ...details: unknown[]) => write('error', message, details),
  child: (context: LogContext) => ({
    debug: (message: unknown, ...details: unknown[]) => write('debug', message, details, context),
    info: (message: unknown, ...details: unknown[]) => write('info', message, details, context),
    warn: (message: unknown, ...details: unknown[]) => write('warn', message, details, context),
    error: (message: unknown, ...details: unknown[]) => write('error', message, details, context),
  }),
};

export const installConsoleLogger = () => {
  if (consoleInstalled) return;
  consoleInstalled = true;
  console.debug = logger.debug;
  console.log = logger.info;
  console.info = logger.info;
  console.warn = logger.warn;
  console.error = logger.error;
  console.table = (value?: unknown) => logger.info('Console table', value);
};
