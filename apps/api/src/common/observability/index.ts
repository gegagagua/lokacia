import '../../config/env'; // loads the monorepo .env before reading SENTRY_DSN / OTEL_* (side effect only)
import { flushSentry, initSentry } from './sentry';
import { initOtel, shutdownOtel } from './otel';

export { captureException } from './sentry';

let started = false;

/**
 * Opt-in observability. Safe to call unconditionally: with empty SENTRY_DSN and
 * OTEL_EXPORTER_OTLP_ENDPOINT it does nothing and loads nothing.
 */
export function initObservability(service: 'lokacia-api' | 'lokacia-worker') {
  if (started) return { sentry: false, otel: false };
  started = true;
  const otel = initOtel({ service });
  const sentry = initSentry({ service });
  return { sentry, otel };
}

export async function shutdownObservability() {
  await Promise.all([flushSentry(), shutdownOtel()]);
}
