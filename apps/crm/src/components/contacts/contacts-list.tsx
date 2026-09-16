'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWRInfinite from 'swr/infinite';
import { CopyCheck, Plus, Search, UsersRound } from 'lucide-react';
import { CONTACT_TYPES, formatDateKa, relativeDaysKa, type ContactRow } from '@lokacia/contracts';
import { Badge, Button, Checkbox, EmptyState, Input, Select, Skeleton } from '@lokacia/ui';
import { CallButton } from '@/components/common/call-button';
import { PageHeader } from '@/components/common/page-header';
import { MemberSelect } from '@/components/common/pickers';
import { apiFetch } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi } from '@/lib/swr';
import { ContactFormDialog } from './contact-form-dialog';
import type { ContactFacets } from './types';

type Filters = { q: string; type: string; tag: string; source: string; agentId: string; hasRequirements: boolean };
type Page = { items: ContactRow[]; total: number; nextCursor: string | null };

export const TYPE_TONE = { client: 'primary', owner: 'link', partner: 'outline' } as const;

export function ContactsList({ initial, openNew }: { initial: Filters; openNew: boolean }) {
  const t = useTranslations('contacts');
  const router = useRouter();
  const { org, role } = useCrm();
  const [filters, setFilters] = React.useState<Filters>(initial);
  const [q, setQ] = React.useState(initial.q);
  const [creating, setCreating] = React.useState(openNew);
  const { data: facets } = useApi<ContactFacets>('/crm/contacts/facets');
  const { data: dups } = useApi<unknown[]>('/crm/contacts/duplicates');

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
                  <CopyCheck className="size-4" strokeWidth={1.5} aria-hidden />
                  {t('duplicates.badge', { count: dups.length })}
                </Link>
              </Button>
            )}
            <Button size="sm" onClick={() => setCreating(true)} icon={<Plus className="size-4" strokeWidth={1.5} aria-hidden />}>
              {t('new')}
            </Button>
          </>
        }
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(220px,2fr)_repeat(4,minmax(0,1fr))_auto]">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')} prefixIcon={<Search className="size-4" strokeWidth={1.5} />} type="search" />
        <Select aria-label={t('filters.type')} value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} placeholder={t('filters.allTypes')} options={CONTACT_TYPES.map((x) => ({ value: x, label: t(`types.${x}`) }))} />
        <Select aria-label={t('filters.tag')} value={filters.tag} onChange={(e) => setFilters((f) => ({ ...f, tag: e.target.value }))} placeholder={t('filters.allTags')} options={(facets?.tags ?? []).map((x) => ({ value: x.tag, label: `${x.tag} (${x.count})` }))} />
        <Select aria-label={t('filters.source')} value={filters.source} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))} placeholder={t('filters.allSources')} options={(facets?.sources ?? []).map((s) => ({ value: s.key, label: s.name }))} />
        {role !== 'agent' ? (
          <MemberSelect value={filters.agentId || null} onChange={(v) => setFilters((f) => ({ ...f, agentId: v ?? '' }))} placeholder={t('filters.allAgents')} />
        ) : (
          <span className="hidden lg:block" />
        )}
        <div className="flex items-center gap-3">
          <Checkbox label={t('filters.withRequirements')} checked={filters.hasRequirements} onCheckedChange={(v) => setFilters((f) => ({ ...f, hasRequirements: v === true }))} />
        </div>
      </div>
      {active && (
        <button
          type="button"
          className="mb-3 text-small text-link underline-offset-4 hover:underline"
          onClick={() => {
            setQ('');
            setFilters({ q: '', type: '', tag: '', source: '', agentId: '', hasRequirements: false });
          }}
        >
          {t('filters.reset')}
        </button>
      )}

      {isLoading && !data ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<UsersRound className="size-5" strokeWidth={1.5} aria-hidden />} title={t('empty')} description={t('emptyHint')} action={<Button onClick={() => setCreating(true)}>{t('new')}</Button>} />
      ) : (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full border-collapse text-left text-[14px] tabular">
            <thead>
              <tr className="border-b border-border-strong text-small text-muted">
                <th scope="col" className="px-3 py-2 font-medium">{t('columns.name')}</th>
                <th scope="col" className="px-3 py-2 font-medium">{t('columns.phone')}</th>
                <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">{t('columns.type')}</th>
                <th scope="col" className="hidden px-3 py-2 font-medium lg:table-cell">{t('columns.tags')}</th>
                <th scope="col" className="hidden px-3 py-2 font-medium lg:table-cell">{t('columns.source')}</th>
                <th scope="col" className="hidden px-3 py-2 font-medium md:table-cell">{t('columns.agent')}</th>
                <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">{t('columns.lastContacted')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="cursor-pointer border-b border-border last:border-b-0 hover:bg-surface-2" onClick={() => router.push(`/contacts/${c.id}`)}>
                  <td className="max-w-[260px] px-3 py-2">
                    <Link href={`/contacts/${c.id}`} className="block truncate font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                      {c.name}
                    </Link>
                    {c.company && <span className="block truncate text-small text-muted">{c.company}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    {c.phones[0] ? <CallButton phone={c.phones[0]} entityId={c.id} variant="ghost" onLogged={() => mutate()} /> : <span className="text-muted">—</span>}
                  </td>
                  <td className="hidden px-3 py-2 md:table-cell">
                    <Badge tone={TYPE_TONE[c.type]}>{t(`types.${c.type}`)}</Badge>
                  </td>
                  <td className="hidden px-3 py-2 lg:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {c.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} tone="outline">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 text-muted lg:table-cell">{facets?.sources.find((s) => s.key === c.source)?.name ?? c.source ?? '—'}</td>
                  <td className="hidden truncate px-3 py-2 md:table-cell">{c.ownerAgentName ?? '—'}</td>
                  <td className="hidden whitespace-nowrap px-3 py-2 text-right text-muted sm:table-cell" title={c.lastContactedAt ? formatDateKa(c.lastContactedAt) : undefined}>
                    {c.lastContactedAt ? relativeDaysKa(c.lastContactedAt) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasMore && (
        <div className="mt-3 flex justify-center">
          <Button variant="secondary" size="sm" onClick={() => setSize(size + 1)}>
            {t('loadMore', { shown: rows.length, total })}
          </Button>
        </div>
      )}
      {creating && <ContactFormDialog open={creating} onOpenChange={setCreating} onSaved={(c) => router.push(`/contacts/${c.id}`)} />}
    </div>
  );
}
