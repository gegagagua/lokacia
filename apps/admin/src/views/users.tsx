'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { ROLES, formatDateKa, relativeDaysKa, type AdminUserRow } from '@lokacia/contracts';
import { Badge, Button, Input, Select } from '@lokacia/ui';
import { qs, useCursorList } from '@/lib/use-cursor-list';
import { PageHeader } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';

export function UsersView() {
  const t = useTranslations('users');
  const tr = useTranslations('nav.role');
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
      <PageHeader title={t('title')} subtitle={list.total !== undefined ? t('total', { count: list.total }) : undefined} />
      <div className="mb-3 flex flex-wrap gap-2">
        <Input aria-label={t('search')} placeholder={t('searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} prefixIcon={<Search className="size-4" strokeWidth={1.5} aria-hidden />} className="w-full sm:w-72" />
        <Select aria-label={t('role')} value={role} onChange={(e) => setRole(e.target.value)} placeholder={t('allRoles')} options={ROLES.filter((r) => r !== 'guest').map((r) => ({ value: r, label: tr(r) }))} className="w-48" />
        <Select aria-label={t('banFilter')} value={banned} onChange={(e) => setBanned(e.target.value)} placeholder={t('allStates')} options={[{ value: 'true', label: t('bannedOnly') }, { value: 'false', label: t('activeOnly') }]} className="w-44" />
      </div>
      <div aria-live="polite">
        {list.error ? (
          <ErrorBlock error={list.error} retry={() => list.mutate()} />
        ) : list.loading ? (
          <LoadingBlock rows={10} />
        ) : (
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[760px] border-collapse text-left text-[14px] tabular">
              <thead>
                <tr className="border-b border-border-strong text-small text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">{t('colUser')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('role')}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t('colListings')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('colCreated')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('colSeen')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('colState')}</th>
                </tr>
              </thead>
              <tbody>
                {list.items.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-muted">
                      {t('empty')}
                    </td>
                  </tr>
                )}
                {list.items.map((u) => (
                  <tr key={u.id} className="border-b border-border last:border-b-0 hover:bg-surface-2">
                    <td className="px-3 py-2">
                      <Link href={`/users/${u.id}`} className="font-medium text-link hover:underline">
                        {u.name ?? t('noName')}
                      </Link>
                      <div className="text-small text-muted">{[u.phone, u.email].filter(Boolean).join(' · ')}</div>
                    </td>
                    <td className="px-3 py-2">{tr(u.role)}</td>
                    <td className="px-3 py-2 text-right">{u.listingsCount}</td>
                    <td className="px-3 py-2 text-small">{formatDateKa(u.createdAt)}</td>
                    <td className="px-3 py-2 text-small text-muted">{u.lastSeenAt ? relativeDaysKa(u.lastSeenAt) : '—'}</td>
                    <td className="px-3 py-2">{u.bannedAt ? <Badge tone="danger">{t('banned')}</Badge> : <Badge tone="success">{t('active')}</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
