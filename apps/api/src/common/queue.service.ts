import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, type JobsOptions } from 'bullmq';
import { ENV, type Env } from '../config/env';

type Handler = (data: any) => Promise<unknown>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Schedule = { name: string; everyMs: number; data?: unknown };

/**
 * All background work goes through here (CLAUDE.md). Driver `bullmq` uses Redis queues + repeatable jobs;
 * driver `inline` runs handlers on the next tick (tests) and exposes `drain()` / `runNow()`.
 */
@Injectable()
export class QueueService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Queue');
  private readonly handlers = new Map<string, Handler>();
  private readonly schedules: Schedule[] = [];
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private pending: Promise<unknown>[] = [];
  private timers: NodeJS.Timeout[] = [];

  constructor(@Inject(ENV) private readonly env: Env) {}

  /** Register a job handler (call from module constructors / onModuleInit). */
  register(name: string, handler: Handler) {
    // Several modules may subscribe to the same event (e.g. `listings.published` → alerts, demand, CRM matching).
    const prev = this.handlers.get(name);
    if (!prev) {
      this.handlers.set(name, handler);
      return;
    }
    this.handlers.set(name, async (data) => {
      const results = await Promise.allSettled([prev(data), handler(data)]);
      const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
      if (failed) throw failed.reason;
      return results.map((r) => (r as PromiseFulfilledResult<unknown>).value);
    });
  }

  /** Register a repeatable job. */
  every(name: string, everyMs: number, data?: unknown) {
    this.schedules.push({ name, everyMs, data });
  }

  async add(name: string, data: unknown = {}, opts: JobsOptions = {}) {
    if (this.queue) {
      await this.queue.add(name, data, { removeOnComplete: 1000, removeOnFail: 5000, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, ...opts });
      return;
    }
    const run = this.runNow(name, data).catch((e: Error) => this.logger.error(`job ${name} failed: ${e.message}`));
    this.pending.push(run);
  }

  async runNow(name: string, data: unknown = {}) {
    const h = this.handlers.get(name);
    if (!h) throw new Error(`No handler for job "${name}"`);
    return h(data);
  }

  /** Inline driver: await all queued work (used by tests). */
  async drain() {
    while (this.pending.length) {
      const batch = this.pending.splice(0);
      await Promise.all(batch);
    }
  }

  async onApplicationBootstrap() {
    if (this.env.QUEUE_DRIVER !== 'bullmq' || this.env.NODE_ENV === 'test') return;
    const connection = { url: this.env.REDIS_URL, maxRetriesPerRequest: null };
    try {
      this.queue = new Queue('lokacia', { connection });
      await this.queue.waitUntilReady();
      if (this.env.JOBS_ENABLED) {
        this.worker = new Worker(
          'lokacia',
          async (job) => {
            const h = this.handlers.get(job.name);
            if (!h) throw new Error(`No handler for job "${job.name}"`);
            return h(job.data);
          },
          { connection, concurrency: 5 },
        );
        this.worker.on('failed', (job, err) => this.logger.warn(`job ${job?.name} failed: ${err.message}`));
        for (const s of this.schedules) {
          await this.queue.upsertJobScheduler(`sched:${s.name}`, { every: s.everyMs }, { name: s.name, data: s.data ?? {} });
        }
      }
      this.logger.log(`BullMQ ready (${this.handlers.size} handlers, ${this.schedules.length} schedules)`);
    } catch (e) {
      this.logger.warn(`BullMQ unavailable (${(e as Error).message}); falling back to inline driver`);
      await this.queue?.close().catch(() => undefined);
      this.queue = null;
      if (this.env.JOBS_ENABLED) {
        for (const s of this.schedules) this.timers.push(setInterval(() => void this.add(s.name, s.data), s.everyMs));
      }
    }
  }

  async onModuleDestroy() {
    this.timers.forEach(clearInterval);
    await this.worker?.close();
    await this.queue?.close();
  }
}
