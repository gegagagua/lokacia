'use client';
import * as React from 'react';
import Link, { useLocalizedPath } from '@/i18n/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Download, FileText, Loader2, MessageSquare, RefreshCw, Scale } from 'lucide-react';
import type { OfferDto, OfferThread } from '@lokacia/contracts';
import { Avatar, Button, Dialog, EmptyState, Field, Skeleton, Textarea, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { useFormat } from '@/i18n/use-format';
import { OfferStatusBadge } from '../status-badges';
import { useRealtime } from '../realtime';
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
    <dl className="grid gap-x-6 gap-y-1.5 text-[15px] sm:grid-cols-2">
      {rows.map((r) => {
        const changed = !!prev && prev[r.key] !== o[r.key];
        return (
          <div key={r.key} className="flex justify-between gap-3 border-b border-border py-1 last:border-b-0 sm:last:border-b">
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="compact text-h2 font-semibold">{t('title')}</h1>
        <OfferStatusBadge status={data.status} />
      </div>
      <ListingSummary listing={data.listing} />

      {/* parties */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[data.tenant, data.owner].map((p, i) => (
          <div key={p.id} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
            <Avatar src={p.avatarUrl} name={p.name} size={36} />
            <div className="min-w-0">
              <div className="text-small text-muted">{i === 0 ? t('tenant') : t('owner')}{p.id === counterpart.id ? '' : ` · ${t('you')}`}</div>
              <div className="truncate font-medium">{p.name ?? '—'}</div>
            </div>
          </div>
        ))}
      </div>
      {data.myRole === 'owner' && tenant && <TenantProfileSummary profile={tenant.profile} name={tenant.name} businessTypes={businessTypes} />}

      {/* action bar */}
      <div aria-live="polite">
        {latest.status === 'pending' && (
          <div className="flex flex-col gap-3 rounded-card border border-border bg-surface-2 p-4">
            <p className="font-medium">{data.can.accept ? t('yourTurn', { name: nameOf(latest.fromUserId) }) : t('waiting', { name: counterpart.name ?? roleOf(counterpart.id) })}</p>
            <div className="flex flex-wrap gap-2">
              {data.can.accept && <Button onClick={() => setDialog('accept')}>{t('accept')}</Button>}
              {data.can.counter && <Button variant="secondary" onClick={openCounter}>{t('counter')}</Button>}
              {data.can.reject && <Button variant="danger" onClick={() => setDialog('reject')}>{t('reject')}</Button>}
              {data.can.withdraw && <Button variant="secondary" onClick={() => setDialog('withdraw')}>{t('withdraw')}</Button>}
              <Button variant="ghost" icon={<MessageSquare className="size-4" strokeWidth={1.5} />} onClick={() => setDialog('message')}>
                {t('message')}
              </Button>
            </div>
          </div>
        )}
        {latest.status !== 'pending' && data.status !== 'accepted' && (
          <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface-2 p-4">
            <p className="flex-1">{t(`closed.${latest.status}`)}</p>
            <Button variant="ghost" icon={<MessageSquare className="size-4" strokeWidth={1.5} />} onClick={() => setDialog('message')}>
              {t('message')}
            </Button>
          </div>
        )}
        {data.status === 'accepted' && (
          <section aria-labelledby="contract-h" className="flex flex-col gap-3 rounded-card border border-primary/40 bg-surface p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-primary" strokeWidth={1.5} aria-hidden />
              <h2 id="contract-h" className="text-h3 font-semibold">{t('contract.title')}</h2>
            </div>
            {data.contractUrl ? (
              <div className="flex flex-wrap gap-2">
                <Button asChild className="h-auto min-h-10 whitespace-normal py-2">
                  <a href={data.contractUrl} target="_blank" rel="noreferrer">
                    <Download className="size-4" strokeWidth={1.5} aria-hidden />
                    {t('contract.download')}
                  </a>
                </Button>
                <Button variant="secondary" loading={busy} icon={<RefreshCw className="size-4" strokeWidth={1.5} />} onClick={() => run(() => apiFetch(`/offers/${latest.id}/contract`, { method: 'POST' }), t('contract.regenerated'))}>
                  {t('contract.regenerate')}
                </Button>
                <Button variant="ghost" icon={<MessageSquare className="size-4" strokeWidth={1.5} />} onClick={() => setDialog('message')}>
                  {t('message')}
                </Button>
              </div>
            ) : (
              <p className="flex items-center gap-2 text-muted" role="status">
                <Loader2 className="size-4 animate-spin" strokeWidth={1.5} aria-hidden />
                {t('contract.generating')}
              </p>
            )}
            <p className="flex items-start gap-2 rounded-button border border-danger/40 p-3 text-small text-danger">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" strokeWidth={1.5} aria-hidden />
              {t('contract.demo')}
            </p>
            <Link href="/services?category=legal" className="inline-flex items-center gap-2 text-link underline-offset-4 hover:underline">
              <Scale className="size-4" strokeWidth={1.5} aria-hidden />
              {t('contract.lawyer')}
            </Link>
          </section>
        )}
      </div>

      {/* timeline */}
      <section aria-labelledby="history-h">
        <h2 id="history-h" className="mb-3 text-h3 font-semibold">{t('history')}</h2>
        <ol className="relative flex flex-col gap-4 border-l border-border-strong pl-5">
          {data.offers.map((o, i) => (
            <li key={o.id} className="relative">
              <span className={`absolute -left-[26px] top-4 size-3 rounded-full border-2 border-bg ${o.status === 'accepted' ? 'bg-success' : o.status === 'pending' ? 'bg-accent' : 'bg-border-strong'}`} aria-hidden />
              <article className={`rounded-card border bg-surface p-4 ${o.id === id ? 'border-primary/50' : 'border-border'}`}>
                <header className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="font-medium">{i === 0 ? t('initial') : t('counterBy')}</span>
                  <span className="text-small text-muted">
                    {nameOf(o.fromUserId)} ({roleOf(o.fromUserId)}) · <time dateTime={o.createdAt}>{tbDateTimeKa(o.createdAt, f.locale)}</time>
                  </span>
                  <span className="ml-auto"><OfferStatusBadge status={o.status} /></span>
                </header>
                <TermsRows o={o} prev={data.offers[i - 1]} dealType={data.listing.dealType} />
                {o.message && <p className="mt-3 whitespace-pre-wrap rounded-button bg-surface-2 p-3 text-[15px]">{o.message}</p>}
              </article>
            </li>
          ))}
        </ol>
      </section>

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
