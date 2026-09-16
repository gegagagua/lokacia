import { Injectable } from '@nestjs/common';
import { eq, settings } from '@lokacia/db';
import { DbService } from './db.service';

const DEFAULTS: Record<string, unknown> = {
  launch_promo_until: null,
  liveness_interval_days: 12,
  liveness_grace_hours: 72,
  demand_expiry_days: 30,
  reveal_rate_limit_per_hour: 20,
  services_commission_pct: 10,
  transfer_commission_pct: 1.5,
  vat_pct: 18,
};

/** Runtime settings from the `settings` table (prices, liveness days, promo), cached for 30s. */
@Injectable()
export class SettingsService {
  private cache: { at: number; values: Record<string, unknown> } | null = null;
  constructor(private readonly dbs: DbService) {}

  async all(): Promise<Record<string, unknown>> {
    if (this.cache && Date.now() - this.cache.at < 30_000) return this.cache.values;
    const rows = await this.dbs.db.select().from(settings);
    const values = { ...DEFAULTS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) };
    this.cache = { at: Date.now(), values };
    return values;
  }

  async get<T>(key: string): Promise<T> {
    return (await this.all())[key] as T;
  }

  async number(key: string): Promise<number> {
    return Number(await this.get(key));
  }

  async set(key: string, value: unknown) {
    const existing = await this.dbs.db.query.settings.findFirst({ where: eq(settings.key, key) });
    if (existing) await this.dbs.db.update(settings).set({ value: value as object }).where(eq(settings.key, key));
    else await this.dbs.db.insert(settings).values({ key, value: value as object });
    this.cache = null;
  }

  /** Launch promo (PRODUCT.md): everything free until this date. */
  async promoActive(now = new Date()): Promise<boolean> {
    const until = await this.get<string | null>('launch_promo_until');
    return !!until && new Date(until) >= now;
  }
}
