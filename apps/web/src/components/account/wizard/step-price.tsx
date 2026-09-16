'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Plus, Trash2, TrendingDown, TrendingUp, Scale } from 'lucide-react';
import { formatMoney, type SessionUser } from '@lokacia/contracts';
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
      <StepSection title={t('heading')}>
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
        {isLease && (
          <div aria-live="polite" className={cn('flex items-start gap-3 rounded-card border p-4', check?.verdict === 'above' ? 'border-danger/50' : check?.verdict === 'below' ? 'border-link/50' : 'border-border')}>
            {check?.verdict === 'above' ? <TrendingUp className="mt-0.5 size-5 shrink-0 text-danger" strokeWidth={1.5} aria-hidden /> : check?.verdict === 'below' ? <TrendingDown className="mt-0.5 size-5 shrink-0 text-link" strokeWidth={1.5} aria-hidden /> : <Scale className="mt-0.5 size-5 shrink-0 text-success" strokeWidth={1.5} aria-hidden />}
            <div className="min-w-0">
              <div className="text-small text-muted">{t('recommendation')}</div>
              {check ? (
                <>
                  <div className={cn('font-medium', check.verdict === 'above' && 'text-danger')}>{check.messageKa}</div>
                  <div className="mt-1 text-small text-muted tabular">
                    {t('recommended', { price: formatMoney(check.recommendedMinor) })} · {t('perM2', { price: formatMoney(check.perM2Minor) })}
                  </div>
                </>
              ) : (
                <div className="text-small text-muted">{t('noRecommendation')}</div>
              )}
            </div>
          </div>
        )}
      </StepSection>

      {form.dealType === 'short_term' && (
        <StepSection title={t('slots')} hint={t('slotsHint')}>
          {listingId ? <SlotsManager listingId={listingId} kind="short_term" defaultPriceMinor={money(form.priceDay) ?? money(form.priceHour)} /> : <p className="text-small text-muted">{t('slotsNeedDraft')}</p>}
        </StepSection>
      )}

      {form.dealType === 'transfer' && (
        <StepSection title={t('equipment')} hint={t('equipmentHint')}>
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
            {eqTotal > 0 && <span className="font-medium tabular">{t('equipmentTotal', { total: formatMoney(eqTotal) })}</span>}
          </div>
        </StepSection>
      )}

      {devOrgs.length > 0 && (
        <StepSection title={t('project')} hint={t('offPlanHint')}>
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

      <StepSection title={t('history')} hint={t('historyHint')}>
        <ul className="flex flex-col gap-4">
          {form.history.map((h, i) => {
            const upd = (p: Partial<typeof h>) => set({ history: form.history.map((x, j) => (j === i ? { ...x, ...p } : x)) });
            return (
              <li key={i} className="grid gap-2 rounded-card border border-border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,160px)_140px_140px_auto] sm:items-end sm:border-0 sm:p-0">
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
