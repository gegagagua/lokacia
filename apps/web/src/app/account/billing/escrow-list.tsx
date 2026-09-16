'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Check, FileText } from 'lucide-react';
import { ESCROW_STATUS_LABELS_KA, formatDateKa, formatDateTimeKa, formatMoney, type CheckoutResponse, type EscrowDto } from '@lokacia/contracts';
import { Badge, Button, Card, cn, Dialog, Field, Textarea, useToast, type BadgeTone } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher } from '@/lib/api-client';
import { followCheckout } from '@/components/billing/checkout';

const TONE: Record<string, BadgeTone> = { pending: 'neutral', funded: 'link', released: 'success', refunded: 'outline', disputed: 'danger' };
const STEPS = ['signed', 'funded', 'closed'] as const;

export function EscrowList() {
  const t = useTranslations('billing.escrow');
  const { data, mutate } = useSWR<EscrowDto[]>('/escrow', fetcher);
  if (!data) return null;
  if (!data.length) return <p className="mt-3 text-muted">{t('empty')}</p>;
  return (
    <ul className="mt-4 flex flex-col gap-3">
      {data.map((e) => (
        <EscrowCard key={e.id} escrow={e} onChange={() => mutate()} />
      ))}
    </ul>
  );
}

function EscrowCard({ escrow: e, onChange }: { escrow: EscrowDto; onChange: () => void }) {
  const t = useTranslations('billing.escrow');
  const toast = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [dispute, setDispute] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const signed = !!e.tenantSignedAt && !!e.ownerSignedAt;
  const mySigned = e.myRole === 'tenant' ? !!e.tenantSignedAt : e.myRole === 'owner' ? !!e.ownerSignedAt : true;
  const stepDone = [signed, ['funded', 'released', 'refunded', 'disputed'].includes(e.status), ['released', 'refunded'].includes(e.status)];

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

  return (
    <Card as="li" className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/listings/${e.listing.slug}`} className="font-medium hover:underline">
            {e.listing.title}
          </Link>
          <div className="text-small text-muted">
            {e.myRole === 'tenant' ? t('youTenant', { owner: e.owner.name ?? '—' }) : e.myRole === 'owner' ? t('youOwner', { tenant: e.tenant.name ?? '—' }) : t('admin')} · {formatDateKa(e.createdAt)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="compact text-h3 font-semibold tabular">{formatMoney(e.amountMinor)}</span>
          <Badge tone={TONE[e.status] ?? 'neutral'}>{ESCROW_STATUS_LABELS_KA[e.status]}</Badge>
        </div>
      </div>

      <ol className="mt-4 grid grid-cols-3 gap-2" aria-label={t('progress')}>
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-col gap-1">
            <span className={cn('h-1 rounded-full', stepDone[i] ? 'bg-primary' : 'bg-surface-2')} aria-hidden />
            <span className={cn('flex items-center gap-1 text-small', stepDone[i] ? 'text-text' : 'text-muted')}>
              {stepDone[i] && <Check className="size-3.5" strokeWidth={2} aria-hidden />}
              {t(`steps.${s}`)}
            </span>
          </li>
        ))}
      </ol>

      <dl className="mt-3 grid gap-x-6 text-small sm:grid-cols-2">
        <div className="flex justify-between border-b border-border py-1.5">
          <dt className="text-muted">{t('tenantSigned')}</dt>
          <dd className="tabular">{e.tenantSignedAt ? formatDateTimeKa(e.tenantSignedAt) : t('notYet')}</dd>
        </div>
        <div className="flex justify-between border-b border-border py-1.5">
          <dt className="text-muted">{t('ownerSigned')}</dt>
          <dd className="tabular">{e.ownerSignedAt ? formatDateTimeKa(e.ownerSignedAt) : t('notYet')}</dd>
        </div>
      </dl>
      {e.disputeReason && <p className="mt-2 text-small text-danger">{t('disputeReason', { reason: e.disputeReason })}</p>}
      {e.history.length > 0 && (
        <details className="mt-2 text-small">
          <summary className="cursor-pointer text-muted">{t('history')}</summary>
          <ul className="mt-1 flex flex-col gap-1">
            {e.history.map((h, i) => (
              <li key={i} className="tabular">
                {formatDateTimeKa(h.at)} — {ESCROW_STATUS_LABELS_KA[h.from as keyof typeof ESCROW_STATUS_LABELS_KA] ?? h.from} → {ESCROW_STATUS_LABELS_KA[h.to as keyof typeof ESCROW_STATUS_LABELS_KA] ?? h.to}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild size="sm" variant="ghost">
          <a href={`/api/v1/escrow/${e.id}/contract.pdf`}>
            <FileText className="size-4" strokeWidth={1.5} aria-hidden />
            {t('contract')}
          </a>
        </Button>
        {e.status === 'pending' && !mySigned && (
          <Button size="sm" loading={busy === 'sign'} onClick={() => act('sign')}>
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
    </Card>
  );
}
