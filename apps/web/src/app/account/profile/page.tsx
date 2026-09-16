import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { TenantProfile } from '@lokacia/contracts';
import { api } from '@/lib/api-server';
import { getBusinessTypes } from '@/lib/taxonomy';
import { requireSession } from '@/components/account/require-session';
import { AccountPageHeader } from '@/components/account/page-header';
import { ProfileTabs, type ProfileSettings } from '@/components/account/profile/profile-tabs';

export const metadata: Metadata = { title: 'პროფილი' };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireSession('/account/profile');
  const t = await getTranslations('account.profile');
  const { tab } = await searchParams;
  const [settings, tenant, consents, types] = await Promise.all([
    api<ProfileSettings>('/v1/users/me/settings'),
    api<(TenantProfile & { id: string }) | null>('/v1/users/me/tenant-profile'),
    api<{ kind: string; granted: boolean; at: string }[]>('/v1/users/me/consents'),
    getBusinessTypes(),
  ]);
  return (
    <>
      <AccountPageHeader title={t('title')} description={t('description')} />
      <ProfileTabs
        initialTab={tab ?? 'personal'}
        user={user}
        settings={settings}
        tenant={tenant}
        consents={consents}
        businessTypes={types.map((b) => ({ value: b.slug, label: b.nameKa }))}
        mockMessengers={process.env.NODE_ENV !== 'production'}
      />
    </>
  );
}
