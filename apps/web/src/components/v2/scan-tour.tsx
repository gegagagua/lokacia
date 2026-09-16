'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { Download, Eye, EyeOff, Ruler } from 'lucide-react';
import type { ScanDto } from '@lokacia/contracts';
import { Button, cn, SpacePlan } from '@lokacia/ui';

const ScanViewer = dynamic(() => import('./scan-viewer'), { ssr: false, loading: () => <div className="h-[320px] w-full animate-pulse rounded-photo bg-surface-2 md:h-[440px]" /> });

/** V5: 3D tour (three.js) with floor-plan fallback generated from the scan. */
export function ScanTour({ scans, areaM2 }: { scans: ScanDto[]; areaM2: number }) {
  const t = useTranslations('v2.tour');
  const [idx, setIdx] = React.useState(0);
  const [failed, setFailed] = React.useState(false);
  const [show3d, setShow3d] = React.useState(true);
  const scan = scans[idx]!;
  const onError = React.useCallback(() => setFailed(true), []);
  const viewable = scan.format !== 'usdz';
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <div className="relative">
          {viewable && show3d && !failed ? (
            <ScanViewer key={scan.id} scan={scan} onError={onError} />
          ) : (
            <div className="drawing-grid grid h-[320px] place-items-center rounded-photo border border-border p-4 text-center md:h-[440px]">
              <div className="flex flex-col items-center gap-3">
                <p className="max-w-xs text-muted">{failed ? t('failed') : scan.format === 'usdz' ? t('usdz') : t('hidden')}</p>
                <Button asChild variant="secondary" size="sm">
                  <a href={scan.url} download rel="noopener">
                    <Download className="size-4" strokeWidth={2} aria-hidden />
                    {t('download', { format: scan.format.toUpperCase() })}
                  </a>
                </Button>
              </div>
            </div>
          )}
          <span className="pointer-events-none absolute left-3 top-3 inline-flex h-7 items-center rounded-full bg-surface/90 px-2.5 font-mono text-[12px] font-semibold text-text shadow-xs backdrop-blur">{scan.format.toUpperCase()}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {viewable && !failed && (
            <Button size="sm" variant="secondary" onClick={() => setShow3d((s) => !s)} icon={show3d ? <EyeOff className="size-4" strokeWidth={2} aria-hidden /> : <Eye className="size-4" strokeWidth={2} aria-hidden />}>
              {show3d ? t('hide3d') : t('show3d')}
            </Button>
          )}
          {scans.length > 1 && (
            <div className="flex gap-1 rounded-full bg-surface-2 p-1">
              {scans.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setIdx(i);
                    setFailed(false);
                  }}
                  aria-pressed={i === idx}
                  className={cn('size-8 rounded-full text-small font-semibold tabular transition-all focus-visible:shadow-ring focus-visible:outline-none', i === idx ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text')}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {scan.plan && (
        <div className="flex flex-col self-start rounded-2xl border border-border bg-surface-2/60 p-4">
          <div className="mb-3 flex items-center gap-2 text-small font-semibold">
            <Ruler className="size-4 text-primary-soft-text" strokeWidth={2} aria-hidden />
            {t('plan')}
          </div>
          <div className="rounded-xl bg-surface p-2">
            <SpacePlan widthM={scan.plan.widthM} depthM={scan.plan.depthM} areaM2={scan.plan.areaM2 || areaM2} outline={scan.plan.outline} />
          </div>
          <p className="mt-3 text-small text-muted">{t('planHint')}</p>
        </div>
      )}
    </div>
  );
}
