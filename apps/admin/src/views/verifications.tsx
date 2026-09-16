'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { Check, FileText, X } from 'lucide-react';
import { formatDateTimeKa, type VerificationDto } from '@lokacia/contracts';
import { Badge, Button, Dialog, EmptyState, Tabs } from '@lokacia/ui';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { PageHeader } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { ReasonDialog } from '@/components/reason-dialog';

const isImage = (url: string) => /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(url);
const isPdf = (url: string) => /\.pdf(\?|$)/i.test(url);

function DocPreview({ url, title }: { url: string; title: string }) {
  const t = useTranslations('verifications');
  if (isImage(url)) return <img src={url} alt={title} className="max-h-[70dvh] w-full rounded-photo border border-border bg-surface-2 object-contain" />;
  if (isPdf(url)) return <iframe src={url} title={title} className="h-[70dvh] w-full rounded-photo border border-border" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-link underline">
      {t('openDocument')}
    </a>
  );
}

export function VerificationCard({ v, onDone, compact }: { v: VerificationDto; onDone: () => void; compact?: boolean }) {
  const t = useTranslations('verifications');
  const [preview, setPreview] = React.useState(false);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const { run, busy } = useAction();
  const approve = async () => {
    if (await run(() => apiFetch(`/admin/verifications/${v.id}/approve`, { method: 'POST' }), t('approved'))) onDone();
  };
  const reject = async (reason: string) => {
    if (await run(() => apiFetch(`/admin/verifications/${v.id}/reject`, { method: 'POST', body: { reason } }), t('rejected'))) {
      setRejectOpen(false);
      onDone();
    }
  };
  return (
    <div className={compact ? '' : 'rounded-card border border-border bg-surface p-4'}>
      <div className="flex gap-3">
        <button type="button" onClick={() => setPreview(true)} className="grid h-20 w-16 shrink-0 place-items-center overflow-hidden rounded-photo border border-border bg-surface-2" aria-label={t('preview')}>
          {isImage(v.documentUrl) ? <img src={v.documentUrl} alt="" className="size-full object-cover" /> : <FileText className="size-6 text-muted" strokeWidth={1.5} aria-hidden />}
        </button>
        <div className="min-w-0 flex-1">
          {!compact && (
            <Link href={`/moderation/${v.listing.id}`} className="font-medium text-link hover:underline">
              {v.listing.title}
            </Link>
          )}
          {!compact && <div className="truncate text-small text-muted">{v.listing.address}</div>}
          <div className="text-small">
            <Link href={`/users/${v.user.id}`} className="hover:underline">
              {v.user.name ?? '—'}
            </Link>{' '}
            <span className="tabular text-muted">{v.user.phone}</span>
          </div>
          <div className="text-[12px] text-muted">{formatDateTimeKa(v.createdAt)}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone={v.status === 'approved' ? 'success' : v.status === 'rejected' ? 'danger' : 'accent'}>{t(`status.${v.status}`)}</Badge>
            {v.note && <span className="text-small text-muted">{v.note}</span>}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => setPreview(true)}>
          {t('preview')}
        </Button>
        {v.status === 'pending' && (
          <>
            <Button size="sm" loading={busy} icon={<Check className="size-4" strokeWidth={1.5} aria-hidden />} onClick={approve}>
              {t('approve')}
            </Button>
            <Button size="sm" variant="danger" icon={<X className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => setRejectOpen(true)}>
              {t('reject')}
            </Button>
          </>
        )}
      </div>
      <Dialog open={preview} onOpenChange={setPreview} title={t('document')} description={v.listing.title} size="xl">
        <DocPreview url={v.documentUrl} title={t('document')} />
      </Dialog>
      <ReasonDialog open={rejectOpen} onOpenChange={setRejectOpen} title={t('rejectTitle')} description={v.listing.title} confirmLabel={t('reject')} busy={busy} onConfirm={reject} templates={false} />
    </div>
  );
}

function List({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const t = useTranslations('verifications');
  const { data, error, mutate } = useSWR<VerificationDto[]>(`/admin/verifications?status=${status}`, fetcher);
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock />;
  if (!data.length) return <EmptyState title={t('emptyTitle')} description={t('emptyText')} />;
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {data.map((v) => (
        <VerificationCard key={v.id} v={v} onDone={() => mutate()} />
      ))}
    </div>
  );
}

export function VerificationsView() {
  const t = useTranslations('verifications');
  return (
    <>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <Tabs
        tabs={(['pending', 'approved', 'rejected'] as const).map((s) => ({ value: s, label: t(`tabs.${s}`), content: <List status={s} /> }))}
      />
    </>
  );
}
