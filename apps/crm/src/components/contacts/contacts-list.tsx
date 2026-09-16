'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWRInfinite from 'swr/infinite';
import { Bookmark, BookmarkPlus, Building2, ClipboardList, CopyCheck, Handshake, Plus, Search, SlidersHorizontal, UserRound, UsersRound, X, type LucideIcon } from 'lucide-react';
import { CONTACT_TYPES, formatDateKa, relativeDaysKa, type ContactRow } from '@lokacia/contracts';
import { Button, cn, EmptyState, Input, Popover, Select, Skeleton } from '@lokacia/ui';
import { CallButton } from '@/components/common/call-button';
import { PageHeader } from '@/components/common/page-header';
import { MemberSelect } from '@/components/common/pickers';
import { Pill, PersonAvatar, toneClass, toneFor, type Tone } from '@/components/common/ui';
import { apiFetch } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi } from '@/lib/swr';
import { ContactFormDialog } from './contact-form-dialog';
import type { ContactFacets } from './types';

type Filters = { q: string; type: string; tag: string; source: string; agentId: string; hasRequirements: boolean };
type Page = { items: ContactRow[]; total: number; nextCursor: string | null };
type SavedView = { id: string; name: string; filters: Filters };

export const TYPE_TONE: Record<ContactRow['type'], Tone> = { client: 2, owner: 7, partner: 4 };
export const TYPE_ICON: Record<ContactRow['type'], LucideIcon> = { client: UserRound, owner: Building2, partner: Handshake };

const EMPTY: Filters = { q: '', type: '', tag: '', source: '', agentId: '', hasRequirements: false };
const VIEWS_KEY = 'lk-crm-contact-views';
const same = (a: Filters, b: Filters) => (Object.keys(EMPTY) as (keyof Filters)[]).every((k) => a[k] === b[k]);

function readViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    const parsed = raw ? (JSON.parse(raw) as SavedView[]) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => v && typeof v.name === 'string' && v.filters) : [];
  } catch {
    return [];
  }
}
function writeViews(v: SavedView[]) {
  try {
    localStorage.setItem(VIEWS_KEY, JSON.stringify(v));
  } catch {
    /* private mode */
  }
}

/** Recency dot: green ≤7 days, amber ≤30 days, red older, grey never. */
function recencyTone(iso: string | null): Tone {
  if (!iso) return 'neutral';
  const days = (Date.now() - new Date(iso).getTime()) / 86_400_000;
  return days <= 7 ? 'success' : days <= 30 ? 3 : 'danger';
}

