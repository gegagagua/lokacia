'use client';
import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { BadgeCheck, Check, Eye, FileText, X } from 'lucide-react';
import { formatDateTimeKa, type VerificationDto } from '@lokacia/contracts';
import { Button, Dialog, EmptyState, Tabs, cn } from '@lokacia/ui';
import { Person, StatusPill, type Tone } from '@/components/kit';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { PageHeader } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { ReasonDialog } from '@/components/reason-dialog';

const isImage = (url: string) => /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/i.test(url);
const isPdf = (url: string) => /\.pdf(\?|$)/i.test(url);

function DocPreview({ url, title }: { url: string; title: string }) {
  const t = useTranslations('verifications');
  if (isImage(url)) return <img src={url} alt={title} className="max-h-[70dvh] w-full rounded-2xl border border-border bg-surface-2 object-contain" />;
  if (isPdf(url)) return <iframe src={url} title={title} className="h-[70dvh] w-full rounded-2xl border border-border" />;
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
  const tone: Tone = v.status === 'approved' ? 'success' : v.status === 'rejected' ? 'danger' : 'accent';
  return (
    <article className={cn('flex min-w-0 flex-col', !compact && 'card card-hover overflow-hidden')}>
      <div className={cn('flex min-w-0 gap-4', !compact && 'p-4 md:p-5')}>
        <button
          type="button"
          onClick={() => setPreview(true)}
          className={cn('group/doc relative grid shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-surface-2 transition-shadow hover:shadow-md focus-visible:shadow-ring focus-visible:outline-none', compact ? 'h-24 w-20' : 'h-32 w-24')}
          aria-label={t('preview')}
        >
          {isImage(v.documentUrl) ? <img src={v.documentUrl} alt="" className="size-full object-cover transition-transform duration-300 group-hover/doc:scale-[1.06]" /> : <FileText className="size-8 text-muted" strokeWidth={1.75} aria-hidden />}
          <span className="absolute inset-x-0 bottom-0 grid place-items-center bg-gradient-to-t from-black/55 to-transparent py-1.5 opacity-0 transition-opacity group-hover/doc:opacity-100">
            <Eye className="size-4 text-white" strokeWidth={2} aria-hidden />
          </span>
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone={tone} pulse={v.status === 'pending'}>
              {t(`status.${v.status}`)}
            </StatusPill>
            <span className="text-[13px] text-muted tabular">{formatDateTimeKa(v.createdAt)}</span>
          </div>
          {!compact && (
            <Link href={`/moderation/${v.listing.id}`} className="line-clamp-2 text-[16px] font-bold leading-snug hover:text-link hover:underline">
              {v.listing.title}
            </Link>
          )}
          {!compact && <div className="truncate text-small text-muted">{v.listing.address}</div>}
          <Person name={v.user.name} href={`/users/${v.user.id}`} sub={v.user.phone} size={30} />
          {v.note && <p className="rounded-xl bg-surface-2 px-3 py-2 text-small text-muted">{v.note}</p>}
          {v.status === 'pending' && (
            <button type="button" onClick={() => setPreview(true)} className="inline-flex w-fit items-center gap-1.5 text-[14px] font-semibold text-link hover:underline">
              <Eye className="size-4" strokeWidth={2} aria-hidden />
              {t('preview')}
            </button>
          )}
        </div>
      </div>
      <div className={cn('flex flex-wrap gap-2', compact ? 'mt-4' : 'mt-auto border-t border-border bg-surface-2/40 px-4 py-3 md:px-5')}>
        {v.status !== 'pending' && (
          <Button size="sm" variant="secondary" icon={<Eye className="size-4" strokeWidth={2} aria-hidden />} onClick={() => setPreview(true)}>
            {t('preview')}
          </Button>
        )}
        {v.status === 'pending' && (
          <div className="grid w-full grid-cols-2 gap-2 [&>button]:min-w-0 [&>button]:whitespace-normal [&>button]:text-center [&>button]:leading-tight [&>button]:h-auto [&>button]:min-h-9 [&>button]:py-1.5">
            <Button size="sm" variant="danger" icon={<X className="size-4" strokeWidth={2} aria-hidden />} onClick={() => setRejectOpen(true)}>
              {t('reject')}
            </Button>
            <Button size="sm" loading={busy} icon={<Check className="size-4" strokeWidth={2} aria-hidden />} onClick={approve}>
              {t('approve')}
            </Button>
          </div>
        )}
      </div>
      <Dialog open={preview} onOpenChange={setPreview} title={t('document')} description={v.listing.title} size="xl">
        <DocPreview url={v.documentUrl} title={t('document')} />
      </Dialog>
      <ReasonDialog open={rejectOpen} onOpenChange={setRejectOpen} title={t('rejectTitle')} description={v.listing.title} confirmLabel={t('reject')} busy={busy} onConfirm={reject} templates={false} />
    </article>
  );
}

function List({ status }: { status: 'pending' | 'approved' | 'rejected' }) {
  const t = useTranslations('verifications');
  const { data, error, mutate } = useSWR<VerificationDto[]>(`/admin/verifications?status=${status}`, fetcher);
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock />;
  if (!data.length) return <EmptyState title={t('emptyTitle')} description={t('emptyText')} icon={<BadgeCheck className="size-6" strokeWidth={2} aria-hidden />} />;
  return (
    <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
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
      <PageHeader icon={BadgeCheck} title={t('title')} subtitle={t('subtitle')} />
      <Tabs
        tabs={(['pending', 'approved', 'rejected'] as const).map((s) => ({ value: s, label: t(`tabs.${s}`), content: <List status={s} /> }))}
      />
    </>
  );
}
