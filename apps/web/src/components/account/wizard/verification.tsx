'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { FileCheck2, ShieldCheck, Upload } from 'lucide-react';
import { useFormat } from '@/i18n/use-format';
import { Badge, Button, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError, fetcher, uploadFile } from '@/lib/api-client';
import { StepSection } from './parts';

type Verification = { id: string; status: 'pending' | 'approved' | 'rejected'; documentUrl: string; note: string | null; createdAt: string };

/** P5: owner uploads a public registry extract; moderator approves → verified_owner badge. */
export function OwnerVerification({ listingId }: { listingId: string | null }) {
  const t = useTranslations('wizard.verification');
  const f = useFormat();
  const toast = useToast();
  const input = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);
  const { data = [], mutate } = useSWR<Verification[]>(listingId ? `/listings/${listingId}/verification` : null, fetcher);
  const pending = data.some((v) => v.status === 'pending');

  const send = async (file: File) => {
    if (!listingId) return;
    setBusy(true);
    try {
      const id = await uploadFile(file, { kind: 'document', listingId });
      const media = await apiFetch<{ url: string }>(`/media/${id}`);
      await apiFetch(`/listings/${listingId}/verification`, { method: 'POST', body: { documentUrl: media.url } });
      await mutate();
      toast({ title: t('sent'), tone: 'success' });
    } catch (e) {
      toast({ title: e instanceof ClientApiError ? e.message : t('error'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const tone = { pending: 'accent', approved: 'success', rejected: 'danger' } as const;
  const label = { pending: t('statusPending'), approved: t('statusApproved'), rejected: t('statusRejected') };

  return (
    <StepSection title={t('heading')} hint={t('hint')} icon={ShieldCheck} tone="success">
      {!listingId ? (
        <p className="text-small text-muted">{t('needsSave')}</p>
      ) : (
        <>
          <ul className="flex flex-col gap-2" aria-live="polite">
            {data.length === 0 && <li className="text-small text-muted">{t('none')}</li>}
            {data.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-small">
                <FileCheck2 className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
                <a href={v.documentUrl} target="_blank" rel="noreferrer" className="text-link underline-offset-4 hover:underline">
                  {t('document')}
                </a>
                <span className="text-muted tabular">{f.date(v.createdAt)}</span>
                <Badge tone={tone[v.status]}>{label[v.status]}</Badge>
                {v.note && <span className="w-full text-muted">{t('note', { note: v.note })}</span>}
              </li>
            ))}
          </ul>
          {!pending && !data.some((v) => v.status === 'approved') && (
            <div>
              <Button variant="secondary" loading={busy} icon={<Upload className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => input.current?.click()}>
                {busy ? t('uploading') : t('upload')}
              </Button>
              <input
                ref={input}
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                className="sr-only"
                tabIndex={-1}
                aria-hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void send(f);
                }}
              />
            </div>
          )}
        </>
      )}
    </StepSection>
  );
}