export function ContactsList({ initial, openNew }: { initial: Filters; openNew: boolean }) {
  const t = useTranslations('contacts');
  const router = useRouter();
  const { org, role, user } = useCrm();
  const [filters, setFilters] = React.useState<Filters>(initial);
  const [q, setQ] = React.useState(initial.q);
  const [creating, setCreating] = React.useState(openNew);
  const [views, setViews] = React.useState<SavedView[]>([]);
  const [viewName, setViewName] = React.useState('');
  const [savingView, setSavingView] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  const { data: facets } = useApi<ContactFacets>('/crm/contacts/facets');
  const { data: dups } = useApi<unknown[]>('/crm/contacts/duplicates');

  React.useEffect(() => setViews(readViews()), []);

  React.useEffect(() => {
    const id = setTimeout(() => setFilters((f) => (f.q === q ? f : { ...f, q })), 250);
    return () => clearTimeout(id);
  }, [q]);

  const params = React.useMemo(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) if (v) p.set(k, String(v));
    return p;
  }, [filters]);

  React.useEffect(() => {
    const s = params.toString();
    window.history.replaceState(null, '', s ? `/contacts?${s}` : '/contacts');
  }, [params]);

  const { data, size, setSize, isLoading, mutate } = useSWRInfinite<Page>(
    (i, prev: Page | null) => {
      if (prev && !prev.nextCursor) return null;
      const p = new URLSearchParams(params);
      p.set('limit', '50');
      if (prev?.nextCursor) p.set('cursor', prev.nextCursor);
      return [`/crm/contacts?${p}`, org.id];
    },
    ([path, orgId]: [string, string]) => apiFetch<Page>(path, { orgId }),
    { revalidateFirstPage: false },
  );
  const rows = data?.flatMap((p) => p.items) ?? [];
  const total = data?.[0]?.total ?? 0;
  const hasMore = !!data?.[data.length - 1]?.nextCursor;
  const active = !!(filters.q || filters.type || filters.tag || filters.source || filters.agentId || filters.hasRequirements);

  const apply = (f: Filters) => {
    setQ(f.q);
    setFilters(f);
  };

  const builtIn: { id: string; label: string; icon: LucideIcon; on: (f: Filters) => boolean; next: (f: Filters) => Filters }[] = [
    { id: 'all', label: t('views.all'), icon: UsersRound, on: (f) => !f.type && !f.hasRequirements && (role === 'agent' || f.agentId !== user.id), next: (f) => ({ ...f, type: '', hasRequirements: false, agentId: f.agentId === user.id ? '' : f.agentId }) },
    ...CONTACT_TYPES.map((x) => ({ id: x, label: t(`views.${x}`), icon: TYPE_ICON[x], on: (f: Filters) => f.type === x, next: (f: Filters) => ({ ...f, type: f.type === x ? '' : x }) })),
    { id: 'req', label: t('filters.withRequirements'), icon: ClipboardList, on: (f) => f.hasRequirements, next: (f) => ({ ...f, hasRequirements: !f.hasRequirements }) },
    ...(role !== 'agent' ? [{ id: 'mine', label: t('views.mine'), icon: UserRound, on: (f: Filters) => f.agentId === user.id, next: (f: Filters) => ({ ...f, agentId: f.agentId === user.id ? '' : user.id }) }] : []),
  ];

  const saveView = () => {
    const name = viewName.trim();
    if (!name) return;
    const next = [...views.filter((v) => v.name !== name), { id: `${Date.now()}`, name, filters }];
    setViews(next);
    writeViews(next);
    setViewName('');
    setSavingView(false);
  };
  const removeView = (id: string) => {
    const next = views.filter((v) => v.id !== id);
    setViews(next);
    writeViews(next);
  };

  const sourceName = (key: string | null) => facets?.sources.find((s) => s.key === key)?.name ?? key ?? '—';
  const chip = 'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13.5px] font-medium transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none';

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle', { count: total })}
        actions={
          <>
            {!!dups?.length && (
              <Button asChild variant="secondary" size="sm">
                <Link href="/contacts/duplicates">
                  <CopyCheck className="size-4 text-tone-ink tone-3" strokeWidth={2} aria-hidden />
                  {t('duplicates.badge', { count: dups.length })}
                </Link>
              </Button>
            )}
            <Button size="sm" onClick={() => setCreating(true)} icon={<Plus className="size-4" strokeWidth={2.4} aria-hidden />}>
              {t('new')}
            </Button>
          </>
        }
      />

      {/* Views: built-in + saved (per browser) */}
      <div className="mb-3 flex items-center gap-2">
        <div role="group" aria-label={t('views.label')} className="scrollbar-none -mx-1 flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-1 py-0.5">
          {builtIn.map((v) => {
            const on = v.on(filters);
            const Icon = v.icon;
            return (
              <button key={v.id} type="button" aria-pressed={on} onClick={() => apply(v.next(filters))} className={cn(chip, on ? 'border-transparent bg-text text-surface shadow-sm' : 'border-border bg-surface text-muted hover:border-border-strong hover:text-text')}>
                <Icon className="size-3.5" strokeWidth={2} aria-hidden />
                {v.label}
              </button>
            );
          })}
          {views.length > 0 && <span aria-hidden className="mx-1 h-5 w-px shrink-0 bg-border" />}
          {views.map((v) => {
            const on = same(filters, v.filters);
            return (
              <span key={v.id} className={cn(chip, 'pr-1', on ? 'border-transparent bg-primary text-primary-contrast shadow-sm' : 'border-border bg-surface text-muted hover:border-border-strong hover:text-text')}>
                <button type="button" aria-pressed={on} onClick={() => apply(v.filters)} className="inline-flex items-center gap-1.5 focus-visible:outline-none">
                  <Bookmark className="size-3.5" strokeWidth={2} aria-hidden />
                  {v.name}
                </button>
                <button type="button" onClick={() => removeView(v.id)} aria-label={`${t('views.remove')}: ${v.name}`} className="grid size-6 place-items-center rounded-full opacity-70 hover:bg-black/10 hover:opacity-100">
                  <X className="size-3" strokeWidth={2.4} aria-hidden />
                </button>
              </span>
            );
          })}
        </div>
        {active && (
          <Popover
            align="end"
            open={savingView}
            onOpenChange={setSavingView}
            className="w-72 p-3"
            trigger={
              <Button variant="ghost" size="sm" className="shrink-0 rounded-full" icon={<BookmarkPlus className="size-4" strokeWidth={2} aria-hidden />}>
                <span className="hidden sm:inline">{t('views.save')}</span>
              </Button>
            }
          >
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                saveView();
              }}
            >
              <label htmlFor="lk-view-name" className="text-[13.5px] font-semibold">
                {t('views.save')}
              </label>
              <Input id="lk-view-name" autoFocus value={viewName} onChange={(e) => setViewName(e.target.value)} placeholder={t('views.namePlaceholder')} maxLength={40} />
              <Button type="submit" size="sm" disabled={!viewName.trim()}>
                {t('views.saveSubmit')}
              </Button>
            </form>
          </Popover>
        )}
      </div>

      {/* Filters */}
      <div className="card mb-4 grid gap-2 p-2.5 sm:grid-cols-2 lg:grid-cols-[minmax(240px,2fr)_repeat(3,minmax(0,1fr))_auto]">
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')} prefixIcon={<Search className="size-4" strokeWidth={2} />} type="search" className="min-w-0 flex-1" />
          <Button variant="secondary" className="relative size-12 shrink-0 px-0 sm:hidden" aria-expanded={showFilters} aria-controls="contact-filters" aria-label={t('filters.more')} onClick={() => setShowFilters((v) => !v)}>
            <SlidersHorizontal className="size-4" strokeWidth={2} aria-hidden />
            {!!(filters.tag || filters.source || (filters.agentId && filters.agentId !== user.id)) && <span aria-hidden className="absolute right-2 top-2 size-2 rounded-full bg-accent" />}
          </Button>
        </div>
        <div id="contact-filters" className={cn('contents', !showFilters && 'max-sm:hidden')}>
          <Select aria-label={t('filters.tag')} value={filters.tag} onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))} placeholder={t('filters.allTags')} options={(facets?.tags ?? []).map((x) => ({ value: x.tag, label: `${x.tag} (${x.count})` }))} />
          <Select aria-label={t('filters.source')} value={filters.source} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))} placeholder={t('filters.allSources')} options={(facets?.sources ?? []).map((s) => ({ value: s.key, label: s.name }))} />
          {role !== 'agent' ? <MemberSelect value={filters.agentId || null} onChange={(v) => setFilters((f) => ({ ...f, agentId: v ?? '' }))} placeholder={t('filters.allAgents')} /> : <span className="hidden lg:block" />}
        </div>
        <div className={cn('flex items-center justify-end', !active && 'max-lg:hidden')}>
          {active ? (
            <Button variant="ghost" size="sm" onClick={() => apply(EMPTY)} icon={<X className="size-4" strokeWidth={2} aria-hidden />}>
              {t('filters.reset')}
            </Button>
          ) : (
            <span className="px-3 text-[13px] text-muted tabular">{t('subtitle', { count: total })}</span>
          )}
        </div>
      </div>

      {isLoading && !data ? (
        <div className="card flex flex-col gap-3 p-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-4 w-48" />
              <Skeleton className="ml-auto h-4 w-24" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<UsersRound className="size-5" strokeWidth={2} aria-hidden />} title={t('empty')} description={t('emptyHint')} action={<Button onClick={() => setCreating(true)}>{t('new')}</Button>} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="card hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[14px] tabular">
                <caption className="sr-only">{t('title')}</caption>
                <thead>
                  <tr className="whitespace-nowrap border-b border-border bg-surface-2/60 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-muted">
                    <th scope="col" className="py-3 pl-5 pr-3 font-semibold">{t('columns.name')}</th>
                    <th scope="col" className="px-3 py-3 font-semibold">{t('columns.phone')}</th>
                    <th scope="col" className="px-3 py-3 font-semibold">{t('columns.type')}</th>
                    <th scope="col" className="hidden px-3 py-3 font-semibold lg:table-cell">{t('columns.tags')}</th>
                    <th scope="col" className="hidden px-3 py-3 font-semibold 2xl:table-cell">{t('columns.source')}</th>
                    <th scope="col" className="hidden px-3 py-3 font-semibold lg:table-cell">{t('columns.agent')}</th>
                    <th scope="col" className="py-3 pl-3 pr-5 text-right font-semibold">{t('columns.lastContacted')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => (
                    <tr key={c.id} className="group cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-primary-soft/35" onClick={() => router.push(`/contacts/${c.id}`)}>
                      <td className="max-w-[300px] py-2.5 pl-5 pr-3">
                        <div className="flex items-center gap-3">
                          <PersonAvatar name={c.name} size={36} />
                          <div className="min-w-0">
                            <Link href={`/contacts/${c.id}`} className="block truncate font-semibold text-text group-hover:text-primary-soft-text" onClick={(e) => e.stopPropagation()}>
                              {c.name}
                            </Link>
                            <span className="block truncate text-[13px] text-muted">{c.company ?? c.emails[0] ?? (c.hasRequirements ? t('filters.withRequirements') : ' ')}</span>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        {c.phones[0] ? <CallButton phone={c.phones[0]} entityId={c.id} variant="ghost" onLogged={() => mutate()} className="-ml-3 font-medium" /> : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <Pill tone={TYPE_TONE[c.type]} icon={TYPE_ICON[c.type]} size="sm">
                          {t(`types.${c.type}`)}
                        </Pill>
                      </td>
                      <td className="hidden px-3 py-2.5 lg:table-cell">
                        <div className="flex max-w-[260px] flex-wrap gap-1">
                          {c.tags.slice(0, 3).map((tag) => (
                            <Pill key={tag} tone={toneFor(tag)} dot size="sm">
                              {tag}
                            </Pill>
                          ))}
                          {c.tags.length > 3 && <Pill size="sm">+{c.tags.length - 3}</Pill>}
                        </div>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted 2xl:table-cell">{sourceName(c.source)}</td>
                      <td className="hidden px-3 py-2.5 lg:table-cell">
                        {c.ownerAgentName ? (
                          <span className="flex items-center gap-2 whitespace-nowrap">
                            <PersonAvatar name={c.ownerAgentName} size={24} />
                            <span className="truncate">{c.ownerAgentName}</span>
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pl-3 pr-5 text-right text-muted" title={c.lastContactedAt ? formatDateKa(c.lastContactedAt) : undefined}>
                        <span className="inline-flex items-center gap-2">
                          <RecencyDot iso={c.lastContactedAt} />
                          {c.lastContactedAt ? relativeDaysKa(c.lastContactedAt) : '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <ul className="flex flex-col gap-2.5 md:hidden">
            {rows.map((c) => (
              <li key={c.id} className="card relative flex items-start gap-3 p-3.5">
                <PersonAvatar name={c.name} size={44} />
                <div className="min-w-0 flex-1">
                  <Link href={`/contacts/${c.id}`} className="block truncate font-semibold after:absolute after:inset-0 after:content-['']">
                    {c.name}
                  </Link>
                  {c.company && <div className="truncate text-[13px] text-muted">{c.company}</div>}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Pill tone={TYPE_TONE[c.type]} size="sm">
                      {t(`types.${c.type}`)}
                    </Pill>
                    {c.tags.slice(0, 2).map((tag) => (
                      <Pill key={tag} tone={toneFor(tag)} dot size="sm">
                        {tag}
                      </Pill>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-muted">
                    <RecencyDot iso={c.lastContactedAt} />
                    {c.lastContactedAt ? relativeDaysKa(c.lastContactedAt) : '—'}
                    {c.ownerAgentName && <span className="truncate">· {c.ownerAgentName}</span>}
                  </div>
                </div>
                {c.phones[0] && (
                  <div className="relative z-[1]">
                    <CallButton phone={c.phones[0]} entityId={c.id} compact onLogged={() => mutate()} className="size-10 rounded-full" />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" size="sm" className="rounded-full px-5" onClick={() => setSize(size + 1)}>
            {t('loadMore', { shown: rows.length, total })}
          </Button>
        </div>
      )}
      {creating && <ContactFormDialog open={creating} onOpenChange={setCreating} onSaved={(c) => router.push(`/contacts/${c.id}`)} />}
    </div>
  );
}

function RecencyDot({ iso }: { iso: string | null }) {
  const tone = recencyTone(iso);
  return <span aria-hidden className={cn('size-2 shrink-0 rounded-full', tone === 'neutral' ? 'bg-border-strong' : cn('bg-tone', toneClass(tone)))} />;
}
