'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { SCAN_FORMATS, type ScanDto, type ScanFormat } from '@lokacia/contracts';
import { useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError, uploadFile } from '@/lib/api-client';

/** V5: owner uploads a 3D scan (GLB/GLTF/OBJ/USDZ/PLY); the API generates the floor plan. Mount on listing management pages. */
export function ScanUpload({ listingId, onUploaded }: { listingId: string; onUploaded?: (scan: ScanDto) => void }) {
  const t = useTranslations('v2.scanUpload');
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const inputId = React.useId();
  const onFile = async (file: File) => {
    const ext = (file.name.split('.').pop() ?? '').toLowerCase() as ScanFormat;
    if (!(SCAN_FORMATS as readonly string[]).includes(ext)) {
      toast({ title: t('badFormat'), tone: 'danger' });
      return;
    }
    setBusy(true);
    try {
      const mediaId = await uploadFile(file, { kind: 'document', listingId, onProgress: setProgress });
      const scan = await apiFetch<ScanDto>(`/v2/listings/${listingId}/scans`, { method: 'POST', body: { mediaId, format: ext } });
      toast({ title: t('done'), tone: 'success' });
      onUploaded?.(scan);
    } catch (e) {
      toast({ title: t('error'), description: e instanceof ClientApiError ? e.message : undefined, tone: 'danger' });
    } finally {
      setBusy(false);
      setProgress(0);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-card border border-dashed border-border-strong p-4">
      <label htmlFor={inputId} className="font-medium">
        {t('label')}
      </label>
      <p className="text-small text-muted">{t('hint')}</p>
      <input id={inputId} type="file" accept=".glb,.gltf,.obj,.usdz,.ply" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="text-small" />
      {busy && (
        <p className="text-small text-muted" aria-live="polite">
          {t('uploading', { pct: progress })}
        </p>
      )}
      <p className="text-small tabular text-muted">{SCAN_FORMATS.map((f) => f.toUpperCase()).join(' · ')}</p>
    </div>
  );
}
