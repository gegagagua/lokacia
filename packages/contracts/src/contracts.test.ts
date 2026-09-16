import { describe, expect, it } from 'vitest';
import {
  canTransition,
  estimateMonthlyCost,
  filtersToParams,
  formatDateKa,
  formatMoney,
  hasFrequentClosures,
  normalizePhone,
  paramsToFilters,
  priceDelta,
  relativeDaysKa,
  slugify,
  dealFinance,
  DEAL_TYPE_LABELS,
  SEARCH_SORT_LABELS,
  formatAreaFor,
  formatDateFor,
  formatMoneyFor,
  localizedName,
  localizedText,
  pricePeriodSuffix,
  relativeDaysFor,
  ruPlural,
  toAppLocale,
  localizeFilterDef,
  localizeUnit,
  passportLabel,
} from './index';

describe('format', () => {
  it('formats money the Georgian way', () => {
    expect(formatMoney(300_000)).toBe('3 000 ₾');
    expect(formatMoney(1_250_050)).toBe('12 500,50 ₾');
  });
  it('formats dates', () => {
    expect(formatDateKa(new Date(2026, 8, 16))).toBe('16 სექტემბერი, 2026');
  });
  it('relative days', () => {
    const now = new Date(2026, 8, 16, 12);
    expect(relativeDaysKa(new Date(2026, 8, 13, 9), now)).toBe('3 დღის წინ');
    expect(relativeDaysKa(now, now)).toBe('დღეს');
  });
  it('slugifies Georgian', () => {
    expect(slugify('კაფე ვაკეში 50 მ²')).toBe('kape-vakeshi-50-m2');
  });
});

describe('phones', () => {
  it('normalizes to E.164', () => {
    expect(normalizePhone('555 12 34 56')).toBe('+995555123456');
    expect(normalizePhone('+995 (555) 123-456')).toBe('+995555123456');
    expect(normalizePhone('00995555123456')).toBe('+995555123456');
    expect(normalizePhone('12')).toBeNull();
  });
});

describe('search url state', () => {
  it('round-trips filters', () => {
    const f = { businessType: 'cafe', dealType: 'rent' as const, districts: ['vake', 'saburtalo'], priceMax: 3000, hasHood: true };
    const params = filtersToParams(f);
    expect(params.toString()).toBe('businessType=cafe&dealType=rent&districts=vake%2Csaburtalo&priceMax=3000&hasHood=true');
    expect(paramsToFilters(params)).toMatchObject(f);
  });
  it('drops invalid params instead of failing', () => {
    expect(paramsToFilters(new URLSearchParams('priceMax=abc&dealType=rent'))).toEqual({ dealType: 'rent' });
  });
});

describe('domain rules', () => {
  it('lifecycle transitions', () => {
    expect(canTransition('draft', 'pending_review')).toBe(true);
    expect(canTransition('draft', 'active')).toBe(false);
    expect(canTransition('active', 'stale')).toBe(true);
    expect(canTransition('stale', 'active')).toBe(true);
  });
  it('flags frequent closures', () => {
    const now = new Date('2026-09-16');
    expect(hasFrequentClosures([{ endedAt: '2024-01-01' }, { endedAt: '2025-01-01' }, { endedAt: '2026-01-01' }], now)).toBe(true);
    expect(hasFrequentClosures([{ endedAt: '2020-01-01' }, { endedAt: '2025-01-01' }, { endedAt: null }], now)).toBe(false);
  });
  it('monthly cost', () => {
    const c = estimateMonthlyCost({ rentMinor: 300_000, areaM2: 50, utilityCoef: 6, serviceFeeMinor: 10_000, depositMonths: 1, fitoutPerM2Minor: 70_000 });
    expect(c.utilitiesMinor).toBe(30_000);
    expect(c.monthlyMinor).toBe(340_000);
    expect(c.depositMinor).toBe(300_000);
    expect(c.fitoutMinor).toBe(3_500_000);
  });
  it('price delta', () => {
    expect(priceDelta(360_000, 60, 5_000)).toMatchObject({ deltaPct: 20, verdict: 'above' });
    expect(priceDelta(100, 0, 5)).toBeNull();
  });
  it('deal finance', () => {
    expect(dealFinance(1_000_000, 10, 40)).toEqual({ commissionMinor: 100_000, agentMinor: 40_000, agencyMinor: 60_000 });
  });
});

