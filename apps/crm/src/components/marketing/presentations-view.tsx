'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Building2, Copy, Eye, FileDown, MailOpen, Plus, Presentation, Trash2, UserRound } from 'lucide-react';
import { formatDateKa, formatNumber, relativeDaysKa, type CrmListingRow, type PresentationRow } from '@lokacia/contracts';
import { Button, EmptyState, Skeleton, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { Pill, PersonAvatar, StatCard } from '@/components/common/ui';
import { downloadFile, errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';
import { PresentationDialog } from './presentation-dialog';

function CoverMosaic({ covers, count }: { covers: string[]; count: number }) {
  const shown = covers.slice(0, 3);
  if (!shown.length)
    return (
      <div className="drawing-grid grid aspect-[16/9] place-items-center text-muted">
        <Presentation className="size-10" strokeWidth={1.5} aria-hidden />
      </div>
    );
  return (
    <div className={`grid aspect-[16/9] gap-1 overflow-hidden bg-surface-2 ${shown.length === 1 ? 'grid-cols-1' : 'grid-cols-[2fr_1fr] grid-rows-2'}`}>
      {shown.map((c, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={c + i} src={c} alt="" loading="lazy" className={`size-full object-cover transition-transform duration-300 group-hover:scale-[1.04] ${i === 0 && shown.length > 1 ? 'row-span-2' : ''} ${shown.length === 2 && i === 1 ? 'row-span-2' : ''}`} />
      ))}
      {count > 3 && <span className="absolute bottom-2.5 right-2.5 rounded-full bg-black/55 px-2.5 py-0.5 text-[12.5px] font-semibold text-white backdrop-blur-sm tabular">+{count - 3}</span>}
    </div>
  );
}

export function PresentationsView({ openNew }: { openNew: boolean }) {
  const t = useTranslations('marketing.presentations');
  const toast = useToast();
  const { can } = useCrm();
  const mutateApi = useApiMutation();
  const { data, isLoading, mutate } = useApi<PresentationRow[]>('/crm/presentations', { refreshInterval: 30_000 });
  const { data: listings } = useApi<CrmListingRow[]>('/crm/listings');
  const [creating, setCreating] = React.useState(openNew);

  const coverById = React.useMemo(() => new Map((listings ?? []).map((l) => [l.id, l.cover])), [listings]);
  const rows = React.useMemo(() => [...(data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data]);

  const link = (p: PresentationRow) => `${window.location.origin}/p/${p.token}`;
  const copy = async (p: PresentationRow) => {
    await navigator.clipboard.writeText(link(p)).catch(() => undefined);
    toast({ title: t('linkCopied'), description: link(p), tone: 'success' });
  };

  const remove = async (p: PresentationRow) => {
    if (!window.confirm(t('deleteConfirm'))) return;
    try {
      await mutateApi(`/crm/presentations/${p.id}`, { method: 'DELETE' });
      toast({ title: t('deleted'), tone: 'success' });
      await mutate();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    }
  };

  const opened = rows.filter((p) => p.openedAt).length;
  const opens = rows.reduce((s, p) => s + p.openCount, 0);
  const iconBtn = 'grid size-9 place-items-center rounded-button text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:shadow-ring focus-visible:outline-none';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        className="mb-0"
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button size="sm" onClick={() => setCreating(true)} icon={<Plus className="size-4" strokeWidth={2.4} aria-hidden />}>
            {t('create')}
          </Button>
        }
      />
      {!!rows.length && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
          <StatCard label={t('kpi.total')} value={formatNumber(rows.length)} icon={Presentation} tone={4} />
          <StatCard label={t('kpi.opened')} value={`${formatNumber(opened)} / ${formatNumber(rows.length)}`} icon={MailOpen} tone="success" />
          <StatCard label={t('kpi.opens')} value={formatNumber(opens)} icon={Eye} tone={2} />
        </div>
      )}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-80 rounded-card" />
          ))}
        </div>
      ) : !rows.length ? (
        <EmptyState icon={<Presentation className="size-6" strokeWidth={2} aria-hidden />} title={t('empty')} description={t('emptyHint')} action={<Button onClick={() => setCreating(true)}>{t('create')}</Button>} />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={t('title')}>
          {rows.map((p) => (
            <li key={p.id} className="card card-hover group flex flex-col overflow-hidden">
              <div className="relative">
                <CoverMosaic covers={p.listingIds.map((id) => coverById.get(id)).filter((c): c is string => !!c)} count={p.listingIds.length} />
                <div className="absolute left-3 top-3">
                  {p.openedAt ? (
                    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface/95 px-2.5 text-[12.5px] font-semibold text-success shadow-sm backdrop-blur">
                      <Eye className="size-3.5" strokeWidth={2} aria-hidden />
                      {t('openedAgo', { when: relativeDaysKa(p.openedAt) })}
                    </span>
                  ) : (
                    <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-surface/95 px-2.5 text-[12.5px] font-semibold text-muted shadow-sm backdrop-blur">
                      <span className="size-2 rounded-full bg-border-strong" aria-hidden />
                      {t('notOpened')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="min-w-0">
                  <h2 className="line-clamp-1 text-[16px] font-semibold leading-6">{p.title}</h2>
                  {p.message && <p className="mt-0.5 line-clamp-2 text-[13.5px] leading-5 text-muted">{p.message}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={2} icon={Building2}>
                    {t('spacesCount', { count: p.listingIds.length })}
                  </Pill>
                  {p.openCount > 0 && (
                    <Pill tone="success" icon={Eye}>
                      {t('opens', { count: p.openCount })}
                    </Pill>
                  )}
                  {p.contactId && (
                    <Link href={`/contacts/${p.contactId}`} className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-full bg-surface-2 pl-1 pr-2.5 text-[12.5px] font-semibold ring-1 ring-inset ring-border transition-colors hover:bg-surface-3">
                      <PersonAvatar name={p.contactName} size={20} />
                      <span className="truncate">{p.contactName}</span>
                    </Link>
                  )}
                  {!p.contactId && (
                    <Pill tone="neutral" icon={UserRound}>
                      {t('noContact')}
                    </Pill>
                  )}
                </div>
                <div className="mt-auto flex items-center gap-2 text-[12.5px] text-muted">
                  <PersonAvatar name={p.createdByName} size={22} />
                  <span className="min-w-0 truncate font-medium text-text">{p.createdByName ?? '—'}</span>
                  <span aria-hidden>·</span>
                  <span className="shrink-0 tabular">{formatDateKa(p.createdAt)}</span>
                </div>
                <div className="flex items-center gap-1 border-t border-border pt-3">
                  <Button size="sm" variant="secondary" className="mr-auto" onClick={() => copy(p)} title={t('copyLink')} icon={<Copy className="size-4" strokeWidth={2} aria-hidden />}>
                    {t('copyShort')}
                  </Button>
                  <a href={`/p/${p.token}?preview=1`} target="_blank" rel="noreferrer" aria-label={t('preview')} title={t('preview')} className={iconBtn}>
                    <Eye className="size-4" strokeWidth={2} aria-hidden />
                  </a>
                  <button
                    type="button"
                    aria-label={t('pdf')}
                    title={t('pdf')}
                    className={iconBtn}
                    onClick={() => downloadFile(`/crm/presentations/${p.id}/pdf`, `presentation-${p.token.slice(0, 6)}.pdf`).catch((e) => toast({ title: errorMessage(e), tone: 'danger' }))}
                  >
                    <FileDown className="size-4" strokeWidth={2} aria-hidden />
                  </button>
                  {can('records.delete') && (
                    <button type="button" aria-label={t('delete')} title={t('delete')} className={`${iconBtn} hover:bg-danger/10 hover:text-danger`} onClick={() => remove(p)}>
                      <Trash2 className="size-4" strokeWidth={2} aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {creating && (
        <PresentationDialog
          onClose={() => setCreating(false)}
          onCreated={async (p) => {
            await navigator.clipboard.writeText(`${window.location.origin}/p/${p.token}`).catch(() => undefined);
            toast({ title: t('form.created'), description: `${window.location.origin}/p/${p.token}`, tone: 'success' });
            await mutate();
          }}
        />
      )}
    </div>
  );
}
