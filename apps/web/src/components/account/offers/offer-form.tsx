'use client';
import * as React from 'react';
import Link, { useLocalizedPath } from '@/i18n/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
    <form onSubmit={submit} className="mt-6 flex flex-col gap-6" noValidate>
      <section aria-labelledby="terms-h" className="rounded-card border border-border bg-surface p-4 sm:p-6">
        <h2 id="terms-h" className="mb-4 text-h3 font-semibold">
          {t('new.terms')}
        </h2>
        <OfferTermsFields value={terms} onChange={setTerms} errors={errors} dealType={listing.dealType} equipment={listing.equipment} />
      </section>
      <section aria-labelledby="tp-h" className="flex flex-col gap-3">
        <h2 id="tp-h" className="text-h3 font-semibold">
          {t('new.profileTitle')}
        </h2>
        <p className="text-small text-muted">{t('new.profileHint')}</p>
        {editing ? (
          <div className="rounded-card border border-border bg-surface p-4 sm:p-6">
            <TenantProfileEditor value={tp} onChange={setTp} businessTypes={businessTypes} />
            {profile && (
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => setEditing(false)}>
                {t('new.profileDone')}
              </Button>
            )}
          </div>
        ) : (
          <TenantProfileSummary
            profile={tp}
            name={userName}
            businessTypes={businessTypes}
            action={
              <Button variant="link" size="sm" onClick={() => setEditing(true)}>
                {t('new.profileEdit')}
              </Button>
            }
          />
        )}
      </section>
      <div aria-live="polite">
        {existing && (
          <p className="rounded-card border border-border bg-surface-2 p-4">
            {t('new.existing')}{' '}
            <Link href={`/account/offers/${existing}`} className="text-link underline underline-offset-4">
              {t('new.openThread')}
            </Link>
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button type="submit" size="lg" loading={busy}>
          {t('new.submit')}
        </Button>
        <p className="text-small text-muted">{t('new.submitHint')}</p>
      </div>
    </form>
  );
}