import { encodeCursor, decodeCursor } from './index';
describe('cursor', () => {
  it('round-trips unicode', () => {
    const c = encodeCursor({ id: 'ა', n: 5 });
    expect(decodeCursor(c)).toEqual({ id: 'ა', n: 5 });
    expect(decodeCursor('%%%')).toBeNull();
  });
});

describe('locale-aware format helpers', () => {
  it('formats money per locale, ₾ after the amount', () => {
    expect(formatMoneyFor(300_000, 'ka')).toBe('3 000 ₾');
    expect(formatMoneyFor(300_000, 'en')).toBe('3,000 ₾');
    expect(formatMoneyFor(300_000, 'ru')).toBe('3 000 ₾');
    expect(formatMoneyFor(1_250_050, 'en')).toBe('12,500.50 ₾');
    expect(formatMoneyFor(1_250_050, 'ru')).toBe('12 500,50 ₾');
    expect(formatMoneyFor(150_000, 'en', 'USD')).toBe('$1,500');
    expect(formatMoneyFor(300_000, 'ka')).toBe(formatMoney(300_000));
  });
  it('formats area, dates and relative days', () => {
    expect(formatAreaFor(1250.5, 'en')).toBe('1,250.5 m²');
    expect(formatAreaFor(64, 'ru')).toBe('64 м²');
    expect(formatDateFor(new Date(2026, 8, 16), 'en')).toBe('September 16, 2026');
    expect(formatDateFor(new Date(2026, 8, 16), 'ru')).toBe('16 сентября 2026');
    expect(formatDateFor(new Date(2026, 8, 16), 'ka')).toBe('16 სექტემბერი, 2026');
    const now = new Date(2026, 8, 16, 12);
    expect(relativeDaysFor(new Date(2026, 8, 13), 'en', now)).toBe('3 days ago');
    expect(relativeDaysFor(new Date(2026, 8, 15), 'en', now)).toBe('yesterday');
    expect(relativeDaysFor(new Date(2026, 8, 14), 'ru', now)).toBe('2 дня назад');
    expect(relativeDaysFor(new Date(2026, 7, 1), 'ru', now)).toBe('1 месяц назад');
    expect(relativeDaysFor(new Date(2026, 8, 11), 'ru', now)).toBe('5 дней назад');
  });
  it('picks localized names/texts with ka fallback and normalizes locales', () => {
    const d = { nameKa: 'ვაკე', nameEn: 'Vake', nameRu: '' };
    expect(localizedName(d, 'en')).toBe('Vake');
    expect(localizedName(d, 'ru')).toBe('ვაკე');
    expect(localizedText('სათაური', null, 'Заголовок', 'ru')).toBe('Заголовок');
    expect(localizedText('სათაური', ' ', null, 'en')).toBe('სათაური');
    expect(toAppLocale('en')).toBe('en');
    expect(toAppLocale('de')).toBe('ka');
    expect(pricePeriodSuffix('month', 'en')).toBe(' / mo');
    expect(pricePeriodSuffix('total', 'ru')).toBe('');
    expect(ruPlural(21, 'день', 'дня', 'дней')).toBe('день');
    expect(ruPlural(12, 'день', 'дня', 'дней')).toBe('дней');
    expect(DEAL_TYPE_LABELS.en.rent).toBe('For rent');
    expect(SEARCH_SORT_LABELS.ru.newest).toBe('Сначала новые');
  });
});

describe('passport localization', () => {
  it('translates default filter labels and units, keeps custom labels', () => {
    const def = { key: 'ceilingM', kind: 'min' as const, labelKa: 'ჭერის სიმაღლე (მინ.)', unit: 'მ' };
    expect(localizeFilterDef(def, 'en')).toMatchObject({ labelKa: 'Ceiling height (min.)', unit: 'm' });
    expect(localizeFilterDef(def, 'ru')).toMatchObject({ labelKa: 'Высота потолка (мин.)', unit: 'м' });
    expect(localizeFilterDef(def, 'ka')).toBe(def);
    expect(localizeFilterDef({ key: 'hasHood', kind: 'boolean' as const, labelKa: 'სპეციალური' }, 'en').labelKa).toBe('სპეციალური');
    expect(passportLabel('powerKw', 'ru')).toBe('Мощность');
    expect(localizeUnit('კვტ', 'en')).toBe('kW');
  });
});
