import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import type { Env } from './config/env';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** Routes that legitimately receive non-JSON bodies: signed local media uploads (raw bytes) and CRM file imports (multipart). */
const NON_JSON_ALLOWED = [/^\/v1\/media\/uploads\/[^/]+$/, /^\/v1\/crm\/imports(\/|$)/];

/**
 * CSRF defence in depth (cookies are SameSite=Lax; every API mutation is JSON): a mutation that carries a body must be
 * `application/json` (or `+json`). HTML forms can only send `application/x-www-form-urlencoded`, `multipart/form-data`
 * or `text/plain` cross-site without a CORS preflight, so those are refused with 415 outside the upload/import routes.
 */
export function jsonOnlyMutations(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING.has(req.method)) return next();
  const length = Number(req.headers['content-length'] ?? 0);
  const hasBody = length > 0 || req.headers['transfer-encoding'] !== undefined;
  const type = String(req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
  if (!hasBody && !type) return next();
  if (type === 'application/json' || /^application\/[a-z0-9.+-]+\+json$/.test(type)) return next();
  const path = req.path.replace(/^\/api(?=\/v1\/)/, '');
  if (NON_JSON_ALLOWED.some((r) => r.test(path))) return next();
  if (!hasBody && type) return next(); // empty body with a stray content-type header carries no payload
  res.status(415).type('application/problem+json').json({
    type: 'https://lokacia.ge/problems/unsupported-media-type',
    title: 'მოთხოვნის ფორმატი არ არის მხარდაჭერილი',
    status: 415,
    detail: 'Mutations must send application/json',
  });
}

/** Shared by main.ts and integration tests so both run the same HTTP pipeline. */
export function configureApp(app: INestApplication, env: Env) {
  app.use(cookieParser());
  app.use(jsonOnlyMutations);
  // MOBILE_WEB_URL: Expo web preview of apps/mobile (native apps send no Origin); dev falls back to :8190.
  const mobileWeb = env.MOBILE_WEB_URL || (env.NODE_ENV !== 'production' ? 'http://localhost:8190' : '');
  // CORS compares bare origins; APP_URL may carry a sub-path (https://digitalfix.cloud/lokacia)
  app.enableCors({ origin: [env.APP_URL, env.CRM_URL, env.ADMIN_URL, ...(mobileWeb ? [mobileWeb] : [])].map((u) => new URL(u).origin), credentials: true });
  app.enableShutdownHooks();
  const http = app.getHttpAdapter().getInstance() as { set?: (k: string, v: unknown) => void };
  http.set?.('trust proxy', 1);
  http.set?.('query parser', 'extended');
}
