'use client';
import { useTranslations } from 'next-intl';
import { AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, ImageOff, Pencil } from 'lucide-react';
import { PASSPORT_FIELD_BY_KEY } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Button, SpacePlan, SpecRow } from '@lokacia/ui';
import { StepSection } from './parts';
import { money, parseNum, relevantKeys, type BusinessTypeOption, type StepKey, type WizardForm } from './types';

export type ReviewIssue = { step: StepKey; message: string };

export function StepReview({ form, types, issues, goTo, children }: { form: WizardForm; types: BusinessTypeOption[]; issues: ReviewIssue[]; goTo: (s: StepKey) => void; children?: React.ReactNode }) {
  const t = useTranslations('wizard.review');
  const ts = useTranslations('wizard.steps');
  const tp = useTranslations('wizard.passport');
  const f = useFormat();
  const area = parseNum(form.areaM2) ?? 0;
  const price = money(form.price);
  const rel = relevantKeys(form, types);
  const filledPct = rel.length ? Math.round((rel.filter((k) => form.passport[k] != null).length / rel.length) * 100) : 100;
  const photos = form.media.filter((m) => m.kind === 'photo' && m.status === 'ready');
  const row = (label: string, value: React.ReactNode, step: StepKey) => (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-b-0">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-muted">{label}</div>
        <div className="break-words font-medium">{value || '—'}</div>
      </div>
      <Button variant="ghost" size="sm" onClick={() => goTo(step)} aria-label={`${t('edit')}: ${label}`} icon={<Pencil className="size-3.5" strokeWidth={2} aria-hidden />}>
        {t('edit')}
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <StepSection title={t('heading')} icon={ClipboardCheck}>
        <div aria-live="polite">
          {issues.length ? (
            <div className="rounded-card border border-danger/30 bg-danger/[0.06] p-5">
              <div className="flex items-center gap-3 font-bold text-danger">
                <span className="grid size-9 place-items-center rounded-xl bg-danger/15" aria-hidden>
                  <AlertTriangle className="size-4" strokeWidth={2} />
                </span>
                {t('missing')}
              </div>
              <ul className="mt-3 flex flex-col gap-2">
                {issues.map((i) => (
                  <li key={`${i.step}-${i.message}`}>
                    <button type="button" className="flex w-full items-center gap-3 rounded-xl bg-surface px-3.5 py-2.5 text-left text-[15px] shadow-xs transition-colors hover:bg-surface-2" onClick={() => goTo(i.step)}>
                      <span className="inline-flex h-6 shrink-0 items-center rounded-full bg-danger/10 px-2 text-[12px] font-semibold text-danger">{ts(i.step)}</span>
                      <span className="min-w-0 flex-1">{i.message}</span>
                      <ArrowRight className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex items-center gap-4 rounded-card border border-success/30 bg-success/[0.07] p-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-success/15 text-success" aria-hidden>
                <CheckCircle2 className="size-5" strokeWidth={2} />
              </span>
              <div>
                <div className="font-bold">{t('ready')}</div>
                <div className="text-small text-muted">{t('moderation')}</div>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <div className="overflow-hidden rounded-card border border-border">
              {photos[0] ? <img src={photos[0].url} alt="" className="aspect-[16/8] w-full object-cover" /> : <div className="drawing-grid grid aspect-[16/8] w-full place-items-center text-muted" aria-hidden><ImageOff className="size-8" strokeWidth={1.75} /></div>}
              <div className="p-4 sm:p-5">
                <h3 className="text-[21px] font-bold leading-snug tracking-tight">{form.title || '—'}</h3>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    { label: t('price'), value: price ? f.money(price) : '—' },
                    { label: t('area'), value: area ? f.area(area) : '—' },
                    { label: t('photos'), value: String(photos.length) },
                    { label: ts('passport'), value: `${filledPct}%` },
                  ].map((k) => (
                    <div key={k.label} className="rounded-2xl bg-surface-2 px-3 py-2.5">
                      <div className="text-[12.5px] text-muted">{k.label}</div>
                      <div className="truncate text-[17px] font-bold tabular">{k.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4">
              {row(t('types'), form.businessTypes.map((s) => { const b = types.find((x) => x.slug === s); return b ? f.name(b) : s; }).join(', '), 'type')}
              {row(t('deal'), f.dealType(form.dealType), 'type')}
              {row(t('address'), [form.address, form.districtName].filter(Boolean).join(' — '), 'location')}
              {row(t('price'), price ? f.money(price) : '', 'price')}
              {row(t('photos'), String(photos.length), 'media')}
              {row(ts('passport'), t('passportFilled', { pct: filledPct }), 'passport')}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {area > 0 && (
              <div className="rounded-card border border-border bg-surface-2/40 p-4">
                <SpacePlan areaM2={area} widthM={(form.passport.widthM as number) ?? null} depthM={(form.passport.depthM as number) ?? null} ceilingM={(form.passport.ceilingM as number) ?? null} powerKw={(form.passport.powerKw as number) ?? null} compact />
              </div>
            )}
            <div className="rounded-card border border-border px-4 py-1">
              {rel
                .filter((k) => form.passport[k] != null)
                .slice(0, 8)
                .map((k) => {
                  const m = PASSPORT_FIELD_BY_KEY[k];
                  const v = form.passport[k];
                  return <SpecRow key={k} label={f.passport(k)} value={typeof v === 'boolean' ? (v ? tp('yes') : tp('no')) : String(v)} unit={typeof v === 'boolean' ? undefined : f.unit(m.unit)} />;
                })}
            </div>
          </div>
        </div>
      </StepSection>
      {children}
    </div>
  );
}
