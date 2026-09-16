'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { ADMIN_SETTINGS, formatMoney, type AdminSettingKey, type PlanDto } from '@lokacia/contracts';
import { Badge, Button, Field, Input, Switch, Textarea } from '@lokacia/ui';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { useIsAdmin } from '@/lib/session-context';
import { PageHeader, Section } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';

type SettingsResponse = { values: Record<string, unknown>; promoActive: boolean; plans: PlanDto[] };

function SettingsForm({ data, onSaved, readOnly }: { data: SettingsResponse; onSaved: () => void; readOnly: boolean }) {
  const t = useTranslations('settings');
  const keys = Object.keys(ADMIN_SETTINGS) as AdminSettingKey[];
  const [values, setValues] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(keys.map((k) => [k, data.values[k] === null || data.values[k] === undefined ? '' : String(data.values[k]).slice(0, ADMIN_SETTINGS[k].kind === 'date' ? 10 : undefined)])),
  );
  const { run, busy } = useAction();
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
  return (
    <form onSubmit={save}>
      <div className="grid gap-4 md:grid-cols-2">
        {keys.map((k) => {
          const def = ADMIN_SETTINGS[k];
          return (
            <Field key={k} label={def.labelKa} hint={k === 'launch_promo_until' ? (data.promoActive ? t('promoActive') : t('promoInactive')) : undefined}>
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
        })}
      </div>
      {!readOnly && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="submit" loading={busy}>
            {t('saveSettings')}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setValues((v) => ({ ...v, launch_promo_until: '' }))}>
            {t('endPromo')}
          </Button>
        </div>
      )}
    </form>
  );
}

function PlanRow({ plan, onSaved, readOnly }: { plan: PlanDto; onSaved: () => void; readOnly: boolean }) {
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
  if (!edit)
    return (
      <tr className="border-b border-border align-top last:border-b-0">
        <td className="px-3 py-2">
          <div className="font-medium">{plan.nameKa}</div>
          <div className="font-mono text-[12px] text-muted">{plan.key}</div>
        </td>
        <td className="px-3 py-2 text-small">
          {t(`audience.${plan.audience}`)} · {plan.kind === 'subscription' ? t('subscription') : t('oneTime')}
        </td>
        <td className="px-3 py-2 text-right font-medium">{formatMoney(plan.priceMinor)}</td>
        <td className="px-3 py-2 text-right">{plan.days ?? '—'}</td>
        <td className="px-3 py-2 text-small text-muted">{plan.features.join(' · ')}</td>
        <td className="px-3 py-2">
          <Switch aria-label={t('active')} checked={plan.active} disabled={readOnly || busy} onCheckedChange={(v) => patch({ active: v })} />
        </td>
        <td className="px-3 py-2 text-right">
          {!readOnly && (
            <Button size="sm" variant="ghost" onClick={() => setEdit(true)}>
              {t('editPlan')}
            </Button>
          )}
        </td>
      </tr>
    );
  return (
    <tr className="border-b border-border bg-surface-2 align-top last:border-b-0">
      <td colSpan={7} className="px-3 py-3">
        <form
          className="grid gap-3 md:grid-cols-[2fr_1fr_1fr]"
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
          <Field label={t('priceGel')}>
            <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} suffix="₾" className="tabular" required />
          </Field>
          <Field label={t('days')}>
            <Input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} className="tabular" />
          </Field>
          <Field label={t('features')} hint={t('featuresHint')} className="md:col-span-3">
            <Textarea rows={3} value={features} onChange={(e) => setFeatures(e.target.value)} />
          </Field>
          <div className="flex gap-2 md:col-span-3">
            <Button type="submit" size="sm" loading={busy}>
              {t('savePlan')}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setEdit(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </td>
    </tr>
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
      <PageHeader title={t('title')} subtitle={t('subtitle')} actions={data.promoActive ? <Badge tone="accent">{t('promoBadge')}</Badge> : undefined} />
      {readOnly && <p className="mb-4 rounded-card border border-border bg-surface-2 px-4 py-2 text-small">{t('readOnly')}</p>}
      <div className="flex flex-col gap-4">
        <Section title={t('runtime')}>
          <SettingsForm key={JSON.stringify(data.values)} data={data} onSaved={() => mutate()} readOnly={readOnly} />
        </Section>
        <Section title={t('plans')}>
          <p className="mb-3 text-small text-muted">{t('plansHint')}</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-[14px] tabular">
              <thead>
                <tr className="border-b border-border-strong text-small text-muted">
                  <th scope="col" className="px-3 py-2 font-medium">{t('planName')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('type')}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t('price')}</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">{t('days')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('features')}</th>
                  <th scope="col" className="px-3 py-2 font-medium">{t('active')}</th>
                  <th scope="col" className="px-3 py-2">
                    <span className="sr-only">{t('editPlan')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.plans.map((p) => (
                  <PlanRow key={`${p.key}-${p.priceMinor}-${p.nameKa}-${p.active}`} plan={p} onSaved={() => mutate()} readOnly={readOnly} />
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>
    </>
  );
}
