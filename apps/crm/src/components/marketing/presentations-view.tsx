'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Copy, Eye, FileDown, Plus, Presentation, Trash2 } from 'lucide-react';
import { formatDateKa, relativeDaysKa, type PresentationRow } from '@lokacia/contracts';
import { Badge, Button, EmptyState, Skeleton, Table, useToast, type Column } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { downloadFile, errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';
import { PresentationDialog } from './presentation-dialog';

export function PresentationsView({ openNew }: { openNew: boolean }) {
  const t = useTranslations('marketing.presentations');
  const toast = useToast();
  const { can } = useCrm();
  const mutateApi = useApiMutation();
  const { data, isLoading, mutate } = useApi<PresentationRow[]>('/crm/presentations', { refreshInterval: 30_000 });
  const [creating, setCreating] = React.useState(openNew);

  const link = (p: PresentationRow) => `${window.location.origin}/p/${p.token}`;
  const copy = async (p: PresentationRow) => {
    await navigator.clipboard.writeText(link(p)).catch(() => undefined);
    toast({ title: t('linkCopied'), description: link(p), tone: 'success' });
  };

  const columns: Column<PresentationRow>[] = [
    {
      key: 'title',
      header: t('columns.title'),
      sortValue: (p) => p.title,
      cell: (p) => (
        <div className="min-w-[180px]">
          <div className="font-medium">{p.title}</div>
          {p.message && <div className="line-clamp-1 text-small text-muted">{p.message}</div>}
        </div>
      ),
    },
    {
      key: 'contact',
      header: t('columns.contact'),
      sortValue: (p) => p.contactName ?? '',
      cell: (p) =>
        p.contactId ? (
          <Link href={`/contacts/${p.contactId}`} className="whitespace-nowrap text-small hover:underline">
            {p.contactName}
          </Link>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    { key: 'spaces', header: t('columns.spaces'), align: 'right', sortValue: (p) => p.listingIds.length, cell: (p) => p.listingIds.length },
    {
      key: 'opened',
      header: t('columns.opened'),
      sortValue: (p) => p.openedAt,
      cell: (p) =>
        p.openedAt ? (
          <div className="flex flex-col gap-0.5">
            <Badge tone="success" icon={<Eye className="size-3" strokeWidth={1.5} aria-hidden />}>
              {t('openedAgo', { when: relativeDaysKa(p.openedAt) })}
            </Badge>
            <span className="text-[11px] text-muted tabular">{t('opens', { count: p.openCount })}</span>
          </div>
        ) : (
          <Badge tone="outline">{t('notOpened')}</Badge>
        ),
    },
    { key: 'author', header: t('columns.author'), sortValue: (p) => p.createdByName ?? '', cell: (p) => <span className="whitespace-nowrap text-small">{p.createdByName ?? '—'}</span> },
    { key: 'created', header: t('columns.created'), sortValue: (p) => p.createdAt, cell: (p) => <span className="whitespace-nowrap text-small text-muted">{formatDateKa(p.createdAt)}</span> },
    {
      key: 'actions',
      header: <span className="inline-block w-0 overflow-hidden whitespace-nowrap align-bottom">{t('columns.actions')}</span>,
      cell: (p) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => copy(p)} aria-label={t('copyLink')} title={t('copyLink')} icon={<Copy className="size-3.5" strokeWidth={1.5} aria-hidden />} />
          <Button asChild size="sm" variant="ghost">
            <a href={`/p/${p.token}?preview=1`} target="_blank" rel="noreferrer" aria-label={t('preview')} title={t('preview')}>
              <Eye className="size-3.5" strokeWidth={1.5} aria-hidden />
            </a>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            aria-label={t('pdf')}
            title={t('pdf')}
            icon={<FileDown className="size-3.5" strokeWidth={1.5} aria-hidden />}
            onClick={() => downloadFile(`/crm/presentations/${p.id}/pdf`, `presentation-${p.token.slice(0, 6)}.pdf`).catch((e) => toast({ title: errorMessage(e), tone: 'danger' }))}
          />
          {can('records.delete') && (
            <Button
              size="sm"
              variant="ghost"
              aria-label={t('delete')}
              title={t('delete')}
              icon={<Trash2 className="size-3.5 text-danger" strokeWidth={1.5} aria-hidden />}
              onClick={async () => {
                if (!window.confirm(t('deleteConfirm'))) return;
                try {
                  await mutateApi(`/crm/presentations/${p.id}`, { method: 'DELETE' });
                  toast({ title: t('deleted'), tone: 'success' });
                  await mutate();
                } catch (e) {
                  toast({ title: errorMessage(e), tone: 'danger' });
                }
              }}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button size="sm" onClick={() => setCreating(true)} icon={<Plus className="size-3.5" strokeWidth={1.5} aria-hidden />}>
            {t('create')}
          </Button>
        }
      />
      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !data?.length ? (
        <EmptyState icon={<Presentation className="size-5" strokeWidth={1.5} aria-hidden />} title={t('empty')} description={t('emptyHint')} action={<Button onClick={() => setCreating(true)}>{t('create')}</Button>} />
      ) : (
        <Table columns={columns} rows={data} rowKey={(p) => p.id} initialSort={{ key: 'created', dir: 'desc' }} />
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
