'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import type { ScanDto } from '@lokacia/contracts';
import { Button, SpacePlan } from '@lokacia/ui';

const ScanViewer = dynamic(() => import('./scan-viewer'), { ssr: false, loading: () => <div className="h-[320px] w-full animate-pulse rounded-photo bg-surface-2 md:h-[420px]" /> });

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
    <div className="grid gap-4 md:grid-cols-[1fr_320px]">
      <div>
        {viewable && show3d && !failed ? (
          <ScanViewer key={scan.id} scan={scan} onError={onError} />
        ) : (
          <div className="grid h-[320px] place-items-center rounded-photo border border-border bg-surface-2 p-4 text-center md:h-[420px]">
            <div className="flex flex-col items-center gap-3">
              <p className="text-muted">{failed ? t('failed') : scan.format === 'usdz' ? t('usdz') : t('hidden')}</p>
              <Button asChild variant="secondary" size="sm">
                <a href={scan.url} download rel="noopener">
                  {t('download', { format: scan.format.toUpperCase() })}
                </a>
              </Button>
            </div>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-small text-muted">
          {viewable && !failed && (
            <button type="button" className="text-link hover:underline" onClick={() => setShow3d((s) => !s)}>
              {show3d ? t('hide3d') : t('show3d')}
            </button>
          )}
          <span>{t('hint')}</span>
          {scans.length > 1 &&
            scans.map((s, i) => (
              <button key={s.id} type="button" onClick={() => { setIdx(i); setFailed(false); }} aria-pressed={i === idx} className="rounded-button border border-border px-2 py-0.5">
                {i + 1}
              </button>
            ))}
        </div>
      </div>
      {scan.plan && (
        <div className="rounded-card border border-border bg-surface p-3">
          <div className="mb-2 text-small font-medium">{t('plan')}</div>
          <SpacePlan widthM={scan.plan.widthM} depthM={scan.plan.depthM} areaM2={scan.plan.areaM2 || areaM2} outline={scan.plan.outline} />
          <p className="mt-2 text-small text-muted">{t('planHint')}</p>
        </div>
      )}
    </div>
  );
}
