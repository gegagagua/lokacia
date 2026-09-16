'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Clock3, Gauge, LocateFixed, MapPin, MapPinOff, Milestone, Navigation, Route, TrendingDown } from 'lucide-react';
import { formatNumber, type CrmRoute, type CrmViewing } from '@lokacia/contracts';
import { Button, Checkbox, EmptyState, Field, Input, Skeleton, useToast } from '@lokacia/ui';
import { IconTile, PersonAvatar, SectionCard, StatCard } from '@/components/common/ui';
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
    <figure className="card p-2.5">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="drawing-grid h-auto w-full rounded-2xl">
        <polyline points={coords.map((c) => c.join(',')).join(' ')} fill="none" stroke="var(--tone-2)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="1 7" />
        {route.stops.map((s, i) => {
          const [x1, y1] = coords[i]!;
          const [x2, y2] = coords[i + 1]!;
          return (
            <text key={`l${s.id}`} x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--tone-2)" className="tabular">
              {formatNumber(s.legKm, 1)} კმ
            </text>
          );
        })}
        <circle cx={coords[0]![0]} cy={coords[0]![1]} r={8} fill="var(--surface)" stroke="var(--text)" strokeWidth={2.5} />
        {route.stops.map((s, i) => {
          const [x, y] = coords[i + 1]!;
          return (
            <g key={s.id}>
              <circle cx={x} cy={y} r={13} fill="var(--primary)" stroke="var(--surface)" strokeWidth={3} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--primary-contrast)">
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="px-1.5 pt-2 text-[12.5px] font-medium text-muted">{label}</figcaption>
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
      <div className="card flex flex-wrap items-end gap-3 p-3">
        <Field label={t('date')}>
          <Input type="date" value={date} onChange={(e) => onDate(e.target.value)} className="tabular" />
        </Field>
        <Button
          variant={here ? 'primary' : 'secondary'}
          icon={<LocateFixed className="size-4" strokeWidth={2} aria-hidden />}
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
      {isLoading && <Skeleton className="h-64 rounded-card" />}
      {data && data.stops.length === 0 && data.unlocated.length === 0 && <EmptyState icon={<Route className="size-6" strokeWidth={2} aria-hidden />} title={t('empty')} />}
      {data && data.stops.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatCard icon={Route} tone={2} label={t('total')} value={`${formatNumber(data.totalKm, 1)} ${t('km')}`} />
            <StatCard icon={Gauge} tone={8} label={t('before')} value={`${formatNumber(data.originalKm, 1)} ${t('km')}`} />
            <StatCard icon={TrendingDown} tone="success" label={t('saved')} value={`${formatNumber(saved, 1)} ${t('km')}`} className="col-span-2 md:col-span-1" />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <SectionCard title={t('stops')} icon={Milestone} tone={2} bodyClassName="pt-2" className="self-start">
              <ol className="flex flex-col">
                <li className="flex items-center gap-3 pb-1">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-text bg-surface" aria-hidden>
                    <Navigation className="size-4" strokeWidth={2.2} />
                  </span>
                  <span className="text-small font-semibold text-muted">{here ? t('startHere') : t('startFirst')}</span>
                </li>
                {data.stops.map((s) => (
                  <li key={s.id} className="relative">
                    <div className="ml-[17px] flex items-center gap-2 border-l-2 border-dashed border-tone-soft py-1.5 pl-5 text-[12px] font-semibold text-muted tabular tone-2">
                      <Route className="size-3.5 text-tone" strokeWidth={2} aria-hidden />
                      {t('leg')}: {formatNumber(s.legKm, 1)} {t('km')}
                    </div>
                    <button type="button" onClick={() => onOpen(s)} className="flex w-full items-start gap-3 rounded-2xl p-1 text-left transition-colors hover:bg-surface-2 focus-visible:shadow-ring focus-visible:outline-none">
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-[14px] font-bold text-primary-contrast shadow-sm ring-4 ring-primary-soft tabular">{s.order}</span>
                      <span className="min-w-0 flex-1 pt-0.5">
                        <span className="block truncate font-semibold">{s.title}</span>
                        <span className="flex items-center gap-1 truncate text-small text-muted">
                          <MapPin className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                          <span className="truncate">{s.address ?? '—'}</span>
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12px] tabular">
                          <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 font-semibold">
                            <Clock3 className="size-3" strokeWidth={2.2} aria-hidden />
                            {timeHM(s.startsAt)}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-semibold">
                            {t('suggested')}: {timeHM(s.suggestedStart)}
                          </span>
                        </span>
                      </span>
                      {s.agentName && (
                        <span title={s.agentName} className="pt-1">
                          <PersonAvatar name={s.agentName} size={26} />
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ol>
            </SectionCard>
            <div className="flex min-w-0 flex-col gap-4">
              <div className="card overflow-hidden p-1.5">
                <div className="h-72 overflow-hidden rounded-2xl lg:h-80">
                  <MapView ariaLabel={t('map')} points={data.stops.map((s) => ({ id: s.id, lat: s.lat!, lng: s.lng!, label: String(s.order), title: s.title }))} fitToPoints onPointClick={(id) => { const s = data.stops.find((x) => x.id === id); if (s) onOpen(s); }} />
                </div>
              </div>
              <RouteSchema route={data} label={t('schema')} />
            </div>
          </div>
          <div className="card flex flex-wrap items-center gap-3 p-3.5">
            <IconTile icon={Route} tone="primary" className="hidden sm:grid" />
            <Checkbox checked={shift} onCheckedChange={(v) => setShift(v === true)} label={t('shiftTimes')} />
            {shift && (
              <Field label={t('dayStart')}>
                <Input type="time" value={dayStart} onChange={(e) => setDayStart(e.target.value)} step={300} className="w-32 tabular" />
              </Field>
            )}
            <Button onClick={apply} loading={busy} icon={<Route className="size-4" strokeWidth={2} aria-hidden />} className="sm:ml-auto">
              {t('optimize')}
            </Button>
          </div>
        </>
      )}
      {data && data.unlocated.length > 0 && (
        <div className="rounded-card border border-dashed border-border-strong bg-surface/60 p-4">
          <div className="mb-2.5 flex items-center gap-2 text-small font-medium text-muted">
            <MapPinOff className="size-4" strokeWidth={2} aria-hidden />
            {t('unlocated')}
          </div>
          <div className="flex flex-wrap gap-2">
            {data.unlocated.map((v) => (
              <button key={v.id} type="button" onClick={() => onOpen(v)} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[13px] font-medium shadow-xs hover:border-border-strong">
                <span className="tabular text-muted">{timeHM(v.startsAt)}</span> {v.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
