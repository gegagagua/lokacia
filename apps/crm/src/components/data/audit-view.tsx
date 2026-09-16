'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Activity, Building2, CalendarDays, ChevronRight, Database, FileSignature, FileChartColumn, Filter, Handshake, MessagesSquare, Presentation, Radar, Repeat, ShieldCheck, SquareCheckBig, SquareKanban, Users, UsersRound, type LucideIcon } from 'lucide-react';
import { formatDateTimeKa, type CrmAuditRow } from '@lokacia/contracts';
import { Button, cn, Drawer, EmptyState, Field, Input, Select, Skeleton } from '@lokacia/ui';
import { useDateFormat } from '@/components/analytics/format';
import { PageHeader } from '@/components/common/page-header';
import { MemberSelect } from '@/components/common/pickers';
import { ChipGroup, IconTile, PersonAvatar, Pill, SectionCard, type Tone } from '@/components/common/ui';
import { apiFetch } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';

type Page = { items: CrmAuditRow[]; nextCursor: string | null; entities: string[] };

const MODULES: { key: string; icon: LucideIcon; tone: Tone }[] = [
  { key: 'contacts', icon: Users, tone: 2 },
  { key: 'deals', icon: SquareKanban, tone: 1 },
  { key: 'tasks', icon: SquareCheckBig, tone: 4 },
  { key: 'viewings', icon: CalendarDays, tone: 7 },
  { key: 'inbox', icon: MessagesSquare, tone: 6 },
  { key: 'documents', icon: FileSignature, tone: 5 },
  { key: 'listings', icon: Building2, tone: 3 },
  { key: 'presentations', icon: Presentation, tone: 3 },
  { key: 'sequences', icon: Repeat, tone: 6 },
  { key: 'imports', icon: Database, tone: 8 },
  { key: 'team', icon: UsersRound, tone: 1 },
  { key: 'cobroker', icon: Handshake, tone: 5 },
  { key: 'competitors', icon: Radar, tone: 7 },
  { key: 'liveness', icon: ShieldCheck, tone: 2 },
  { key: 'owner_reports', icon: FileChartColumn, tone: 4 },
];
const CHIP_MODULES = ['contacts', 'deals', 'tasks', 'viewings', 'documents', 'listings', 'team'] as const;

function parseAction(action: string) {
  const [method = '', path = ''] = action.split(' ');
  const parts = path.split('.');
  const mod = (parts[0] === 'crm' ? (parts[1] ?? '') : (parts[0] ?? '')).replace(/-/g, '_');
  const sub = parts.slice(parts[0] === 'crm' ? 2 : 1).join('.');
  const meta = MODULES.find((m) => m.key === mod) ?? { key: mod, icon: Activity, tone: 8 as Tone };
  const m = method.toLowerCase();
  const methodTone: Tone = m === 'delete' ? 'danger' : m === 'post' ? 'success' : m === 'patch' || m === 'put' ? 2 : 8;
  return { method: m, module: mod, sub, meta, methodTone };
}

