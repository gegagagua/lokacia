'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ExternalLink, Heart, Scale, Trash2 } from 'lucide-react';
import { COMPARE_MAX, formatDateKa, type CompareListDto, type FavoriteDto } from '@lokacia/contracts';
import { Button, Checkbox, EmptyState, IconButton, ListingCard, Skeleton, useToast } from '@lokacia/ui';
import { apiFetch, fetcher } from '@/lib/api-client';
import { CopyLinkButton } from '../copy-link-button';

export function FavoritesBoard({ typeNames }: { typeNames: Record<string, string> }) {
  const t = useTranslations('favorites');
  const toast = useToast();
  const router = useRouter();
  const { data, mutate, isLoading } = useSWR<FavoriteDto[]>('/favorites', fetcher);
  const lists = useSWR<CompareListDto[]>('/compare', fetcher);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);

  const toggle = (id: string, on: boolean) => {
    setSelected((s) => {
      if (!on) return s.filter((x) => x !== id);
      if (s.length >= COMPARE_MAX) {
        toast({ title: t('maxReached'), tone: 'danger' });
        return s;
      }
      return s.includes(id) ? s : [...s, id];
    });
  };

  const remove = async (id: string) => {
    const next = (data ?? []).filter((f) => f.id !== id);
    setSelected((s) => s.filter((x) => x !== id));
    try {
      await mutate(
        async () => {
          await apiFetch(`/favorites/${id}`, { method: 'DELETE' });
          return next;
        },
        { optimisticData: next, rollbackOnError: true, revalidate: false },
      );
      toast({ title: t('removed') });
    } catch {
      toast({ title: t('error'), tone: 'danger' });
    }
  };

  const compare = async () => {
    setBusy(true);
    try {
      const res = await apiFetch<CompareListDto>('/compare', { method: 'POST', body: { name: t('compareName', { date: formatDateKa(new Date()) }), listingIds: selected } });
      router.push(`/compare/${res.shareToken}`);
    } catch {
      toast({ title: t('error'), tone: 'danger' });
      setBusy(false);
    }
  };

  const deleteList = async (id: string) => {
    try {
      await apiFetch(`/compare/${id}`, { method: 'DELETE' });
      await lists.mutate();
      toast({ title: t('lists.deleted') });
    } catch {
      toast({ title: t('error'), tone: 'danger' });
    }
  };

  return (
    <div className="mt-6">
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2" aria-busy="true" aria-label={t('loading')}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-72 rounded-card" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState
          icon={<Heart className="size-5" strokeWidth={1.5} aria-hidden />}
          title={t('empty.title')}
          description={t('empty.description')}
          action={
            <Button asChild>
              <Link href="/search">{t('empty.action')}</Link>
            </Button>
          }
        />
      ) : (
        <>
          <p className="mb-3 text-small text-muted tabular" aria-live="polite">
            {t('selected', { count: selected.length })}
          </p>
          <ul className="grid gap-4 sm:grid-cols-2">
            {data.map((f) => {
              const on = selected.includes(f.id);
              return (
                <li key={f.id} className={`relative flex flex-col rounded-card ${on ? 'outline-2 outline-offset-2 outline-primary' : ''}`}>
                  <ListingCard listing={f} href={`/listings/${f.slug}`} LinkComponent={Link} businessTypeName={(s) => typeNames[s] ?? s} favorite onFavorite={() => void remove(f.id)} className="h-full" />
                  <div className="absolute left-2 top-10 z-10 rounded-[6px] border border-border bg-surface/95 p-1.5">
                    <Checkbox checked={on} onCheckedChange={(v) => toggle(f.id, v === true)} aria-label={t('select', { title: f.title })} disabled={!on && selected.length >= COMPARE_MAX} />
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {selected.length > 0 && (
        <div className="sticky bottom-4 z-30 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-border-strong bg-surface px-4 py-3">
          <span className="text-small tabular" aria-live="polite">
            {t('selected', { count: selected.length })}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              {t('clear')}
            </Button>
            <Button size="sm" onClick={compare} loading={busy} disabled={selected.length < 1} icon={<Scale className="size-4" strokeWidth={1.5} aria-hidden />}>
              {t('compare', { count: selected.length })}
            </Button>
          </div>
        </div>
      )}

      <section className="mt-10" aria-labelledby="compare-lists">
        <h2 id="compare-lists" className="text-h3 font-semibold">
          {t('lists.title')}
        </h2>
        {!lists.data?.length ? (
          <p className="mt-2 text-muted">{t('lists.empty')}</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-card border border-border bg-surface">
            {lists.data.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/compare/${l.shareToken}`} className="font-medium hover:text-link">
                    {l.name}
                  </Link>
                  <div className="text-small text-muted tabular">
                    {t('lists.count', { count: l.listingIds.length })} · {formatDateKa(l.updatedAt)}
                  </div>
                </div>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/compare/${l.shareToken}`}>
                    <ExternalLink className="size-4" strokeWidth={1.5} aria-hidden />
                    {t('lists.open')}
                  </Link>
                </Button>
                <CopyLinkButton path={`/compare/${l.shareToken}`} label={t('lists.copy')} copiedLabel={t('lists.copied')} />
                <IconButton label={t('lists.delete')} size="sm" onClick={() => void deleteList(l.id)}>
                  <Trash2 className="size-4" strokeWidth={1.5} />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
