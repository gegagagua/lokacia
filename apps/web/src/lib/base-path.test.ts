import { describe, expect, it, vi } from 'vitest';

describe('withBase', () => {
  it('prefixes root-relative URLs once and keeps the base root slash-free', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_PATH', '/lokacia');
    vi.resetModules();
    const { withBase, stripBase } = await import('./base-path');
    expect(withBase('/')).toBe('/lokacia');
    expect(withBase('/?q=1')).toBe('/lokacia?q=1');
    expect(withBase('/en/search')).toBe('/lokacia/en/search');
    expect(withBase('/lokacia/api/v1/x')).toBe('/lokacia/api/v1/x');
    expect(withBase('https://x.ge/a')).toBe('https://x.ge/a');
    expect(withBase('//cdn/x')).toBe('//cdn/x');
    expect(stripBase('/lokacia')).toBe('/');
    expect(stripBase('/lokacia/en')).toBe('/en');
    vi.unstubAllEnvs();
  });
});
