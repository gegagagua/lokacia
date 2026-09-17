import { describe, expect, it } from 'vitest';
import { prefixApiUrls } from './base-path.interceptor';

describe('prefixApiUrls', () => {
  it('prefixes nested root-relative API URLs only', () => {
    const at = new Date();
    const out = prefixApiUrls({ cover: '/api/v1/media/files/a.webp', items: [{ url: '/api/v1/media/placeholder/x.svg' }], link: '/listings/x', ext: 'https://x.ge/api/v1/a', at, n: 3 }, '/lokacia');
    expect(out).toEqual({ cover: '/lokacia/api/v1/media/files/a.webp', items: [{ url: '/lokacia/api/v1/media/placeholder/x.svg' }], link: '/listings/x', ext: 'https://x.ge/api/v1/a', at, n: 3 });
  });
});
