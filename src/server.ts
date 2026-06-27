import { createServer } from 'node:http';
import { app } from './app';
import { connectDatabase, disconnectDatabase } from './config/db';
import { env } from './config/env';

import { attachSocketServer } from './socket/socket.server';
import { shutdownOcr } from './services/ocr.service';
import { aiOrchestrator } from './services/ai';
import { logRazorpayConfigStatus } from './services/razorpay.service';
import { recoverInterruptedSessionRuntimes } from './services/session.service';

const server = createServer(app);
const io = attachSocketServer(server);
let shutdownPromise: Promise<void> | null = null;

logRazorpayConfigStatus();

const start = async (): Promise<void> => {
  await connectDatabase();
  const recoveredSessions = await recoverInterruptedSessionRuntimes();
  if (recoveredSessions) {
    console.info('[Interview] Recovered interrupted session runtimes', {
      count: recoveredSessions,
    });
  }

  server.listen(env.PORT, () => {
    console.log(`Interview Mate AI API listening on http://localhost:${env.PORT}`);
    void aiOrchestrator.healthCheck().then((providers) => {
      console.log('[AI Health] Startup provider audit complete');
      console.table(providers);
    }).catch((error) => {
      console.warn('[AI Health] Startup audit could not complete; server remains available', error);
    });
  });
};

const shutdown = async (signal: string): Promise<void> => {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    console.log(`${signal} received. Closing the API server...`);

    const serverError = await new Promise<Error | undefined>((resolve) => {
      if (!server.listening) {
        resolve(undefined);
        return;
      }
      server.close((error) => resolve(error));
    });

    io.close();
    await shutdownOcr();
    await disconnectDatabase();

    if (serverError) throw serverError;
  })();

  return shutdownPromise;
};

const terminate = (signal: string): void => {
  void shutdown(signal)
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Server shutdown failed', error);
      process.exit(1);
    });
};

process.once('SIGTERM', () => terminate('SIGTERM'));
process.once('SIGINT', () => terminate('SIGINT'));
process.once('beforeExit', () => {
  void disconnectDatabase();
});

process.once('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection', reason);
  terminate('unhandledRejection');
});

void start().catch((error) => {
  console.error('[Database] Backend startup aborted because PostgreSQL is unavailable', {
    timestamp: new Date().toISOString(),
    error,
  });
  terminate('startupFailure');
});
