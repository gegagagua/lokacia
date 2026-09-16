import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { requireSession } from '@/components/account/require-session';
import { AccountPageHeader } from '@/components/account/page-header';
import { Inbox } from '@/components/account/chat/inbox';

export const metadata: Metadata = { title: 'შეტყობინებები' };

export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const user = await requireSession('/account/messages');
  const t = await getTranslations('chat');
  const { c } = await searchParams;
  return (
    <>
      <AccountPageHeader title={t('title')} description={t('description')} />
      <Inbox me={user.id} initialId={c ?? null} />
    </>
  );
}
