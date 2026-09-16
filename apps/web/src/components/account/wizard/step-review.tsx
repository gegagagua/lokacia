'use client';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DEAL_TYPE_LABELS_KA, formatArea, formatMoney, PASSPORT_FIELD_BY_KEY } from '@lokacia/contracts';
import { Button, SpacePlan, SpecRow } from '@lokacia/ui';
import { StepSection } from './parts';
import { money, parseNum, relevantKeys, type BusinessTypeOption, type StepKey, type WizardForm } from './types';

export type ReviewIssue = { step: StepKey; message: string };

export function StepReview({ form, types, issues, goTo, children }: { form: WizardForm; types: BusinessTypeOption[]; issues: ReviewIssue[]; goTo: (s: StepKey) => void; children?: React.ReactNode }) {
  const t = useTranslations('wizard.review');
  const ts = useTranslations('wizard.steps');
  const tp = useTranslations('wizard.passport');
  const area = parseNum(form.areaM2) ?? 0;
  const price = money(form.price);
  const rel = relevantKeys(form, types);
  const filledPct = rel.length ? Math.round((rel.filter((k) => form.passport[k] != null).length / rel.length) * 100) : 100;
  const photos = form.media.filter((m) => m.kind === 'photo' && m.status === 'ready');
  const row = (label: string, value: React.ReactNode, step: StepKey) => (
    <div className="flex items-start justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <div className="min-w-0">
        <div className="text-small text-muted">{label}</div>
        <div className="break-words">{value || '—'}</div>
      </div>
      <Button variant="link" size="sm" onClick={() => goTo(step)} aria-label={`${t('edit')}: ${label}`}>
        {t('edit')}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <StepSection title={t('heading')}>
        <div aria-live="polite">
          {issues.length ? (
            <div className="rounded-card border border-danger/60 p-4">
              <div className="flex items-center gap-2 font-medium text-danger">
                <AlertTriangle className="size-4" strokeWidth={1.5} aria-hidden />
                {t('missing')}
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-small">
                {issues.map((i) => (
                  <li key={`${i.step}-${i.message}`}>
                    <button type="button" className="text-left text-link underline-offset-4 hover:underline" onClick={() => goTo(i.step)}>
                      {ts(i.step)}: {i.message}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-card border border-success/50 p-4">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" strokeWidth={1.5} aria-hidden />
              <div>
                <div className="font-medium">{t('ready')}</div>
                <div className="text-small text-muted">{t('moderation')}</div>
              </div>
            </div>
          )}
        </div>
        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_280px]">
          <div>
            <h3 className="text-h3 font-semibold">{form.title || '—'}</h3>
            <div className="mt-3">
              {row(t('types'), form.businessTypes.map((s) => types.find((b) => b.slug === s)?.nameKa ?? s).join(', '), 'type')}
              {row(t('deal'), DEAL_TYPE_LABELS_KA[form.dealType], 'type')}
              {row(t('address'), [form.address, form.districtName].filter(Boolean).join(' — '), 'location')}
              {row(t('area'), area ? formatArea(area) : '', 'location')}
              {row(t('price'), price ? formatMoney(price) : '', 'price')}
              {row(t('photos'), String(photos.length), 'media')}
              {row(ts('passport'), t('passportFilled', { pct: filledPct }), 'passport')}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {area > 0 && (
              <div className="rounded-card border border-border p-3">
                <SpacePlan areaM2={area} widthM={(form.passport.widthM as number) ?? null} depthM={(form.passport.depthM as number) ?? null} ceilingM={(form.passport.ceilingM as number) ?? null} powerKw={(form.passport.powerKw as number) ?? null} compact />
              </div>
            )}
            {photos[0] && <img src={photos[0].url} alt="" className="aspect-[4/3] w-full rounded-photo border border-border object-cover" />}
            <div>
              {rel
                .filter((k) => form.passport[k] != null)
                .slice(0, 8)
                .map((k) => {
                  const m = PASSPORT_FIELD_BY_KEY[k];
                  const v = form.passport[k];
                  return <SpecRow key={k} label={m.labelKa} value={typeof v === 'boolean' ? (v ? tp('yes') : tp('no')) : String(v)} unit={typeof v === 'boolean' ? undefined : m.unit} />;
                })}
            </div>
          </div>
        </div>
      </StepSection>
      {children}
    </div>
  );
}
