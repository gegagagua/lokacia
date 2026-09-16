import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/components/account/require-session';
import { AccountPageHeader } from '@/components/account/page-header';
import { OrgManager } from '@/components/account/org/org-manager';

export const metadata: Metadata = { title: 'ორგანიზაცია' };

export default async function OrgPage() {
  const user = await requireSession('/account/org');
  const t = await getTranslations('account.org');
  const crmUrl = process.env.NEXT_PUBLIC_CRM_URL ?? process.env.CRM_URL ?? 'http://localhost:3101';
  return (
    <>
      <AccountPageHeader title={t('title')} description={t('description')} />
      <OrgManager user={user} crmUrl={crmUrl} />
    </>
  );
}
