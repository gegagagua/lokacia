'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { LocateFixed, Route } from 'lucide-react';
import { formatNumber, type CrmRoute, type CrmViewing } from '@lokacia/contracts';
import { Badge, Button, Checkbox, EmptyState, Field, Input, Skeleton, Stat, useToast } from '@lokacia/ui';
import { errorMessage } from '@/lib/api-client';
import { useApi, useApiMutation } from '@/lib/swr';
import { timeHM } from './dates';

const MapView = dynamic(() => import('@lokacia/ui/map').then((m) => m.MapView), { ssr: false, loading: () => <Skeleton className="h-full min-h-72" /> });

/** Cadastral-drawing schematic of the ordered route: start point, numbered stops, blueprint polyline, leg lengths. */
function RouteSchema({ route, label }: { route: CrmRoute; label: string }) {
  const pts = [route.start, ...route.stops];
  const lats = pts.map((p) => p.lat!);
  const lngs = pts.map((p) => p.lng!);
  const [minLat, maxLat, minLng, maxLng] = [Math.min(...lats), Math.max(...lats), Math.min(...lngs), Math.max(...lngs)];
  const W = 480;
  const H = 300;
  const pad = 36;
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const spanX = Math.max((maxLng - minLng) * kx, 1e-6);
  const spanY = Math.max(maxLat - minLat, 1e-6);
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
  const xy = (p: { lat: number | null; lng: number | null }) => [pad + ((p.lng! - minLng) * kx) * scale + (W - pad * 2 - spanX * scale) / 2, H - pad - (p.lat! - minLat) * scale - (H - pad * 2 - spanY * scale) / 2] as const;
  const coords = pts.map(xy);
  return (
    <figure className="rounded-card border border-border bg-surface p-2">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="drawing-grid h-auto w-full rounded-[8px]">
        <polyline points={coords.map((c) => c.join(',')).join(' ')} fill="none" stroke="var(--c-blueprint)" strokeWidth={2} strokeLinejoin="round" />
        {route.stops.map((s, i) => {
          const [x1, y1] = coords[i]!;
          const [x2, y2] = coords[i + 1]!;
          return (
            <text key={`l${s.id}`} x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize={11} fill="var(--c-blueprint)" className="tabular">
              {formatNumber(s.legKm, 1)} კმ
            </text>
          );
        })}
        <rect x={coords[0]![0] - 6} y={coords[0]![1] - 6} width={12} height={12} fill="var(--bg)" stroke="var(--text)" strokeWidth={1.5} />
        {route.stops.map((s, i) => {
          const [x, y] = coords[i + 1]!;
          return (
            <g key={s.id}>
              <circle cx={x} cy={y} r={11} fill="var(--primary)" stroke="var(--bg)" strokeWidth={2} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--primary-contrast)">
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="px-1 pt-1 text-[12px] text-muted">{label}</figcaption>
    </figure>
  );
}

export function RouteView({ date, onDate, agentId, onOpen }: { date: string; onDate: (d: string) => void; agentId: string | null; onOpen: (v: CrmViewing) => void }) {
  const t = useTranslations('calendar.route');
  const toast = useToast();
  const mutate = useApiMutation();
  const [here, setHere] = React.useState<{ lat: number; lng: number } | null>(null);
  const [shift, setShift] = React.useState(true);
  const [dayStart, setDayStart] = React.useState('10:00');
  const [busy, setBusy] = React.useState(false);
  const qs = new URLSearchParams({ date });
  if (agentId) qs.set('agentId', agentId);
  if (here) {
    qs.set('startLat', String(here.lat));
    qs.set('startLng', String(here.lng));
  }
  const { data, isLoading, mutate: reload } = useApi<CrmRoute>(`/crm/viewings/route?${qs}`);

  const apply = async () => {
    if (!data?.stops.length) return;
    setBusy(true);
    try {
      await mutate('/crm/viewings/route/apply', { body: { order: data.stops.map((s) => s.id), shiftTimes: shift, dayStart } });
      toast({ title: t('applied'), tone: 'success' });
      await reload();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const saved = data ? Math.max(0, data.originalKm - data.totalKm) : 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('date')}>
          <Input type="date" value={date} onChange={(e) => onDate(e.target.value)} className="tabular" />
        </Field>
        <Button
          variant={here ? 'primary' : 'secondary'}
          icon={<LocateFixed className="size-4" strokeWidth={1.5} aria-hidden />}
          onClick={() => {
            if (here) return setHere(null);
            navigator.geolocation?.getCurrentPosition(
              (p) => setHere({ lat: p.coords.latitude, lng: p.coords.longitude }),
              () => toast({ title: t('startFirst') }),
            );
          }}
        >
          {here ? t('startHere') : `${t('start')}: ${t('startFirst')}`}
        </Button>
      </div>
      {isLoading && <Skeleton className="h-64" />}
      {data && data.stops.length === 0 && data.unlocated.length === 0 && <EmptyState icon={<Route className="size-5" strokeWidth={1.5} aria-hidden />} title={t('empty')} />}
      {data && data.stops.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Stat label={t('total')} value={`${formatNumber(data.totalKm, 1)} ${t('km')}`} />
            <Stat label={t('before')} value={`${formatNumber(data.originalKm, 1)} ${t('km')}`} />
            <Stat label={t('saved')} value={`${formatNumber(saved, 1)} ${t('km')}`} className="col-span-2 md:col-span-1" />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <ol className="flex min-w-0 flex-col divide-y divide-border rounded-card border border-border bg-surface">
              {data.stops.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => onOpen(s)} className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-surface-2">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-small font-semibold text-primary-contrast tabular">{s.order}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{s.title}</span>
                      <span className="block truncate text-small text-muted">{s.address ?? '—'}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-muted tabular">
                        <span>
                          {t('leg')}: {formatNumber(s.legKm, 1)} {t('km')}
                        </span>
                        <span>
                          {t('suggested')}: {timeHM(s.suggestedStart)}
                        </span>
                      </span>
                    </span>
                    <span className="text-small tabular text-muted">{timeHM(s.startsAt)}</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="flex flex-col gap-3">
              <div className="h-72 lg:h-80">
                <MapView ariaLabel={t('map')} points={data.stops.map((s) => ({ id: s.id, lat: s.lat!, lng: s.lng!, label: String(s.order), title: s.title }))} fitToPoints onPointClick={(id) => { const s = data.stops.find((x) => x.id === id); if (s) onOpen(s); }} />
              </div>
              <RouteSchema route={data} label={t('schema')} />
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-3">
            <Checkbox checked={shift} onCheckedChange={(v) => setShift(v === true)} label={t('shiftTimes')} />
            {shift && (
              <Field label={t('dayStart')}>
                <Input type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value)} step={300} className="w-32 tabular" />
              </Field>
            )}
            <Button onClick={apply} loading={busy} icon={<Route className="size-4" strokeWidth={1.5} aria-hidden />} className="ml-auto">
              {t('optimize')}
            </Button>
          </div>
        </>
      )}
      {data && data.unlocated.length > 0 && (
        <div className="rounded-card border border-dashed border-border-strong p-3">
          <div className="mb-2 text-small text-muted">{t('unlocated')}</div>
          <div className="flex flex-wrap gap-2">
            {data.unlocated.map((v) => (
              <Badge key={v.id} tone="outline" className="cursor-pointer" onClick={() => onOpen(v)}>
                {timeHM(v.startsAt)} {v.title}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
