import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { and, eq, isNull, listings } from '@lokacia/db';
import { createApp } from './helpers';
import { orgIdBySlug } from './crm-helpers';

const XSD = path.resolve(__dirname, '../assets/feeds/lokacia-feed.xsd');

describe('C9 XML feed', () => {
  let ctx: Awaited<ReturnType<typeof createApp>>;
  beforeAll(async () => (ctx = await createApp()));
  afterAll(async () => ctx.app.close());

  it('serves active org listings as cacheable, well-formed XML valid against the XSD', async () => {
    const orgId = await orgIdBySlug(ctx.db, 'city-spaces');
    const res = await ctx.http().get(`/v1/feeds/${orgId}.xml`).buffer(true).parse((r, cb) => {
      let data = '';
      r.setEncoding('utf8');
      r.on('data', (c: string) => (data += c));
      r.on('end', () => cb(null, data));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/xml/);
    expect(res.headers['cache-control']).toMatch(/max-age=600/);
    expect(res.headers.etag).toBeTruthy();
    const xml = res.body as string;
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);

    // structural assertions
    const active = await ctx.db.select({ id: listings.id }).from(listings).where(and(eq(listings.orgId, orgId), eq(listings.status, 'active'), isNull(listings.deletedAt)));
    const ids = [...xml.matchAll(/<listing id="([0-9a-f-]{36})"/g)].map((m) => m[1]);
    expect(ids.length).toBe(active.length);
    expect(new Set(ids)).toEqual(new Set(active.map((a) => a.id)));
    expect(xml).toMatch(new RegExp(`<listings count="${active.length}">`));
    expect(xml).toMatch(/<feed version="1.0" generatedAt="[^"]+">/);
    expect(xml.match(/<listing /g)?.length).toBe(xml.match(/<\/listing>/g)?.length);
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);

    // XSD validation with libxml2's xmllint when present (macOS ships /usr/bin/xmllint)
    const xmllint = ['/usr/bin/xmllint', '/opt/homebrew/bin/xmllint', '/usr/local/bin/xmllint'].find((p) => existsSync(p));
    if (xmllint) {
      const dir = mkdtempSync(path.join(os.tmpdir(), 'lk-feed-'));
      const file = path.join(dir, 'feed.xml');
      writeFileSync(file, xml);
      const out = execFileSync(xmllint, ['--noout', '--schema', XSD, file], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      expect(out).toBe('');
    }

    // second request is served from cache with the same ETag; conditional GET → 304
    const again = await ctx.http().get(`/v1/feeds/${orgId}.xml`);
    expect(again.headers['x-cache']).toBe('HIT');
    expect(again.headers.etag).toBe(res.headers.etag);
    const notModified = await ctx.http().get(`/v1/feeds/${orgId}.xml`).set('if-none-match', res.headers.etag as string);
    expect(notModified.status).toBe(304);
  });

  it('returns 404 for unknown organizations and bad file names', async () => {
    expect((await ctx.http().get('/v1/feeds/00000000-0000-4000-8000-000000000000.xml')).status).toBe(404);
    const orgId = await orgIdBySlug(ctx.db, 'city-spaces');
    expect((await ctx.http().get(`/v1/feeds/${orgId}.json`)).status).toBe(404);
    expect((await ctx.http().get('/v1/feeds/not-a-uuid.xml')).status).toBe(404);
  });
});
