'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { CalendarSync, CheckCircle2, Copy, Link2 } from 'lucide-react';
import { Button, Input, useToast } from '@lokacia/ui';
import { IconTile } from '@/components/common/ui';
import { errorMessage } from '@/lib/api-client';
import { useApi, useApiMutation } from '@/lib/swr';

export function SyncPanel({ onSynced }: { onSynced?: () => void }) {
  const t = useTranslations('calendar.sync');
  const toast = useToast();
  const mutate = useApiMutation();
  const { data: feed } = useApi<{ url: string; webcal: string }>('/crm/calendar/feed-url');
  const { data: google, mutate: reload } = useApi<{ connected: boolean; connectedAt: string | null }>('/crm/calendar/google');
  const [busy, setBusy] = React.useState(false);
  return (
    <section className="card flex flex-col gap-4 p-4" aria-labelledby="cal-sync">
      <h2 id="cal-sync" className="flex items-center gap-2 text-[15px] font-semibold">
        <IconTile icon={CalendarSync} tone={4} size="sm" />
        {t('title')}
      </h2>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="ics-url" className="flex items-center gap-1.5 text-small font-semibold">
          <Link2 className="size-3.5 text-muted" strokeWidth={2} aria-hidden />
          {t('feed')}
        </label>
        <div className="flex gap-2">
          <Input id="ics-url" readOnly value={feed?.url ?? ''} className="min-w-0 flex-1 bg-surface-2 text-small tabular" onFocus={(e) => e.currentTarget.select()} />
          <Button
            variant="secondary"
            size="sm"
            className="h-12 w-12 shrink-0 px-0"
            aria-label={t('copy')}
            icon={<Copy className="size-4" strokeWidth={2} aria-hidden />}
            onClick={async () => {
              if (!feed) return;
              await navigator.clipboard?.writeText(feed.url).catch(() => undefined);
              toast({ title: t('copied'), tone: 'success' });
            }}
          />
        </div>
        <p className="text-[12.5px] leading-5 text-muted">{t('feedHint')}</p>
      </div>
      {google?.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-success/10 px-3 py-2.5 text-small">
          <span className="flex items-center gap-2 font-semibold text-success">
            <CheckCircle2 className="size-4" strokeWidth={2.2} aria-hidden />
            {t('googleConnected')}
          </span>
          <Button size="sm" variant="ghost" onClick={async () => { await mutate('/crm/calendar/google/disconnect'); await reload(); }}>
            {t('googleDisconnect')}
          </Button>
        </div>
      ) : (
        <Button
          variant="secondary"
          className="h-auto min-h-11 justify-start whitespace-normal py-2 text-left"
          loading={busy}
          icon={<CalendarSync className="size-4" strokeWidth={2} aria-hidden />}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await mutate<{ synced: number }>('/crm/calendar/google/connect');
              toast({ title: t('googleSynced', { count: r.synced }), tone: 'success' });
              await reload();
              onSynced?.();
            } catch (e) {
              toast({ title: errorMessage(e), tone: 'danger' });
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('google')}
        </Button>
      )}
    </section>
  );
}
