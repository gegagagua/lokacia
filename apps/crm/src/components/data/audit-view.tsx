'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { formatDateTimeKa, type CrmAuditRow } from '@lokacia/contracts';
import { Button, Drawer, EmptyState, Field, Input, Select, Skeleton } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { MemberSelect } from '@/components/common/pickers';
import { apiFetch } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';

type Page = { items: CrmAuditRow[]; nextCursor: string | null; entities: string[] };

export function AuditView() {
  const t = useTranslations('data.audit');
  const { org } = useCrm();
  const [actorId, setActorId] = React.useState<string | null>(null);
  const [entity, setEntity] = React.useState('');
  const [action, setAction] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [items, setItems] = React.useState<CrmAuditRow[] | null>(null);
  const [entities, setEntities] = React.useState<string[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState<CrmAuditRow | null>(null);
  const [loading, setLoading] = React.useState(false);

  const query = React.useCallback(
    (c?: string | null) => {
      const p = new URLSearchParams({ limit: '50' });
      if (actorId) p.set('actorId', actorId);
      if (entity) p.set('entity', entity);
      if (action.trim()) p.set('action', action.trim());
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      if (c) p.set('cursor', c);
      return `/crm/audit?${p}`;
    },
    [actorId, entity, action, from, to],
  );

  React.useEffect(() => {
    const ctl = setTimeout(() => {
      setLoading(true);
      apiFetch<Page>(query(), { orgId: org.id })
        .then((r) => {
          setItems(r.items);
          setCursor(r.nextCursor);
          setEntities((e) => [...new Set([...e, ...r.entities])]);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(ctl);
  }, [query, org.id]);

  const more = async () => {
    if (!cursor) return;
    setLoading(true);
    const r = await apiFetch<Page>(query(cursor), { orgId: org.id }).finally(() => setLoading(false));
    setItems((x) => [...(x ?? []), ...r.items]);
    setCursor(r.nextCursor);
  };

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Field label={t('actor')}>
          <MemberSelect value={actorId} onChange={setActorId} placeholder="—" />
        </Field>
        <Field label={t('entity')}>
          <Select value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="—" options={entities.map((e) => ({ value: e, label: e }))} />
        </Field>
        <Field label={t('actionSearch')}>
          <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="post crm.deals" />
        </Field>
        <Field label={t('from')}>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t('to')}>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      {!items ? (
        <Skeleton className="h-64" />
      ) : items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className="relative overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-[14px] tabular">
            <thead>
              <tr className="border-b border-border-strong text-left text-small text-muted">
                <th scope="col" className="px-3 py-2 font-medium">{t('when')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('actor')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('action')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('entity')}</th>
                <th scope="col" className="px-3 py-2"><span className="sr-only">{t('details')}</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                  <td className="whitespace-nowrap px-3 py-2 text-muted">{formatDateTimeKa(r.createdAt)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{r.actorName ?? '—'}</td>
                  <td className="px-3 py-2 font-mono text-[12px]">{r.action}</td>
                  <td className="max-w-48 truncate px-3 py-2 text-small text-muted">{r.entityId ?? r.entity}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setOpen(r)}>{t('details')}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" onClick={more} loading={loading}>{t('loadMore')}</Button>
        </div>
      )}
      <Drawer open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={open?.action ?? ''}>
        {open && (
          <div className="flex flex-col gap-2 text-small">
            <div className="tabular text-muted">{formatDateTimeKa(open.createdAt)} · {open.actorName} · {open.ip}</div>
            <div className="tabular">{open.entity} {open.entityId}</div>
            <pre className="overflow-x-auto rounded-card border border-border bg-bg p-3 text-[12px] leading-relaxed">{JSON.stringify(open.diff, null, 2)}</pre>
          </div>
        )}
      </Drawer>
    </>
  );
}
