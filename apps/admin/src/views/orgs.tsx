'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BadgeCheck, Building2, ChevronRight, Search } from 'lucide-react';
import { formatDateKa, type AdminOrgRow } from '@lokacia/contracts';
import { Button, Input } from '@lokacia/ui';
import { qs, useCursorList } from '@/lib/use-cursor-list';
import { PageHeader } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { PillFilter, StatusPill, TableCard, THead, Toolbar, td, th, tr } from '@/components/kit';
import { hashIndex } from '@/lib/format';

const ORG_TINTS = ['bg-primary-soft text-primary-soft-text', 'bg-accent-soft text-[#7a5500] dark:text-accent', 'bg-link/10 text-link', 'bg-surface-3 text-text'];

export function OrgMark({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const initials = name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('');
  return (
    <span className={`grid shrink-0 place-items-center font-bold ${ORG_TINTS[hashIndex(name, ORG_TINTS.length)]} ${size === 'lg' ? 'size-14 rounded-2xl text-[20px]' : 'size-10 rounded-xl text-[15px]'}`} aria-hidden>
      {initials}
    </span>
  );
}

export function OrgsView() {
  const t = useTranslations('orgs');
  const router = useRouter();
  const [q, setQ] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [type, setType] = React.useState('');
  React.useEffect(() => {
    const id = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  const list = useCursorList<AdminOrgRow>(`/admin/orgs${qs({ q: query, type, limit: 50 })}`);
  return (
    <>
      <PageHeader icon={Building2} title={t('title')} subtitle={list.total !== undefined ? t('total', { count: list.total }) : undefined} />
      <Toolbar>
        <Input aria-label={t('search')} placeholder={t('searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} prefixIcon={<Search className="size-4" strokeWidth={2} aria-hidden />} className="w-full min-w-0 sm:w-80 sm:flex-1 lg:max-w-md [&_input]:h-11" />
        <PillFilter label={t('type')} value={type} onChange={setType} options={[{ value: '', label: t('allTypes') }, { value: 'agency', label: t('types.agency') }, { value: 'developer', label: t('types.developer') }]} />
      </Toolbar>
      <div aria-live="polite">
        {list.error ? (
          <ErrorBlock error={list.error} retry={() => list.mutate()} />
        ) : list.loading ? (
          <LoadingBlock rows={8} />
        ) : (
          <TableCard minWidth={780} label={t('title')}>
            <THead>
              <th scope="col" className={th}>{t('colName')}</th>
              <th scope="col" className={th}>{t('type')}</th>
              <th scope="col" className={th}>{t('plan')}</th>
              <th scope="col" className={`${th} text-right`}>{t('colMembers')}</th>
              <th scope="col" className={`${th} text-right`}>{t('colListings')}</th>
              <th scope="col" className={th}>{t('colCreated')}</th>
              <th scope="col" className={th}>
                <span className="sr-only">{t('open')}</span>
              </th>
            </THead>
            <tbody>
              {list.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-14 text-center text-muted">
                    {t('empty')}
                  </td>
                </tr>
              )}
              {list.items.map((o) => (
                <tr key={o.id} className={`${tr} cursor-pointer`} onClick={(e) => !(e.target as HTMLElement).closest('a,button') && router.push(`/orgs/${o.id}`)}>
                  <td className={td}>
                    <div className="flex min-w-0 items-center gap-3">
                      <OrgMark name={o.name} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/orgs/${o.id}`} className="truncate font-semibold hover:text-link hover:underline">
                            {o.name}
                          </Link>
                          {o.verified && <BadgeCheck className="size-4 shrink-0 text-link" strokeWidth={2} aria-label={t('verified')} />}
                        </div>
                        <div className="truncate font-mono text-[12.5px] text-muted">{o.slug}</div>
                      </div>
                    </div>
                  </td>
                  <td className={td}>
                    <StatusPill tone={o.type === 'agency' ? 'info' : 'primary'} dot={false}>
                      {t(`types.${o.type}`)}
                    </StatusPill>
                  </td>
                  <td className={td}>
                    <span className={`inline-flex rounded-lg px-2 py-0.5 font-mono text-[13px] ${o.plan === 'free' ? 'bg-surface-2 text-muted' : 'bg-accent-soft font-semibold text-[#7a5500] dark:text-accent'}`}>{o.plan}</span>
                  </td>
                  <td className={`${td} text-right font-semibold`}>{o.membersCount}</td>
                  <td className={`${td} text-right font-semibold`}>{o.listingsCount}</td>
                  <td className={`${td} text-muted`}>{formatDateKa(o.createdAt)}</td>
                  <td className={`${td} w-10 text-muted`}>
                    <Link href={`/orgs/${o.id}`} aria-label={`${t('open')}: ${o.name}`} className="grid size-8 place-items-center rounded-full hover:bg-surface-3 hover:text-text">
                      <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableCard>
        )}
      </div>
      {list.hasMore && (
        <div className="mt-5 flex justify-center">
          <Button variant="secondary" loading={list.loadingMore} onClick={() => list.loadMore()}>
            {t('loadMore')}
          </Button>
        </div>
      )}
    </>
  );
}