export function AuditView() {
  const t = useTranslations('data.audit');
  const { org } = useCrm();
  const fmt = useDateFormat();
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

  const chipValue = CHIP_MODULES.find((m) => action.trim() === `crm.${m}`) ?? (action.trim() ? '' : 'all');
  const groups = React.useMemo(() => {
    const out: { day: string; label: string; rows: CrmAuditRow[] }[] = [];
    for (const r of items ?? []) {
      const d = new Date(r.createdAt);
      const day = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const last = out[out.length - 1];
      if (last?.day === day) last.rows.push(r);
      else out.push({ day, label: fmt.dayLine(d), rows: [r] });
    }
    return out;
  }, [items, fmt]);

  const openParsed = open ? parseAction(open.action) : null;

  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="card mb-5 flex flex-col gap-4 p-4">
        <ChipGroup
          label={t('modules')}
          value={chipValue as 'all'}
          onChange={(v) => setAction(v === 'all' ? '' : `crm.${v}`)}
          options={[{ value: 'all', label: t('all'), icon: Filter }, ...CHIP_MODULES.map((m) => ({ value: m, label: t(`moduleNames.${m}`), icon: MODULES.find((x) => x.key === m)!.icon }))] as { value: 'all'; label: string; icon: LucideIcon }[]}
        />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Field label={t('actor')} className="col-span-2 sm:col-span-1">
            <MemberSelect value={actorId} onChange={setActorId} placeholder="—" />
          </Field>
          <Field label={t('entity')} className="col-span-2 sm:col-span-1">
            <Select value={entity} onChange={(e) => setEntity(e.target.value)} placeholder="—" options={entities.map((e) => ({ value: e, label: e }))} />
          </Field>
          <Field label={t('actionSearch')} className="col-span-2 lg:col-span-1">
            <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="post crm.deals" />
          </Field>
          <Field label={t('from')}>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label={t('to')}>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
      </div>
      {!items ? (
        <Skeleton className="h-96 rounded-card" />
      ) : items.length === 0 ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className="flex flex-col gap-4 md:gap-5">
          {groups.map((g) => (
            <SectionCard key={g.day} title={g.label} action={<Pill size="sm" tone="neutral">{t('count', { n: g.rows.length })}</Pill>} bodyClassName="px-2 pb-3 pt-2 md:px-3">
              <ol className="relative">
                {g.rows.map((r, i) => {
                  const p = parseAction(r.action);
                  return (
                    <li key={r.id} className="relative">
                      {i < g.rows.length - 1 && <span aria-hidden className="absolute bottom-0 left-[31px] top-12 w-0.5 rounded-full bg-border" />}
                      <button type="button" onClick={() => setOpen(r)} className="group flex w-full items-start gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-surface-2 focus-visible:shadow-ring focus-visible:outline-none">
                        <span className="relative z-[1] rounded-xl bg-surface ring-4 ring-surface">
                          <IconTile icon={p.meta.icon} tone={p.meta.tone} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="font-semibold">{MODULES.some((m) => m.key === p.module) ? t(`moduleNames.${p.module}`) : p.module}</span>
                            {p.sub && <span className="text-muted">· {p.sub}</span>}
                            <Pill size="sm" tone={p.methodTone}>
                              {['post', 'patch', 'put', 'delete'].includes(p.method) ? t(`methods.${p.method}`) : p.method.toUpperCase()}
                            </Pill>
                          </span>
                          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
                            <span className="flex items-center gap-1.5">
                              <PersonAvatar name={r.actorName} size={20} />
                              <span className="font-medium text-text">{r.actorName ?? '—'}</span>
                            </span>
                            {r.entityId && <code className="max-w-48 truncate rounded-md bg-surface-2 px-1.5 py-0.5 text-[11.5px]">{r.entityId}</code>}
                          </span>
                        </span>
                        <span className="flex shrink-0 items-center gap-1 pt-0.5 text-[12.5px] font-medium text-muted tabular">
                          {fmt.time(r.createdAt)}
                          <ChevronRight className="size-4 opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2} aria-hidden />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </SectionCard>
          ))}
        </div>
      )}
      {cursor && (
        <div className="mt-5 flex justify-center">
          <Button variant="secondary" onClick={more} loading={loading}>
            {t('loadMore')}
          </Button>
        </div>
      )}
      <Drawer open={!!open} onOpenChange={(o) => !o && setOpen(null)} title={open?.action ?? ''}>
        {open && openParsed && (
          <div className="flex flex-col gap-4 text-small">
            <div className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3">
              <IconTile icon={openParsed.meta.icon} tone={openParsed.meta.tone} />
              <div className="min-w-0">
                <div className="font-semibold">{MODULES.some((m) => m.key === openParsed.module) ? t(`moduleNames.${openParsed.module}`) : openParsed.module}</div>
                <div className="text-muted tabular">{formatDateTimeKa(open.createdAt)}</div>
              </div>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-muted">{t('actor')}</dt>
              <dd className={cn('flex items-center gap-2 font-medium')}>
                <PersonAvatar name={open.actorName} size={22} />
                {open.actorName ?? '—'}
              </dd>
              <dt className="text-muted">{t('action')}</dt>
              <dd className="font-mono text-[12.5px]">{open.action}</dd>
              <dt className="text-muted">{t('entity')}</dt>
              <dd className="break-all tabular">
                {open.entity} {open.entityId}
              </dd>
              <dt className="text-muted">IP</dt>
              <dd className="tabular">{open.ip ?? '—'}</dd>
            </dl>
            <pre className="overflow-x-auto rounded-2xl border border-border bg-surface-2 p-3 text-[12px] leading-relaxed">{JSON.stringify(open.diff, null, 2)}</pre>
          </div>
        )}
      </Drawer>
    </>
  );
}
