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
    <div className="relative">
      {/* soft ambient tint behind the workspace */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-72 bg-[radial-gradient(900px_280px_at_70%_0%,color-mix(in_srgb,var(--primary-soft)_85%,transparent),transparent_70%)]" />
      <div className="container-page relative grid gap-5 py-5 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-8 lg:py-10">
        <AccountNav hasOrg={user.orgs.some((o) => o.type === 'agency')} crmUrl={crmUrl} user={{ name: user.name, phone: user.phone, avatarUrl: user.avatarUrl }} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
