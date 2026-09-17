'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Crosshair, Layers, MapPin, MousePointerClick, Navigation, Ruler } from 'lucide-react';
import { Field, Input, Skeleton, cn } from '@lokacia/ui';
import { InfoTile, StepSection } from './parts';
import type { WizardForm } from './types';
import { withBase } from '@/lib/base-path';

const MapView = dynamic(() => import('@lokacia/ui/map').then((m) => m.MapView), { ssr: false, loading: () => <Skeleton className="h-full w-full rounded-none" /> });

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
        const r = await fetch(withBase(`/api/v1/geo/insights?lat=${lat}&lng=${lng}&radiusM=100`));
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
    <StepSection title={t('heading')} hint={t('mapHint')} icon={MapPin}>
      <div className={cn('relative h-72 overflow-hidden rounded-card border shadow-sm sm:h-[420px]', errors.pin ? 'border-danger ring-2 ring-danger/30' : 'border-border')} aria-invalid={!!errors.pin || undefined}>
        <MapView className="h-full w-full" zoom={pin ? 15 : 12} draggablePin={pin} onPinMove={move} onMapClick={move} ariaLabel={t('mapLabel')} />
        {!pin && (
          <div className="pointer-events-none absolute inset-x-0 top-4 flex justify-center px-4">
            <span className="glass inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-[14px] font-semibold shadow-md">
              <MousePointerClick className="size-4 text-primary" strokeWidth={2} aria-hidden />
              {t('mapHint')}
            </span>
          </div>
        )}
      </div>
      {errors.pin && (
        <p role="alert" className="-mt-3 text-small font-medium text-danger">
          {errors.pin}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2" aria-live="polite">
        <InfoTile label={t('district')} icon={Layers}>
          {lookup ? '…' : form.districtName ?? (pin ? t('districtUnknown') : <span className="font-medium text-muted">{t('districtAuto')}</span>)}
        </InfoTile>
        <InfoTile label={t('coords')} icon={Crosshair}>
          <span className="tabular">{pin ? `${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}` : '—'}</span>
        </InfoTile>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label={t('address')} required error={errors.address} className="sm:col-span-2">
          <Input value={form.address} placeholder={t('addressPlaceholder')} maxLength={200} autoComplete="street-address" prefixIcon={<Navigation className="size-4" strokeWidth={2} aria-hidden />} onChange={(e) => set({ address: e.target.value })} />
        </Field>
        <Field label={t('area')} required error={errors.areaM2}>
          <Input type="number" inputMode="decimal" min={1} step={0.1} value={form.areaM2} prefixIcon={<Ruler className="size-4" strokeWidth={2} aria-hidden />} onChange={(e) => set({ areaM2: e.target.value })} />
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
