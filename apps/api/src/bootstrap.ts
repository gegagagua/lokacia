import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { Env } from './config/env';

/** Shared by main.ts and integration tests so both run the same HTTP pipeline. */
export function configureApp(app: INestApplication, env: Env) {
  app.use(cookieParser());
  app.enableCors({ origin: [env.APP_URL, env.CRM_URL, env.ADMIN_URL], credentials: true });
  app.enableShutdownHooks();
  const http = app.getHttpAdapter().getInstance() as { set?: (k: string, v: unknown) => void };
  http.set?.('trust proxy', 1);
  http.set?.('query parser', 'extended');
}
