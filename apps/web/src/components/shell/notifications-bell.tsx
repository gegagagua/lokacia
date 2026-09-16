'use client';
import Link from '@/i18n/link';
import useSWR from 'swr';
import { Bell } from 'lucide-react';
import { relativeDaysFor, toAppLocale } from '@lokacia/contracts';
import { useLocale, useTranslations } from 'next-intl';
import { IconButton, Popover } from '@lokacia/ui';
import { apiFetch, fetcher } from '@/lib/api-client';

type N = { id: string; title: string | null; body: string | null; link: string | null; readAt: string | null; createdAt: string };

export function NotificationsBell() {
  const t = useTranslations('meta.notifications');
  const locale = toAppLocale(useLocale());
  const { data, mutate } = useSWR<{ items: N[]; unread: number }>('/notifications', fetcher, { refreshInterval: 60_000 });
  return (
    <Popover
      align="end"
      className="w-80 p-0"
      onOpenChange={(o) => {
        if (!o && data?.unread) void apiFetch('/notifications/read', { method: 'POST' }).then(() => mutate());
      }}
      trigger={
        <IconButton label={data?.unread ? t('titleUnread', { count: data.unread }) : t('title')} size="sm" className="relative">
          <Bell className="size-4" strokeWidth={1.5} />
          {!!data?.unread && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" aria-hidden />}
        </IconButton>
      }
    >
      <div className="border-b border-border px-4 py-2.5 font-medium">{t('title')}</div>
      <ul className="max-h-96 overflow-y-auto">
        {!data?.items.length && <li className="px-4 py-6 text-center text-small text-muted">{t('empty')}</li>}
        {data?.items.map((n) => (
          <li key={n.id} className="border-b border-border last:border-b-0">
            <Link href={n.link ?? '/account'} className="block px-4 py-3 hover:bg-surface-2">
              <div className="flex items-start gap-2">
                {!n.readAt && <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-label={t('new')} />}
                <div className="min-w-0">
                  <div className="text-[15px] font-medium">{n.title}</div>
                  <div className="line-clamp-2 text-small text-muted">{n.body}</div>
                  <div className="mt-1 text-[11px] text-muted">{relativeDaysFor(n.createdAt, locale)}</div>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
