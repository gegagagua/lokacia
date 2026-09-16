'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { CalendarClock, Check, Gift, Lock, Package, Pencil, Percent, Settings, SlidersHorizontal, Timer } from 'lucide-react';
import { ADMIN_SETTINGS, formatMoney, type AdminSettingKey, type PlanDto } from '@lokacia/contracts';
import { Button, Field, Input, Switch, Textarea, cn } from '@lokacia/ui';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { useIsAdmin } from '@/lib/session-context';
import { PageHeader, Section } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { StatusPill } from '@/components/kit';

type SettingsResponse = { values: Record<string, unknown>; promoActive: boolean; plans: PlanDto[] };

const GROUPS: { key: 'groupTiming' | 'groupMoney'; icon: React.ElementType; keys: AdminSettingKey[] }[] = [
  { key: 'groupTiming', icon: Timer, keys: ['liveness_interval_days', 'liveness_grace_hours', 'billing_grace_hours', 'demand_expiry_days', 'reveal_rate_limit_per_hour'] },
  { key: 'groupMoney', icon: Percent, keys: ['services_commission_pct', 'transfer_commission_pct', 'finance_default_commission_pct', 'vat_pct'] },
];

function SettingsForm({ data, onSaved, readOnly }: { data: SettingsResponse; onSaved: () => void; readOnly: boolean }) {
  const t = useTranslations('settings');
  const keys = Object.keys(ADMIN_SETTINGS) as AdminSettingKey[];
  const initial = React.useMemo(
    () => Object.fromEntries(keys.map((k) => [k, data.values[k] === null || data.values[k] === undefined ? '' : String(data.values[k]).slice(0, ADMIN_SETTINGS[k].kind === 'date' ? 10 : undefined)])) as Record<string, string>,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data],
  );
  const [values, setValues] = React.useState<Record<string, string>>(initial);
  const { run, busy } = useAction();
  const dirty = keys.some((k) => (values[k] ?? '') !== (initial[k] ?? ''));
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    for (const k of keys) {
      const raw = values[k] ?? '';
      if (ADMIN_SETTINGS[k].kind === 'date') body[k] = raw === '' ? null : raw;
      else if (raw !== '') body[k] = Number(raw);
    }
    if (await run(() => apiFetch('/admin/settings', { method: 'PATCH', body }), t('saved'))) onSaved();
  };
  const grouped = new Set(GROUPS.flatMap((g) => g.keys).concat(['launch_promo_until']));
  const other = keys.filter((k) => !grouped.has(k));
  const input = (k: AdminSettingKey) => {
    const def = ADMIN_SETTINGS[k];
    return (
      <Field key={k} label={def.labelKa}>
        <Input
          type={def.kind === 'date' ? 'date' : 'number'}
          step={def.kind === 'number' ? 'any' : undefined}
          min={def.kind === 'number' ? 0 : undefined}
          value={values[k] ?? ''}
          disabled={readOnly}
          onChange={(e) => setValues((v) => ({ ...v, [k]: e.target.value }))}
          className="tabular"
        />
      </Field>
    );
  };
  return (
    <form onSubmit={save} className="flex flex-col gap-5">
      {/* promo band */}
      <section className="hero-gradient relative overflow-hidden rounded-card p-5 shadow-md md:p-7" aria-labelledby="promo-title">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 size-60 rounded-full bg-[#f7d67a]/15 blur-2xl" />
        <div className="relative grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,340px)] md:items-end">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-white/10 text-[#f7d67a] ring-1 ring-inset ring-white/15">
                <Gift className="size-5" strokeWidth={2} aria-hidden />
              </span>
              <h2 id="promo-title" className="text-[20px] font-bold text-white md:text-[24px]">
                {t('groupPromo')}
              </h2>
            </div>
            <p className="mt-3 max-w-xl text-[15px] text-white/80">{t('groupPromoHint')}</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[14px] font-semibold text-white ring-1 ring-inset ring-white/15">
              <span className={cn('size-2 rounded-full', data.promoActive ? 'bg-[#7ee0c0]' : 'bg-white/40')} aria-hidden />
              {data.promoActive ? t('promoActive') : t('promoInactive')}
            </div>
          </div>
          <div className="rounded-2xl bg-surface p-4 text-text shadow-lg">
            <Field label={ADMIN_SETTINGS.launch_promo_until.labelKa}>
              <Input type="date" value={values.launch_promo_until ?? ''} disabled={readOnly} onChange={(e) => setValues((v) => ({ ...v, launch_promo_until: e.target.value }))} className="tabular" />
            </Field>
            {!readOnly && (
              <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" icon={<CalendarClock className="size-4" strokeWidth={2} aria-hidden />} onClick={() => setValues((v) => ({ ...v, launch_promo_until: '' }))}>
                {t('endPromo')}
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <Section key={g.key} icon={g.icon} title={t(g.key)}>
            <div className="grid gap-4">{g.keys.filter((k) => k in ADMIN_SETTINGS).map(input)}</div>
          </Section>
        ))}
      </div>
      {other.length > 0 && (
        <Section icon={SlidersHorizontal} title={t('groupOther')}>
          <div className="grid gap-4 md:grid-cols-2">{other.map(input)}</div>
        </Section>
      )}

      {!readOnly && dirty && (
        <div className={cn('sticky bottom-4 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface/95 px-4 py-3 shadow-lg backdrop-blur transition-opacity', !dirty && 'opacity-90')}>
          <span className="text-[14.5px] font-medium text-muted">{t('unsaved')}</span>
          <Button type="submit" loading={busy} icon={<Check className="size-4" strokeWidth={2} aria-hidden />}>
            {t('saveSettings')}
          </Button>
        </div>
      )}
    </form>
  );
}

