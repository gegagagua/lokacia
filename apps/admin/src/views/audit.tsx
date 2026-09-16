'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatDateTimeKa, type AuditEntryDto } from '@lokacia/contracts';
import { Badge, Button, Field, Input } from '@lokacia/ui';
import { qs, useCursorList } from '@/lib/use-cursor-list';
import { PageHeader } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { JsonView } from '@/components/json-view';

export function AuditTable({ items, compact }: { items: AuditEntryDto[]; compact?: boolean }) {
  const t = useTranslations('audit');
  if (!items.length) return <p className="text-small text-muted">{t('empty')}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-[13px] tabular">
        <thead>
          <tr className="border-b border-border-strong text-muted">
            <th scope="col" className="px-2 py-1.5 font-medium">{t('colTime')}</th>
            <th scope="col" className="px-2 py-1.5 font-medium">{t('colActor')}</th>
            <th scope="col" className="px-2 py-1.5 font-medium">{t('colAction')}</th>
            {!compact && <th scope="col" className="px-2 py-1.5 font-medium">{t('colEntity')}</th>}
            <th scope="col" className="px-2 py-1.5 font-medium">{t('colDiff')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="border-b border-border align-top last:border-b-0">
              <td className="whitespace-nowrap px-2 py-1.5 text-muted">{formatDateTimeKa(a.createdAt)}</td>
              <td className="px-2 py-1.5">
                {a.actorId ? (
                  <Link href={`/users/${a.actorId}`} className="hover:underline">
                    {a.actorName ?? a.actorId.slice(0, 8)}
                  </Link>
                ) : (
                  <span className="text-muted">{t('system')}</span>
                )}
                {a.impersonatorId && (
                  <Badge tone="accent" className="ml-1">
                    {t('impersonated')}
                  </Badge>
                )}
                {a.ip && <div className="text-[11px] text-muted">{a.ip}</div>}
              </td>
              <td className="px-2 py-1.5 font-mono text-[12px]">{a.action}</td>
              {!compact && (
                <td className="px-2 py-1.5">
                  <span className="font-mono text-[12px]">{a.entity}</span>
                  {a.entityId && <div className="max-w-[180px] truncate font-mono text-[11px] text-muted">{a.entityId}</div>}
                </td>
              )}
              <td className="px-2 py-1.5">
                <JsonView value={a.diff} label={t('showDiff')} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AuditView() {
  const t = useTranslations('audit');
  const [draft, setDraft] = React.useState({ actorId: '', entity: '', action: '', from: '', to: '' });
  const [filters, setFilters] = React.useState(draft);
  const valid = !filters.actorId || /^[0-9a-f-]{36}$/i.test(filters.actorId);
  const list = useCursorList<AuditEntryDto>(valid ? `/admin/audit${qs({ limit: 50, ...filters, from: filters.from ? `${filters.from}T00:00:00Z` : '', to: filters.to ? `${filters.to}T23:59:59Z` : '' })}` : null);
  const set = (k: keyof typeof draft) => (e: React.ChangeEvent<HTMLInputElement>) => setDraft((d) => ({ ...d, [k]: e.target.value }));
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <form
        className="mb-4 grid gap-3 rounded-card border border-border bg-surface p-3 sm:grid-cols-2 lg:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          setFilters(draft);
        }}
      >
        <Field label={t('actorId')} error={!valid ? t('badUuid') : undefined} className="lg:col-span-2">
          <Input value={draft.actorId} onChange={set('actorId')} placeholder="uuid" className="font-mono" />
        </Field>
        <Field label={t('entity')}>
          <Input value={draft.entity} onChange={set('entity')} />
        </Field>
        <Field label={t('action')}>
          <Input value={draft.action} onChange={set('action')} />
        </Field>
        <Field label={t('from')}>
          <Input type="date" value={draft.from} onChange={set('from')} />
        </Field>
        <Field label={t('to')}>
          <Input type="date" value={draft.to} onChange={set('to')} />
        </Field>
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <Button type="submit" size="sm">
            {t('apply')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              const empty = { actorId: '', entity: '', action: '', from: '', to: '' };
              setDraft(empty);
              setFilters(empty);
            }}
          >
            {t('reset')}
          </Button>
        </div>
      </form>
      <div className="rounded-card border border-border bg-surface p-2" aria-live="polite">
        {list.error ? <ErrorBlock error={list.error} retry={() => list.mutate()} /> : list.loading ? <LoadingBlock /> : <AuditTable items={list.items} />}
      </div>
      {list.hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" loading={list.loadingMore} onClick={() => list.loadMore()}>
            {t('loadMore')}
          </Button>
        </div>
      )}
    </>
  );
}
