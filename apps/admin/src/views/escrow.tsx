'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Clock, Gavel, History, PenLine, RefreshCw, Scale, ShieldAlert, ShieldCheck } from 'lucide-react';
import { ESCROW_STATUS_LABELS_KA, formatDateTimeKa, formatMoney, type EscrowDto, type EscrowStatus, type LedgerReconciliation } from '@lokacia/contracts';
import { Avatar, Button, Dialog, EmptyState, Field, IconButton, RadioGroup, Tabs, Textarea, cn } from '@lokacia/ui';
import { StatusPill, type Tone } from '@/components/kit';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { PageHeader, Section } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';

const PORTAL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';
const tone = (s: EscrowStatus): Tone => (s === 'disputed' ? 'danger' : s === 'funded' ? 'accent' : s === 'released' ? 'success' : 'neutral');

function ResolveDialog({ e, open, onOpenChange, onDone }: { e: EscrowDto; open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const t = useTranslations('escrow');
  const [outcome, setOutcome] = React.useState<'release' | 'refund'>('release');
  const [note, setNote] = React.useState('');
  const { run, busy } = useAction();
  const submit = async () => {
    if (await run(() => apiFetch(`/admin/escrow/${e.id}/resolve`, { method: 'POST', body: { outcome, note } }), t('resolved'))) {
      onOpenChange(false);
      onDone();
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('resolveTitle')}
      description={`${e.listing.title} · ${formatMoney(e.amountMinor)}`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button loading={busy} disabled={note.trim().length < 3} onClick={submit}>
            {t('resolve')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {e.disputeReason && (
          <div className="flex gap-3 rounded-2xl bg-danger/10 px-4 py-3 text-[15px]">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" strokeWidth={2} aria-hidden />
            <div>
              <div className="font-bold text-danger">{t('disputeReason')}</div>
              {e.disputeReason}
            </div>
          </div>
        )}
        <RadioGroup
          value={outcome}
          onValueChange={(v) => setOutcome(v as 'release' | 'refund')}
          options={[
            { value: 'release', label: t('releaseTo', { name: e.owner.name ?? t('owner') }) },
            { value: 'refund', label: t('refundTo', { name: e.tenant.name ?? t('tenant') }) },
          ]}
        />
        <Field label={t('note')} hint={t('noteHint')}>
          <Textarea rows={3} value={note} onChange={(ev) => setNote(ev.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function Party({ role, name, id, signedAt }: { role: string; name: string | null; id: string; signedAt: string | null }) {
  const t = useTranslations('escrow');
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl bg-surface-2/70 px-3 py-2.5">
      <Avatar name={name ?? '?'} size={36} className="ring-0" />
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium text-muted">{role}</div>
        <Link href={`/users/${id}`} className="block truncate font-semibold hover:text-link hover:underline">
          {name ?? '—'}
        </Link>
        <span className={cn('mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold', signedAt ? 'bg-success/10 text-[color-mix(in_srgb,var(--success)_85%,var(--text))]' : 'bg-surface-3 text-muted')}>
          {signedAt ? <PenLine className="size-3" strokeWidth={2} aria-hidden /> : <Clock className="size-3" strokeWidth={2} aria-hidden />}
          {signedAt ? t('signed') : t('notSigned')}
        </span>
      </div>
    </div>
  );
}

function EscrowCard({ e, onDone }: { e: EscrowDto; onDone: () => void }) {
  const t = useTranslations('escrow');
  const [open, setOpen] = React.useState(false);
  const [history, setHistory] = React.useState(false);
  return (
    <article className={cn('card overflow-hidden', e.status === 'disputed' && 'ring-1 ring-danger/30')}>
      <div className="flex flex-wrap items-start gap-3 p-4 md:p-5">
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl', e.status === 'disputed' ? 'bg-danger/10 text-danger' : 'bg-primary-soft text-primary-soft-text')}>
          <ShieldCheck className="size-5" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <a href={`${PORTAL}/listings/${e.listing.slug}`} target="_blank" rel="noreferrer" className="line-clamp-2 text-[16px] font-bold leading-snug hover:text-link hover:underline">
            {e.listing.title}
          </a>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-muted">
            <StatusPill tone={tone(e.status)} pulse={e.status === 'disputed'}>
              {ESCROW_STATUS_LABELS_KA[e.status]}
            </StatusPill>
            <span className="tabular">{formatDateTimeKa(e.createdAt)}</span>
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[12px] uppercase">{e.provider}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[12.5px] font-medium text-muted">{t('amount')}</div>
          <div className="text-[22px] font-bold leading-tight tabular">{formatMoney(e.amountMinor)}</div>
        </div>
      </div>
      <div className="flex flex-col items-stretch gap-2 px-4 pb-4 sm:flex-row sm:items-center md:px-5">
        <Party role={t('tenant')} name={e.tenant.name} id={e.tenant.id} signedAt={e.tenantSignedAt} />
        <ArrowRight className="hidden size-4 shrink-0 text-muted sm:block" strokeWidth={2} aria-hidden />
        <Party role={t('owner')} name={e.owner.name} id={e.owner.id} signedAt={e.ownerSignedAt} />
      </div>
      {e.disputeReason && (
        <div className="mx-4 mb-4 flex gap-3 rounded-2xl bg-danger/10 px-4 py-3 text-[15px] md:mx-5">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" strokeWidth={2} aria-hidden />
          <div className="min-w-0">
            <div className="text-[13px] font-bold text-danger">{t('disputeReason')}</div>
            <p className="[overflow-wrap:anywhere]">{e.disputeReason}</p>
          </div>
        </div>
      )}
      {history && (
        <ol className="mx-4 mb-4 ml-7 border-l-2 border-border md:mx-5 md:ml-8">
          {e.history.map((h, i) => (
            <li key={i} className="relative pb-3 pl-5 text-[14px] last:pb-0">
              <span className="absolute -left-[7px] top-1.5 size-3 rounded-full bg-primary-500 ring-4 ring-surface" aria-hidden />
              <span className="font-semibold">
                {ESCROW_STATUS_LABELS_KA[h.from as EscrowStatus] ?? h.from} → {ESCROW_STATUS_LABELS_KA[h.to as EscrowStatus] ?? h.to}
              </span>
              <span className="ml-2 text-muted tabular">{formatDateTimeKa(h.at)}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-surface-2/40 px-4 py-3 md:px-5">
        <Button size="sm" variant="ghost" aria-expanded={history} onClick={() => setHistory((h) => !h)} icon={<History className="size-4" strokeWidth={2} aria-hidden />}>
          {t('history')}
          <ChevronDown className={cn('size-4 transition-transform', history && 'rotate-180')} strokeWidth={2} aria-hidden />
        </Button>
        {e.status === 'disputed' && (
          <>
            <Button size="sm" onClick={() => setOpen(true)} icon={<Gavel className="size-4" strokeWidth={2} aria-hidden />}>
              {t('resolve')}
            </Button>
            <ResolveDialog e={e} open={open} onOpenChange={setOpen} onDone={onDone} />
          </>
        )}
      </div>
    </article>
  );
}

function EscrowTable({ status }: { status: EscrowStatus | 'all' }) {
  const t = useTranslations('escrow');
  const { data, error, mutate } = useSWR<EscrowDto[]>(`/admin/escrow${status === 'all' ? '' : `?status=${status}`}`, fetcher);
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock />;
  if (!data.length) return <EmptyState title={t('emptyTitle')} description={t('emptyText')} icon={<ShieldCheck className="size-6" strokeWidth={2} aria-hidden />} />;
  return (
    <div className="flex flex-col gap-4">
      {data.map((e) => (
        <EscrowCard key={e.id} e={e} onDone={() => mutate()} />
      ))}
    </div>
  );
}

function Reconciliation() {
  const t = useTranslations('escrow');
  const { data, error, mutate, isValidating } = useSWR<LedgerReconciliation>('/admin/ledger/reconcile', fetcher);
  return (
    <Section
      icon={Scale}
      title={t('ledger')}
      className="xl:sticky xl:top-24"
      actions={
        <IconButton label={t('recheck')} size="sm" variant="secondary" className="rounded-full" loading={isValidating} onClick={() => mutate()}>
          <RefreshCw className="size-4" strokeWidth={2} />
        </IconButton>
      }
    >
      {error ? (
        <ErrorBlock error={error} />
      ) : !data ? (
        <LoadingBlock rows={3} />
      ) : (
        <div aria-live="polite">
          <div className={cn('flex items-center gap-3 rounded-2xl px-4 py-3.5', data.ok ? 'bg-success/10' : 'bg-danger/10')}>
            {data.ok ? <CheckCircle2 className="size-6 shrink-0 text-success" strokeWidth={2} aria-hidden /> : <AlertTriangle className="size-6 shrink-0 text-danger" strokeWidth={2} aria-hidden />}
            <span className={cn('font-bold', data.ok ? 'text-[color-mix(in_srgb,var(--success)_85%,var(--text))]' : 'text-danger')}>{data.ok ? t('balanced', { count: data.checkedTx }) : t('unbalanced', { count: data.unbalanced.length })}</span>
          </div>
          {data.unbalanced.length > 0 && (
            <ul className="mt-3 flex flex-col gap-1">
              {data.unbalanced.map((u) => (
                <li key={u.txId} className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-[12px] [overflow-wrap:anywhere]">
                  {u.txId}: {formatMoney(u.debitMinor)} ≠ {formatMoney(u.creditMinor)}
                </li>
              ))}
            </ul>
          )}
          <h3 className="mb-2 mt-5 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">{t('balances')}</h3>
          <ul className="flex flex-col">
            {data.balances.map((b) => (
              <li key={b.account} className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
                <span className="min-w-0 truncate font-mono text-[13px]">{b.account}</span>
                <span className="font-bold tabular">{formatMoney(b.balanceMinor)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Section>
  );
}

export function EscrowView() {
  const t = useTranslations('escrow');
  return (
    <>
      <PageHeader icon={ShieldAlert} title={t('title')} subtitle={t('subtitle')} />
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Tabs className="min-w-0" tabs={(['disputed', 'funded', 'pending', 'all'] as const).map((s) => ({ value: s, label: s === 'all' ? t('all') : ESCROW_STATUS_LABELS_KA[s], content: <EscrowTable status={s} /> }))} />
        <Reconciliation />
      </div>
    </>
  );
}
