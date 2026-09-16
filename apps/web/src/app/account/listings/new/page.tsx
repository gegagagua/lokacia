import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/components/account/require-session';
import { ListingWizard } from '@/components/account/wizard/listing-wizard';
import { getBusinessTypes } from '@/lib/taxonomy';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('wizard');
  return { title: t('titleNew'), robots: { index: false, follow: false } };
}

export default async function NewListingPage({ searchParams }: { searchParams: Promise<{ step?: string }> }) {
  const user = await requireSession('/account/listings/new');
  const [{ step }, types] = await Promise.all([searchParams, getBusinessTypes()]);
  return <ListingWizard user={user} types={types.map((b) => ({ slug: b.slug, nameKa: b.nameKa, filterConfig: b.filterConfig }))} detail={null} initialStep={step} />;
}
