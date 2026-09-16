import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getAppLocale } from '@/i18n/server';
import { localizePath } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { LeaseDetailView } from './lease-detail';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.titles');
  return { title: t('lease'), robots: { index: false, follow: false } };
}

export default async function LeasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(localizePath(`/login?next=/account/property/leases/${id}`, await getAppLocale()));
  return (
    <div>
      <LeaseDetailView id={id} />
    </div>
  );
}
