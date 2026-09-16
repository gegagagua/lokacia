import { describe, expect, it } from 'vitest';
import queries from '../evals/search-queries.json';
import { parseSearch, createAiClient } from './index';

type Case = { text: string; expected: Record<string, unknown> };

function matches(actual: Record<string, unknown>, expected: Record<string, unknown>) {
  return Object.entries(expected).every(([k, v]) => JSON.stringify(actual[k]) === JSON.stringify(v));
}

describe('NL search parser eval (P13)', () => {
  it('≥ 90% of 50 Georgian queries parse correctly', async () => {
    const ai = createAiClient(process.env.AI_LIVE ? process.env : {});
    const failures: { text: string; got: unknown; expected: unknown }[] = [];
    for (const c of queries as Case[]) {
      const { filters } = await parseSearch(ai, c.text);
      if (!matches(filters as Record<string, unknown>, c.expected)) failures.push({ text: c.text, got: filters, expected: c.expected });
    }
    const score = 1 - failures.length / queries.length;
    if (failures.length) console.log(JSON.stringify(failures, null, 1));
    expect(queries.length).toBe(50);
    expect(score).toBeGreaterThanOrEqual(0.9);
  });
});
