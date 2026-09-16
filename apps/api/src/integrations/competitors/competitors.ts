export interface CompetitorPriceChecker {
  readonly name: string;
  /** Returns the current price in minor units, or null if the listing is gone. Real implementations must respect robots.txt/ToS (HUMAN_TODO). */
  check(url: string, lastPriceMinor: number | null): Promise<number | null>;
}
export const COMPETITORS = Symbol('COMPETITORS');

export class MockCompetitorChecker implements CompetitorPriceChecker {
  readonly name = 'mock';
  async check(url: string, last: number | null) {
    const h = [...url].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, Math.floor(Date.now() / 86_400_000));
    if (last === null) return 100_000 + (h % 50) * 10_000;
    const change = (h % 7) - 3; // -3..+3 steps
    return Math.max(10_000, last + (Math.abs(change) === 3 ? change * 10_000 : 0));
  }
}
