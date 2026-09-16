'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { formatDateKa, type AdminOrgRow } from '@lokacia/contracts';
import { Badge, Button, Input, Select } from '@lokacia/ui';
import { qs, useCursorList } from '@/lib/use-cursor-list';
import { PageHeader } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';

export function OrgsView() {
  const t = useTranslations('orgs');
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
      <PageHeader title={t('title')} subtitle={list.total !== undefined ? t('total', { count: list.total }) : undefined} />
      <div className="mb-3 flex flex-wrap gap-2">
        <Input aria-label={t('search')} placeholder={t('searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} prefixIcon={<Search className="size-4" strokeWidth={1.5} aria-hidden />} className="w-full sm:w-72" />
        <Select aria-label={t('type')} value={type} onChange={(e) => setType(e.target.value)} placeholder={t('allTypes')} options={[{ value: 'agency', label: t('types.agency') }, { value: 'developer', label: t('types.developer') }]} className="w-48" />
      </div>
      <div aria-live="polite">
        {list.error ? (
          <ErrorBlock error={list.error} retry={() => list.mutate()} />
        ) : list.loading ? (
          <LoadingBlock rows={8} />
        ) : (
          <div className="overflow-x-auto rounded-card border border-border bg-surface">
            <table className="w-full min-w-[720px] border-collapse text-left text-[14px] tabular">
              <thead>
                <tr className="border-b border-border-strong text-small text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">{t('colName')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('type')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('plan')}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t('colMembers')}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t('colListings')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('colCreated')}</th>
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
                {list.items.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-b-0 hover:bg-surface-2">
                    <td className="px-3 py-2">
                      <Link href={`/orgs/${o.id}`} className="font-medium text-link hover:underline">
                        {o.name}
                      </Link>
                      {o.verified && (
                        <Badge tone="success" className="ml-2">
                          {t('verified')}
                        </Badge>
                      )}
                      <div className="font-mono text-[12px] text-muted">{o.slug}</div>
                    </td>
                    <td className="px-3 py-2">{t(`types.${o.type}`)}</td>
                    <td className="px-3 py-2 font-mono text-[13px]">{o.plan}</td>
                    <td className="px-3 py-2 text-right">{o.membersCount}</td>
                    <td className="px-3 py-2 text-right">{o.listingsCount}</td>
                    <td className="px-3 py-2 text-small">{formatDateKa(o.createdAt)}</td>
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
