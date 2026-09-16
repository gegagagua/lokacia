import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { sql } from '@lokacia/db';
import { ENV, type Env } from '../config/env';
import { Public } from './decorators';
import { DbService } from './db.service';
import { RedisService } from './redis.service';

@ApiTags('health')
@Public()
@Controller()
export class HealthController {
  constructor(
    private readonly dbs: DbService,
    private readonly redis: RedisService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Get('v1/health')
  async health() {
    const started = Date.now();
    let db = 'ok';
    try {
      await this.dbs.db.execute(sql`select 1`);
    } catch {
      db = 'down';
    }
    return { status: db === 'ok' ? 'ok' : 'degraded', db, redis: this.redis.available ? 'ok' : 'fallback', search: this.env.SEARCH_ENGINE, ms: Date.now() - started, time: new Date().toISOString() };
  }
}
