import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { createDb, withOrg, withSystem, type Db, type Tx } from '@lokacia/db';
import { ENV, type Env } from '../config/env';

@Injectable()
export class DbService implements OnModuleDestroy {
  readonly db: Db;
  private readonly client: ReturnType<typeof createDb>['client'];

  constructor(@Inject(ENV) env: Env) {
    const { db, client } = createDb(env.DATABASE_URL, { max: env.NODE_ENV === 'test' ? 5 : 20 });
    this.db = db;
    this.client = client;
  }

  /** Org-scoped transaction: RLS limits org-owned tables to `orgId`. */
  org<T>(orgId: string, fn: (tx: Tx) => Promise<T>) {
    return withOrg(this.db, orgId, fn);
  }

  /** System transaction (jobs, admin, token links): explicit RLS bypass. */
  system<T>(fn: (tx: Tx) => Promise<T>) {
    return withSystem(this.db, fn);
  }

  async onModuleDestroy() {
    await this.client.end({ timeout: 5 });
  }
}
