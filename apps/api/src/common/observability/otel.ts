import { optionalRequire, warn } from './optional';

type NodeSdk = { start(): void; shutdown(): Promise<void> };

let sdk: NodeSdk | null = null;

/**
 * Start OpenTelemetry tracing (OTLP/HTTP) when OTEL_EXPORTER_OTLP_ENDPOINT is set. No-op otherwise.
 * Runtime packages: @opentelemetry/sdk-node, @opentelemetry/auto-instrumentations-node,
 * @opentelemetry/exporter-trace-otlp-http. Must run before http/express/pg/ioredis are required.
 */
export function initOtel(opts: { service: string }): boolean {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) return false;
  const sdkMod = optionalRequire<{ NodeSDK: new (cfg: Record<string, unknown>) => NodeSdk }>('@opentelemetry/sdk-node');
  const auto = optionalRequire<{ getNodeAutoInstrumentations(cfg?: Record<string, unknown>): unknown[] }>('@opentelemetry/auto-instrumentations-node');
  const exporter = optionalRequire<{ OTLPTraceExporter: new (cfg: Record<string, unknown>) => unknown }>('@opentelemetry/exporter-trace-otlp-http');
  if (!sdkMod || !auto || !exporter) {
    warn('OTEL_EXPORTER_OTLP_ENDPOINT is set but OpenTelemetry packages are not installed — tracing disabled');
    return false;
  }
  process.env.OTEL_SERVICE_NAME ??= opts.service;
  // Stable HTTP semconv → metric `http.server.request.duration` (seconds); Grafana dashboard relies on it.
  process.env.OTEL_SEMCONV_STABILITY_OPT_IN ??= 'http';
  const base = endpoint.replace(/\/$/, '');
  // Metrics are optional: exported only when the metrics packages are installed too.
  const metricsExporter = optionalRequire<{ OTLPMetricExporter: new (cfg: Record<string, unknown>) => unknown }>('@opentelemetry/exporter-metrics-otlp-http');
  const metricsSdk = optionalRequire<{ PeriodicExportingMetricReader: new (cfg: Record<string, unknown>) => unknown }>('@opentelemetry/sdk-metrics');
  const metricReader =
    metricsExporter && metricsSdk
      ? new metricsSdk.PeriodicExportingMetricReader({ exporter: new metricsExporter.OTLPMetricExporter({ url: `${base}/v1/metrics` }), exportIntervalMillis: 15_000 })
      : undefined;
  sdk = new sdkMod.NodeSDK({
    serviceName: process.env.OTEL_SERVICE_NAME,
    traceExporter: new exporter.OTLPTraceExporter({ url: `${base}/v1/traces` }),
    ...(metricReader ? { metricReader } : {}),
    instrumentations: [
      auto.getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        // never record SQL parameters / request bodies (personal data)
        '@opentelemetry/instrumentation-pg': { enhancedDatabaseReporting: false },
      }),
    ],
  });
  sdk.start();
  return true;
}

export async function shutdownOtel() {
  await sdk?.shutdown().catch(() => undefined);
}
