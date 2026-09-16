'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CalendarCheck, CircleCheck, Hand, Pencil, Play, Plus, Repeat, Square, Trash2, UserPlus, Zap, type LucideIcon } from 'lucide-react';
import { formatDateTimeKa, type CrmSequence, type CrmSequenceRun } from '@lokacia/contracts';
import { Button, Dialog, EmptyState, IconButton, Skeleton, Switch, Table, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { ContactPicker } from '@/components/common/pickers';
import { IconTile, PersonAvatar, Pill, Progress, SectionCard, StatCard, toneClass, type Tone } from '@/components/common/ui';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';
import { CHANNEL_META } from './channel';
import { SequenceEditor } from './sequence-editor';

const TRIGGER_META: Record<CrmSequence['trigger'], { icon: LucideIcon; tone: Tone }> = {
  after_viewing: { icon: CalendarCheck, tone: 1 },
  new_lead: { icon: Zap, tone: 3 },
  manual: { icon: Hand, tone: 4 },
};
const RUN_TONE: Record<CrmSequenceRun['status'], Tone> = { running: 2, done: 'success', stopped: 'neutral' };

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
        <span className="text-[14px] font-semibold">{t('contact')}</span>
        <ContactPicker value={contactId} onChange={(id) => setContactId(id)} />
      </div>
    </Dialog>
  );
}

