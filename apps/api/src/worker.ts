import './common/observability/register-worker';
import { shutdownObservability } from './common/observability';
import 'reflect-metadata';
import { Logger as NestLogger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

/**
 * BullMQ worker process (no HTTP). Boots the same Nest module graph as the API so every module
 * registers its queue handlers and schedules in onModuleInit, then QueueService starts the Worker.
 *
 * Production topology: API pods run with JOBS_ENABLED=false (they only enqueue), worker pods run this
 * entrypoint (JOBS_ENABLED forced to true). Scale workers horizontally; repeatable jobs are deduplicated
 * by BullMQ job schedulers.
 */
process.env.JOBS_ENABLED = 'true';
if (process.env.QUEUE_DRIVER === 'inline') {
  new NestLogger('Worker').warn('QUEUE_DRIVER=inline — the worker only runs schedules locally; use bullmq in production');
}

async function bootstrap() {
  // Required after env is forced so the ENV provider sees JOBS_ENABLED=true.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { AppModule } = require('./app.module') as typeof import('./app.module');
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const log = app.get(Logger);
  log.log('Worker started (BullMQ, no HTTP)');

  let stopping = false;
  const stop = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.log(`Worker ${signal}: draining active jobs`);
    const force = setTimeout(() => process.exit(1), Number(process.env.WORKER_SHUTDOWN_TIMEOUT_MS ?? 30_000));
    force.unref();
    try {
      await app.close(); // QueueService.onModuleDestroy → worker.close() waits for in-flight jobs
      await shutdownObservability();
      process.exit(0);
    } catch (e) {
      log.error(`Worker shutdown failed: ${(e as Error).message}`);
      process.exit(1);
    }
  };
  process.once('SIGTERM', () => void stop('SIGTERM'));
  process.once('SIGINT', () => void stop('SIGINT'));
}

void bootstrap();
