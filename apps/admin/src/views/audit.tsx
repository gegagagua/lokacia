'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Filter, History, RotateCcw, Search, ShieldAlert } from 'lucide-react';
import { formatDateKa, type AuditEntryDto } from '@lokacia/contracts';
import { Avatar, Button, Field, Input, cn } from '@lokacia/ui';
import { qs, useCursorList } from '@/lib/use-cursor-list';
import { PageHeader } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { JsonView } from '@/components/json-view';
import { InlineEmpty, StatusPill, type Tone } from '@/components/kit';

const actionTone = (a: string): Tone =>
  /reject|ban|delete|remove|fail|dispute|refund/i.test(a) ? 'danger' : /approve|create|verify|release|publish|unban/i.test(a) ? 'success' : /impersonat/i.test(a) ? 'accent' : /update|patch|edit|role|plan|setting/i.test(a) ? 'info' : 'neutral';
const dotClass: Record<Tone, string> = { danger: 'bg-danger', success: 'bg-success', accent: 'bg-accent', info: 'bg-link', primary: 'bg-primary', neutral: 'bg-border-strong' };
const time = (iso: string) => new Date(iso).toLocaleTimeString('ka-GE', { hour: '2-digit', minute: '2-digit', hour12: false });

/** Audit log rendered as a day-grouped timeline (name kept for existing imports). */
export function AuditTable({ items, compact }: { items: AuditEntryDto[]; compact?: boolean }) {
  const t = useTranslations('audit');
  if (!items.length) return <InlineEmpty icon={History}>{t('empty')}</InlineEmpty>;
  const groups: { day: string; items: AuditEntryDto[] }[] = [];
  for (const a of items) {
    const day = formatDateKa(a.createdAt);
    const g = groups.at(-1);
    if (g && g.day === day) g.items.push(a);
    else groups.push({ day, items: [a] });
  }
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => (
        <div key={g.day}>
          <div className="mb-3 flex items-center gap-3">
            <span className="rounded-full bg-surface-2 px-3 py-1 text-[13px] font-semibold text-muted">{g.day}</span>
            <span className="h-px flex-1 bg-border" aria-hidden />
          </div>
          <ol className="relative ml-1.5 border-l-2 border-border sm:ml-4">
            {g.items.map((a) => {
              const tone = actionTone(a.action);
              return (
                <li key={a.id} className="relative min-w-0 pb-5 pl-5 last:pb-1 sm:pl-6">
                  <span className={cn('absolute -left-[7px] top-2 size-3 rounded-full ring-4 ring-surface', dotClass[tone])} aria-hidden />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <time dateTime={a.createdAt} className="w-12 shrink-0 text-[13px] font-semibold tabular text-muted">
                      {time(a.createdAt)}
                    </time>
                    <StatusPill tone={tone} className="h-auto min-h-7 whitespace-normal py-1 font-mono text-[12.5px] [overflow-wrap:anywhere]">
                      {a.action}
                    </StatusPill>
                    {!compact && (
                      <span className="inline-flex min-w-0 items-center gap-1.5 text-[13.5px] text-muted">
                        <span className="font-mono">{a.entity}</span>
                        {a.entityId && <span className="max-w-[160px] truncate font-mono text-[12px] opacity-80">#{a.entityId.slice(0, 8)}</span>}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 sm:pl-[60px]">
                    {a.actorId ? (
                      <Link href={`/users/${a.actorId}`} className="inline-flex min-w-0 items-center gap-2 text-[14.5px] font-semibold hover:text-link hover:underline">
                        <Avatar name={a.actorName ?? '?'} size={26} className="ring-0" />
                        <span className="truncate">{a.actorName ?? a.actorId.slice(0, 8)}</span>
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-2 text-[14.5px] text-muted">
                        <span className="grid size-[26px] place-items-center rounded-full bg-surface-2">
                          <ShieldAlert className="size-3.5" strokeWidth={2} aria-hidden />
                        </span>
                        {t('system')}
                      </span>
                    )}
                    {a.impersonatorId && <StatusPill tone="accent">{t('impersonated')}</StatusPill>}
                    {a.ip && <span className="font-mono text-[12.5px] text-muted">{a.ip}</span>}
                    {a.diff !== null && a.diff !== undefined && (
                      <div className="basis-full">
                        <JsonView value={a.diff} label={t('showDiff')} />
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}

export function AuditView() {
  const t = useTranslations('audit');
  const empty = { actorId: '', entity: '', action: '', from: '', to: '' };
  const [draft, setDraft] = React.useState(empty);
  const [filters, setFilters] = React.useState(draft);
  const valid = !filters.actorId || /^[0-9a-f-]{36}$/i.test(filters.actorId);
  const list = useCursorList<AuditEntryDto>(valid ? `/admin/audit${qs({ limit: 50, ...filters, from: filters.from ? `${filters.from}T00:00:00Z` : '', to: filters.to ? `${filters.to}T23:59:59Z` : '' })}` : null);
  const set = (k: keyof typeof draft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  const active = Object.values(filters).filter(Boolean).length;
  return (
    <>
      <PageHeader icon={History} title={t('title')} subtitle={t('subtitle')} />
      <div className="grid items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <form
          className="card flex flex-col gap-4 p-5 xl:sticky xl:top-24"
          onSubmit={(e) => {
            e.preventDefault();
            setFilters(draft);
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-[17px] font-bold">
              <Filter className="size-[18px] text-muted" strokeWidth={2} aria-hidden />
              {t('filters')}
            </h2>
            {active > 0 && <StatusPill tone="primary">{active}</StatusPill>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Field label={t('actorId')} error={!valid ? t('badUuid') : undefined} className="sm:col-span-2 xl:col-span-1">
              <Input value={draft.actorId} onChange={set('actorId')} placeholder="uuid" className="font-mono" />
            </Field>
            <Field label={t('entity')}>
              <Input value={draft.entity} onChange={set('entity')} placeholder="listing" className="font-mono" />
            </Field>
            <Field label={t('action')}>
              <Input value={draft.action} onChange={set('action')} placeholder="listing.approve" className="font-mono" />
            </Field>
            <Field label={t('from')}>
              <Input type="date" value={draft.from} onChange={set('from')} />
            </Field>
            <Field label={t('to')}>
              <Input type="date" value={draft.to} onChange={set('to')} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="flex-1" icon={<Search className="size-4" strokeWidth={2} aria-hidden />}>
              {t('apply')}
            </Button>
            <Button
              type="button"
              variant="secondary"
              icon={<RotateCcw className="size-4" strokeWidth={2} aria-hidden />}
              onClick={() => {
                setDraft(empty);
                setFilters(empty);
              }}
            >
              {t('reset')}
            </Button>
          </div>
        </form>
        <div className="min-w-0">
          <div className="card p-5 md:p-6" aria-live="polite">
            {list.error ? <ErrorBlock error={list.error} retry={() => list.mutate()} /> : list.loading ? <LoadingBlock /> : <AuditTable items={list.items} />}
          </div>
          {list.hasMore && (
            <div className="mt-5 flex justify-center">
              <Button variant="secondary" loading={list.loadingMore} onClick={() => list.loadMore()}>
                {t('loadMore')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
