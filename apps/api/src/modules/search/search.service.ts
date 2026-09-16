import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { parseSearch, type AiClient } from '@lokacia/ai';
import type { SearchParseResponse, SearchQuery } from '@lokacia/contracts';
import { ENV, type Env } from '../../config/env';
import { DbService } from '../../common/db.service';
import { QueueService } from '../../common/queue.service';
import { RedisService } from '../../common/redis.service';
import { AI } from '../../integrations/integrations.module';
import { ListingReadService } from '../listings/listing-read.service';
import { MeiliSearchEngine, PostgresSearchEngine, type SearchEngine } from './search.engine';

@Injectable()
export class SearchService implements OnModuleInit {
  readonly engine: SearchEngine;
  constructor(
    dbs: DbService,
    @Inject(ENV) env: Env,
    private readonly read: ListingReadService,
    private readonly queue: QueueService,
    private readonly redis: RedisService,
    @Inject(AI) private readonly ai: AiClient,
  ) {
    this.engine = env.SEARCH_ENGINE === 'meilisearch' ? new MeiliSearchEngine(dbs.db, env.MEILI_URL, env.MEILI_MASTER_KEY) : new PostgresSearchEngine(dbs.db);
  }

  onModuleInit() {
    this.queue.register('search.index', (d: { listingId: string }) => this.engine.index(d.listingId));
  }

  /** Called on every listing change (status, price, passport) — indexing happens in the queue. */
  async listingChanged(listingId: string) {
    await this.queue.add('search.index', { listingId });
  }

  async search(q: SearchQuery) {
    const r = await this.engine.search(q);
    return { items: await this.read.cards(r.ids), total: r.total, nextCursor: r.nextCursor, tookMs: r.tookMs };
  }

  map(q: SearchQuery) {
    return this.engine.mapPoints(q);
  }

  /** P13: text → validated filters, cached 24h; fallback to rule parser/keyword search. */
  async parse(text: string): Promise<SearchParseResponse> {
    const key = `parse:${createHash('sha1').update(text.trim().toLowerCase()).digest('hex')}`;
    const cached = await this.redis.get(key);
    if (cached) return { filters: JSON.parse(cached), source: 'cache' };
    const r = await parseSearch(this.ai, text);
    await this.redis.set(key, JSON.stringify(r.filters), 24 * 3600);
    return r;
  }
}
