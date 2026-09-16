'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import type { FinanceApplicationDto, FinanceProductDto } from '@lokacia/contracts';
import { Button, Checkbox, Dialog, Field, Input, Textarea } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';
import { useFormat } from '@/i18n/use-format';

export function ApplyButton({ product, loggedIn, listing, defaultOpen }: { product: FinanceProductDto; loggedIn: boolean; listing: { id: string; title: string } | null; defaultOpen?: boolean }) {
  const t = useTranslations('finance.apply');
  const tf = useTranslations('finance');
  const fmt = useFormat();
  const [open, setOpen] = React.useState(!!defaultOpen);
  const [amount, setAmount] = React.useState(product.minAmountMinor ? String(product.minAmountMinor / 100) : '');
  const [term, setTerm] = React.useState(product.kind === 'insurance' ? '12' : '24');
  const [company, setCompany] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [consent, setConsent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<FinanceApplicationDto | null>(null);

  if (!loggedIn) {
    return (
      <Button asChild className="mt-4">
        <Link href={`/login?next=${encodeURIComponent(`/finance?product=${product.id}${listing ? `&listing=${listing.id}` : ''}`)}`}>{t('loginToApply')}</Link>
      </Button>
    );
  }

  const amountMinor = Math.round(Number(amount.replace(/\s/g, '').replace(',', '.')) * 100);
  const outOfRange = (product.minAmountMinor != null && amountMinor < product.minAmountMinor) || (product.maxAmountMinor != null && amountMinor > product.maxAmountMinor);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await apiFetch<FinanceApplicationDto>('/finance/applications', {
        method: 'POST',
        body: { productId: product.id, listingId: listing?.id ?? null, amountMinor, termMonths: term ? Number(term) : null, companyName: company || null, phone: phone || null, message: message || null, consent },
      });
      setResult(r);
    } catch (err) {
      setError(err instanceof ClientApiError ? (err.problem?.errors?.[0]?.message ?? err.message) : t('error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setResult(null); }} title={product.name} description={product.partner} trigger={<Button className="mt-4">{t('cta')}</Button>}>
      {result ? (
        <div className="flex flex-col items-center gap-2 py-4 text-center" role="status">
          <CheckCircle2 className="size-10 text-success" strokeWidth={1.5} aria-hidden />
          <p className="font-semibold">{t('sent')}</p>
          <p className="text-small text-muted">{t('status', { status: tf(`statusLabels.${result.status}`) })}</p>
          <Button asChild variant="secondary" className="mt-2">
            <Link href="/account/billing#finance">{t('myApplications')}</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          {listing && <p className="text-small text-muted">{t('listing', { title: listing.title })}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('amount')} required error={outOfRange && amount ? t('range', { min: product.minAmountMinor ? fmt.money(product.minAmountMinor) : '0 ₾', max: product.maxAmountMinor ? fmt.money(product.maxAmountMinor) : '∞' }) : undefined}>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} suffix="₾" required />
            </Field>
            <Field label={t('term')}>
              <Input type="number" min={1} max={360} value={term} onChange={(e) => setTerm(e.target.value)} suffix={t('months')} />
            </Field>
            <Field label={t('company')}>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="organization" />
            </Field>
            <Field label={t('phone')}>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" />
            </Field>
          </div>
          <Field label={t('message')}>
            <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} />
          </Field>
          <Checkbox checked={consent} onCheckedChange={(c) => setConsent(c === true)} label={t('consent', { partner: product.partner })} />
          {error && (
            <p role="alert" className="text-small text-danger">
              {error}
            </p>
          )}
          <Button type="submit" loading={busy} disabled={!consent || !amountMinor || outOfRange}>
            {t('submit')}
          </Button>
        </form>
      )}
    </Dialog>
  );
}
