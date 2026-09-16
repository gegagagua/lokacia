'use client';
import useSWR from 'swr';
import { Bell } from 'lucide-react';
import { relativeDaysKa } from '@lokacia/contracts';
import { IconButton, Popover } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';

type N = { id: string; title: string | null; body: string | null; link: string | null; readAt: string | null; createdAt: string };

export function NotificationsBell() {
  const { data, mutate } = useSWR<{ items: N[]; unread: number }>('/notifications', (p: string) => apiFetch(p, { noOrg: true }), { refreshInterval: 60_000 });
  return (
    <Popover
      align="end"
      className="w-80 p-0"
      onOpenChange={(o) => {
        if (!o && data?.unread) void apiFetch('/notifications/read', { method: 'POST', noOrg: true }).then(() => mutate());
      }}
      trigger={
        <IconButton label={`შეტყობინებები${data?.unread ? ` (${data.unread})` : ''}`} size="sm" className="relative">
          <Bell className="size-4" strokeWidth={1.5} />
          {!!data?.unread && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-accent" aria-hidden />}
        </IconButton>
      }
    >
      <div className="border-b border-border px-4 py-2.5 font-medium">შეტყობინებები</div>
      <ul className="max-h-96 overflow-y-auto">
        {!data?.items.length && <li className="px-4 py-6 text-center text-small text-muted">ახალი შეტყობინება არ არის</li>}
        {data?.items.map((n) => (
          <li key={n.id} className="border-b border-border last:border-b-0">
            <a href={n.link ?? '#'} className="block px-4 py-3 hover:bg-surface-2">
              <div className="flex items-start gap-2">
                {!n.readAt && <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-label="ახალი" />}
                <div className="min-w-0">
                  <div className="text-[15px] font-medium">{n.title}</div>
                  <div className="line-clamp-2 text-small text-muted">{n.body}</div>
                  <div className="mt-1 text-[11px] text-muted">{relativeDaysKa(n.createdAt)}</div>
                </div>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </Popover>
  );
}
