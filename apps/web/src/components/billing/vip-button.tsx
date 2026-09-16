'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import type { PlansResponse } from '@lokacia/contracts';
import { Button, Dialog, RadioGroup, useToast } from '@lokacia/ui';
import { ClientApiError, fetcher } from '@/lib/api-client';
import { startCheckout } from './checkout';
import { useFormat } from '@/i18n/use-format';

/** Owned by the billing work stream: buys VIP (7/30 days) for a listing. Rendered in the owner's listings table. */
export function VipPurchaseButton({ listingId, vipUntil }: { listingId: string; vipUntil?: string | null }) {
  const t = useTranslations('billing.vip');
  const fmt = useFormat();
  const toast = useToast();
  const [open, setOpen] = React.useState(false);
  const [plan, setPlan] = React.useState('vip_7');
  const [busy, setBusy] = React.useState(false);
  const { data } = useSWR<PlansResponse>(open ? '/billing/plans' : null, fetcher);
  const active = !!vipUntil && new Date(vipUntil) > new Date();
  const options = (data?.plans ?? []).filter((p) => p.key === 'vip_7' || p.key === 'vip_30');
  const selected = options.find((p) => p.key === plan);

  const buy = async () => {
    setBusy(true);
    try {
      await startCheckout({ planKey: plan, listingId, returnPath: '/account/listings' });
    } catch (e) {
      toast({ title: t('error'), description: e instanceof ClientApiError ? e.message : undefined, tone: 'danger' });
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={setOpen}
      size="sm"
      title={active ? t('extendTitle') : t('title')}
      description={t('description')}
      trigger={
        <Button size="sm" variant={active ? 'secondary' : 'ghost'} icon={<Sparkles className="size-3.5 text-accent" strokeWidth={1.5} aria-hidden />}>
          {active ? t('activeUntil', { date: fmt.date(vipUntil!) }) : t('enable')}
        </Button>
      }
      footer={
        <>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={buy} loading={busy} disabled={!selected}>
            {data?.promoActive ? t('enableFree') : selected ? t('pay', { amount: fmt.money(selected.priceMinor) }) : t('enable')}
          </Button>
        </>
      }
    >
      {!data ? (
        <p className="text-small text-muted" aria-live="polite">
          {t('loading')}
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          <RadioGroup
            value={plan}
            onValueChange={setPlan}
            aria-label={t('period')}
            options={options.map((p) => ({ value: p.key, label: `${p.days} ${t('days')} — ${data.promoActive ? '0 ₾' : fmt.money(p.priceMinor)}` }))}
          />
          {data.promoActive && <p className="rounded-button border border-accent bg-accent/10 px-3 py-2 text-small">{t('promo', { date: data.promoUntil ? fmt.date(data.promoUntil) : '' })}</p>}
          {active && <p className="text-small text-muted">{t('extendHint', { date: fmt.date(vipUntil!) })}</p>}
          <ul className="list-disc pl-5 text-small text-muted">
            {(selected?.features ?? []).map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      )}
    </Dialog>
  );
}
