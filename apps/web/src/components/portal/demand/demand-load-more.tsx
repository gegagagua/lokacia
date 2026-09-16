'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { DemandDto } from '@lokacia/contracts';
import { Button } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { DemandCard } from './demand-card';

/** Cursor pagination for the demand board ("კიდევ ჩვენება"). */
export function DemandLoadMore({ query, cursor, icons }: { query: string; cursor: string | null; icons: Record<string, string> }) {
  const t = useTranslations('demand.board');
  const [items, setItems] = React.useState<DemandDto[]>([]);
  const [next, setNext] = React.useState(cursor);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  const load = async () => {
    if (!next) return;
    setLoading(true);
    setError(false);
    try {
      const p = new URLSearchParams(query);
      p.set('cursor', next);
      const res = await apiFetch<{ items: DemandDto[]; nextCursor: string | null }>(`/demand?${p}`);
      setItems((s) => [...s, ...res.items]);
      setNext(res.nextCursor);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {items.length > 0 && (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((d) => (
            <li key={d.id}>
              <DemandCard d={d} icon={icons[d.businessType]} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 flex justify-center" aria-live="polite">
        {error && <p className="mr-3 self-center text-small text-danger">{t('loadError')}</p>}
        {next && (
          <Button variant="secondary" onClick={load} loading={loading}>
            {loading ? t('loading') : t('loadMore')}
          </Button>
        )}
      </div>
    </>
  );
}
