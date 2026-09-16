'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import { useTranslations } from 'next-intl';
import { BellRing, ExternalLink, Search, Trash2 } from 'lucide-react';
import {
  ALERT_CHANNELS, filtersToParams, type AlertChannel, type SavedSearchDto,
} from '@lokacia/contracts';
import { Badge, Button, Checkbox, EmptyState, Switch, cn, useToast } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { useFormat } from '@/i18n/use-format';
import { describeFiltersFor } from './chips';

export function SavedSearchesList({ initial, typeNames, districtNames }: { initial: SavedSearchDto[]; typeNames: Record<string, string>; districtNames: Record<string, string> }) {
  const t = useTranslations('alerts');
  const toast = useToast();
  const [items, setItems] = React.useState(initial);

  const update = async (id: string, patch: { active?: boolean; channels?: AlertChannel[] }) => {
    const prev = items;
    setItems((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    try {
      const saved = await apiFetch<SavedSearchDto>(`/saved-searches/${id}`, { method: 'PATCH', body: patch });
      setItems((s) => s.map((x) => (x.id === id ? saved : x)));
    } catch {
      setItems(prev);
      toast({ title: t('failed'), tone: 'danger' });
    }
  };

  const remove = async (id: string) => {
    const prev = items;
    setItems((s) => s.filter((x) => x.id !== id));
    try {
      await apiFetch(`/saved-searches/${id}`, { method: 'DELETE' });
      toast({ title: t('deleted'), tone: 'success' });
    } catch {
      setItems(prev);
      toast({ title: t('failed'), tone: 'danger' });
    }
  };

  if (!items.length)
    return (
      <EmptyState
        icon={<BellRing className="size-5" strokeWidth={1.5} aria-hidden />}
        title={t('emptyTitle')}
        description={t('emptyText')}
        action={
          <Button asChild>
            <Link href="/search">
              <Search className="size-4" strokeWidth={1.5} aria-hidden />
              {t('goSearch')}
            </Link>
          </Button>
        }
      />
    );

  return (
    <ul className="flex flex-col gap-4">
      {items.map((s) => (
        <SavedSearchItem key={s.id} item={s} typeNames={typeNames} districtNames={districtNames} onUpdate={(p) => void update(s.id, p)} onDelete={() => void remove(s.id)} />
      ))}
    </ul>
  );
}

function SavedSearchItem({ item: s, typeNames, districtNames, onUpdate, onDelete }: { item: SavedSearchDto; typeNames: Record<string, string>; districtNames: Record<string, string>; onUpdate: (p: { active?: boolean; channels?: AlertChannel[] }) => void; onDelete: () => void }) {
  const t = useTranslations('alerts');
  const ts = useTranslations('search');
  const fmt = useFormat();
  const [confirm, setConfirm] = React.useState(false);
  const [channelError, setChannelError] = React.useState(false);
  const qs = filtersToParams(s.query).toString();
  const summary = describeFiltersFor(s.query, { typeNames, districtNames, t: (k, v) => ts(k as never, v as never), fmt });
  const headingId = `ss-${s.id}`;
  return (
    <li className={cn('rounded-card border border-border bg-surface p-4 md:p-5', !s.active && 'bg-surface-2')} aria-labelledby={headingId}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 id={headingId} className="text-h3 font-semibold">
            {s.name}
          </h2>
          <p className="mt-0.5 text-small text-muted">{summary}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-small">
            <Badge tone="outline">{t('matches', { count: fmt.number(s.matchCount) })}</Badge>
            {s.newCount > 0 && <Badge tone="accent">{t('newMatches', { count: fmt.number(s.newCount) })}</Badge>}
            <span className="text-muted">{s.lastNotifiedAt ? t('lastNotified', { date: fmt.dateTime(s.lastNotifiedAt) }) : t('never')}</span>
          </div>
        </div>
        <div className="shrink-0 md:w-56">
          <Switch label={s.active ? t('active') : t('paused')} checked={s.active} onCheckedChange={(v) => onUpdate({ active: v })} />
        </div>
      </div>

      <fieldset className="mt-4 border-t border-border pt-3">
        <legend className="sr-only">{t('channels')}</legend>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-small font-medium text-muted" aria-hidden>
            {t('channels')}:
          </span>
          {ALERT_CHANNELS.map((c) => (
            <Checkbox
              key={c}
              label={ts(`channel.${c}`)}
              checked={s.channels.includes(c)}
              disabled={!s.active}
              onCheckedChange={(v) => {
                const next = v ? [...new Set([...s.channels, c])] : s.channels.filter((x) => x !== c);
                if (!next.length) {
                  setChannelError(true);
                  return;
                }
                setChannelError(false);
                onUpdate({ channels: next });
              }}
            />
          ))}
        </div>
        {channelError && (
          <p role="alert" className="mt-2 text-small text-danger">
            {t('channelsError')}
          </p>
        )}
        {s.channels.includes('telegram') && <p className="mt-2 text-small text-muted">{t('telegramHint')}</p>}
      </fieldset>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="secondary">
          <Link href={qs ? `/search?${qs}` : '/search'}>
            <ExternalLink className="size-4" strokeWidth={1.5} aria-hidden />
            {t('open')}
          </Link>
        </Button>
        {confirm ? (
          <Button size="sm" variant="danger" onClick={onDelete} onBlur={() => setConfirm(false)} autoFocus>
            {t('confirmDelete')}
          </Button>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
            <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
            {t('delete')}
          </Button>
        )}
      </div>
    </li>
  );
}
