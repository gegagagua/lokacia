'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { MapPin } from 'lucide-react';
import { Field, Input, Skeleton } from '@lokacia/ui';
import { StepSection } from './parts';
import type { WizardForm } from './types';

const MapView = dynamic(() => import('@lokacia/ui/map').then((m) => m.MapView), { ssr: false, loading: () => <Skeleton className="h-full w-full" /> });

export function StepLocation({ form, set, errors }: { form: WizardForm; set: (p: Partial<WizardForm>) => void; errors: Record<string, string> }) {
  const t = useTranslations('wizard.location');
  const [lookup, setLookup] = React.useState(false);
  const pin = React.useMemo(() => (form.lat != null && form.lng != null ? { lat: form.lat, lng: form.lng } : null), [form.lat, form.lng]);

  const move = React.useCallback(
    async (p: { lat: number; lng: number }) => {
      const lat = Math.round(p.lat * 1e6) / 1e6;
      const lng = Math.round(p.lng * 1e6) / 1e6;
      set({ lat, lng });
      setLookup(true);
      try {
        const r = await fetch(`/api/v1/geo/insights?lat=${lat}&lng=${lng}&radiusM=100`);
        const j = (await r.json()) as { district?: { id: string; name: string } | null };
        set({ districtId: j.district?.id ?? null, districtName: j.district?.name ?? null });
      } catch {
        set({ districtId: null, districtName: null });
      } finally {
        setLookup(false);
      }
    },
    [set],
  );

  return (
    <StepSection title={t('heading')} hint={t('mapHint')}>
      <div className="h-72 overflow-hidden rounded-card border border-border sm:h-96" aria-invalid={!!errors.pin || undefined}>
        <MapView className="h-full w-full" zoom={pin ? 15 : 12} draggablePin={pin} onPinMove={move} onMapClick={move} ariaLabel={t('mapLabel')} />
      </div>
      {errors.pin && (
        <p role="alert" className="-mt-3 text-small text-danger">
          {errors.pin}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('address')} required error={errors.address} className="sm:col-span-2">
          <Input value={form.address} placeholder={t('addressPlaceholder')} maxLength={200} autoComplete="street-address" onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-small font-medium">{t('district')}</span>
          <div className="flex h-10 items-center gap-2 rounded-button border border-border bg-surface-2 px-3 text-[15px]" aria-live="polite">
            <MapPin className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
            {lookup ? '…' : form.districtName ?? (pin ? t('districtUnknown') : <span className="text-muted">{t('districtAuto')}</span>)}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-small font-medium">{t('coords')}</span>
          <div className="flex h-10 items-center rounded-button border border-border bg-surface-2 px-3 text-small text-muted tabular">{pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : '—'}</div>
        </div>
        <Field label={t('area')} required error={errors.areaM2}>
          <Input type="number" inputMode="decimal" min={1} step={0.1} value={form.areaM2} onChange={(e) => set({ areaM2: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label={t('floor')}>
            <Input type="number" inputMode="numeric" min={-5} max={100} value={form.floor} onChange={(e) => set({ floor: e.target.value })} />
          </Field>
          <Field label={t('floorsTotal')}>
            <Input type="number" inputMode="numeric" min={1} max={100} value={form.floorsTotal} onChange={(e) => set({ floorsTotal: e.target.value })} />
          </Field>
        </div>
      </div>
    </StepSection>
  );
}
