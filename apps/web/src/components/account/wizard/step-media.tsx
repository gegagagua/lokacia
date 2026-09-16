'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Orbit, Ruler, Sparkles } from 'lucide-react';
import { Button, Field, FileUpload, Input, useToast, type UploadItem } from '@lokacia/ui';
import { apiFetch, ClientApiError, uploadFile } from '@/lib/api-client';
import { StepSection } from './parts';
import type { MediaEntry, WizardForm } from './types';

type MediaResponse = { id: string; url: string; kind: MediaEntry['kind']; status: MediaEntry['status']; isFloorplan: boolean; variants: Record<string, string> | null };
const preview = (m: MediaResponse) => m.variants?.sm ?? m.variants?.md ?? m.url;

export function StepMedia({ form, update, listingId, errors }: { form: WizardForm; update: (fn: (f: WizardForm) => Partial<WizardForm>) => void; listingId: string | null; errors: Record<string, string> }) {
  const t = useTranslations('wizard.media');
  const toast = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const pano = React.useRef<HTMLInputElement>(null);
  // dnd-kit generates ids that differ between server and client render → mount the sortable grid on the client only
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const patchEntry = React.useCallback((id: string, p: Partial<MediaEntry>) => update((f) => ({ media: f.media.map((m) => (m.id === id ? { ...m, ...p } : m)) })), [update]);

  const poll = React.useCallback(
    async (id: string) => {
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, i < 5 ? 800 : 2000));
        try {
          const m = await apiFetch<MediaResponse>(`/media/${id}`);
          if (m.status === 'ready' || m.status === 'failed') {
            patchEntry(id, { status: m.status, url: `${preview(m)}${preview(m).includes('?') ? '&' : '?'}t=${Date.now()}`, kind: m.kind, isFloorplan: m.isFloorplan });
            return;
          }
        } catch {
          /* keep polling */
        }
      }
    },
    [patchEntry],
  );

  const upload = async (files: File[], kind: MediaEntry['kind']) => {
    for (const file of files) {
      const tmp = `tmp-${Math.random().toString(36).slice(2)}`;
      const local = URL.createObjectURL(file);
      update((f) => ({ media: [...f.media, { id: tmp, url: local, kind, isFloorplan: false, status: 'uploading', progress: 0, name: file.name }] }));
      try {
        const id = await uploadFile(file, { kind, listingId, onProgress: (progress) => patchEntry(tmp, { progress }) });
        update((f) => ({ media: f.media.map((m) => (m.id === tmp ? { ...m, id, status: 'processing' } : m)) }));
        void poll(id);
      } catch {
        patchEntry(tmp, { status: 'failed' });
        toast({ title: t('uploadError', { name: file.name }), tone: 'danger' });
      }
    }
  };

  const remove = async (id: string) => {
    if (!id.startsWith('tmp-')) {
      try {
        await apiFetch(`/media/${id}`, { method: 'DELETE' });
      } catch {
        toast({ title: t('deleteError'), tone: 'danger' });
        return;
      }
    }
    update((f) => ({ media: f.media.filter((m) => m.id !== id) }));
  };

  const reorder = (ids: string[]) => {
    update((f) => ({ media: ids.map((id) => f.media.find((m) => m.id === id)!).filter(Boolean) }));
    const real = ids.filter((id) => !id.startsWith('tmp-'));
    if (real.length) void apiFetch('/media/reorder', { method: 'POST', body: { ids: real } }).catch(() => undefined);
  };

  const togglePlan = async (m: MediaEntry) => {
    setBusy(m.id);
    try {
      const plan = !m.isFloorplan;
      const r = await apiFetch<MediaResponse>(`/media/${m.id}`, { method: 'PATCH', body: { isFloorplan: plan, kind: plan ? 'plan' : 'photo' } });
      patchEntry(m.id, { isFloorplan: r.isFloorplan, kind: r.kind });
    } catch (e) {
      toast({ title: e instanceof ClientApiError ? e.message : t('deleteError'), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const enhance = async (m: MediaEntry) => {
    setBusy(m.id);
    try {
      await apiFetch(`/media/${m.id}/enhance`, { method: 'POST', body: {} });
      patchEntry(m.id, { status: 'processing' });
      await poll(m.id);
      toast({ title: t('enhanced'), tone: 'success' });
    } catch (e) {
      toast({ title: e instanceof ClientApiError ? e.message : t('deleteError'), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  const images = form.media.filter((m) => m.kind !== 'video' && m.kind !== 'document');
  const items: UploadItem[] = images.map((m) => ({ id: m.id, url: m.url, name: m.name, status: m.status, progress: m.progress, kind: m.kind }));
  const photos = images.filter((m) => m.kind === 'photo').length;
  const iconBtn = 'grid size-7 place-items-center rounded-[4px] bg-surface/90 text-text disabled:opacity-50';

  return (
    <StepSection title={t('heading')} hint={t('hint')}>
      <FileUpload
        items={mounted ? items : []}
        onFiles={(files) => void upload(files, 'photo')}
        onReorder={reorder}
        onRemove={(id) => void remove(id)}
        accept="image/jpeg,image/png,image/webp,image/heic"
        label={t('upload')}
        hint={t('uploadHint')}
        extra={(it) => {
          const m = images.find((x) => x.id === it.id);
          if (!m || m.status !== 'ready') return null;
          return (
            <>
              {m.kind === 'pano360' && <span className="grid h-7 place-items-center rounded-[4px] bg-accent px-1.5 text-[11px] text-accent-contrast">{t('panoBadge')}</span>}
              {m.kind !== 'pano360' && (
                <button type="button" className={`${iconBtn} ${m.isFloorplan ? 'text-link' : ''}`} aria-pressed={m.isFloorplan} aria-label={m.isFloorplan ? t('unmarkPlan') : t('markPlan')} title={m.isFloorplan ? t('unmarkPlan') : t('markPlan')} disabled={busy === m.id} onClick={() => void togglePlan(m)}>
                  <Ruler className="size-3.5" strokeWidth={1.5} />
                </button>
              )}
              {m.kind === 'photo' && (
                <button type="button" className={iconBtn} aria-label={t('enhance')} title={t('enhance')} disabled={busy === m.id} onClick={() => void enhance(m)}>
                  <Sparkles className="size-3.5" strokeWidth={1.5} />
                </button>
              )}
            </>
          );
        }}
      />
      <div className="flex flex-wrap items-center gap-3 text-small text-muted" aria-live="polite">
        <span className="tabular">{t('count', { count: images.length })}</span>
        {images.some((m) => m.isFloorplan) && <span>· {t('planBadge')}</span>}
        {photos < 5 && <span>· {t('fewPhotos', { count: 5 - photos })}</span>}
      </div>
      {errors.media && <p role="alert" className="text-small text-danger">{errors.media}</p>}
      <div>
        <Button variant="secondary" icon={<Orbit className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => pano.current?.click()}>
          {t('pano')}
        </Button>
        <input
          ref={pano}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            e.target.value = '';
            if (files.length) void upload(files, 'pano360');
          }}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('videoUrl')} hint={t('urlHint')} error={errors.videoUrl}>
          <Input type="url" inputMode="url" value={form.videoUrl} onChange={(e) => update(() => ({ videoUrl: e.target.value }))} />
        </Field>
        <Field label={t('tourUrl')} hint={t('urlHint')} error={errors.tourUrl}>
          <Input type="url" inputMode="url" value={form.tourUrl} onChange={(e) => update(() => ({ tourUrl: e.target.value }))} />
        </Field>
      </div>
    </StepSection>
  );
}
