'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Pencil, Plus, Repeat, Trash2, UserPlus } from 'lucide-react';
import { formatDateTimeKa, type CrmSequence, type CrmSequenceRun } from '@lokacia/contracts';
import { Badge, Button, Card, Dialog, EmptyState, IconButton, Skeleton, Switch, Table, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { ContactPicker } from '@/components/common/pickers';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';
import { SequenceEditor } from './sequence-editor';

const RUN_TONE = { running: 'primary', done: 'success', stopped: 'outline' } as const;

function EnrollDialog({ sequence, onOpenChange, onDone }: { sequence: CrmSequence | null; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const t = useTranslations('sequences.enroll');
  const toast = useToast();
  const mutate = useApiMutation();
  const [contactId, setContactId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog
      open={!!sequence}
      onOpenChange={onOpenChange}
      title={t('title')}
      description={sequence?.name}
      footer={
        <Button
          disabled={!contactId}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await mutate(`/crm/sequences/${sequence!.id}/enroll`, { body: { contactId } });
              toast({ title: t('done'), tone: 'success' });
              setContactId(null);
              onOpenChange(false);
              onDone();
            } catch (e) {
              toast({ title: errorMessage(e), tone: 'danger' });
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('submit')}
        </Button>
      }
    >
      <div className="flex min-h-48 flex-col gap-1.5">
        <span className="text-small font-medium">{t('contact')}</span>
        <ContactPicker value={contactId} onChange={(id) => setContactId(id)} />
      </div>
    </Dialog>
  );
}

export function SequencesScreen() {
  const t = useTranslations('sequences');
  const toast = useToast();
  const mutateApi = useApiMutation();
  const { can } = useCrm();
  const manage = can('sequences.manage');
  const { data, isLoading, mutate } = useApi<CrmSequence[]>('/crm/sequences');
  const { data: runs, mutate: reloadRuns } = useApi<CrmSequenceRun[]>('/crm/sequences/runs');
  const [editing, setEditing] = React.useState<CrmSequence | null | 'new'>(null);
  const [enrolling, setEnrolling] = React.useState<CrmSequence | null>(null);
  const reload = () => Promise.all([mutate(), reloadRuns()]);
  const act = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast({ title: msg, tone: 'success' });
      await reload();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        className="mb-0"
        actions={
          manage ? (
            <Button icon={<Plus className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => setEditing('new')}>
              {t('new')}
            </Button>
          ) : (
            <span className="text-small text-muted">{t('noManage')}</span>
          )
        }
      />
      {isLoading && !data && <Skeleton className="h-40" />}
      {data && data.length === 0 && <EmptyState icon={<Repeat className="size-5" strokeWidth={1.5} aria-hidden />} title={t('empty')} description={t('emptyHint')} />}
      {data && data.length > 0 && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.map((s) => (
            <Card key={s.id} className="flex min-w-0 flex-col gap-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-[16px] font-semibold">{s.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge tone="link">{t(`trigger.${s.trigger}`)}</Badge>
                    <Badge tone="outline">{t('steps', { count: s.steps.length })}</Badge>
                  </div>
                </div>
                <Switch checked={s.active} disabled={!manage} aria-label={t('toggle')} onCheckedChange={(v) => act(() => mutateApi(`/crm/sequences/${s.id}`, { method: 'PATCH', body: { active: v } }), t('saved'))} />
              </div>
              <ol className="flex flex-col gap-1 border-l border-border-strong pl-3 text-small">
                {s.steps.map((st, i) => (
                  <li key={i} className="flex min-w-0 gap-2">
                    <span className="shrink-0 tabular text-muted">+{st.delayDays}</span>
                    <span className="shrink-0 font-medium">{t(`channels.${st.channel}`)}</span>
                    <span className="min-w-0 truncate text-muted">{st.template}</span>
                  </li>
                ))}
              </ol>
              <div className="flex gap-3 text-small tabular text-muted">
                <span>
                  {t('running')}: <b className="text-text">{s.running}</b>
                </span>
                <span>
                  {t('done')}: {s.done}
                </span>
                <span>
                  {t('stopped')}: {s.stopped}
                </span>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={<UserPlus className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => setEnrolling(s)} disabled={!s.active}>
                  {t('enroll.button')}
                </Button>
                {manage && (
                  <>
                    <IconButton size="sm" label={t('edit')} onClick={() => setEditing(s)}>
                      <Pencil className="size-4" strokeWidth={1.5} />
                    </IconButton>
                    <IconButton size="sm" label={t('delete')} onClick={() => act(() => mutateApi(`/crm/sequences/${s.id}`, { method: 'DELETE' }), t('deleted'))}>
                      <Trash2 className="size-4 text-danger" strokeWidth={1.5} />
                    </IconButton>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <section>
        <h2 className="compact mb-2 text-h3 font-semibold">{t('runs.title')}</h2>
        <Table<CrmSequenceRun>
          rows={runs ?? []}
          rowKey={(r) => r.id}
          empty={t('runs.empty')}
          initialSort={{ key: 'next', dir: 'asc' }}
          columns={[
            { key: 'contact', header: t('runs.contact'), sortValue: (r) => r.contactName ?? '', cell: (r) => <Link href={`/contacts/${r.contactId}`} className="text-link hover:underline">{r.contactName ?? '—'}</Link> },
            { key: 'sequence', header: t('runs.sequence'), sortValue: (r) => r.sequenceName, cell: (r) => r.sequenceName },
            { key: 'progress', header: t('runs.progress'), align: 'right', sortValue: (r) => r.step, cell: (r) => `${Math.min(r.step, r.stepsTotal)} / ${r.stepsTotal}` },
            { key: 'next', header: t('runs.next'), sortValue: (r) => r.nextAt ?? '9', cell: (r) => (r.nextAt ? formatDateTimeKa(r.nextAt) : '—') },
            { key: 'status', header: t('runs.status'), sortValue: (r) => r.status, cell: (r) => <Badge tone={RUN_TONE[r.status]}>{t(r.status)}</Badge> },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (r) =>
                r.status === 'running' ? (
                  <Button size="sm" variant="ghost" onClick={() => act(() => mutateApi(`/crm/sequences/runs/${r.id}/stop`), t('runs.stoppedToast'))}>
                    {t('runs.stop')}
                  </Button>
                ) : null,
            },
          ]}
        />
      </section>

      <SequenceEditor open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} sequence={editing === 'new' ? null : editing} onSaved={() => void reload()} />
      <EnrollDialog sequence={enrolling} onOpenChange={(o) => !o && setEnrolling(null)} onDone={() => void reload()} />
    </div>
  );
}
