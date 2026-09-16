import { optionalRequire, warn } from './optional';

type SentryLike = {
  init(opts: Record<string, unknown>): void;
  captureException(e: unknown, ctx?: Record<string, unknown>): string;
  flush(timeoutMs?: number): Promise<boolean>;
};

let sentry: SentryLike | null = null;

/** Initialise Sentry when SENTRY_DSN is set. No-op otherwise. Requires `@sentry/node` at runtime. */
export function initSentry(opts: { service: string; release?: string }): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  const mod = optionalRequire<SentryLike>('@sentry/node');
  if (!mod) {
    warn('SENTRY_DSN is set but @sentry/node is not installed — error reporting disabled');
    return false;
  }
  mod.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development',
    release: opts.release ?? process.env.GIT_SHA,
    serverName: opts.service,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    sendDefaultPii: false, // Georgian personal-data law: never ship phones/IPs to a third party by default
  });
  sentry = mod;
  return true;
}

export function captureException(e: unknown, extra?: Record<string, unknown>) {
  sentry?.captureException(e, extra ? { extra } : undefined);
}

export async function flushSentry(timeoutMs = 2000) {
  await sentry?.flush(timeoutMs);
}
