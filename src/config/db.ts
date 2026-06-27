import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { env } from './env';

const adapter = new PrismaNeon(
  {
    connectionString: env.DATABASE_URL,
    max: env.DATABASE_POOL_MAX,
    connectionTimeoutMillis: env.DATABASE_CONNECT_TIMEOUT_MS,
    idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
  },
  {
    onPoolError: (error) => {
      console.error('[Database] Neon pool error', {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
      });
    },
    onConnectionError: (error) => {
      console.error('[Database] Neon connection error', {
        timestamp: new Date().toISOString(),
        message: error.message,
        stack: error.stack,
      });
    },
  },
);

const createPrismaClient = () =>
  new PrismaClient({
    adapter,
    log: [
      { emit: 'stdout', level: 'warn' },
      { emit: 'event', level: 'error' },
    ],
  });

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>;
  prismaConnected?: boolean;
  prismaDisconnectPromise?: Promise<void>;
  prismaLoggingInitialized?: boolean;
};

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient();

// Cache in every environment. Electron development reloads and production startup
// paths must share the same process-level pool.
globalForPrisma.prisma = prisma;

if (!globalForPrisma.prismaLoggingInitialized) {
  prisma.$on('error', (event) => {
    console.error('[Database] Prisma operation failed', {
      timestamp: new Date().toISOString(),
      operation: 'query',
      model: 'unknown',
      query: event.target,
      connectionState: globalForPrisma.prismaConnected ? 'connected' : 'not-connected',
      message: event.message,
      stack: new Error(event.message).stack,
    });
  });
  globalForPrisma.prismaLoggingInitialized = true;
}

export const connectDatabase = async (): Promise<void> => {
  if (globalForPrisma.prismaConnected) return;

  await prisma.$connect();
  globalForPrisma.prismaConnected = true;
  console.log('[Database] Prisma connection pool ready', {
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    adapter: 'PrismaNeon',
    poolMax: env.DATABASE_POOL_MAX,
    idleTimeoutMs: env.DATABASE_IDLE_TIMEOUT_MS,
  });
};

export const disconnectDatabase = (): Promise<void> => {
  if (globalForPrisma.prismaDisconnectPromise) {
    return globalForPrisma.prismaDisconnectPromise;
  }

  globalForPrisma.prismaDisconnectPromise = (async () => {
    if (!globalForPrisma.prismaConnected) return;

    await prisma.$disconnect();
    globalForPrisma.prismaConnected = false;
    console.log('[Database] Prisma connection pool closed', {
      timestamp: new Date().toISOString(),
    });
  })();

  return globalForPrisma.prismaDisconnectPromise;
};
