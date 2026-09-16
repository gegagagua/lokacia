import { describe, expect, it } from 'vitest';
import { formatMoney } from '@lokacia/contracts';
import { buildDraftListing, mediaMeta } from './broker-draft';
import { interpolate, lookup, t } from './i18n';
import { cardSubtitle, confirmedLabel, gelToMinor, passportRows, priceLabel, pricePerM2Label } from './listing-format';
import { bboxParam, pinsToGeoJSON } from './map-style';
import { activeFilterCount, mergeParsed, numberOrUndefined, searchQuery } from './search-filters';
import { linkToRoute, resolveApiAssetUrl } from './urls';
import { contrastRatio, darkColors, lightColors } from '../theme/tokens';

describe('formatting through @lokacia/contracts', () => {
  it('formats prices with Georgian rules', () => {
    expect(formatMoney(300000)).toBe('3 000 ₾');
    expect(priceLabel({ priceMinor: 300000, currency: 'GEL', pricePeriod: 'month' })).toBe('3 000 ₾ / თვე');
    expect(priceLabel({ priceMinor: 30400000, currency: 'GEL', pricePeriod: 'total' })).toBe('304 000 ₾');
    expect(priceLabel({ priceMinor: 5000, currency: 'USD', pricePeriod: 'day' })).toBe('$50 / დღე');
    expect(pricePerM2Label({ priceMinor: 1140000, currency: 'GEL', areaM2: 200 })).toBe('57 ₾ მ²-ზე');
  });

  it('builds card subtitle, confirmation and passport rows', () => {
    expect(cardSubtitle({ areaM2: 64.5, districtName: 'ვაკე', dealType: 'rent' })).toBe('64,5 მ² · ვაკე · იჯარა');
    expect(confirmedLabel('2026-09-14T10:00:00Z', new Date('2026-09-17T10:00:00Z'))).toBe('დადასტურდა 3 დღის წინ');
    expect(confirmedLabel(null)).toBeNull();
    const rows = passportRows({ powerKw: 25, threePhase: true, ceilingM: 3.4, hasGas: false, parking: null });
    expect(rows.map((r) => [r.key, r.value])).toEqual([
      ['powerKw', '25 კვტ'],
      ['threePhase', 'კი'],
      ['ceilingM', '3,4 მ'],
      ['hasGas', 'არა'],
    ]);
  });

  it('converts typed GEL to tetri', () => {
    expect(gelToMinor('3 000')).toBe(300000);
    expect(gelToMinor('12,5')).toBe(1250);
    expect(gelToMinor('abc')).toBeNull();
    expect(gelToMinor('0')).toBeNull();
  });
});

describe('i18n', () => {
  it('interpolates ICU-style placeholders and resolves nested keys', () => {
    expect(interpolate('{n} ფართი', { n: 12 })).toBe('12 ფართი');
    expect(interpolate('{missing}', {})).toBe('{missing}');
    expect(lookup({ a: { b: 'x' } }, 'a.b')).toBe('x');
    expect(t('search.results', { n: 561 })).toBe('561 ფართი');
    expect(t('listing.reveal')).toBe('ნომრის ჩვენება');
  });
});

describe('urls', () => {
  it('maps web-relative API URLs to the API base', () => {
    expect(resolveApiAssetUrl('http://10.0.2.2:4000/', '/api/v1/media/placeholder/interior/a-0.svg')).toBe('http://10.0.2.2:4000/v1/media/placeholder/interior/a-0.svg');
    expect(resolveApiAssetUrl('http://x', 'https://cdn.lokacia.ge/a.webp')).toBe('https://cdn.lokacia.ge/a.webp');
    expect(resolveApiAssetUrl('http://x', null)).toBeNull();
  });

  it('turns notification links into app routes', () => {
    expect(linkToRoute('https://lokacia.ge/account/messages?c=abc')).toBe('/chat/abc');
    expect(linkToRoute('/account/viewings?v=1')).toBe('/viewings');
    expect(linkToRoute('/account/offers/xyz')).toBe('/offers');
    expect(linkToRoute('http://localhost:3100/listings/cafe-80m2-vake-1')).toBe('/listing/cafe-80m2-vake-1');
    expect(linkToRoute('/pricing')).toBeNull();
  });
});

describe('search filters', () => {
  it('serializes with the shared contracts serializer', () => {
    const q = searchQuery({ businessType: 'cafe', districts: ['vake', 'saburtalo'], priceMax: 3000, verifiedOnly: false }, { limit: 20, cursor: 'c1' });
    expect(q.toString()).toBe('businessType=cafe&districts=vake%2Csaburtalo&priceMax=3000&cursor=c1&limit=20');
  });

  it('counts active filters and merges NL-parsed ones', () => {
    expect(activeFilterCount({ businessType: 'cafe', priceMax: 3000, districts: [], hasHood: true })).toBe(2);
    expect(mergeParsed({ hasGas: true, dealType: 'sale', q: 'x' }, { businessType: 'cafe', areaMin: 64 })).toEqual({ dealType: 'sale', businessType: 'cafe', areaMin: 64 });
    expect(numberOrUndefined(' 1 200 ')).toBe(1200);
    expect(numberOrUndefined('')).toBeUndefined();
  });
});

describe('map + broker helpers', () => {
  it('builds GeoJSON pins and bbox params', () => {
    const fc = pinsToGeoJSON([{ id: 'a', lat: 41.7, lng: 44.8, priceMinor: 1, vip: true }, { id: 'b', lat: Number.NaN, lng: 44, priceMinor: 1, vip: false }]);
    expect(fc.features).toHaveLength(1);
    expect(fc.features[0]!.geometry.coordinates).toEqual([44.8, 41.7]);
    expect(bboxParam([44.7, 41.6, 44.9, 41.8])).toBe('44.70000,41.60000,44.90000,41.80000');
  });

  it('validates the on-site draft with listingInputSchema', () => {
    const fields = { businessType: 'cafe', dealType: 'rent' as const, title: 'ფართი კაფესთვის', address: 'თბილისი, ჭავჭავაძის 1', area: '80', price: '3 000', note: '' };
    const body = buildDraftListing(fields, { lat: 41.7123456, lng: 44.7654321 });
    expect(body).toMatchObject({ businessTypes: ['cafe'], priceMinor: 300000, areaM2: 80, lat: 41.712346, isOwner: false, currency: 'GEL' });
    expect(buildDraftListing(fields, null)).toBeNull();
    expect(buildDraftListing({ ...fields, title: 'ab' }, { lat: 41.7, lng: 44.7 })).toBeNull();
    expect(buildDraftListing(fields, { lat: 10, lng: 10 })).toBeNull();
  });

  it('derives upload names and allowed MIME types', () => {
    expect(mediaMeta('file:///x/IMG_1.HEIC', 'image')).toEqual({ name: 'IMG_1.heic', type: 'image/heic' });
    expect(mediaMeta('file:///cache/recording-abc.m4a', 'audio').type).toBe('audio/mp4');
    expect(mediaMeta('blob:http://x/123', 'image', 'image/png', 'a.png')).toEqual({ name: 'a.png', type: 'image/png' });
  });
});

describe('theme tokens', () => {
  it('meets WCAG AA contrast for text and primary buttons in both themes', () => {
    for (const c of [lightColors, darkColors]) {
      expect(contrastRatio(c.text, c.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.textMuted, c.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.primaryContrast, c.primary)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(c.link, c.bg)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
