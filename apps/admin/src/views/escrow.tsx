'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import { ESCROW_STATUS_LABELS_KA, formatDateTimeKa, formatMoney, type EscrowDto, type EscrowStatus, type LedgerReconciliation } from '@lokacia/contracts';
import { Badge, Button, Dialog, EmptyState, Field, RadioGroup, Tabs, Textarea } from '@lokacia/ui';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { PageHeader, Section } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';

const PORTAL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';
const tone = (s: EscrowStatus) => (s === 'disputed' ? 'danger' : s === 'funded' ? 'accent' : s === 'released' ? 'success' : 'neutral');

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
          <div className="rounded-card border border-danger px-3 py-2 text-small">
            <div className="font-medium">{t('disputeReason')}</div>
            {e.disputeReason}
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

function EscrowRow({ e, onDone }: { e: EscrowDto; onDone: () => void }) {
  const t = useTranslations('escrow');
  const [open, setOpen] = React.useState(false);
  const [history, setHistory] = React.useState(false);
  return (
    <tr className="border-b border-border align-top last:border-b-0">
      <td className="px-3 py-2">
        <a href={`${PORTAL}/listings/${e.listing.slug}`} target="_blank" rel="noreferrer" className="font-medium text-link hover:underline">
          {e.listing.title}
        </a>
        <div className="text-small text-muted">
          {t('tenant')}:{' '}
          <Link href={`/users/${e.tenant.id}`} className="hover:underline">
            {e.tenant.name ?? '—'}
          </Link>{' '}
          · {t('owner')}:{' '}
          <Link href={`/users/${e.owner.id}`} className="hover:underline">
            {e.owner.name ?? '—'}
          </Link>
        </div>
        {e.disputeReason && <div className="mt-1 text-small text-danger">{e.disputeReason}</div>}
        <button type="button" className="mt-1 text-small text-link hover:underline" aria-expanded={history} onClick={() => setHistory((h) => !h)}>
          {t('history')}
        </button>
        {history && (
          <ol className="mt-1 text-[12px] text-muted">
            {e.history.map((h, i) => (
              <li key={i} className="tabular">
                {formatDateTimeKa(h.at)} — {ESCROW_STATUS_LABELS_KA[h.from as EscrowStatus] ?? h.from} → {ESCROW_STATUS_LABELS_KA[h.to as EscrowStatus] ?? h.to}
              </li>
            ))}
          </ol>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular">{formatMoney(e.amountMinor)}</td>
      <td className="px-3 py-2">
        <Badge tone={tone(e.status)}>{ESCROW_STATUS_LABELS_KA[e.status]}</Badge>
        <div className="mt-1 text-[12px] text-muted">
          {t('signatures', { tenant: e.tenantSignedAt ? '✓' : '—', owner: e.ownerSignedAt ? '✓' : '—' })}
        </div>
      </td>
      <td className="px-3 py-2 text-small text-muted tabular">{formatDateTimeKa(e.createdAt)}</td>
      <td className="px-3 py-2 text-right">
        {e.status === 'disputed' && (
          <Button size="sm" onClick={() => setOpen(true)}>
            {t('resolve')}
          </Button>
        )}
        {e.status === 'disputed' && <ResolveDialog e={e} open={open} onOpenChange={setOpen} onDone={onDone} />}
      </td>
    </tr>
  );
}

function EscrowTable({ status }: { status: EscrowStatus | 'all' }) {
  const t = useTranslations('escrow');
  const { data, error, mutate } = useSWR<EscrowDto[]>(`/admin/escrow${status === 'all' ? '' : `?status=${status}`}`, fetcher);
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock />;
  if (!data.length) return <EmptyState title={t('emptyTitle')} description={t('emptyText')} />;
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[760px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-border-strong text-small text-muted">
            <th scope="col" className="px-3 py-2 font-medium">{t('deal')}</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">{t('amount')}</th>
            <th scope="col" className="px-3 py-2 font-medium">{t('status')}</th>
            <th scope="col" className="px-3 py-2 font-medium">{t('created')}</th>
            <th scope="col" className="px-3 py-2">
              <span className="sr-only">{t('actions')}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((e) => (
            <EscrowRow key={e.id} e={e} onDone={() => mutate()} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Reconciliation() {
  const t = useTranslations('escrow');
  const { data, error, mutate, isValidating } = useSWR<LedgerReconciliation>('/admin/ledger/reconcile', fetcher);
  return (
    <Section
      title={t('ledger')}
      actions={
        <Button size="sm" variant="secondary" loading={isValidating} onClick={() => mutate()}>
          {t('recheck')}
        </Button>
      }
    >
      {error ? (
        <ErrorBlock error={error} />
      ) : !data ? (
        <LoadingBlock rows={3} />
      ) : (
        <div aria-live="polite">
          <p className={`flex items-center gap-2 font-medium ${data.ok ? 'text-success' : 'text-danger'}`}>
            {data.ok ? <CheckCircle2 className="size-4" strokeWidth={1.5} aria-hidden /> : <AlertTriangle className="size-4" strokeWidth={1.5} aria-hidden />}
            {data.ok ? t('balanced', { count: data.checkedTx }) : t('unbalanced', { count: data.unbalanced.length })}
          </p>
          {data.unbalanced.length > 0 && (
            <ul className="mt-2 text-small">
              {data.unbalanced.map((u) => (
                <li key={u.txId} className="font-mono text-[12px]">
                  {u.txId}: {formatMoney(u.debitMinor)} ≠ {formatMoney(u.creditMinor)}
                </li>
              ))}
            </ul>
          )}
          <h3 className="mb-1 mt-3 text-small font-medium">{t('balances')}</h3>
          <ul>
            {data.balances.map((b) => (
              <li key={b.account} className="flex justify-between border-b border-border py-1 text-[13px] last:border-b-0">
                <span className="font-mono">{b.account}</span>
                <span className="tabular">{formatMoney(b.balanceMinor)}</span>
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
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <Tabs tabs={(['disputed', 'funded', 'pending', 'all'] as const).map((s) => ({ value: s, label: s === 'all' ? t('all') : ESCROW_STATUS_LABELS_KA[s], content: <EscrowTable status={s} /> }))} />
        <Reconciliation />
      </div>
    </>
  );
}
