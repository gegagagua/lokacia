'use client';
import * as React from 'react';
import Link, { useLocalizedPath } from '@/i18n/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Handshake, Info, Pencil, Send, UserRound } from 'lucide-react';
import type { OfferDto, OfferThreadSummary } from '@lokacia/contracts';
import { Button, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';
import { OfferTermsFields, termsToBody, type OfferTerms, type TermsErrors } from './offer-terms-fields';
import { cleanTenantProfile, TenantProfileEditor, TenantProfileSummary, type BusinessTypeOption, type TenantProfileValue } from './tenant-profile';

export function OfferForm({ listing, profile, userName, businessTypes }: { listing: { id: string; dealType: string; priceMinor: number; equipment: { name: string; qty: number; priceMinor: number }[] }; profile: TenantProfileValue | null; userName: string | null; businessTypes: BusinessTypeOption[] }) {
  const t = useTranslations('offers');
  const router = useRouter();
  const lp = useLocalizedPath();
  const toast = useToast();
  const [terms, setTerms] = React.useState<OfferTerms>({
    priceGel: String(listing.priceMinor / 100),
    termMonths: String(profile?.desiredTermMonths ?? 12),
    freeMonths: '0',
    indexationPct: '0',
    fitoutPaidBy: 'tenant',
    equipmentIncluded: listing.dealType === 'transfer',
    message: '',
  });
  const [errors, setErrors] = React.useState<TermsErrors>({});
  const [tp, setTp] = React.useState<TenantProfileValue>(profile ?? {});
  const [editing, setEditing] = React.useState(!profile);
  const [busy, setBusy] = React.useState(false);
  const [existing, setExisting] = React.useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { body, errors: errs } = termsToBody(terms, listing.dealType, (k) => t(`form.${k}`));
    setErrors(errs);
    if (!body) return;
    setBusy(true);
    try {
      const created = await apiFetch<OfferDto>('/offers', { method: 'POST', body: { ...body, listingId: listing.id, tenantProfile: cleanTenantProfile(tp) } });
      toast({ title: t('new.sent'), tone: 'success' });
      router.push(lp(`/account/offers/${created.id}`));
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 409) {
        const sent = await apiFetch<OfferThreadSummary[]>('/offers?box=sent').catch(() => []);
        const thread = sent.find((s) => s.listing.id === listing.id && s.latest.status === 'pending');
        setExisting(thread?.latest.id ?? thread?.rootId ?? null);
      }
      toast({ title: err instanceof ClientApiError ? err.message : t('errors.generic'), tone: 'danger' });
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      <section aria-labelledby="terms-h" className="card p-5 sm:p-7">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-primary-soft text-primary-soft-text" aria-hidden>
            <Handshake className="size-5" strokeWidth={2} />
          </span>
          <h2 id="terms-h" className="text-[20px] font-bold tracking-tight">
            {t('new.terms')}
          </h2>
        </div>
        <OfferTermsFields value={terms} onChange={setTerms} errors={errors} dealType={listing.dealType} equipment={listing.equipment} />
      </section>
      <section aria-labelledby="tp-h" className="card flex flex-col gap-4 p-5 sm:p-7">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-2xl bg-link/12 text-link" aria-hidden>
            <UserRound className="size-5" strokeWidth={2} />
          </span>
          <div>
            <h2 id="tp-h" className="text-[20px] font-bold tracking-tight">
              {t('new.profileTitle')}
            </h2>
            <p className="text-small text-muted">{t('new.profileHint')}</p>
          </div>
        </div>
        {editing ? (
          <div className="rounded-2xl bg-surface-2/60 p-4 sm:p-5">
            <TenantProfileEditor value={tp} onChange={setTp} businessTypes={businessTypes} />
            {profile && (
              <Button variant="secondary" size="sm" className="mt-4" onClick={() => setEditing(false)}>
                {t('new.profileDone')}
              </Button>
            )}
          </div>
        ) : (
          <TenantProfileSummary
            profile={tp}
            name={userName}
            businessTypes={businessTypes}
            className="border-border bg-surface-2/40 shadow-none"
            action={
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)} icon={<Pencil className="size-3.5" strokeWidth={2} aria-hidden />}>
                {t('new.profileEdit')}
              </Button>
            }
          />
        )}
      </section>
      <div aria-live="polite">
        {existing && (
          <p className="flex flex-wrap items-center gap-2 rounded-2xl bg-accent-soft p-4">
            <Info className="size-5 shrink-0" strokeWidth={2} aria-hidden />
            {t('new.existing')}{' '}
            <Link href={`/account/offers/${existing}`} className="font-semibold text-link underline underline-offset-4">
              {t('new.openThread')}
            </Link>
          </p>
        )}
      </div>
      <div className="sticky bottom-3 z-10 flex flex-col gap-3 rounded-card border border-border bg-surface/95 p-3 shadow-lg backdrop-blur-xl sm:flex-row sm:items-center sm:p-4">
        <Button type="submit" size="lg" variant="accent" loading={busy} icon={<Send className="size-4" strokeWidth={2} aria-hidden />}>
          {t('new.submit')}
        </Button>
        <p className="text-small text-muted">{t('new.submitHint')}</p>
      </div>
    </form>
  );
}
