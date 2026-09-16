'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronRight, Search, Users } from 'lucide-react';
import { ROLES, formatDateKa, relativeDaysKa, type AdminUserRow } from '@lokacia/contracts';
import { Button, Input, Select } from '@lokacia/ui';
import { qs, useCursorList } from '@/lib/use-cursor-list';
import { PageHeader } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { Person, StatusPill, TableCard, THead, Toolbar, td, th, tr, type Tone } from '@/components/kit';

export const roleTone = (r: string): Tone => (r === 'admin' ? 'danger' : r === 'moderator' ? 'accent' : r.startsWith('agency') || r === 'broker' ? 'info' : r === 'developer' ? 'primary' : 'neutral');

export function UsersView() {
  const t = useTranslations('users');
  const tr_ = useTranslations('nav.role');
  const router = useRouter();
  const [q, setQ] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [role, setRole] = React.useState('');
  const [banned, setBanned] = React.useState('');
  React.useEffect(() => {
    const id = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);
  const list = useCursorList<AdminUserRow>(`/admin/users${qs({ q: query, role, banned, limit: 50 })}`);
  return (
    <>
      <PageHeader icon={Users} title={t('title')} subtitle={list.total !== undefined ? t('total', { count: list.total }) : undefined} />
      <Toolbar>
        <Input aria-label={t('search')} placeholder={t('searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} prefixIcon={<Search className="size-4" strokeWidth={2} aria-hidden />} className="w-full min-w-0 sm:w-80 sm:flex-1 lg:max-w-md [&_input]:h-11" />
        <Select aria-label={t('role')} value={role} onChange={(e) => setRole(e.target.value)} placeholder={t('allRoles')} options={ROLES.filter((r) => r !== 'guest').map((r) => ({ value: r, label: tr_(r) }))} className="h-11 min-w-0 flex-1 sm:w-52 sm:flex-none" />
        <Select aria-label={t('banFilter')} value={banned} onChange={(e) => setBanned(e.target.value)} placeholder={t('allStates')} options={[{ value: 'true', label: t('bannedOnly') }, { value: 'false', label: t('activeOnly') }]} className="h-11 min-w-0 flex-1 sm:w-48 sm:flex-none" />
      </Toolbar>
      <div aria-live="polite">
        {list.error ? (
          <ErrorBlock error={list.error} retry={() => list.mutate()} />
        ) : list.loading ? (
          <LoadingBlock rows={10} />
        ) : (
          <TableCard minWidth={820} label={t('title')}>
            <THead>
              <th scope="col" className={th}>{t('colUser')}</th>
              <th scope="col" className={th}>{t('role')}</th>
              <th scope="col" className={`${th} text-right`}>{t('colListings')}</th>
              <th scope="col" className={th}>{t('colCreated')}</th>
              <th scope="col" className={th}>{t('colSeen')}</th>
              <th scope="col" className={th}>{t('colState')}</th>
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
              {list.items.map((u) => (
                <tr key={u.id} className={`${tr} cursor-pointer`} onClick={(e) => !(e.target as HTMLElement).closest('a,button') && router.push(`/users/${u.id}`)}>
                  <td className={td}>
                    <Person name={u.name ?? t('noName')} href={`/users/${u.id}`} sub={[u.phone, u.email].filter(Boolean).join(' · ')} />
                  </td>
                  <td className={td}>
                    <StatusPill tone={roleTone(u.role)} dot={false}>
                      {tr_(u.role)}
                    </StatusPill>
                  </td>
                  <td className={`${td} text-right font-semibold`}>{u.listingsCount}</td>
                  <td className={`${td} text-muted`}>{formatDateKa(u.createdAt)}</td>
                  <td className={`${td} text-muted`}>{u.lastSeenAt ? relativeDaysKa(u.lastSeenAt) : '—'}</td>
                  <td className={td}>{u.bannedAt ? <StatusPill tone="danger">{t('banned')}</StatusPill> : <StatusPill tone="success">{t('active')}</StatusPill>}</td>
                  <td className={`${td} w-10 text-muted`}>
                    <Link href={`/users/${u.id}`} aria-label={`${t('open')}: ${u.name ?? u.phone ?? ''}`} className="grid size-8 place-items-center rounded-full hover:bg-surface-3 hover:text-text">
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
