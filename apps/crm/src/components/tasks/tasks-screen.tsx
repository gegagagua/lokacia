'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlarmClock, Check, ListTodo, Trash2, Undo2 } from 'lucide-react';
import { formatDateTimeKa, relativeDaysKa, type CrmTask, type CrmTaskCounts } from '@lokacia/contracts';
import { Badge, Button, cn, EmptyState, IconButton, Input, Popover, Select, Skeleton, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { ContactPicker, MemberSelect } from '@/components/common/pickers';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';
import { PushCard } from './push-card';

type View = 'today' | 'overdue' | 'upcoming' | 'done';
const VIEWS: View[] = ['today', 'overdue', 'upcoming', 'done'];

function defaultDue() {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(0, 0, 0);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function TasksScreen() {
  const t = useTranslations('tasks');
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const mutateApi = useApiMutation();
  const { can, user } = useCrm();
  const teamView = can('contacts.viewAll');
  const [view, setView] = React.useState<View>((params.get('view') as View) ?? 'today');
  const [scope, setScope] = React.useState<'mine' | 'all'>('mine');
  const dealId = params.get('dealId');
  const [contactId, setContactId] = React.useState<string | null>(params.get('contactId'));
  const [title, setTitle] = React.useState('');
  const [due, setDue] = React.useState(defaultDue);
  const [priority, setPriority] = React.useState<'low' | 'normal' | 'high'>('normal');
  const [assignee, setAssignee] = React.useState<string | null>(user.id);
  const [busy, setBusy] = React.useState(false);
  const titleRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (params.get('new') === '1') setTimeout(() => titleRef.current?.focus(), 50);
  }, [params]);

  const { data, isLoading, mutate } = useApi<CrmTask[]>(`/crm/tasks?view=${view}&scope=${scope}`);
  const { data: counts, mutate: reloadCounts } = useApi<CrmTaskCounts>(`/crm/tasks/counts?scope=${scope}`);
  const reload = () => Promise.all([mutate(), reloadCounts()]);

  const act = async (fn: () => Promise<unknown>, msg?: string) => {
    try {
      await fn();
      if (msg) toast({ title: msg, tone: 'success' });
      await reload();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    await act(async () => {
      await mutateApi('/crm/tasks', { body: { title: title.trim(), dueAt: due ? new Date(due).toISOString() : null, priority, assigneeId: teamView ? assignee : undefined, contactId, dealId } });
      setTitle('');
      if (params.get('new')) router.replace(pathname);
    }, t('add.created'));
    setBusy(false);
  };

  const snooze = (task: CrmTask, kind: 'hour' | 'tomorrow' | 'week') => {
    let body: { minutes?: number; until?: string };
    if (kind === 'hour') body = { minutes: 60 };
    else if (kind === 'week') body = { minutes: 7 * 24 * 60 };
    else {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      body = { until: d.toISOString() };
    }
    return act(() => mutateApi(`/crm/tasks/${task.id}/snooze`, { body }), t('snoozed'));
  };

  const now = Date.now();
  return (
    <div>
      <PageHeader title={t('title')} subtitle={t('subtitle')} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-w-0 flex-col gap-3">
          <form onSubmit={add} className="grid gap-2 rounded-card border border-border bg-surface p-3 md:grid-cols-[minmax(0,1fr)_200px_130px] lg:grid-cols-[minmax(0,1fr)_200px_130px_auto]">
            <Input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('add.placeholder')} aria-label={t('add.title')} maxLength={200} className="md:col-span-3 lg:col-span-1" />
            <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label={t('add.due')} step={300} className="tabular" />
            <Select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} aria-label={t('add.priority')} options={(['low', 'normal', 'high'] as const).map((p) => ({ value: p, label: t(`priority.${p}`) }))} />
            <Button type="submit" loading={busy} disabled={!title.trim()}>
              {t('add.submit')}
            </Button>
            <div className="grid gap-2 md:col-span-3 md:grid-cols-2 lg:col-span-4">
              <ContactPicker value={contactId} onChange={(id) => setContactId(id)} placeholder={t('add.contact')} />
              {teamView && <MemberSelect value={assignee} onChange={setAssignee} includeEmpty={false} />}
            </div>
            {dealId && <p className="text-small text-muted md:col-span-3 lg:col-span-4">{t('linked.deal')}: <Link className="text-link" href={`/deals/${dealId}`}>→</Link></p>}
          </form>

          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label={t('title')} className="flex flex-wrap gap-1 border-b border-border">
              {VIEWS.map((v) => (
                <button key={v} role="tab" type="button" aria-selected={view === v} onClick={() => setView(v)} className={cn('-mb-px flex h-10 items-center gap-2 border-b-2 px-3 text-[14px]', view === v ? 'border-primary text-text' : 'border-transparent text-muted hover:text-text')}>
                  {t(`tabs.${v}`)}
                  <span className={cn('rounded-full px-1.5 text-[11px] tabular', v === 'overdue' && counts?.overdue ? 'bg-danger/15 text-danger' : 'bg-surface-2 text-muted')}>{counts?.[v] ?? '·'}</span>
                </button>
              ))}
            </div>
            {teamView && (
              <div className="ml-auto flex rounded-button border border-border-strong bg-surface p-0.5">
                {(['mine', 'all'] as const).map((s) => (
                  <button key={s} type="button" aria-pressed={scope === s} onClick={() => setScope(s)} className={cn('h-8 rounded-[5px] px-3 text-small', scope === s ? 'bg-primary text-primary-contrast' : 'text-muted')}>
                    {t(`scope.${s}`)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isLoading && !data && <Skeleton className="h-64" />}
          {data && data.length === 0 && <EmptyState icon={<ListTodo className="size-5" strokeWidth={1.5} aria-hidden />} title={t(`empty.${view}`)} description={t('emptyHint')} />}
          {data && data.length > 0 && (
            <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
              {data.map((task) => {
                const overdue = !task.doneAt && task.dueAt && new Date(task.dueAt).getTime() < now;
                return (
                  <li key={task.id} className="flex items-start gap-3 px-3 py-2.5">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={!!task.doneAt}
                      aria-label={task.doneAt ? t('reopen') : t('complete')}
                      onClick={() => act(() => mutateApi(`/crm/tasks/${task.id}/${task.doneAt ? 'reopen' : 'complete'}`))}
                      className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-[4px] border', task.doneAt ? 'border-primary bg-primary text-primary-contrast' : 'border-border-strong bg-surface hover:border-primary')}
                    >
                      {task.doneAt && <Check className="size-3.5" strokeWidth={2} aria-hidden />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className={cn('flex flex-wrap items-center gap-2', task.doneAt && 'text-muted line-through')}>
                        <span className="font-medium">{task.title}</span>
                        {task.priority === 'high' && <Badge tone="danger">{t('priority.high')}</Badge>}
                        {task.priority === 'low' && <Badge tone="outline">{t('priority.low')}</Badge>}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-3 text-small text-muted">
                        <span className={cn('tabular', overdue && 'font-medium text-danger')}>
                          {task.dueAt ? `${formatDateTimeKa(task.dueAt)}${overdue ? ` · ${t('overdueBy')} ${relativeDaysKa(task.dueAt)}` : ''}` : t('noDue')}
                        </span>
                        {task.contactId && (
                          <Link href={`/contacts/${task.contactId}`} className="text-link hover:underline">
                            {task.contactName}
                          </Link>
                        )}
                        {task.dealId && (
                          <Link href={`/deals/${task.dealId}`} className="text-link hover:underline">
                            {task.dealTitle}
                          </Link>
                        )}
                        {scope === 'all' && task.assigneeName && <span>{task.assigneeName}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!task.doneAt ? (
                        <Popover
                          align="end"
                          className="w-48 p-1"
                          trigger={
                            <IconButton size="sm" label={t('snooze')}>
                              <AlarmClock className="size-4" strokeWidth={1.5} />
                            </IconButton>
                          }
                        >
                          {(['hour', 'tomorrow', 'week'] as const).map((k) => (
                            <button key={k} type="button" onClick={() => snooze(task, k)} className="block w-full rounded-button px-3 py-2 text-left text-[14px] hover:bg-surface-2">
                              {t(`snoozeOptions.${k}`)}
                            </button>
                          ))}
                        </Popover>
                      ) : (
                        <IconButton size="sm" label={t('reopen')} onClick={() => act(() => mutateApi(`/crm/tasks/${task.id}/reopen`))}>
                          <Undo2 className="size-4" strokeWidth={1.5} />
                        </IconButton>
                      )}
                      {can('records.delete') && (
                        <IconButton size="sm" label={t('delete')} onClick={() => act(() => mutateApi(`/crm/tasks/${task.id}`, { method: 'DELETE' }), t('deleted'))}>
                          <Trash2 className="size-4 text-danger" strokeWidth={1.5} />
                        </IconButton>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <aside>
          <PushCard />
        </aside>
      </div>
    </div>
  );
}
