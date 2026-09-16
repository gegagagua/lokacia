import 'server-only';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { LandingDto } from '@lokacia/contracts';
import { getFormat } from '@/i18n/server';
import { getNames } from '../data';
import { pageMetadata } from '../seo';

export async function landingMetadata(data: LandingDto | null, path: string): Promise<Metadata> {
  const t = await getTranslations('seo.landing');
  if (!data) return { title: t('notFound'), robots: { index: false } };
  const [f, names] = await Promise.all([getFormat(), getNames()]);
  // API names are Georgian — use the localized taxonomy names (fallback: API value).
  const type = data.businessType ? (names.typeNames[data.businessType.slug] ?? data.businessType.name) : '';
  const district = data.district ? (names.districtNames[data.district.slug] ?? data.district.name) : '';
  const avg = data.avgPriceM2Minor ? f.money(Math.round(data.avgPriceM2Minor / 100) * 100) : '—';
  const title = type && district ? t('titleTypeDistrict', { type, district }) : type ? t('titleType', { type }) : t('titleDistrict', { district });
  const description =
    type && district
      ? t('descTypeDistrict', { count: data.total, type, district, avg })
      : type
        ? t('descType', { count: data.total, type, avg })
        : t('descDistrict', { count: data.total, district, avg });
  // Thin combo pages (no listings) stay out of the index but keep links followable.
  return pageMetadata({ title, description, path, noindex: data.total === 0 && !!(type && district) });
}
