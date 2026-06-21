import { createServer } from 'node:http';
import { app } from './app';
import { prisma } from './config/db';
import { env } from './config/env';

import { attachSocketServer } from './socket/socket.server';
import { shutdownOcr } from './services/ocr.service';
import { aiOrchestrator } from './services/ai';

const server = createServer(app);
const io = attachSocketServer(server);

server.listen(env.PORT, () => {
  console.log(`Interview Mate AI API listening on http://localhost:${env.PORT}`);
  void aiOrchestrator.healthCheck().then((providers) => {
    console.log('[AI Health] Startup provider audit complete');
    console.table(providers);
  }).catch((error) => {
    console.warn('[AI Health] Startup audit could not complete; server remains available', error);
  });
});

const shutdown = async (signal: string): Promise<void> => {
  console.log(`${signal} received. Closing the API server...`);

  server.close(async (error) => {
    io.close();
    await shutdownOcr();
    await prisma.$disconnect();

    if (error) {
      console.error('Server shutdown failed', error);
      process.exit(1);
    }

    process.exit(0);
  });
};

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection', reason);
  void shutdown('unhandledRejection');
});
