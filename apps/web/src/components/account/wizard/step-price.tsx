'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Banknote, Building2, CalendarClock, History, Plus, Scale, Trash2, TrendingDown, TrendingUp, Wrench } from 'lucide-react';
import type { SessionUser } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Button, Checkbox, Field, IconButton, Input, Select, cn } from '@lokacia/ui';
import { fetcher } from '@/lib/api-client';
import { SlotsManager } from '../listings/slots-manager';
import { StepSection } from './parts';
import { money, parseNum, type BusinessTypeOption, type WizardForm } from './types';

type PriceCheck = { verdict: 'above' | 'below' | 'fair'; deltaPct: number; messageKa: string; recommendedMinor: number; perM2Minor: number; districtAvgM2Minor: number } | null;
type Project = { id: string; name: string; completionDate: string; developer?: { slug: string } };

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function StepPrice({ form, set, types, user, listingId, errors }: { form: WizardForm; set: (p: Partial<WizardForm>) => void; types: BusinessTypeOption[]; user: SessionUser; listingId: string | null; errors: Record<string, string> }) {
  const t = useTranslations('wizard.price');
  const f = useFormat();
  const priceMinor = money(form.price);
  const area = parseNum(form.areaM2);
  const q = form.lat != null && form.lng != null && priceMinor && area && ['rent', 'short_term'].includes(form.dealType)
    ? `/geo/price-check?lat=${form.lat}&lng=${form.lng}&areaM2=${area}&priceMinor=${priceMinor}&dealType=${form.dealType}${form.businessTypes[0] ? `&businessType=${form.businessTypes[0]}` : ''}`
    : null;
  const key = useDebounced(q, 500);
  const { data: check } = useSWR<PriceCheck>(key, fetcher, { keepPreviousData: true });

  const devOrgs = user.orgs.filter((o) => o.type === 'developer');
  const { data: projects } = useSWR<Project[]>(devOrgs.length ? '/projects' : null, fetcher);
  const myProjects = (projects ?? []).filter((p) => !p.developer || devOrgs.some((o) => o.slug === p.developer!.slug) || p.id === form.projectId);

  const priceLabel = form.dealType === 'sale' ? t('priceSale') : form.dealType === 'transfer' ? t('priceTransfer') : form.dealType === 'short_term' ? t('priceShort') : t('priceRent');
  const isLease = form.dealType === 'rent' || form.dealType === 'short_term';
  const eqTotal = form.equipment.reduce((a, e) => a + (money(e.price) ?? 0) * Math.max(1, parseNum(e.qty) ?? 1), 0);

  return (
    <div className="flex flex-col gap-6">
      <StepSection title={t('heading')} icon={Banknote}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={priceLabel} required error={errors.price}>
            <Input type="number" inputMode="decimal" min={1} value={form.price} suffix="₾" onChange={(e) => set({ price: e.target.value })} />
          </Field>
          {(!form.isOwner || form.orgId) && (
            <Field label={t('commission')}>
              <Input type="number" inputMode="decimal" min={0} max={100} step={0.5} value={form.commissionPct} suffix="%" onChange={(e) => set({ commissionPct: e.target.value })} />
            </Field>
          )}
          {form.dealType === 'short_term' && (
            <>
              <Field label={t('priceHour')}>
                <Input type="number" inputMode="decimal" min={0} value={form.priceHour} suffix="₾" onChange={(e) => set({ priceHour: e.target.value })} />
              </Field>
              <Field label={t('priceDay')}>
                <Input type="number" inputMode="decimal" min={0} value={form.priceDay} suffix="₾" onChange={(e) => set({ priceDay: e.target.value })} />
              </Field>
            </>
          )}
          {isLease && (
            <>
              <Field label={t('serviceFee')}>
                <Input type="number" inputMode="decimal" min={0} value={form.serviceFee} suffix="₾" onChange={(e) => set({ serviceFee: e.target.value })} />
              </Field>
              <Field label={t('deposit')}>
                <Input type="number" inputMode="decimal" min={0} max={12} step={0.5} value={form.depositMonths} onChange={(e) => set({ depositMonths: e.target.value })} />
              </Field>
              <Checkbox label={t('utilities')} checked={form.utilitiesIncluded} onCheckedChange={(v) => set({ utilitiesIncluded: v === true })} />
            </>
          )}
        </div>
        {isLease && <PriceAdvice check={check ?? null} />}
      </StepSection>

      {form.dealType === 'short_term' && (
        <StepSection title={t('slots')} hint={t('slotsHint')} icon={CalendarClock}>
          {listingId ? <SlotsManager listingId={listingId} kind="short_term" defaultPriceMinor={money(form.priceDay) ?? money(form.priceHour)} /> : <p className="text-small text-muted">{t('slotsNeedDraft')}</p>}
        </StepSection>
      )}

      {form.dealType === 'transfer' && (
        <StepSection title={t('equipment')} hint={t('equipmentHint')} icon={Wrench}>
          <ul className="flex flex-col gap-3">
            {form.equipment.map((e, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1fr)_64px_96px_auto] items-end gap-2">
                <Field label={i === 0 ? t('equipmentName') : undefined}>
                  <Input aria-label={t('equipmentName')} value={e.name} maxLength={120} onChange={(ev) => set({ equipment: form.equipment.map((x, j) => (j === i ? { ...x, name: ev.target.value } : x)) })} />
                </Field>
                <Field label={i === 0 ? t('equipmentQty') : undefined}>
                  <Input aria-label={t('equipmentQty')} type="number" min={1} value={e.qty} onChange={(ev) => set({ equipment: form.equipment.map((x, j) => (j === i ? { ...x, qty: ev.target.value } : x)) })} />
                </Field>
                <Field label={i === 0 ? t('equipmentPrice') : undefined}>
                  <Input aria-label={t('equipmentPrice')} type="number" min={0} value={e.price} onChange={(ev) => set({ equipment: form.equipment.map((x, j) => (j === i ? { ...x, price: ev.target.value } : x)) })} />
                </Field>
                <IconButton label={t('remove')} onClick={() => set({ equipment: form.equipment.filter((_, j) => j !== i) })}>
                  <Trash2 className="size-4" strokeWidth={1.5} />
                </IconButton>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" icon={<Plus className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => set({ equipment: [...form.equipment, { name: '', qty: '1', price: '' }] })}>
              {t('equipmentAdd')}
            </Button>
            {eqTotal > 0 && <span className="font-medium tabular">{t('equipmentTotal', { total: f.money(eqTotal) })}</span>}
          </div>
        </StepSection>
      )}

      {devOrgs.length > 0 && (
        <StepSection title={t('project')} hint={t('offPlanHint')} icon={Building2}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('project')}>
              <Select
                value={form.projectId}
                onChange={(e) => {
                  const p = myProjects.find((x) => x.id === e.target.value);
                  set({ projectId: e.target.value, completionDate: p?.completionDate ?? form.completionDate });
                }}
                options={[{ value: '', label: t('projectNone') }, ...myProjects.map((p) => ({ value: p.id, label: p.name }))]}
              />
            </Field>
            <Field label={t('completionDate')}>
              <Input type="date" value={form.completionDate} onChange={(e) => set({ completionDate: e.target.value })} />
            </Field>
          </div>
        </StepSection>
      )}

      <StepSection title={t('history')} hint={t('historyHint')} icon={History}>
        <ul className="flex flex-col gap-4">
          {form.history.map((h, i) => {
            const upd = (p: Partial<typeof h>) => set({ history: form.history.map((x, j) => (j === i ? { ...x, ...p } : x)) });
            return (
              <li key={i} className="grid gap-3 rounded-2xl border border-border bg-surface-2/50 p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,160px)_150px_150px_auto] lg:items-end">
                <Field label={t('historyName')}>
                  <Input value={h.businessName} maxLength={120} onChange={(e) => upd({ businessName: e.target.value })} />
                </Field>
                <Field label={t('historyType')}>
                  <Select value={h.businessType} onChange={(e) => upd({ businessType: e.target.value })} options={[{ value: '', label: t('historyNoType') }, ...types.map((b) => ({ value: b.slug, label: b.nameKa }))]} />
                </Field>
                <Field label={t('historyStart')}>
                  <Input type="date" value={h.startedAt} onChange={(e) => upd({ startedAt: e.target.value })} />
                </Field>
                <Field label={t('historyEnd')}>
                  <Input type="date" value={h.endedAt} onChange={(e) => upd({ endedAt: e.target.value })} />
                </Field>
                <IconButton label={t('remove')} onClick={() => set({ history: form.history.filter((_, j) => j !== i) })}>
                  <Trash2 className="size-4" strokeWidth={1.5} />
                </IconButton>
              </li>
            );
          })}
        </ul>
        <Button variant="secondary" className="w-fit" icon={<Plus className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => set({ history: [...form.history, { businessName: '', businessType: '', startedAt: '', endedAt: '', note: '' }] })}>
          {t('historyAdd')}
        </Button>
      </StepSection>
    </div>
  );
}

