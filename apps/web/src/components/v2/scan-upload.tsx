'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Box, UploadCloud } from 'lucide-react';
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
    <div className="rounded-card border-2 border-dashed border-border-strong bg-surface-2/50 p-5 transition-colors has-[:focus-visible]:border-primary">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-link/10 text-link">
          <Box className="size-6" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <label htmlFor={inputId} className="font-semibold">
            {t('label')}
          </label>
          <p className="mt-0.5 text-small text-muted">{t('hint')}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SCAN_FORMATS.map((f) => (
              <span key={f} className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[11.5px] font-semibold text-muted ring-1 ring-border">
                {f.toUpperCase()}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-button bg-surface px-4 text-[15px] font-semibold shadow-xs ring-1 ring-border">
          <UploadCloud className="size-4" strokeWidth={2} aria-hidden />
          <input id={inputId} type="file" accept=".glb,.gltf,.obj,.usdz,.ply" disabled={busy} onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} className="text-small file:hidden" />
        </span>
        {busy && (
          <div className="flex min-w-40 flex-1 items-center gap-2" aria-live="polite">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-small text-muted tabular">{t('uploading', { pct: progress })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
