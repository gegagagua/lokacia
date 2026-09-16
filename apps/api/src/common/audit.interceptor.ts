import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tap } from 'rxjs';
import { auditLog } from '@lokacia/db';
import { SKIP_AUDIT } from './decorators';
import { DbService } from './db.service';
import type { AppRequest } from './request';

const SENSITIVE = /code|token|secret|password|key/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, SENSITIVE.test(k) ? '[redacted]' : redact(v, depth + 1)]));
}

/** Writes audit_log for every successful authenticated mutation (CLAUDE.md: full action log). */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Audit');
  constructor(
    private readonly dbs: DbService,
    private readonly reflector: Reflector,
  ) {}

  intercept(ctx: ExecutionContext, next: CallHandler) {
    if (ctx.getType() !== 'http') return next.handle();
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const mutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method);
    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_AUDIT, [ctx.getHandler(), ctx.getClass()]);
    if (!mutation || skip) return next.handle();

    return next.handle().pipe(
      tap((result: unknown) => {
        if (!req.user) return;
        const route = (req.route?.path as string | undefined) ?? req.path;
        const segments = route.replace(/^\/?v1\//, '').split('/').filter((s) => s && !s.startsWith(':'));
        const entity = segments[0] ?? 'unknown';
        const entityId =
          (req.params?.id as string | undefined) ??
          (result && typeof result === 'object' && 'id' in result ? String((result as { id: unknown }).id) : null);
        this.dbs.db
          .insert(auditLog)
          .values({
            actorId: req.user.impersonatorId ?? req.user.id,
            impersonatorId: req.user.impersonatorId ? req.user.impersonatorId : null,
            orgId: req.org?.id ?? null,
            action: `${req.method.toLowerCase()} ${segments.join('.')}`,
            entity,
            entityId,
            diff: redact({ body: req.body, actingAs: req.user.impersonatorId ? req.user.id : undefined }) as object,
            ip: req.ip,
          })
          .catch((e: Error) => this.logger.warn(`audit write failed: ${e.message}`));
      }),
    );
  }
}
