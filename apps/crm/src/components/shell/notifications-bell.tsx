'use client';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Bell, BellOff } from 'lucide-react';
import { relativeDaysKa } from '@lokacia/contracts';
import { cn, Popover } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';

type N = { id: string; title: string | null; body: string | null; link: string | null; readAt: string | null; createdAt: string };

export function NotificationsBell() {
  const t = useTranslations('shell.notifications');
  const { data, mutate } = useSWR<{ items: N[]; unread: number }>('/notifications', (p: string) => apiFetch(p, { noOrg: true }), { refreshInterval: 60_000 });
  const unread = data?.unread ?? 0;
  return (
    <Popover
      align="end"
      className="w-[min(380px,calc(100vw-24px))] overflow-hidden p-0"
      onOpenChange={(o) => {
        if (!o && unread) void apiFetch('/notifications/read', { method: 'POST', noOrg: true }).then(() => mutate());
      }}
      trigger={
        <button type="button" aria-label={unread ? t('labelUnread', { count: unread }) : t('title')} title={t('title')} className="relative grid size-10 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:shadow-ring focus-visible:outline-none">
          <Bell className="size-[19px]" strokeWidth={2} aria-hidden />
          {!!unread && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white ring-2 ring-surface tabular" aria-hidden>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      }
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <span className="font-semibold">{t('title')}</span>
        {!!unread && <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[12px] font-semibold text-primary-soft-text">{t('newCount', { count: unread })}</span>}
      </div>
      <ul className="scrollbar-thin max-h-[420px] overflow-y-auto p-1.5">
        {!data?.items.length && (
          <li className="flex flex-col items-center gap-2 px-4 py-10 text-center text-small text-muted">
            <span className="grid size-11 place-items-center rounded-2xl bg-surface-2" aria-hidden>
              <BellOff className="size-5" strokeWidth={2} />
            </span>
            {t('empty')}
          </li>
        )}
        {data?.items.map((n) => (
          <li key={n.id}>
            <a href={n.link ?? '#'} className={cn('flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2', !n.readAt && 'bg-primary-soft/40')}>
              <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', n.readAt ? 'bg-surface-2 text-muted' : 'bg-primary-soft text-primary-soft-text')} aria-hidden>
                <Bell className="size-4" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 text-[14px] font-semibold leading-5">{n.title}</div>
                  {!n.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-label={t('new')} />}
                </div>
                <div className="line-clamp-2 text-[13px] leading-5 text-muted">{n.body}</div>
                <div className="mt-0.5 text-[12px] text-muted">{relativeDaysKa(n.createdAt)}</div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
