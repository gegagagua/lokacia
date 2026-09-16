import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/components/account/require-session';
import { MyListings } from '@/components/account/listings/my-listings';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('myListings');
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function MyListingsPage() {
  await requireSession('/account/listings');
  return <MyListings />;
}
