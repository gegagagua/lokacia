'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { ProviderDto } from '@lokacia/contracts';
import { Button } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { ProviderCard } from './provider-card';

export function ProvidersLoadMore({ query, cursor }: { query: string; cursor: string | null }) {
  const t = useTranslations('services.hub');
  const o = useTranslations('services.orders');
  const [items, setItems] = React.useState<ProviderDto[]>([]);
  const [next, setNext] = React.useState(cursor);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  if (!next && !items.length) return null;
  return (
    <>
      {items.length > 0 && (
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <li key={p.id}>
              <ProviderCard p={p} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6 flex items-center justify-center gap-3" aria-live="polite">
        {error && <p className="text-small text-danger">{o('error')}</p>}
        {next && (
          <Button
            variant="secondary"
            loading={loading}
            onClick={async () => {
              setLoading(true);
              setError(false);
              try {
                const p = new URLSearchParams(query);
                p.set('cursor', next);
                const res = await apiFetch<{ items: ProviderDto[]; nextCursor: string | null }>(`/services/providers?${p}`);
                setItems((s) => [...s, ...res.items]);
                setNext(res.nextCursor);
              } catch {
                setError(true);
              } finally {
                setLoading(false);
              }
            }}
          >
            {t('loadMore')}
          </Button>
        )}
      </div>
    </>
  );
}
