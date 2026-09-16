'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import useSWR, { type KeyedMutator } from 'swr';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import type { ProviderDto, ServiceOrderDto, ServiceOrderStatus } from '@lokacia/contracts';
import { Badge, Button, EmptyState, Field, Input, Skeleton, Stat, Tabs, Textarea, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { useLocalizedPath } from '@/i18n/link';
import { useFormat } from '@/i18n/use-format';
import { useCategoryName } from './provider-card';

type MyProvider = ProviderDto & { ledger: { revenueMinor: number; commissionMinor: number; completed: number } };
const FLOW: ServiceOrderStatus[] = ['requested', 'quoted', 'accepted', 'in_progress', 'completed'];

function statusTone(s: ServiceOrderStatus) {
  return s === 'completed' ? 'success' : s === 'cancelled' ? 'outline' : s === 'quoted' ? 'accent' : 'primary';
}

function Timeline({ status }: { status: ServiceOrderStatus }) {
  const t = useTranslations('services.orders');
  if (status === 'cancelled') return null;
  const idx = FLOW.indexOf(status);
  return (
    <ol className="mt-3 flex flex-wrap items-center gap-x-1 gap-y-2 text-[12px]" aria-label={t('steps')}>
      {FLOW.map((s, i) => (
        <li key={s} className="flex items-center gap-1" aria-current={i === idx ? 'step' : undefined}>
          <span className={`grid size-5 place-items-center rounded-full border ${i <= idx ? 'border-primary bg-primary text-primary-contrast' : 'border-border-strong text-muted'}`}>
            {i < idx ? <Check className="size-3" strokeWidth={2} aria-hidden /> : <span className="tabular">{i + 1}</span>}
          </span>
          <span className={i === idx ? 'font-medium' : 'text-muted'}>{t(`status.${s}`)}</span>
          {i < FLOW.length - 1 && <span aria-hidden className="mx-1 h-px w-4 bg-border-strong" />}
        </li>
      ))}
    </ol>
  );
}

function useAction(mutate: KeyedMutator<ServiceOrderDto[]>) {
  const t = useTranslations('services.orders');
  const toast = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const run = async (key: string, path: string, body?: unknown) => {
    setBusy(key);
    try {
      await apiFetch(path, { method: 'POST', body });
      await mutate();
      toast({ title: t('saved'), tone: 'success' });
      return true;
    } catch (e) {
      const p = e instanceof ClientApiError ? e.problem : null;
      toast({ title: p?.title ?? t('error'), description: p?.detail ?? p?.errors?.[0]?.message, tone: 'danger' });
      return false;
    } finally {
      setBusy(null);
    }
  };
  return { busy, run };
}

function OrderHeader({ o }: { o: ServiceOrderDto }) {
  const t = useTranslations('services.orders');
  const f = useFormat();
  const catName = useCategoryName();
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <p className="text-small text-muted">
          {catName(o.category)} · {t('created', { date: f.date(o.createdAt) })}
        </p>
        <h3 className="mt-0.5 font-semibold">{o.role === 'requester' ? <Link href={`/services/${o.provider.slug}`} className="hover:text-link">{o.provider.name}</Link> : `${t('requester')}: ${o.requester.name}`}</h3>
      </div>
      <Badge tone={statusTone(o.status)}>{t(`status.${o.status}`)}</Badge>
    </div>
  );
}

function ReviewForm({ slug, onDone }: { slug: string; onDone: () => void }) {
  const t = useTranslations('services.orders');
  const toast = useToast();
  const [rating, setRating] = React.useState(5);
  const [body, setBody] = React.useState('');
  const [sending, setSending] = React.useState(false);
  return (
    <form
      className="mt-4 flex flex-col gap-3 rounded-card border border-border bg-bg p-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setSending(true);
        try {
          await apiFetch(`/services/providers/${slug}/reviews`, { method: 'POST', body: { rating, body: body || null } });
          toast({ title: t('reviewThanks'), tone: 'success' });
          onDone();
        } catch (err) {
          toast({ title: err instanceof ClientApiError ? err.message : t('error'), tone: 'danger' });
        } finally {
          setSending(false);
        }
      }}
    >
      <fieldset>
        <legend className="text-small font-medium">{t('reviewRating')}</legend>
        <div className="mt-1 flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={t('stars', { count: n })}
              onClick={() => setRating(n)}
              className={`grid size-9 place-items-center rounded-button text-[22px] leading-none ${n <= rating ? 'text-accent' : 'text-border-strong'} hover:bg-surface-2`}
            >
              ★
            </button>
          ))}
        </div>
      </fieldset>
      <Field label={t('reviewBody')}>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} maxLength={2000} />
      </Field>
      <Button type="submit" size="sm" loading={sending} className="self-start">
        {t('reviewSubmit')}
      </Button>
    </form>
  );
}

