import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Response } from 'express';
import type { ApiScope } from '@lokacia/contracts';
import { ProblemException } from '../../../common/problem';
import { RateLimitService } from '../../../common/redis.service';
import type { AppRequest } from '../../../common/request';
import { ApiKeysService } from './api-keys.service';

export const API_SCOPE_KEY = 'apiScope';
/** Required scope for a /v1/public endpoint. */
export const RequireScope = (scope: ApiScope) => SetMetadata(API_SCOPE_KEY, scope);

/** Authenticates `x-api-key`, enforces scope, per-minute rate limit and monthly quota, meters usage. */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly keys: ApiKeysService,
    private readonly rate: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<AppRequest>();
    const res = ctx.switchToHttp().getResponse<Response>();
    const raw = String(req.headers['x-api-key'] ?? '');
    if (!raw) throw new ProblemException(401, 'api-key-missing', 'API გასაღები არ არის მითითებული', 'გადაეცით x-api-key ჰედერი');
    const key = await this.keys.findByRaw(raw);
    if (!key) throw new ProblemException(401, 'api-key-invalid', 'API გასაღები არასწორია ან გაუქმებულია');
    const scope = this.reflector.get<ApiScope | undefined>(API_SCOPE_KEY, ctx.getHandler());
    if (scope && !key.scopes.includes(scope)) throw new ProblemException(403, 'api-scope', 'გასაღებს არ აქვს ამ მონაცემების წვდომა', scope);
    res.setHeader('x-ratelimit-limit', String(key.rateLimitPerMin));
    const { remaining } = await this.rate.hit(`apikey:${key.id}`, key.rateLimitPerMin, 60);
    res.setHeader('x-ratelimit-remaining', String(Math.max(0, remaining)));
    const used = await this.keys.usedThisMonth(key.id);
    if (used >= key.monthlyQuota) throw new ProblemException(429, 'api-quota', 'თვიური ლიმიტი გადაჭარბებულია', `${used}/${key.monthlyQuota}`);
    req.apiKey = { id: key.id, orgId: key.orgId, scopes: key.scopes };
    const endpoint = ((req.route as { path?: string } | undefined)?.path ?? req.path).replace(/^\/?/, '/');
    await this.keys.meter(key.id, endpoint);
    return true;
  }
}
