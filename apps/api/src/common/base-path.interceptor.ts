import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { map } from 'rxjs';
import { ENV, type Env } from '../config/env';

/** Adds PUBLIC_BASE_PATH to root-relative `/api/v1/...` URLs (media, uploads) at any depth of a JSON response. */
export function prefixApiUrls(value: unknown, base: string, depth = 0): unknown {
  if (typeof value === 'string') return value.startsWith('/api/v1/') ? `${base}${value}` : value;
  if (depth > 12 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => prefixApiUrls(v, base, depth + 1));
  if (Object.getPrototypeOf(value) !== Object.prototype) return value; // Date, Buffer, streams, StreamableFile
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, prefixApiUrls(v, base, depth + 1)]));
}

/**
 * Sub-path hosting (e.g. https://digitalfix.cloud/lokacia): stored media URLs are root-relative (`/api/v1/media/...`) and
 * would escape the sub-path in the browser. No-op when PUBLIC_BASE_PATH is empty (domain-root deployments).
 */
@Injectable()
export class BasePathInterceptor implements NestInterceptor {
  private readonly base: string;
  constructor(@Inject(ENV) env: Env) {
    this.base = env.PUBLIC_BASE_PATH.replace(/\/$/, '');
  }

  intercept(ctx: ExecutionContext, next: CallHandler) {
    if (!this.base || ctx.getType() !== 'http') return next.handle();
    return next.handle().pipe(map((body: unknown) => prefixApiUrls(body, this.base)));
  }
}
