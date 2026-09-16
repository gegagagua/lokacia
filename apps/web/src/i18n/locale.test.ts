import { describe, expect, it } from 'vitest';
import { isLocale, languageAlternates, localizePath, splitLocalePath, switchLocaleHref, toLocale } from './locale';

describe('splitLocalePath', () => {
  it('extracts en/ru/ka prefixes and keeps the rest', () => {
    expect(splitLocalePath('/en/search')).toEqual({ locale: 'en', path: '/search' });
    expect(splitLocalePath('/ru')).toEqual({ locale: 'ru', path: '/' });
    expect(splitLocalePath('/ka/listings/x')).toEqual({ locale: 'ka', path: '/listings/x' });
    expect(splitLocalePath('/search')).toEqual({ locale: null, path: '/search' });
  });
  it('does not treat look-alike segments as locales', () => {
    expect(splitLocalePath('/english')).toEqual({ locale: null, path: '/english' });
    expect(splitLocalePath('/rustavi-offices')).toEqual({ locale: null, path: '/rustavi-offices' });
  });
});

describe('localizePath', () => {
  it('keeps ka at the root and prefixes en/ru', () => {
    expect(localizePath('/', 'ka')).toBe('/');
    expect(localizePath('/', 'en')).toBe('/en');
    expect(localizePath('/search?businessType=office#map', 'ru')).toBe('/ru/search?businessType=office#map');
    expect(localizePath('/listings/office-64m2-vake-1', 'en')).toBe('/en/listings/office-64m2-vake-1');
  });
  it('replaces an existing prefix and strips it for ka', () => {
    expect(localizePath('/en/pricing', 'ru')).toBe('/ru/pricing');
    expect(localizePath('/ru/pricing', 'ka')).toBe('/pricing');
  });
  it('leaves external, relative, hash, API and sitemap links untouched', () => {
    expect(localizePath('https://lokacia.ge/x', 'en')).toBe('https://lokacia.ge/x');
    expect(localizePath('//cdn.example/x', 'en')).toBe('//cdn.example/x');
    expect(localizePath('#main', 'en')).toBe('#main');
    expect(localizePath('mailto:a@b.ge', 'ru')).toBe('mailto:a@b.ge');
    expect(localizePath('/api/v1/media/1', 'en')).toBe('/api/v1/media/1');
    expect(localizePath('/sitemap-en.xml', 'en')).toBe('/sitemap-en.xml');
  });
});

describe('languageAlternates', () => {
  it('lists ka, en, ru and x-default (= ka)', () => {
    expect(languageAlternates('/pricing')).toEqual({ ka: '/pricing', en: '/en/pricing', ru: '/ru/pricing', 'x-default': '/pricing' });
    expect(languageAlternates('/')).toEqual({ ka: '/', en: '/en', ru: '/ru', 'x-default': '/' });
  });
});

describe('locale guards', () => {
  it('accepts only supported locales and falls back to ka', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(toLocale(undefined)).toBe('ka');
    expect(toLocale('ru')).toBe('ru');
  });
});

describe('switchLocaleHref', () => {
  it('maps the current URL to another language keeping query and hash', () => {
    const loc = { pathname: '/en/search', search: '?dealType=rent', hash: '#results' };
    expect(switchLocaleHref(loc, 'ru')).toBe('/ru/search?dealType=rent#results');
    expect(switchLocaleHref(loc, 'ka')).toBe('/search?dealType=rent#results');
    expect(switchLocaleHref({ pathname: '/', search: '', hash: '' }, 'en')).toBe('/en');
  });
});
