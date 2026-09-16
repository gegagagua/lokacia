'use client';
import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { SessionUser, TenantProfile } from '@lokacia/contracts';
import { Tabs } from '@lokacia/ui';
import { PersonalForm } from './personal-form';
import { TenantProfileForm } from './tenant-profile-form';
import { NotificationsForm } from './notifications-form';
import { PrivacyPanel } from './privacy-panel';

export type ProfileSettings = { notificationPrefs: Record<string, string[]>; telegramLinked: boolean; viberLinked: boolean; email: string | null; bio: string | null; consentAt: string | null };

export function ProfileTabs(props: { initialTab: string; user: SessionUser; settings: ProfileSettings; tenant: TenantProfile | null; consents: { kind: string; granted: boolean; at: string }[]; businessTypes: { value: string; label: string }[]; mockMessengers: boolean }) {
  const t = useTranslations('account.profile.tabs');
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = React.useState(props.initialTab);
  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        setTab(v);
        router.replace(`${pathname}?tab=${v}`, { scroll: false });
      }}
      tabs={[
        { value: 'personal', label: t('personal'), content: <PersonalForm user={props.user} settings={props.settings} /> },
        { value: 'tenant', label: t('tenant'), content: <TenantProfileForm initial={props.tenant} businessTypes={props.businessTypes} /> },
        { value: 'notifications', label: t('notifications'), content: <NotificationsForm settings={props.settings} hasEmail={!!props.user.email} mockMessengers={props.mockMessengers} /> },
        { value: 'privacy', label: t('privacy'), content: <PrivacyPanel consents={props.consents} /> },
      ]}
    />
  );
}
