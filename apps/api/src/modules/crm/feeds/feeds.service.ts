import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, isNull, listingMedia, listings, organizations, spacePassports, users } from '@lokacia/db';
import { PASSPORT_FIELDS } from '@lokacia/contracts';
import { DbService } from '../../../common/db.service';
import { QueueService } from '../../../common/queue.service';
import { RedisService } from '../../../common/redis.service';
import { ENV, type Env } from '../../../config/env';
import { TaxonomyService } from '../../taxonomy/taxonomy.service';

const TTL_SECONDS = 600;

/** Characters not allowed in XML 1.0 documents. */
const INVALID_XML = /[\x00-\x08\x0B\x0C\x0E-\x1F￾￿]/g; // eslint-disable-line no-control-regex

export function xmlEscape(s: string): string {
  return s.replace(INVALID_XML, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

type Node = { name: string; attrs?: Record<string, string | number | null | undefined>; text?: string | number | null; children?: (Node | null)[] };

function render(n: Node, indent = ''): string {
  const attrs = Object.entries(n.attrs ?? {})
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => ` ${k}="${xmlEscape(String(v))}"`)
    .join('');
  const kids = (n.children ?? []).filter((c): c is Node => !!c);
  if (kids.length) return `${indent}<${n.name}${attrs}>\n${kids.map((c) => render(c, `${indent}  `)).join('\n')}\n${indent}</${n.name}>`;
  if (n.text === null || n.text === undefined || n.text === '') return `${indent}<${n.name}${attrs}/>`;
  return `${indent}<${n.name}${attrs}>${xmlEscape(String(n.text))}</${n.name}>`;
}

const leaf = (name: string, text: string | number | null | undefined, attrs?: Node['attrs']): Node | null => (text === null || text === undefined || text === '' ? null : { name, text, attrs });

/**
 * C9 XML feed for other portals: active listings of one organization.
 * Structure is defined by apps/api/assets/feeds/lokacia-feed.xsd. Cached 10 minutes; invalidated on publish.
 */
@Injectable()
export class FeedsService implements OnModuleInit {
  constructor(
    private readonly dbs: DbService,
    private readonly redis: RedisService,
    private readonly queue: QueueService,
    private readonly tax: TaxonomyService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit() {
    this.queue.register('listings.published', async (d: { listingId: string }) => {
      const l = await this.dbs.db.query.listings.findFirst({ where: eq(listings.id, d.listingId), columns: { orgId: true } });
      if (l?.orgId) await this.invalidate(l.orgId);
    });
  }

  cacheKey(orgId: string) {
    return `crm:feed:${orgId}`;
  }

  invalidate(orgId: string) {
    return this.redis.del(this.cacheKey(orgId));
  }

  /** Returns null when the organization does not exist. */
  async get(orgId: string): Promise<{ xml: string; etag: string; cached: boolean } | null> {
    const hit = await this.redis.get(this.cacheKey(orgId));
    if (hit) return { xml: hit, etag: this.etag(hit), cached: true };
    const xml = await this.build(orgId);
    if (xml === null) return null;
    await this.redis.set(this.cacheKey(orgId), xml, TTL_SECONDS);
    return { xml, etag: this.etag(xml), cached: false };
  }

  private etag(xml: string) {
    return `"${createHash('sha1').update(xml).digest('hex').slice(0, 27)}"`;
  }

  private abs(url: string) {
    if (/^https?:\/\//.test(url)) return url;
    return `${this.env.APP_URL}${url.startsWith('/') ? url : `/${url}`}`;
  }

  async build(orgId: string): Promise<string | null> {
    const org = await this.dbs.db.query.organizations.findFirst({ where: and(eq(organizations.id, orgId), isNull(organizations.deletedAt)) });
    if (!org) return null;
    const rows = await this.dbs.db
      .select({ l: listings, p: spacePassports })
      .from(listings)
      .leftJoin(spacePassports, eq(spacePassports.listingId, listings.id))
      .where(and(eq(listings.orgId, orgId), eq(listings.status, 'active'), isNull(listings.deletedAt)))
      .orderBy(asc(listings.createdAt));
    const ids = rows.map((r) => r.l.id);
    const media = ids.length
      ? await this.dbs.db
          .select({ listingId: listingMedia.listingId, url: listingMedia.url, variants: listingMedia.variants, sort: listingMedia.sort })
          .from(listingMedia)
          .where(and(inArray(listingMedia.listingId, ids), eq(listingMedia.kind, 'photo'), isNull(listingMedia.deletedAt), eq(listingMedia.status, 'ready')))
          .orderBy(asc(listingMedia.sort))
      : [];
    const agentIds = [...new Set(rows.map((r) => r.l.agentId ?? r.l.ownerId))];
    const agents = agentIds.length ? await this.dbs.db.select({ id: users.id, name: users.name, phone: users.phone }).from(users).where(inArray(users.id, agentIds)) : [];
    const agentById = new Map(agents.map((a) => [a.id, a]));

    const listingNodes: Node[] = [];
    for (const { l, p } of rows) {
      const district = await this.tax.districtById(l.districtId);
      const agent = agentById.get(l.agentId ?? l.ownerId);
      const passportFields: Node[] = [];
      for (const f of PASSPORT_FIELDS) {
        const v = p ? (p as Record<string, unknown>)[f.key] : null;
        if (v === null || v === undefined || typeof v === 'object') continue;
        passportFields.push({ name: 'field', attrs: { key: f.key, unit: f.unit ?? null }, text: typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v) });
      }
      listingNodes.push({
        name: 'listing',
        attrs: { id: l.id, updatedAt: l.updatedAt.toISOString() },
        children: [
          leaf('url', `${this.env.APP_URL}/listings/${l.slug}`),
          leaf('dealType', l.dealType),
          leaf('status', l.status),
          leaf('title', l.title, { lang: 'ka' }),
          leaf('title', l.titleEn, { lang: 'en' }),
          leaf('title', l.titleRu, { lang: 'ru' }),
          leaf('description', l.description, { lang: 'ka' }),
          leaf('description', l.descriptionEn, { lang: 'en' }),
          leaf('description', l.descriptionRu, { lang: 'ru' }),
          { name: 'price', attrs: { currency: l.currency, period: l.pricePeriod }, text: (l.priceMinor / 100).toFixed(2) },
          leaf('areaM2', Number(l.areaM2).toFixed(2)),
          leaf('floor', l.floor),
          leaf('commissionPct', l.commissionPct === null ? null : Number(l.commissionPct).toFixed(2)),
          { name: 'location', children: [leaf('city', l.city), leaf('district', district?.nameKa ?? null), leaf('address', l.address), leaf('lat', l.lat), leaf('lng', l.lng)] },
          { name: 'businessTypes', children: l.businessTypes.map((b) => leaf('businessType', b)) },
          passportFields.length ? { name: 'passport', children: passportFields } : null,
          { name: 'photos', children: media.filter((m) => m.listingId === l.id).map((m) => leaf('photo', this.abs(m.variants?.lg ?? m.url))) },
          { name: 'contact', children: [leaf('name', agent?.name ?? org.name), leaf('phone', agent?.phone ?? org.phone), leaf('email', org.email)] },
        ],
      });
    }
    const root: Node = {
      name: 'feed',
      attrs: { version: '1.0', generatedAt: new Date().toISOString() },
      children: [
        { name: 'agency', attrs: { id: org.id }, children: [leaf('name', org.name), leaf('url', `${this.env.APP_URL}/agencies/${org.slug}`), leaf('phone', org.phone), leaf('email', org.email), leaf('website', org.website)] },
        { name: 'listings', attrs: { count: listingNodes.length }, children: listingNodes },
      ],
    };
    return `<?xml version="1.0" encoding="UTF-8"?>\n${render(root)}\n`;
  }
}