/** Compact vertical flow of a sequence: channel node, "+N days" connector. */
function StepFlow({ steps }: { steps: CrmSequence['steps'] }) {
  const t = useTranslations('sequences');
  return (
    <ol className="flex flex-col">
      {steps.map((st, i) => {
        const meta = CHANNEL_META[st.channel];
        const Icon = meta.icon;
        return (
          <li key={i} className="relative flex min-w-0 gap-3 pb-3 last:pb-0">
            {i < steps.length - 1 && <span aria-hidden className="absolute bottom-0 left-[15px] top-8 w-0.5 rounded-full bg-border" />}
            <span className={`relative grid size-8 shrink-0 place-items-center rounded-full bg-tone-soft text-tone-ink ring-4 ring-surface ${toneClass(meta.tone)}`} aria-hidden>
              <Icon className="size-4" strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-center gap-2 text-[13px]">
                <span className="font-semibold">{t(`channels.${st.channel}`)}</span>
                <span className="rounded-full bg-surface-2 px-2 py-px text-[11.5px] font-semibold text-muted tabular">{st.delayDays === 0 ? t('flow.now') : t('flow.plusDays', { days: st.delayDays })}</span>
              </div>
              <p className="truncate text-[13px] leading-5 text-muted">{st.template}</p>
            </div>
          </li>
        );
      })}
    </ol>
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
  const sum = (k: 'running' | 'done' | 'stopped') => (data ?? []).reduce((s, x) => s + x[k], 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        className="mb-0"
        actions={
          manage ? (
            <Button size="sm" icon={<Plus className="size-4" strokeWidth={2.4} aria-hidden />} onClick={() => setEditing('new')}>
              {t('new')}
            </Button>
          ) : (
            <Pill tone="neutral">{t('noManage')}</Pill>
          )
        }
      />
      {data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:gap-4">
          <StatCard label={t('running')} value={sum('running')} icon={Play} tone={2} />
          <StatCard label={t('done')} value={sum('done')} icon={CircleCheck} tone="success" />
          <StatCard label={t('stopped')} value={sum('stopped')} icon={Square} tone={8} />
        </div>
      )}
      {isLoading && !data && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-72 rounded-card" />
          ))}
        </div>
      )}
      {data && data.length === 0 && <EmptyState icon={<Repeat className="size-6" strokeWidth={2} aria-hidden />} title={t('empty')} description={t('emptyHint')} action={manage && <Button onClick={() => setEditing('new')}>{t('new')}</Button>} />}
      {data && data.length > 0 && (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label={t('title')}>
          {data.map((s) => {
            const trig = TRIGGER_META[s.trigger];
            return (
              <li key={s.id} className="card flex min-w-0 flex-col">
                <div className="flex items-start gap-3 p-4 pb-3 md:p-5 md:pb-3">
                  <IconTile icon={trig.icon} tone={trig.tone} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[16px] font-semibold leading-6">{s.name}</h2>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Pill tone={trig.tone} size="sm">
                        {t(`trigger.${s.trigger}`)}
                      </Pill>
                      <Pill tone="neutral" size="sm">
                        {t('steps', { count: s.steps.length })}
                      </Pill>
                    </div>
                  </div>
                  <Switch checked={s.active} disabled={!manage} aria-label={t('toggle')} onCheckedChange={(v) => act(() => mutateApi(`/crm/sequences/${s.id}`, { method: 'PATCH', body: { active: v } }), t('saved'))} />
                </div>
                <div className="mx-4 flex-1 rounded-2xl bg-surface-2/70 p-3 md:mx-5">
                  <StepFlow steps={s.steps} />
                </div>
                <dl className="grid grid-cols-3 gap-2 px-4 pt-3 md:px-5">
                  {(['running', 'done', 'stopped'] as const).map((k) => (
                    <div key={k} className="min-w-0">
                      <dt className="truncate text-[12px] text-muted">{t(k)}</dt>
                      <dd className={`text-[18px] font-bold leading-6 tabular ${k === 'running' ? 'text-link' : k === 'done' ? 'text-success' : 'text-muted'}`}>{s[k]}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 md:px-5">
                  <Button size="sm" variant="secondary" icon={<UserPlus className="size-4" strokeWidth={2} aria-hidden />} onClick={() => setEnrolling(s)} disabled={!s.active}>
                    {t('enroll.button')}
                  </Button>
                  {manage && (
                    <div className="ml-auto flex gap-1">
                      <IconButton size="sm" label={t('edit')} onClick={() => setEditing(s)}>
                        <Pencil className="size-4" strokeWidth={2} />
                      </IconButton>
                      <IconButton size="sm" label={t('delete')} className="hover:bg-danger/10" onClick={() => act(() => mutateApi(`/crm/sequences/${s.id}`, { method: 'DELETE' }), t('deleted'))}>
                        <Trash2 className="size-4 text-danger" strokeWidth={2} />
                      </IconButton>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <SectionCard title={t('runs.title')} icon={Play} tone={2} bodyClassName="mt-3 overflow-hidden rounded-b-card border-t border-border p-0 md:mt-4 md:p-0 [&>div>div]:rounded-none [&>div>div]:border-0 [&>div>div]:shadow-none" action={runs ? <Pill tone="neutral">{runs.length}</Pill> : undefined}>
        <div>
        <Table<CrmSequenceRun>
          rows={runs ?? []}
          rowKey={(r) => r.id}
          empty={t('runs.empty')}
          initialSort={{ key: 'next', dir: 'asc' }}
          columns={[
            {
              key: 'contact',
              header: t('runs.contact'),
              sortValue: (r) => r.contactName ?? '',
              cell: (r) => (
                <Link href={`/contacts/${r.contactId}`} className="inline-flex items-center gap-2 whitespace-nowrap font-semibold hover:text-primary-soft-text">
                  <PersonAvatar name={r.contactName} size={28} />
                  {r.contactName ?? '—'}
                </Link>
              ),
            },
            { key: 'sequence', header: t('runs.sequence'), sortValue: (r) => r.sequenceName, cell: (r) => <span className="whitespace-nowrap">{r.sequenceName}</span> },
            {
              key: 'progress',
              header: t('runs.progress'),
              sortValue: (r) => r.step,
              cell: (r) => (
                <div className="flex min-w-32 items-center gap-2">
                  <Progress value={(Math.min(r.step, r.stepsTotal) / Math.max(1, r.stepsTotal)) * 100} tone={r.status === 'done' ? 'success' : 2} label={t('runs.progress')} />
                  <span className="shrink-0 text-[12.5px] font-semibold tabular text-muted">
                    {Math.min(r.step, r.stepsTotal)}/{r.stepsTotal}
                  </span>
                </div>
              ),
            },
            { key: 'next', header: t('runs.next'), sortValue: (r) => r.nextAt ?? '9', cell: (r) => <span className="whitespace-nowrap text-[13.5px] tabular">{r.nextAt ? formatDateTimeKa(r.nextAt) : '—'}</span> },
            {
              key: 'status',
              header: t('runs.status'),
              sortValue: (r) => r.status,
              cell: (r) => (
                <Pill tone={RUN_TONE[r.status]} dot>
                  {t(r.status)}
                </Pill>
              ),
            },
            {
              key: 'actions',
              header: '',
              align: 'right',
              cell: (r) =>
                r.status === 'running' ? (
                  <Button size="sm" variant="ghost" icon={<Square className="size-3.5" strokeWidth={2} aria-hidden />} onClick={() => act(() => mutateApi(`/crm/sequences/runs/${r.id}/stop`), t('runs.stoppedToast'))}>
                    {t('runs.stop')}
                  </Button>
                ) : null,
            },
          ]}
        />
        </div>
      </SectionCard>

      <SequenceEditor open={editing !== null} onOpenChange={(o) => !o && setEditing(null)} sequence={editing === 'new' ? null : editing} onSaved={() => void reload()} />
      <EnrollDialog sequence={enrolling} onOpenChange={(o) => !o && setEnrolling(null)} onDone={() => void reload()} />
    </div>
  );
}
