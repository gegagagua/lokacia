'use client';
import * as React from 'react';
import Link, { useLocalizedPath } from '@/i18n/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ArrowLeftRight, BellRing, CalendarRange, CheckCircle2, CircleSlash, Download, FileText, Gift, Hammer, History, Hourglass, Loader2, MessageSquare, Package, Quote, RefreshCw, Scale, TrendingUp, XCircle } from 'lucide-react';
import type { OfferDto, OfferThread } from '@lokacia/contracts';
import { Avatar, Button, Dialog, EmptyState, Field, Skeleton, Textarea, cn, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { useFormat } from '@/i18n/use-format';
import { OfferStatusBadge } from '../status-badges';
import { useRealtime } from '../realtime';
import { IconTile } from '../ui';
import { tbDateTimeKa } from '../viewings/tz';
import { ListingSummary } from './listing-summary';
import { OfferTermsFields, termsFrom, termsToBody, type OfferTerms, type TermsErrors } from './offer-terms-fields';
import { TenantProfileSummary, type BusinessTypeOption, type TenantProfileValue } from './tenant-profile';

type TenantView = { id: string; name: string | null; avatarUrl: string | null; memberSince: string; verified: boolean; profile: TenantProfileValue | null };

type TermKey = 'priceMinor' | 'termMonths' | 'freeMonths' | 'indexationPct' | 'fitoutPaidBy' | 'equipmentIncluded';

function TermsRows({ o, prev, dealType }: { o: OfferDto; prev?: OfferDto; dealType: string }) {
  const t = useTranslations('offers.thread');
  const tf = useTranslations('offers.form');
  const f = useFormat();
  const isSale = dealType === 'sale' || dealType === 'transfer';
  const rows: { key: TermKey; label: string; value: string }[] = [
    { key: 'priceMinor', label: isSale ? tf('priceTotal') : tf('priceMonthly'), value: f.money(o.priceMinor) },
    ...(!isSale
      ? [
          { key: 'termMonths' as const, label: tf('term'), value: t('months', { count: o.termMonths }) },
          { key: 'freeMonths' as const, label: tf('freeMonths'), value: o.freeMonths ? t('months', { count: o.freeMonths }) : t('none') },
          { key: 'indexationPct' as const, label: tf('indexation'), value: o.indexationPct ? `${o.indexationPct}%` : t('none') },
        ]
      : []),
    { key: 'fitoutPaidBy', label: tf('fitoutPaidBy'), value: tf(`fitout.${o.fitoutPaidBy}`) },
    ...(dealType === 'transfer' ? [{ key: 'equipmentIncluded' as const, label: tf('equipmentIncluded'), value: o.equipmentIncluded ? t('yes') : t('no') }] : []),
  ];
  return (
    <dl className="grid gap-x-6 text-[15px] sm:grid-cols-2">
      {rows.map((r) => {
        const changed = !!prev && prev[r.key] !== o[r.key];
        return (
          <div key={r.key} className="flex justify-between gap-3 border-b border-border py-2.5">
            <dt className="text-muted">{r.label}</dt>
            <dd className={`text-right tabular ${changed ? 'font-semibold' : ''}`}>
              {changed && <span className="mr-1.5 inline-block size-1.5 -translate-y-0.5 rounded-full bg-accent" aria-label={t('changed')} />}
              {r.value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function OfferThreadView({ id, businessTypes }: { id: string; businessTypes: BusinessTypeOption[] }) {
  const t = useTranslations('offers.thread');
  const tf = useTranslations('offers.form');
  const f = useFormat();
  const lp = useLocalizedPath();
  const router = useRouter();
  const toast = useToast();
  const { data, error, isLoading, mutate } = useSWR<OfferThread>(`/offers/${id}`, fetcher, {
    refreshInterval: (d) => (d?.status === 'accepted' && !d.contractUrl ? 2000 : 15_000),
  });
  useRealtime('notification', () => void mutate());
  const tenantId = data?.myRole === 'owner' ? data.tenant.id : null;
  const { data: tenant } = useSWR<TenantView>(tenantId ? `/users/${tenantId}/tenant-profile` : null, fetcher);

  const [dialog, setDialog] = React.useState<null | 'accept' | 'counter' | 'reject' | 'withdraw' | 'message'>(null);
  const [terms, setTerms] = React.useState<OfferTerms | null>(null);
  const [errors, setErrors] = React.useState<TermsErrors>({});
  const [text, setText] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  if (isLoading) return <Skeleton className="h-96 rounded-card" />;
  if (error || !data)
    return <EmptyState title={t('notFound')} description={t('notFoundHint')} action={<Button asChild><Link href="/account/offers">{t('back')}</Link></Button>} />;

  const latest = data.offers.at(-1)!;
  const counterpart = data.myRole === 'tenant' ? data.owner : data.tenant;
  const nameOf = (uid: string) => (uid === data.tenant.id ? (data.tenant.name ?? t('tenant')) : (data.owner.name ?? t('owner')));
  const roleOf = (uid: string) => (uid === data.tenant.id ? t('tenant') : t('owner'));

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      const r = await fn();
      toast({ title: success, tone: 'success' });
      setDialog(null);
      setText('');
      await mutate();
      return r;
    } catch (e) {
      toast({ title: e instanceof ClientApiError ? e.message : t('error'), tone: 'danger' });
      await mutate();
      return null;
    } finally {
      setBusy(false);
    }
  };

  const openCounter = () => {
    setTerms(termsFrom(latest));
    setErrors({});
    setDialog('counter');
  };
  const sendCounter = async () => {
    if (!terms) return;
    const { body, errors: errs } = termsToBody(terms, data.listing.dealType, (k) => tf(k));
    setErrors(errs);
    if (!body) return;
    const r = (await run(() => apiFetch<OfferDto>(`/offers/${latest.id}/counter`, { method: 'POST', body }), t('counterSent'))) as OfferDto | null;
    if (r) router.replace(lp(`/account/offers/${r.id}`));
  };
  const sendMessage = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await apiFetch<{ conversationId: string }>('/conversations/with-user', { method: 'POST', body: { userId: counterpart.id, listingId: data.listing.id, body: text.trim() } });
      router.push(lp(`/account/messages?c=${r.conversationId}`));
    } catch (e) {
      toast({ title: e instanceof ClientApiError ? e.message : t('error'), tone: 'danger' });
      setBusy(false);
    }
  };

  const myId = data.myRole === 'tenant' ? data.tenant.id : data.owner.id;
  const isSale = data.listing.dealType === 'sale' || data.listing.dealType === 'transfer';
  const chips = (o: OfferDto, prev?: OfferDto) => {
    const items: { key: TermKey; icon: typeof CalendarRange; text: string }[] = [
      ...(!isSale
        ? [
            { key: 'termMonths' as const, icon: CalendarRange, text: `${tf('term')}: ${t('months', { count: o.termMonths })}` },
            { key: 'freeMonths' as const, icon: Gift, text: `${tf('freeMonths')}: ${o.freeMonths ? t('months', { count: o.freeMonths }) : t('none')}` },
            { key: 'indexationPct' as const, icon: TrendingUp, text: `${tf('indexation')}: ${o.indexationPct ? `${o.indexationPct}%` : t('none')}` },
          ]
        : []),
      { key: 'fitoutPaidBy', icon: Hammer, text: `${tf('fitoutPaidBy')}: ${tf(`fitout.${o.fitoutPaidBy}`)}` },
      ...(data.listing.dealType === 'transfer' ? [{ key: 'equipmentIncluded' as const, icon: Package, text: `${tf('equipmentIncluded')}: ${o.equipmentIncluded ? t('yes') : t('no')}` }] : []),
    ];
    return (
      <ul className="flex flex-wrap gap-1.5">
        {items.map((c) => {
          const changed = !!prev && prev[c.key] !== o[c.key];
          return (
            <li key={c.key} className={cn('inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 py-1 text-[13px]', changed ? 'bg-accent-soft font-semibold ring-1 ring-accent/60' : 'bg-surface-2')}>
              <c.icon className="size-3.5 shrink-0 text-muted" strokeWidth={2} aria-hidden />
              {c.text}
              {changed && <span className="sr-only"> ({t('changed')})</span>}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[28px] font-bold leading-9 tracking-tight sm:text-[34px] sm:leading-[42px]">{t('title')}</h1>
        <OfferStatusBadge status={data.status} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <ListingSummary listing={data.listing} />

          {/* action bar */}
          <div aria-live="polite">
            {latest.status === 'pending' && (
              <div className={cn('card flex flex-col gap-4 p-5 sm:p-6', data.can.accept && 'ring-1 ring-inset ring-accent/60')}>
                <div className="flex items-center gap-3">
                  <IconTile icon={data.can.accept ? BellRing : Hourglass} tone={data.can.accept ? 'accent' : 'neutral'} />
                  <p className="text-[16px] font-semibold">{data.can.accept ? t('yourTurn', { name: nameOf(latest.fromUserId) }) : t('waiting', { name: counterpart.name ?? roleOf(counterpart.id) })}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.can.accept && <Button onClick={() => setDialog('accept')} icon={<CheckCircle2 className="size-4" strokeWidth={2} aria-hidden />}>{t('accept')}</Button>}
                  {data.can.counter && <Button variant="secondary" onClick={openCounter} icon={<ArrowLeftRight className="size-4" strokeWidth={2} aria-hidden />}>{t('counter')}</Button>}
                  {data.can.reject && <Button variant="danger" onClick={() => setDialog('reject')} icon={<XCircle className="size-4" strokeWidth={2} aria-hidden />}>{t('reject')}</Button>}
                  {data.can.withdraw && <Button variant="secondary" onClick={() => setDialog('withdraw')}>{t('withdraw')}</Button>}
                  <Button variant="ghost" icon={<MessageSquare className="size-4" strokeWidth={2} aria-hidden />} onClick={() => setDialog('message')}>
                    {t('message')}
                  </Button>
                </div>
              </div>
            )}
            {latest.status !== 'pending' && data.status !== 'accepted' && (
              <div className="card flex flex-wrap items-center gap-3 p-5">
                <IconTile icon={latest.status === 'rejected' ? XCircle : CircleSlash} tone={latest.status === 'rejected' ? 'danger' : 'neutral'} />
                <p className="flex-1 font-medium">{t(`closed.${latest.status}`)}</p>
                <Button variant="ghost" icon={<MessageSquare className="size-4" strokeWidth={2} aria-hidden />} onClick={() => setDialog('message')}>
                  {t('message')}
                </Button>
              </div>
            )}
            {data.status === 'accepted' && (
              <section aria-labelledby="contract-h" className="relative flex flex-col gap-4 overflow-hidden rounded-card border border-success/30 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--success)_12%,var(--surface)),var(--surface)_60%)] p-5 shadow-sm sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl bg-success text-white shadow-md dark:text-bg" aria-hidden>
                    <FileText className="size-6" strokeWidth={2} />
                  </span>
                  <h2 id="contract-h" className="text-[20px] font-bold tracking-tight">{t('contract.title')}</h2>
                </div>
                {data.contractUrl ? (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild className="h-auto min-h-11 whitespace-normal py-2">
                      <a href={data.contractUrl} target="_blank" rel="noreferrer">
                        <Download className="size-4" strokeWidth={2} aria-hidden />
                        {t('contract.download')}
                      </a>
                    </Button>
                    <Button variant="secondary" loading={busy} icon={<RefreshCw className="size-4" strokeWidth={2} />} onClick={() => run(() => apiFetch(`/offers/${latest.id}/contract`, { method: 'POST' }), t('contract.regenerated'))}>
                      {t('contract.regenerate')}
                    </Button>
                    <Button variant="ghost" icon={<MessageSquare className="size-4" strokeWidth={2} />} onClick={() => setDialog('message')}>
                      {t('message')}
                    </Button>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 text-muted" role="status">
                    <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden />
                    {t('contract.generating')}
                  </p>
                )}
                <p className="flex items-start gap-2 rounded-2xl bg-danger/10 p-3 text-small text-danger">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden />
                  {t('contract.demo')}
                </p>
                <Link href="/services?category=legal" className="inline-flex items-center gap-2 self-start font-semibold text-link underline-offset-4 hover:underline">
                  <Scale className="size-4" strokeWidth={2} aria-hidden />
                  {t('contract.lawyer')}
                </Link>
              </section>
            )}
          </div>

          {/* negotiation timeline */}
          <section aria-labelledby="history-h" className="card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-3">
              <IconTile icon={History} tone="link" size="sm" />
              <h2 id="history-h" className="text-[18px] font-bold tracking-tight">{t('history')}</h2>
            </div>
            <ol className="flex flex-col gap-5">
              {data.offers.map((o, i) => {
                const mine = o.fromUserId === myId;
                const from = o.fromUserId === data.tenant.id ? data.tenant : data.owner;
                return (
                  <li key={o.id} className={cn('flex gap-3', mine && 'flex-row-reverse')}>
                    <Avatar src={from.avatarUrl} name={from.name} size={36} className="mt-1 hidden sm:inline-grid" />
                    <article className={cn('min-w-0 max-w-full flex-1 rounded-3xl border p-4 shadow-xs sm:max-w-[88%] sm:flex-none sm:p-5', mine ? 'rounded-tr-md border-primary/25 bg-primary-soft/50' : 'rounded-tl-md border-border bg-surface', o.id === id && 'ring-2 ring-primary/30')}>
                      <header className={cn('mb-2 flex flex-wrap items-center gap-x-2 gap-y-1', mine && 'sm:flex-row-reverse')}>
                        <span className="text-[13px] font-semibold">{i === 0 ? t('initial') : t('counterBy')}</span>
                        <span className="text-[13px] text-muted">
                          {nameOf(o.fromUserId)} ({roleOf(o.fromUserId)}) · <time dateTime={o.createdAt}>{tbDateTimeKa(o.createdAt, f.locale)}</time>
                        </span>
                        <span className={cn(mine ? 'sm:mr-auto' : 'ml-auto')}>
                          <OfferStatusBadge status={o.status} />
                        </span>
                      </header>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className={cn('text-[28px] font-bold leading-9 tracking-tight tabular', data.offers[i - 1] && data.offers[i - 1]!.priceMinor !== o.priceMinor && 'text-primary-soft-text')}>{f.money(o.priceMinor)}</span>
                        <span className="text-small text-muted">{isSale ? tf('priceTotal') : tf('priceMonthly')}</span>
                        {data.offers[i - 1] && data.offers[i - 1]!.priceMinor !== o.priceMinor && (
                          <span className="text-small text-muted line-through tabular">{f.money(data.offers[i - 1]!.priceMinor)}</span>
                        )}
                      </div>
                      <div className="mt-3">{chips(o, data.offers[i - 1])}</div>
                      {o.message && (
                        <p className="mt-3 flex gap-2 whitespace-pre-wrap rounded-2xl bg-surface p-3 text-[15px] shadow-xs">
                          <Quote className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
                          <span className="min-w-0">{o.message}</span>
                        </p>
                      )}
                    </article>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        {/* sidebar: parties + tenant profile */}
        <aside className="flex min-w-0 flex-col gap-4">
          <section className="card p-5" aria-labelledby="parties-h">
            <h2 id="parties-h" className="mb-3 text-[15px] font-bold">{t('parties')}</h2>
            <ul className="flex flex-col gap-3">
              {[data.tenant, data.owner].map((p, i) => (
                <li key={p.id} className="flex items-center gap-3">
                  <Avatar src={p.avatarUrl} name={p.name} size={44} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{p.name ?? '—'}</div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted">
                      {i === 0 ? t('tenant') : t('owner')}
                      {p.id !== counterpart.id && <span className="inline-flex h-5 items-center rounded-full bg-primary-soft px-2 text-[11.5px] font-semibold text-primary-soft-text">{t('you')}</span>}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
          {data.myRole === 'owner' && tenant && <TenantProfileSummary profile={tenant.profile} name={tenant.name} businessTypes={businessTypes} />}
        </aside>
      </div>

      <Dialog open={dialog === 'accept'} onOpenChange={(o) => !o && setDialog(null)} title={t('acceptTitle')} description={t('acceptHint')}
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>{t('cancel')}</Button><Button loading={busy} onClick={() => run(() => apiFetch(`/offers/${latest.id}/accept`, { method: 'POST' }), t('accepted'))}>{t('accept')}</Button></>}>
        <TermsRows o={latest} dealType={data.listing.dealType} />
      </Dialog>
      <Dialog open={dialog === 'counter'} onOpenChange={(o) => !o && setDialog(null)} title={t('counterTitle')} description={t('counterHint')} size="lg"
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>{t('cancel')}</Button><Button loading={busy} onClick={sendCounter}>{t('counterSubmit')}</Button></>}>
        {terms && <OfferTermsFields value={terms} onChange={setTerms} errors={errors} dealType={data.listing.dealType} equipment={data.listing.equipment} />}
      </Dialog>
      <Dialog open={dialog === 'reject'} onOpenChange={(o) => !o && setDialog(null)} title={t('rejectTitle')}
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>{t('cancel')}</Button><Button variant="danger" loading={busy} onClick={() => run(() => apiFetch(`/offers/${latest.id}/reject`, { method: 'POST', body: { reason: text.trim() || null } }), t('rejected'))}>{t('reject')}</Button></>}>
        <Field label={t('reason')} hint={t('reasonHint')}>
          <Textarea value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
        </Field>
      </Dialog>
      <Dialog open={dialog === 'withdraw'} onOpenChange={(o) => !o && setDialog(null)} title={t('withdrawTitle')} description={t('withdrawHint')}
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>{t('cancel')}</Button><Button variant="danger" loading={busy} onClick={() => run(() => apiFetch(`/offers/${latest.id}/withdraw`, { method: 'POST' }), t('withdrawn'))}>{t('withdraw')}</Button></>} />
      <Dialog open={dialog === 'message'} onOpenChange={(o) => !o && setDialog(null)} title={t('messageTitle', { name: counterpart.name ?? roleOf(counterpart.id) })}
        footer={<><Button variant="ghost" onClick={() => setDialog(null)}>{t('cancel')}</Button><Button loading={busy} disabled={!text.trim()} onClick={sendMessage}>{t('messageSubmit')}</Button></>}>
        <Field label={t('messageLabel')}>
          <Textarea value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} />
        </Field>
      </Dialog>
    </div>
  );
}