function PlanCard({ plan, onSaved, readOnly }: { plan: PlanDto; onSaved: () => void; readOnly: boolean }) {
  const t = useTranslations('settings');
  const [edit, setEdit] = React.useState(false);
  const [name, setName] = React.useState(plan.nameKa);
  const [price, setPrice] = React.useState(String(plan.priceMinor / 100));
  const [days, setDays] = React.useState(plan.days ? String(plan.days) : '');
  const [features, setFeatures] = React.useState(plan.features.join('\n'));
  const { run, busy } = useAction();
  const patch = async (body: Record<string, unknown>) => {
    if (await run(() => apiFetch(`/admin/plans/${plan.key}`, { method: 'PATCH', body }), t('planSaved'))) {
      setEdit(false);
      onSaved();
    }
  };
  return (
    <article className={cn('card flex min-w-0 flex-col overflow-hidden transition-all', !plan.active && !edit && 'opacity-70', edit && 'ring-2 ring-primary')}>
      <div className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-1.5">
            <StatusPill tone="primary" dot={false}>
              {t(`audience.${plan.audience}`)}
            </StatusPill>
            <StatusPill tone={plan.kind === 'subscription' ? 'info' : 'neutral'} dot={false}>
              {plan.kind === 'subscription' ? t('subscription') : t('oneTime')}
            </StatusPill>
          </div>
          <h3 className="mt-3 text-[18px] font-bold leading-snug">{plan.nameKa}</h3>
          <div className="font-mono text-[12.5px] text-muted">{plan.key}</div>
        </div>
        <Switch aria-label={`${t('active')}: ${plan.nameKa}`} checked={plan.active} disabled={readOnly || busy} onCheckedChange={(v) => patch({ active: v })} />
      </div>
      {edit ? (
        <form
          className="grid gap-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            void patch({
              nameKa: name,
              priceMinor: Math.round(Number(price.replace(',', '.')) * 100),
              days: days === '' ? null : Number(days),
              features: features.split('\n').map((f) => f.trim()).filter(Boolean),
            });
          }}
        >
          <Field label={t('planName')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('priceGel')}>
              <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} suffix="₾" className="tabular" required />
            </Field>
            <Field label={t('days')}>
              <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} className="tabular" />
            </Field>
          </div>
          <Field label={t('features')} hint={t('featuresHint')}>
            <Textarea rows={4} value={features} onChange={(e) => setFeatures(e.target.value)} />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" size="sm" loading={busy} className="flex-1">
              {t('savePlan')}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setEdit(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="px-5 pt-4">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[30px] font-bold leading-none tracking-tight tabular">{formatMoney(plan.priceMinor)}</span>
              <span className="text-small text-muted">{plan.days ? t('perDays', { days: plan.days }) : t('noDays')}</span>
            </div>
          </div>
          <ul className="flex flex-1 flex-col gap-2 px-5 py-4">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[14.5px]">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary-soft text-primary-soft-text">
                  <Check className="size-3" strokeWidth={3} aria-hidden />
                </span>
                {f}
              </li>
            ))}
          </ul>
          {!readOnly && (
            <div className="border-t border-border bg-surface-2/40 px-5 py-3">
              <Button size="sm" variant="secondary" className="w-full" icon={<Pencil className="size-4" strokeWidth={2} aria-hidden />} onClick={() => setEdit(true)} aria-label={`${t('editPlan')}: ${plan.nameKa}`}>
                {t('editPlan')}
              </Button>
            </div>
          )}
        </>
      )}
    </article>
  );
}

export function SettingsView() {
  const t = useTranslations('settings');
  const isAdmin = useIsAdmin();
  const { data, error, mutate } = useSWR<SettingsResponse>('/admin/settings', fetcher);
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock rows={10} />;
  const readOnly = !isAdmin;
  return (
    <>
      <PageHeader
        icon={Settings}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          data.promoActive ? (
            <StatusPill tone="accent" pulse>
              {t('promoBadge')}
            </StatusPill>
          ) : undefined
        }
      />
      {readOnly && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-[15px]" role="status">
          <Lock className="size-5 shrink-0 text-muted" strokeWidth={2} aria-hidden />
          {t('readOnly')}
        </div>
      )}
      <SettingsForm key={JSON.stringify(data.values)} data={data} onSaved={() => mutate()} readOnly={readOnly} />

      <div className="mb-5 mt-12 flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary-soft text-primary-soft-text">
            <Package className="size-5" strokeWidth={2} aria-hidden />
          </span>
          <div>
            <h2 className="text-[22px] font-bold tracking-tight">{t('plans')}</h2>
            <p className="text-small text-muted">{t('plansHint')}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data.plans.map((p) => (
          <PlanCard key={`${p.key}-${p.priceMinor}-${p.nameKa}-${p.active}`} plan={p} onSaved={() => mutate()} readOnly={readOnly} />
        ))}
      </div>
    </>
  );
}
