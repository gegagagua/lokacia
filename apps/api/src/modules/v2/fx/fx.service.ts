import { Controller, Get, Header, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { desc, eq, fxRates } from '@lokacia/db';
import type { FxRatesResponse } from '@lokacia/contracts';
import { Public } from '../../../common/decorators';
import { DbService } from '../../../common/db.service';
import { QueueService } from '../../../common/queue.service';

/** Rates provider (National Bank of Georgia API in production — see HUMAN_TODO). GEL per 1 unit. */
export interface FxProvider {
  readonly name: string;
  rates(day: string): Promise<Record<'USD' | 'EUR', number>>;
}

/** Deterministic mock around recent NBG levels. */
export class MockFxProvider implements FxProvider {
  readonly name = 'mock';
  async rates(day: string) {
    const n = Number(day.replace(/-/g, '')) % 97;
    return { USD: 2.7 + ((n % 11) - 5) / 1000, EUR: 2.94 + ((n % 13) - 6) / 1000 };
  }
}

@Injectable()
export class FxService implements OnModuleInit {
  private readonly logger = new Logger('Fx');
  private readonly provider: FxProvider = new MockFxProvider();
  constructor(
    private readonly dbs: DbService,
    private readonly queue: QueueService,
  ) {}

  onModuleInit() {
    this.queue.register('v2.fx.refresh', () => this.refresh());
    this.queue.every('v2.fx.refresh', 12 * 3600_000);
  }

  async refresh(day = new Date().toISOString().slice(0, 10)) {
    const rates = await this.provider.rates(day);
    for (const [currency, rate] of Object.entries(rates)) {
      const rateX10000 = Math.round(rate * 10000);
      await this.dbs.db.insert(fxRates).values({ currency, day, rateX10000 }).onConflictDoUpdate({ target: [fxRates.currency, fxRates.day], set: { rateX10000, updatedAt: new Date() } });
    }
    return { day, rates };
  }

  async latest(): Promise<FxRatesResponse> {
    const usd = await this.dbs.db.query.fxRates.findFirst({ where: eq(fxRates.currency, 'USD'), orderBy: desc(fxRates.day) });
    const eur = await this.dbs.db.query.fxRates.findFirst({ where: eq(fxRates.currency, 'EUR'), orderBy: desc(fxRates.day) });
    if (!usd || !eur) {
      const r = await this.refresh();
      return { base: 'GEL', day: r.day, rates: r.rates, provider: this.provider.name };
    }
    return { base: 'GEL', day: usd.day, rates: { USD: usd.rateX10000 / 10000, EUR: eur.rateX10000 / 10000 }, provider: this.provider.name };
  }
}

@ApiTags('fx')
@Public()
@Controller('v1/fx')
export class FxController {
  constructor(private readonly fx: FxService) {}

  @Get('rates')
  @Header('cache-control', 'public, max-age=900')
  rates() {
    return this.fx.latest();
  }
}
