'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Check, ChevronDown, FileText, PenLine, ShieldCheck } from 'lucide-react';
import type { CheckoutResponse, EscrowDto } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Badge, Button, cn, Dialog, Field, Skeleton, Textarea, useToast, type BadgeTone } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { followCheckout } from '@/components/billing/checkout';
import { withBase } from '@/lib/base-path';

const TONE: Record<string, BadgeTone> = { pending: 'neutral', funded: 'link', released: 'success', refunded: 'outline', disputed: 'danger' };
const STEPS = ['signed', 'funded', 'closed'] as const;

export function EscrowList() {
  const t = useTranslations('billing.escrow');
  const { data, mutate } = useSWR<EscrowDto[]>('/escrow', fetcher);
  if (!data) return <Skeleton className="mt-5 h-56 rounded-card" />;
  if (!data.length) return <p className="mt-5 rounded-card border border-dashed border-border-strong bg-surface px-5 py-6 text-muted">{t('empty')}</p>;
  return (
    <ul className="mt-5 flex flex-col gap-4">
      {data.map((e) => (
        <EscrowCard key={e.id} escrow={e} onChange={() => mutate()} />
      ))}
    </ul>
  );
}

function EscrowCard({ escrow: e, onChange }: { escrow: EscrowDto; onChange: () => void }) {
  const t = useTranslations('billing.escrow');
  const f = useFormat();
  const tl = useTranslations('account.billingLabels.escrowStatus');
  const statusLabel = (s: string) => (tl.has(s) ? tl(s) : s);
  const toast = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [dispute, setDispute] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const signed = !!e.tenantSignedAt && !!e.ownerSignedAt;
  const mySigned = e.myRole === 'tenant' ? !!e.tenantSignedAt : e.myRole === 'owner' ? !!e.ownerSignedAt : true;
  const stepDone = [signed, ['funded', 'released', 'refunded', 'disputed'].includes(e.status), ['released', 'refunded'].includes(e.status)];
  const currentStep = stepDone.findIndex((d) => !d);

  const act = async (action: string, body?: unknown) => {
    setBusy(action);
    try {
      if (action === 'fund') {
        followCheckout(await apiFetch<CheckoutResponse>(`/escrow/${e.id}/fund`, { method: 'POST' }));
        return;
      }
      await apiFetch(`/escrow/${e.id}/${action}`, { method: 'POST', body });
      toast({ title: t(`done.${action}`), tone: 'success' });
      setDispute(false);
      onChange();
    } catch (err) {
      toast({ title: t('error'), description: err instanceof ClientApiError ? err.message : undefined, tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const sigs = [
    { label: t('tenantSigned'), at: e.tenantSignedAt },
    { label: t('ownerSigned'), at: e.ownerSignedAt },
  ];

  return (
    <li className="card overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5 md:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-link/10 text-link">
            <ShieldCheck className="size-5" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <Link href={`/listings/${e.listing.slug}`} className="font-semibold hover:text-link hover:underline">
              {e.listing.title}
            </Link>
            <div className="text-small text-muted">
              {e.myRole === 'tenant' ? t('youTenant', { owner: e.owner.name ?? '—' }) : e.myRole === 'owner' ? t('youOwner', { tenant: e.tenant.name ?? '—' }) : t('admin')} · {f.date(e.createdAt)}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className="text-[26px] font-bold leading-none tracking-tight tabular">{f.money(e.amountMinor)}</span>
          <Badge tone={TONE[e.status] ?? 'neutral'}>{statusLabel(e.status)}</Badge>
        </div>
      </div>

      <div className="border-y border-border bg-surface-2/60 px-5 py-5 md:px-6">
        <ol className="grid grid-cols-3" aria-label={t('progress')}>
          {STEPS.map((s, i) => {
            const done = stepDone[i];
            const current = i === currentStep;
            return (
              <li key={s} className="relative flex flex-col items-center gap-2 text-center">
                {i > 0 && <span aria-hidden className={cn('absolute right-1/2 top-4 h-0.5 w-full -translate-y-1/2', stepDone[i - 1] ? 'bg-primary' : 'bg-border-strong')} />}
                <span className={cn('relative grid size-8 place-items-center rounded-full text-small font-bold tabular ring-4 ring-surface-2', done ? 'bg-primary text-primary-contrast' : current ? 'bg-surface text-primary-soft-text ring-primary-soft outline outline-2 outline-primary' : 'bg-surface text-muted outline outline-1 outline-border-strong')}>
                  {done ? <Check className="size-4" strokeWidth={3} aria-hidden /> : i + 1}
                </span>
                <span className={cn('text-small font-medium', done || current ? 'text-text' : 'text-muted')}>{t(`steps.${s}`)}</span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="p-5 md:p-6">
        <dl className="grid gap-3 sm:grid-cols-2">
          {sigs.map((sg) => (
            <div key={sg.label} className="relative rounded-2xl border border-border py-3 pl-[60px] pr-4">
              <dt className="text-small text-muted">
                <span aria-hidden className={cn('absolute left-4 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full', sg.at ? 'bg-success/12 text-success' : 'bg-surface-2 text-muted')}>
                  {sg.at ? <Check className="size-4" strokeWidth={3} /> : <PenLine className="size-4" strokeWidth={2} />}
                </span>
                {sg.label}
              </dt>
              <dd className="font-medium tabular">{sg.at ? f.dateTime(sg.at) : t('notYet')}</dd>
            </div>
          ))}
        </dl>
        {e.disputeReason && <p className="mt-3 rounded-xl bg-danger/10 px-3 py-2 text-small text-danger">{t('disputeReason', { reason: e.disputeReason })}</p>}
        {e.history.length > 0 && (
          <details className="group mt-3 text-small">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full px-2 py-1 font-medium text-muted hover:bg-surface-2 hover:text-text [&::-webkit-details-marker]:hidden">
              <ChevronDown className="size-4 transition-transform group-open:rotate-180" strokeWidth={2} aria-hidden />
              {t('history')}
            </summary>
            <ol className="ml-3 mt-2 flex flex-col gap-2 border-l-2 border-border pl-4">
              {e.history.map((h, i) => (
                <li key={i} className="relative">
                  <span aria-hidden className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-primary ring-4 ring-surface" />
                  <span className="text-muted tabular">{f.dateTime(h.at)}</span> — {statusLabel(h.from)} → <b className="font-semibold">{statusLabel(h.to)}</b>
                </li>
              ))}
            </ol>
          </details>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button asChild size="sm" variant="secondary">
            <a href={withBase(`/api/v1/escrow/${e.id}/contract.pdf`)}>
              <FileText className="size-4" strokeWidth={2} aria-hidden />
              {t('contract')}
            </a>
          </Button>
          <span className="flex-1" aria-hidden />
          {e.status === 'pending' && !mySigned && (
            <Button size="sm" loading={busy === 'sign'} onClick={() => act('sign')} icon={<PenLine className="size-4" strokeWidth={2} aria-hidden />}>
              {t('sign')}
            </Button>
          )}
          {e.status === 'pending' && e.myRole === 'tenant' && (
            <Button size="sm" loading={busy === 'fund'} disabled={!signed} title={signed ? undefined : t('signFirst')} onClick={() => act('fund')}>
              {t('fund')}
            </Button>
          )}
          {e.status === 'funded' && e.myRole === 'tenant' && (
            <Button size="sm" loading={busy === 'release'} onClick={() => window.confirm(t('releaseConfirm')) && act('release')}>
              {t('release')}
            </Button>
          )}
          {e.status === 'funded' && e.myRole === 'owner' && (
            <Button size="sm" variant="secondary" loading={busy === 'refund'} onClick={() => window.confirm(t('refundConfirm')) && act('refund')}>
              {t('refund')}
            </Button>
          )}
          {e.status === 'funded' && e.myRole !== 'admin' && (
            <Dialog
              open={dispute}
              onOpenChange={setDispute}
              size="sm"
              title={t('disputeTitle')}
              description={t('disputeText')}
              trigger={
                <Button size="sm" variant="danger">
                  {t('dispute')}
                </Button>
              }
            >
              <form
                onSubmit={(ev) => {
                  ev.preventDefault();
                  void act('dispute', { reason });
                }}
                className="flex flex-col gap-3"
              >
                <Field label={t('reason')} required>
                  <Textarea rows={4} value={reason} onChange={(ev) => setReason(ev.target.value)} minLength={5} maxLength={1000} required />
                </Field>
                <Button type="submit" variant="danger" loading={busy === 'dispute'} disabled={reason.trim().length < 5}>
                  {t('disputeSubmit')}
                </Button>
              </form>
            </Dialog>
          )}
        </div>
      </div>
    </li>
  );
}