function RequesterOrders({ orders, mutate }: { orders: ServiceOrderDto[]; mutate: KeyedMutator<ServiceOrderDto[]> }) {
  const t = useTranslations('services.orders');
  const f = useFormat();
  const { busy, run } = useAction(mutate);
  const [reviewing, setReviewing] = React.useState<string | null>(null);
  if (!orders.length)
    return (
      <EmptyState
        title={t('empty')}
        description={t('emptyHint')}
        action={
          <Button asChild>
            <Link href="/services">{t('browse')}</Link>
          </Button>
        }
      />
    );
  return (
    <ul className="flex flex-col gap-4">
      {orders.map((o) => (
        <li key={o.id} className="rounded-card border border-border bg-surface p-4">
          <OrderHeader o={o} />
          <p className="mt-2 whitespace-pre-line text-[15px]">{o.description}</p>
          {o.listing && (
            <p className="mt-1 text-small text-muted">
              {t('listing')}:{' '}
              <Link href={`/listings/${o.listing.slug}`} className="text-link hover:underline">
                {o.listing.title}
              </Link>
            </p>
          )}
          <Timeline status={o.status} />
          {o.quoteMinor != null && (
            <div className="mt-3 rounded-button border border-border bg-bg px-3 py-2">
              <p className="text-small text-muted">{t('quote')}</p>
              <p className="compact text-h3 font-semibold tabular">{f.money(o.quoteMinor)}</p>
              {o.quoteNote && <p className="text-small">{o.quoteNote}</p>}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {o.status === 'quoted' && (
              <Button size="sm" loading={busy === `accept-${o.id}`} onClick={() => void run(`accept-${o.id}`, `/services/orders/${o.id}/accept`)}>
                {t('accept')}
              </Button>
            )}
            {['requested', 'quoted', 'accepted', 'in_progress'].includes(o.status) && (
              <Button
                size="sm"
                variant="ghost"
                loading={busy === `cancel-${o.id}`}
                onClick={() => {
                  if (window.confirm(t('confirmCancel'))) void run(`cancel-${o.id}`, `/services/orders/${o.id}/status`, { status: 'cancelled' });
                }}
              >
                {t('cancel')}
              </Button>
            )}
            {o.canReview && reviewing !== o.id && (
              <Button size="sm" variant="secondary" onClick={() => setReviewing(o.id)}>
                {t('review')}
              </Button>
            )}
          </div>
          {reviewing === o.id && (
            <ReviewForm
              slug={o.provider.slug}
              onDone={() => {
                setReviewing(null);
                void mutate();
              }}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

function QuoteForm({ o, onSubmit, busy }: { o: ServiceOrderDto; onSubmit: (amountMinor: number, note: string) => void; busy: boolean }) {
  const t = useTranslations('services.orders');
  const [amount, setAmount] = React.useState(o.quoteMinor ? String(o.quoteMinor / 100) : '');
  const [note, setNote] = React.useState(o.quoteNote ?? '');
  return (
    <form
      className="mt-3 grid gap-3 rounded-button border border-border bg-bg p-3 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        const n = Math.round(Number(amount) * 100);
        if (n > 0) onSubmit(n, note);
      }}
    >
      <Field label={t('quoteAmount')} required>
        <Input type="number" inputMode="decimal" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} suffix="₾" required />
      </Field>
      <Field label={t('quoteNote')}>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('quoteNotePlaceholder')} maxLength={2000} />
      </Field>
      <Button type="submit" loading={busy} disabled={!(Number(amount) > 0)}>
        {o.status === 'quoted' ? t('updateQuote') : t('sendQuote')}
      </Button>
    </form>
  );
}

function ProviderPanel({ provider, orders, mutate }: { provider: MyProvider; orders: ServiceOrderDto[]; mutate: KeyedMutator<ServiceOrderDto[]> }) {
  const t = useTranslations('services');
  const f = useFormat();
  const { busy, run } = useAction(mutate);
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t('ledger.revenue')} value={f.money(provider.ledger.revenueMinor)} />
        <Stat label={t('ledger.commission')} value={f.money(provider.ledger.commissionMinor)} />
        <Stat label={t('ledger.completed')} value={provider.ledger.completed} />
        <Stat label={t('ledger.rating')} value={provider.rating.toFixed(1)} hint={t('provider.reviewsCount', { count: provider.reviewsCount })} />
      </div>
      <p className="text-small">
        <Link href={`/services/${provider.slug}`} className="text-link hover:underline">
          {provider.name}
        </Link>
      </p>
      {!orders.length ? (
        <p className="rounded-card border border-dashed border-border-strong p-6 text-muted">{t('orders.providerEmpty')}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {orders.map((o) => (
            <li key={o.id} className="rounded-card border border-border bg-surface p-4">
              <OrderHeader o={o} />
              <p className="mt-2 whitespace-pre-line text-[15px]">{o.description}</p>
              {o.listing && (
                <p className="mt-1 text-small text-muted">
                  {t('orders.listing')}:{' '}
                  <Link href={`/listings/${o.listing.slug}`} className="text-link hover:underline">
                    {o.listing.title}
                  </Link>
                </p>
              )}
              <Timeline status={o.status} />
              {o.status === 'completed' && o.amountMinor != null && (
                <dl className="mt-3 grid grid-cols-2 gap-2 text-small">
                  <div>
                    <dt className="text-muted">{t('orders.amount')}</dt>
                    <dd className="font-medium tabular">{f.money(o.amountMinor)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted">{t('orders.commission', { pct: o.commissionPct })}</dt>
                    <dd className="font-medium tabular">{f.money(o.commissionMinor ?? 0)}</dd>
                  </div>
                </dl>
              )}
              {(o.status === 'requested' || o.status === 'quoted') && (
                <QuoteForm o={o} busy={busy === `quote-${o.id}`} onSubmit={(quoteMinor, quoteNote) => void run(`quote-${o.id}`, `/services/orders/${o.id}/quote`, { quoteMinor, quoteNote: quoteNote || null })} />
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                {o.status === 'accepted' && (
                  <Button size="sm" variant="secondary" loading={busy === `start-${o.id}`} onClick={() => void run(`start-${o.id}`, `/services/orders/${o.id}/status`, { status: 'in_progress' })}>
                    {t('orders.start')}
                  </Button>
                )}
                {(o.status === 'accepted' || o.status === 'in_progress') && (
                  <Button size="sm" loading={busy === `done-${o.id}`} onClick={() => void run(`done-${o.id}`, `/services/orders/${o.id}/status`, { status: 'completed' })}>
                    {t('orders.complete')}
                  </Button>
                )}
                {['requested', 'quoted', 'accepted', 'in_progress'].includes(o.status) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    loading={busy === `cancel-${o.id}`}
                    onClick={() => {
                      if (window.confirm(t('orders.confirmCancel'))) void run(`cancel-${o.id}`, `/services/orders/${o.id}/status`, { status: 'cancelled' });
                    }}
                  >
                    {t('orders.cancel')}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ServicesDashboard({ initialTab }: { initialTab: 'mine' | 'provider' }) {
  const t = useTranslations('services.orders');
  const router = useRouter();
  const lp = useLocalizedPath();
  const [tab, setTab] = React.useState(initialTab);
  const mine = useSWR<ServiceOrderDto[]>('/services/orders?role=requester', fetcher);
  const provider = useSWR<MyProvider | null>('/services/providers/me', fetcher);
  const incoming = useSWR<ServiceOrderDto[]>(provider.data ? '/services/orders?role=provider' : null, fetcher);

  if (mine.isLoading || provider.isLoading) {
    return (
      <div className="mt-6 flex flex-col gap-4" aria-busy="true" aria-label={t('loading')}>
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 rounded-card" />
        <Skeleton className="h-40 rounded-card" />
      </div>
    );
  }

  const tabs = [
    { value: 'mine', label: t('mine'), count: mine.data?.length ?? 0, content: <RequesterOrders orders={mine.data ?? []} mutate={mine.mutate} /> },
    ...(provider.data
      ? [
          {
            value: 'provider',
            label: t('provider'),
            count: incoming.data?.filter((o) => o.status === 'requested').length ?? 0,
            content: incoming.data ? (
              <ProviderPanel
                provider={provider.data}
                orders={incoming.data}
                mutate={async (...args) => {
                  const r = await incoming.mutate(...args);
                  void provider.mutate();
                  return r;
                }}
              />
            ) : (
              <Skeleton className="h-40 rounded-card" />
            ),
          },
        ]
      : []),
  ];

  return (
    <Tabs
      className="mt-6"
      tabs={tabs}
      value={provider.data ? tab : 'mine'}
      onValueChange={(v) => {
        setTab(v as 'mine' | 'provider');
        router.replace(lp(v === 'provider' ? '/account/services?tab=provider' : '/account/services'), { scroll: false });
      }}
    />
  );
}