function PriceAdvice({ check }: { check: NonNullable<PriceCheck> | null }) {
  const t = useTranslations('wizard.price');
  const f = useFormat();
  const v = check?.verdict;
  const tone = v === 'above' ? { box: 'border-danger/30 bg-danger/[0.06]', tile: 'bg-danger/15 text-danger', Icon: TrendingUp, bar: 'bg-danger' } : v === 'below' ? { box: 'border-link/30 bg-link/[0.06]', tile: 'bg-link/15 text-link', Icon: TrendingDown, bar: 'bg-link' } : v === 'fair' ? { box: 'border-success/30 bg-success/[0.07]', tile: 'bg-success/15 text-success', Icon: Scale, bar: 'bg-success' } : { box: 'border-dashed border-border-strong bg-surface-2/50', tile: 'bg-surface-3 text-muted', Icon: Scale, bar: 'bg-border-strong' };
  const max = check ? Math.max(check.perM2Minor, check.districtAvgM2Minor) * 1.15 || 1 : 1;
  return (
    <div aria-live="polite" className={cn('rounded-card border p-5 transition-colors duration-300', tone.box)}>
      <div className="flex items-start gap-4">
        <span className={cn('grid size-11 shrink-0 place-items-center rounded-2xl', tone.tile)} aria-hidden>
          <tone.Icon className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-muted">{t('recommendation')}</div>
          {check ? (
            <>
              <div className={cn('mt-0.5 text-[17px] font-bold leading-snug', v === 'above' && 'text-danger')}>{check.messageKa}</div>
              <div className="mt-4 grid gap-2.5">
                {[
                  { label: t('yourPerM2'), value: check.perM2Minor, cls: tone.bar },
                  { label: t('districtPerM2'), value: check.districtAvgM2Minor, cls: 'bg-border-strong' },
                ].map((r) => (
                  <div key={r.label} className="grid grid-cols-[minmax(0,110px)_minmax(0,1fr)_auto] items-center gap-3 text-small sm:grid-cols-[150px_minmax(0,1fr)_auto]">
                    <span className="truncate text-muted">{r.label}</span>
                    <span className="h-2.5 overflow-hidden rounded-full bg-surface-3/70">
                      <span className={cn('block h-full rounded-full transition-all duration-500', r.cls)} style={{ width: `${Math.min(100, (r.value / max) * 100)}%` }} />
                    </span>
                    <span className="font-bold tabular">{f.money(r.value)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 inline-flex flex-wrap items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-small shadow-xs">
                <span className="text-muted">{t('recommendedShort')}</span>
                <span className="font-bold tabular">{f.money(check.recommendedMinor)}</span>
              </div>
            </>
          ) : (
            <div className="mt-0.5 text-[15px] text-muted">{t('noRecommendation')}</div>
          )}
        </div>
      </div>
    </div>
  );
}
