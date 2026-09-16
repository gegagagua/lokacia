'use client';
import * as React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Camera, CloudUpload, LocateFixed, Mic, Square, Trash2, X } from 'lucide-react';
import { BUSINESS_TYPES, DEAL_TYPE_LABELS_KA, DEAL_TYPES, formatDateTimeKa } from '@lokacia/contracts';
import { Badge, Button, Card, Field, Input, Select, Textarea, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { useOnline } from '@/components/shell/offline-banner';
import { useCrm } from '@/lib/crm-context';
import { enqueue, flushQueue, installQueueAutoFlush, listQueue, onQueueChanged, removeCapture, sendCapture, type CaptureFields, type QueuedCapture } from '@/lib/offline-queue';

const MapView = dynamic(() => import('@lokacia/ui/map').then((m) => m.MapView), { ssr: false });
const TBILISI = { lat: 41.7151, lng: 44.8271 };
const MAX_AUDIO_MS = 120_000;

type Photo = { id: string; blob: Blob; name: string; url: string };

export function CaptureView() {
  const t = useTranslations('mobile');
  const toast = useToast();
  const online = useOnline();
  const { org } = useCrm();
  const [photos, setPhotos] = React.useState<Photo[]>([]);
  const [pos, setPos] = React.useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [locating, setLocating] = React.useState(false);
  const [audio, setAudio] = React.useState<{ blob: Blob; url: string; name: string } | null>(null);
  const [recording, setRecording] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const recorder = React.useRef<MediaRecorder | null>(null);
  const [fields, setFields] = React.useState<CaptureFields>({ title: '', businessType: 'retail', dealType: 'rent', priceGel: 0, areaM2: 0, address: '', note: '' });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState<{ listingId?: string; offline: boolean } | null>(null);
  const [queue, setQueue] = React.useState<QueuedCapture[]>([]);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const refreshQueue = React.useCallback(() => void listQueue().then(setQueue).catch(() => setQueue([])), []);
  React.useEffect(() => {
    refreshQueue();
    const off = onQueueChanged(refreshQueue);
    const uninstall = installQueueAutoFlush();
    return () => {
      off();
      uninstall();
    };
  }, [refreshQueue]);

  React.useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const locate = () => {
    if (!navigator.geolocation) return toast({ title: t('gps.denied'), tone: 'danger' });
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setPos((x) => x ?? TBILISI);
        toast({ title: t('gps.denied'), tone: 'danger' });
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 30_000 },
    );
  };
  React.useEffect(locate, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addPhotos = (files: FileList | null) => {
    if (!files) return;
    setPhotos((ps) => [...ps, ...[...files].filter((f) => f.type.startsWith('image/')).map((f) => ({ id: crypto.randomUUID(), blob: f as Blob, name: f.name || `photo-${Date.now()}.jpg`, url: URL.createObjectURL(f) }))]);
  };

  const startRecording = async () => {
    if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) return toast({ title: t('voice.unsupported'), tone: 'danger' });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';
      const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks: Blob[] = [];
      const started = Date.now();
      const timer = setInterval(() => {
        const ms = Date.now() - started;
        setElapsed(ms);
        if (ms >= MAX_AUDIO_MS && rec.state === 'recording') rec.stop();
      }, 250);
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = () => {
        clearInterval(timer);
        stream.getTracks().forEach((tr) => tr.stop());
        const mime = (rec.mimeType || 'audio/webm').split(';')[0]!;
        const blob = new Blob(chunks, { type: mime });
        const ext = mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
        setAudio({ blob, url: URL.createObjectURL(blob), name: `voice-note-${Date.now()}.${ext}` });
        setRecording(false);
      };
      recorder.current = rec;
      rec.start();
      setElapsed(0);
      setRecording(true);
    } catch {
      toast({ title: t('voice.denied'), tone: 'danger' });
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (fields.title.trim().length < 5) e.title = t('validation.title');
    if (!(fields.areaM2 > 0)) e.areaM2 = t('validation.area');
    if (!(fields.priceGel > 0)) e.priceGel = t('validation.price');
    if (fields.address.trim().length < 3) e.address = t('validation.address');
    if (!pos) e.location = t('validation.location');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async () => {
    if (!validate() || !pos) return;
    setSaving(true);
    try {
      const item = await enqueue({ orgId: org.id, fields: { ...fields, title: fields.title.trim(), address: fields.address.trim() }, lat: pos.lat, lng: pos.lng, photos: photos.map((p) => ({ name: p.name, blob: p.blob })), audio: audio ? { name: audio.name, blob: audio.blob } : null });
      let listingId: string | undefined;
      let offline = !navigator.onLine;
      if (!offline) {
        try {
          listingId = await sendCapture(item);
        } catch (err) {
          offline = !navigator.onLine;
          const status = (err as { status?: number }).status;
          if (status && status < 500) {
            await removeCapture(item.id);
            throw err;
          }
          offline = true;
        }
      }
      setSaved({ listingId, offline });
      toast({ title: offline ? t('savedOffline') : t('savedOnline'), tone: 'success' });
      setPhotos([]);
      setAudio(null);
      setFields((f) => ({ ...f, title: '', priceGel: 0, areaM2: 0, address: '', note: '' }));
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : 'შეცდომა', tone: 'danger' });
    } finally {
      setSaving(false);
      refreshQueue();
    }
  };

  const set = <K extends keyof CaptureFields>(k: K, v: CaptureFields[K]) => setFields((f) => ({ ...f, [k]: v }));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <PageHeader title={t('title')} subtitle={t('subtitle')} className="mb-1" />

      {queue.length > 0 && (
        <Card className="flex flex-col gap-2 border-accent p-3" aria-live="polite">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-medium">
              <CloudUpload className="size-4" strokeWidth={1.5} aria-hidden />
              {t('queue.title')} <Badge tone="accent">{queue.length}</Badge>
            </h2>
            <Button size="sm" variant="secondary" disabled={!online} onClick={() => void flushQueue().then(refreshQueue)}>
              {t('queue.sync')}
            </Button>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {queue.map((q) => (
              <li key={q.id} className="flex items-center gap-2 py-2 text-small">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{q.fields.title}</span>
                  <span className="block text-muted tabular">
                    {formatDateTimeKa(q.createdAt)} · {t('photos.count', { n: q.photos.length })}{q.audio ? ` · ${t('voice.title')}` : ''}
                  </span>
                  {q.error && <span className="block text-danger">{q.error}</span>}
                </span>
                <Badge tone={q.status === 'error' ? 'danger' : q.status === 'syncing' ? 'link' : 'outline'}>{t(`queue.${q.status === 'done' ? 'syncing' : q.status}`)}</Badge>
                <button type="button" aria-label={t('queue.remove')} className="grid size-9 place-items-center rounded-button text-muted hover:bg-surface-2" onClick={() => void removeCapture(q.id)}>
                  <X className="size-4" strokeWidth={1.5} />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {saved && (
        <Card role="status" className="flex flex-wrap items-center justify-between gap-2 border-success p-3">
          <span>{saved.offline ? t('savedOffline') : t('savedOnline')}</span>
          {saved.listingId && (
            <Button asChild size="sm" variant="secondary">
              <Link href={`/listings/${saved.listingId}`}>{t('openListing')}</Link>
            </Button>
          )}
        </Card>
      )}

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{t('photos.title')}</h2>
          <span className="text-small text-muted tabular">{t('photos.count', { n: photos.length })}</span>
        </div>
        <Button size="lg" icon={<Camera className="size-5" strokeWidth={1.5} />} onClick={() => fileRef.current?.click()}>
          {t('photos.take')}
        </Button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => { addPhotos(e.target.files); e.target.value = ''; }} />
        {photos.length > 0 && (
          <ul className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <li key={p.id} className="relative aspect-square overflow-hidden rounded-photo border border-border">
                <img src={p.url} alt="" className="size-full object-cover" />
                <button type="button" aria-label={t('photos.remove')} onClick={() => setPhotos((ps) => ps.filter((x) => x.id !== p.id))} className="absolute right-1 top-1 grid size-8 place-items-center rounded-[4px] bg-surface/90 text-danger">
                  <Trash2 className="size-4" strokeWidth={1.5} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-medium">{t('gps.title')}</h2>
          <Button size="sm" variant="secondary" loading={locating} icon={<LocateFixed className="size-4" strokeWidth={1.5} />} onClick={locate}>
            {locating ? t('gps.detecting') : t('gps.detect')}
          </Button>
        </div>
        {pos && (
          <p className="text-small text-muted tabular">
            {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
            {pos.accuracy ? ` · ${t('gps.accuracy', { m: pos.accuracy })}` : ''}
          </p>
        )}
        {errors.location && <p className="text-small text-danger">{errors.location}</p>}
        {online && (
          <div className="h-56">
            <MapView center={pos ? [pos.lng, pos.lat] : [TBILISI.lng, TBILISI.lat]} zoom={15} draggablePin={pos} onPinMove={(p) => setPos({ ...p })} onMapClick={(p) => setPos({ ...p })} ariaLabel={t('gps.mapHint')} />
          </div>
        )}
        {online && <p className="text-small text-muted">{t('gps.mapHint')}</p>}
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <h2 className="font-medium">{t('voice.title')}</h2>
        <div className="flex flex-wrap items-center gap-2">
          {recording ? (
            <Button size="lg" variant="danger" icon={<Square className="size-4" strokeWidth={1.5} />} onClick={() => recorder.current?.stop()}>
              {t('voice.stop')} <span className="tabular">{Math.floor(elapsed / 1000)}″</span>
            </Button>
          ) : (
            <Button size="lg" variant="secondary" icon={<Mic className="size-5" strokeWidth={1.5} />} onClick={startRecording}>
              {t('voice.record')}
            </Button>
          )}
          {audio && !recording && (
            <>
              <audio controls src={audio.url} className="h-10 max-w-full" />
              <Button size="sm" variant="ghost" icon={<Trash2 className="size-4" strokeWidth={1.5} />} onClick={() => setAudio(null)}>
                {t('voice.remove')}
              </Button>
            </>
          )}
        </div>
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <Field label={t('fields.title')} error={errors.title} required>
          <Input value={fields.title} onChange={(e) => set('title', e.target.value)} placeholder={t('fields.titlePlaceholder')} className="h-12" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t('fields.businessType')}>
            <Select value={fields.businessType} onChange={(e) => set('businessType', e.target.value)} options={BUSINESS_TYPES.map((b) => ({ value: b.slug, label: b.nameKa }))} className="h-12" />
          </Field>
          <Field label={t('fields.dealType')}>
            <Select value={fields.dealType} onChange={(e) => set('dealType', e.target.value as CaptureFields['dealType'])} options={DEAL_TYPES.map((d) => ({ value: d, label: DEAL_TYPE_LABELS_KA[d] }))} className="h-12" />
          </Field>
          <Field label={t('fields.price')} error={errors.priceGel} required>
            <Input type="number" inputMode="decimal" min={0} value={fields.priceGel || ''} onChange={(e) => set('priceGel', Number(e.target.value))} className="h-12 tabular" />
          </Field>
          <Field label={t('fields.area')} error={errors.areaM2} required>
            <Input type="number" inputMode="decimal" min={0} value={fields.areaM2 || ''} onChange={(e) => set('areaM2', Number(e.target.value))} className="h-12 tabular" />
          </Field>
        </div>
        <Field label={t('fields.address')} error={errors.address} required>
          <Input value={fields.address} onChange={(e) => set('address', e.target.value)} autoComplete="street-address" className="h-12" />
        </Field>
        <Field label={t('fields.note')}>
          <Textarea value={fields.note} onChange={(e) => set('note', e.target.value)} />
        </Field>
      </Card>

      <div className="sticky bottom-16 z-10 md:bottom-4">
        <Button size="lg" className="w-full" onClick={save} loading={saving}>
          {saving ? t('saving') : t('save')}
        </Button>
      </div>
    </div>
  );
}
