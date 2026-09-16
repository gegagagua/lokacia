import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/** Monorepo root = nearest ancestor with pnpm-workspace.yaml (works from src/ and dist/). */
export function repoRoot(from = __dirname): string {
  let dir = from;
  while (dir !== path.dirname(dir)) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

config({ path: path.join(repoRoot(), '.env'), quiet: true });

const bool = z.preprocess((v) => v === 'true' || v === '1' || v === true, z.boolean());

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  APP_URL: z.string().url().default('http://localhost:3100'),
  CRM_URL: z.string().url().default('http://localhost:3101'),
  ADMIN_URL: z.string().url().default('http://localhost:3102'),
  API_URL: z.string().url().default('http://localhost:4000'),
  DATABASE_URL: z.string().default('postgres://lokacia:lokacia@localhost:5432/lokacia'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  QUEUE_DRIVER: z.enum(['bullmq', 'inline']).default('bullmq'),
  JOBS_ENABLED: bool.default(true),
  SEARCH_ENGINE: z.enum(['postgres', 'meilisearch']).default('postgres'),
  MEILI_URL: z.string().default('http://localhost:7700'),
  MEILI_MASTER_KEY: z.string().default(''),
  JWT_ACCESS_SECRET: z.string().min(8).default('dev_access_secret_change_me'),
  JWT_REFRESH_SECRET: z.string().min(8).default('dev_refresh_secret_change_me'),
  COOKIE_DOMAIN: z.string().optional(),
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_DIR: z.string().default(path.join(repoRoot(), 'storage')),
  S3_ENDPOINT: z.string().default(''),
  S3_BUCKET: z.string().default('lokacia-media'),
  S3_ACCESS_KEY: z.string().default(''),
  S3_SECRET_KEY: z.string().default(''),
  IMGPROXY_URL: z.string().default(''),
  MAPTILER_KEY: z.string().default(''),
  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  SMS_PROVIDER: z.string().default('mock'),
  SMS_API_KEY: z.string().default(''),
  OTP_DEV_CODE: z.string().default('123456'),
  TURNSTILE_SECRET: z.string().default(''),
  TELEGRAM_BOT_TOKEN: z.string().default(''),
  /** secret_token passed to Telegram setWebhook; checked on POST /v1/users/telegram/webhook (required in production). */
  TELEGRAM_WEBHOOK_SECRET: z.string().default(''),
  VIBER_BOT_TOKEN: z.string().default(''),
  WHATSAPP_CLOUD_TOKEN: z.string().default(''),
  PUSH_PROVIDER: z.enum(['mock', 'expo']).default('mock'),
  EXPO_ACCESS_TOKEN: z.string().default(''),
  /** Expo web preview origin allowed by CORS; non-production falls back to http://localhost:8190. */
  MOBILE_WEB_URL: z.string().default(''),
  SMTP_URL: z.string().default('smtp://localhost:1025'),
  PAYMENTS_PROVIDER: z.enum(['mock', 'bog', 'tbc', 'psp']).default('mock'),
  PAYMENTS_WEBHOOK_SECRET: z.string().default('dev_webhook_secret'),
  BOG_CLIENT_ID: z.string().default(''),
  BOG_CLIENT_SECRET: z.string().default(''),
  TBC_API_KEY: z.string().default(''),
  PSP_API_URL: z.string().default(''),
  PSP_API_KEY: z.string().default(''),
  ANTHROPIC_API_KEY: z.string().default(''),
  AI_MODEL: z.string().default(''),
  GOOGLE_CALENDAR_CLIENT_ID: z.string().default(''),
  ESIGN_PROVIDER: z.string().default('mock'),
  SENTRY_DSN: z.string().default(''),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().default(''),
  FOOT_TRAFFIC_PROVIDER: z.string().default('mock'),
  LOG_LEVEL: z.string().default('info'),
  IP_HASH_SALT: z.string().default('dev_ip_salt'),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(overrides: Partial<Record<keyof Env, unknown>> = {}): Env {
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  if (parsed.data.NODE_ENV === 'production') {
    for (const k of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (parsed.data[k].startsWith('dev_') || parsed.data[k] === 'change_me') throw new Error(`${k} must be set in production`);
    }
    for (const k of ['IP_HASH_SALT', 'PAYMENTS_WEBHOOK_SECRET'] as const) {
      if (parsed.data[k].startsWith('dev_')) throw new Error(`${k} must be set in production`);
    }
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
