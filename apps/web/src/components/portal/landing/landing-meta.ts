import 'server-only';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { formatMoney, type LandingDto } from '@lokacia/contracts';
import { pageMetadata } from '../seo';

export async function landingMetadata(data: LandingDto | null, path: string): Promise<Metadata> {
  if (!data) return { title: 'გვერდი ვერ მოიძებნა', robots: { index: false } };
  const t = await getTranslations('seo.landing');
  const type = data.businessType?.name ?? '';
  const district = data.district?.name ?? '';
  const avg = data.avgPriceM2Minor ? formatMoney(Math.round(data.avgPriceM2Minor / 100) * 100) : '—';
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
