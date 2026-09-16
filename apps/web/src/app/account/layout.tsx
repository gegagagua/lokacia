import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getSession } from '@/lib/session';
import { AccountNav } from '@/components/account/account-nav';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('meta.titles');
  return { title: { default: t('account'), template: t('accountTemplate', { page: '%s' }) }, robots: { index: false, follow: false } };
}

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) return <div className="container-page py-8">{children}</div>;
  const crmUrl = process.env.NEXT_PUBLIC_CRM_URL ?? process.env.CRM_URL ?? 'http://localhost:3101';
  return (
    <div className="container-page grid gap-8 py-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:py-10">
      <AccountNav hasOrg={user.orgs.some((o) => o.type === 'agency')} crmUrl={crmUrl} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
