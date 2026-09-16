'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlarmClock, CalendarClock, CalendarRange, Check, CheckCheck, Clock, Flag, Handshake, ListTodo, Plus, Target, Trash2, Undo2, UserRound, UsersRound, type LucideIcon } from 'lucide-react';
import { formatDateKa, formatDateTimeKa, relativeDaysKa, type CrmTask, type CrmTaskCounts } from '@lokacia/contracts';
import { Button, cn, EmptyState, IconButton, Input, Popover, Select, Skeleton, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { ContactPicker, MemberSelect } from '@/components/common/pickers';
import { IconTile, Pill, PersonAvatar, Progress, SectionCard, Segmented, toneClass, type Tone } from '@/components/common/ui';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';
import { PushCard } from './push-card';

type View = 'today' | 'overdue' | 'upcoming' | 'done';

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

  const [completing, setCompleting] = React.useState<string[]>([]);
  const toggle = async (task: CrmTask) => {
    if (!task.doneAt) setCompleting((c) => [...c, task.id]);
    await act(() => mutateApi(`/crm/tasks/${task.id}/${task.doneAt ? 'reopen' : 'complete'}`));
    setCompleting((c) => c.filter((x) => x !== task.id));
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
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const today = new Date();
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const yesterday = new Date(today.getTime() - 86_400_000);
  const groupLabel = (iso: string | null) => {
    if (!iso) return t('groups.noDue');
    const d = new Date(iso);
    const k = dayKey(d);
    if (k === dayKey(today)) return t('groups.today');
    if (k === dayKey(tomorrow)) return t('groups.tomorrow');
    if (k === dayKey(yesterday)) return t('groups.yesterday');
    return formatDateKa(d);
  };
  const groups: { label: string; items: CrmTask[] }[] = [];
  for (const task of data ?? []) {
    const label = groupLabel(view === 'done' ? (task.doneAt ?? task.dueAt) : task.dueAt);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(task);
    else groups.push({ label, items: [task] });
  }
  const time = (iso: string) => formatDateTimeKa(iso).split(', ').pop();
  const VIEW_META: Record<View, { icon: LucideIcon; tone: Tone }> = {
    overdue: { icon: AlarmClock, tone: 'danger' },
    today: { icon: CalendarClock, tone: 'primary' },
    upcoming: { icon: CalendarRange, tone: 2 },
    done: { icon: CheckCheck, tone: 'success' },
  };
  const openTotal = (counts?.today ?? 0) + (counts?.overdue ?? 0) + (counts?.upcoming ?? 0);
  const donePct = counts ? Math.round(((counts.done ?? 0) / Math.max(1, openTotal + (counts.done ?? 0))) * 100) : 0;

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={teamView ? <Segmented label={t('scopeLabel')} value={scope} onChange={setScope} options={(['mine', 'all'] as const).map((x) => ({ value: x, label: t(`scope.${x}`), icon: x === 'mine' ? UserRound : UsersRound }))} /> : undefined}
      />

      <div role="tablist" aria-label={t('title')} className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(['overdue', 'today', 'upcoming', 'done'] as const).map((v) => {
          const meta = VIEW_META[v];
          const on = view === v;
          return (
            <button
              key={v}
              role="tab"
              type="button"
              aria-selected={on}
              onClick={() => setView(v)}
              className={cn(
                'card relative flex items-center gap-3 overflow-hidden p-3.5 text-left transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none md:p-4',
                on ? 'border-transparent shadow-md ring-2 ring-tone' : 'hover:-translate-y-0.5 hover:shadow-md',
                toneClass(meta.tone),
              )}
            >
              {on && <span aria-hidden className="absolute inset-0 bg-tone-faint" />}
              <IconTile icon={meta.icon} tone={meta.tone} className="relative" />
              <span className="relative min-w-0">
                <span className={cn('block text-[24px] font-bold leading-7 tabular', v === 'overdue' && (counts?.overdue ?? 0) > 0 && 'text-danger')}>{counts?.[v] ?? '·'}</span>
                <span className="block truncate text-[13px] font-medium text-muted">{t(`tabs.${v}`)}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <form onSubmit={add} className="card flex flex-col gap-3 p-3 transition-shadow focus-within:shadow-md md:p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-contrast shadow-sm" aria-hidden>
                <Plus className="size-5" strokeWidth={2.4} />
              </span>
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('add.placeholder')}
                aria-label={t('add.title')}
                maxLength={200}
                className="h-10 min-w-0 flex-1 bg-transparent text-[16px] font-medium outline-none placeholder:font-normal placeholder:text-muted"
              />
              <Button type="submit" loading={busy} disabled={!title.trim()} size="sm" className="hidden sm:inline-flex">
                {t('add.submit')}
              </Button>
            </div>
            <div className={cn('grid gap-2 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-[200px_150px_minmax(0,1fr)_minmax(0,1fr)]', !title && !contactId && 'max-sm:hidden')}>
              <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} aria-label={t('add.due')} step={300} className="tabular" />
              <Select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)} aria-label={t('add.priority')} options={(['low', 'normal', 'high'] as const).map((p) => ({ value: p, label: t(`priority.${p}`) }))} />
              <div className={cn(!teamView && 'lg:col-span-2')}>
                <ContactPicker value={contactId} onChange={(id) => setContactId(id)} placeholder={t('add.contact')} />
              </div>
              {teamView && <MemberSelect value={assignee} onChange={setAssignee} includeEmpty={false} />}
            </div>
            {dealId && (
              <p className="text-small text-muted">
                {t('linked.deal')}:{' '}
                <Link className="text-link" href={`/deals/${dealId}`}>
                  →
                </Link>
              </p>
            )}
            <Button type="submit" loading={busy} disabled={!title.trim()} className={cn('sm:hidden', !title && 'hidden')}>
              {t('add.submit')}
            </Button>
          </form>

          {isLoading && !data && (
            <div className="card flex flex-col gap-3 p-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="size-6 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          )}
          {data && data.length === 0 && <EmptyState icon={<ListTodo className="size-5" strokeWidth={2} aria-hidden />} title={t(`empty.${view}`)} description={t('emptyHint')} />}
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="mb-2 flex items-center gap-2 px-1 text-[13px] font-semibold uppercase tracking-[0.05em] text-muted">
                {g.label}
                <span className="rounded-full bg-surface-3 px-2 py-0.5 text-[11.5px] tabular">{g.items.length}</span>
              </h2>
              <ul className="card flex flex-col divide-y divide-border overflow-hidden">
                {g.items.map((task) => {
                  const done = !!task.doneAt || completing.includes(task.id);
                  const overdue = !task.doneAt && task.dueAt && new Date(task.dueAt).getTime() < now;
                  return (
                    <li key={task.id} className={cn('group relative flex items-start gap-3 px-3.5 py-3 transition-colors hover:bg-surface-2/60 md:px-4', task.priority === 'high' && !task.doneAt && 'before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-danger')}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={!!task.doneAt}
                        aria-label={task.doneAt ? t('reopen') : t('complete')}
                        onClick={() => toggle(task)}
                        className={cn(
                          'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition-all duration-300 focus-visible:shadow-ring focus-visible:outline-none',
                          done ? 'scale-105 border-success bg-success text-white' : overdue ? 'border-danger/60 hover:border-danger hover:bg-danger/10' : 'border-border-strong hover:border-success hover:bg-success/10',
                        )}
                      >
                        <Check className={cn('size-3.5 transition-all duration-300', done ? 'scale-100 opacity-100' : 'scale-50 opacity-0 group-hover:opacity-40')} strokeWidth={3} aria-hidden />
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className={cn('text-[15px] font-semibold leading-6 transition-colors', done && 'text-muted line-through decoration-2')}>{task.title}</div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Pill size="sm" tone={task.doneAt ? 'success' : overdue ? 'danger' : task.dueAt ? 'neutral' : 'neutral'} icon={task.doneAt ? CheckCheck : overdue ? AlarmClock : Clock}>
                            <span className="tabular">{task.dueAt ? (overdue ? `${t('overdueBy')} · ${relativeDaysKa(task.dueAt)}` : `${groupLabel(task.dueAt) === g.label ? time(task.dueAt) : formatDateTimeKa(task.dueAt)}`) : t('noDue')}</span>
                          </Pill>
                          {task.priority === 'high' && (
                            <Pill size="sm" tone="danger" icon={Flag}>
                              {t('priority.high')}
                            </Pill>
                          )}
                          {task.priority === 'low' && (
                            <Pill size="sm" icon={Flag}>
                              {t('priority.low')}
                            </Pill>
                          )}
                          {task.contactId && (
                            <Link href={`/contacts/${task.contactId}`} className="inline-flex h-6 max-w-[220px] items-center gap-1.5 rounded-full border border-border bg-surface pl-0.5 pr-2 text-[12px] font-semibold hover:border-border-strong">
                              <PersonAvatar name={task.contactName} size={20} />
                              <span className="truncate">{task.contactName}</span>
                            </Link>
                          )}
                          {task.dealId && (
                            <Link href={`/deals/${task.dealId}`} className="inline-flex h-6 max-w-[220px] items-center gap-1.5 rounded-full bg-tone-soft px-2 text-[12px] font-semibold text-tone-ink tone-1 hover:underline">
                              <Handshake className="size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                              <span className="truncate">{task.dealTitle}</span>
                            </Link>
                          )}
                        </div>
                      </div>
                      {scope === 'all' && task.assigneeName && (
                        <span title={task.assigneeName} className="mt-0.5 hidden sm:block">
                          <PersonAvatar name={task.assigneeName} size={28} />
                          <span className="sr-only">{task.assigneeName}</span>
                        </span>
                      )}
                      <div className="flex shrink-0 items-center gap-0.5 transition-opacity md:opacity-60 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                        {!task.doneAt ? (
                          <Popover
                            align="end"
                            className="w-52 p-1.5"
                            trigger={
                              <IconButton size="sm" label={t('snooze')} className="rounded-full">
                                <AlarmClock className="size-4" strokeWidth={2} />
                              </IconButton>
                            }
                          >
                            {(['hour', 'tomorrow', 'week'] as const).map((k) => (
                              <button key={k} type="button" onClick={() => snooze(task, k)} className="block w-full rounded-[10px] px-3 py-2 text-left text-[14px] font-medium hover:bg-surface-2">
                                {t(`snoozeOptions.${k}`)}
                              </button>
                            ))}
                          </Popover>
                        ) : (
                          <IconButton size="sm" label={t('reopen')} className="rounded-full" onClick={() => act(() => mutateApi(`/crm/tasks/${task.id}/reopen`))}>
                            <Undo2 className="size-4" strokeWidth={2} />
                          </IconButton>
                        )}
                        {can('records.delete') && (
                          <IconButton size="sm" label={t('delete')} className="rounded-full hover:bg-danger/10" onClick={() => act(() => mutateApi(`/crm/tasks/${task.id}`, { method: 'DELETE' }), t('deleted'))}>
                            <Trash2 className="size-4 text-danger" strokeWidth={2} />
                          </IconButton>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
        <aside className="flex flex-col gap-4">
          <SectionCard title={t('progress.title')} icon={Target} tone={1}>
            <div className="flex items-end justify-between gap-2">
              <span className="text-[32px] font-bold leading-none tabular">{donePct}%</span>
              <span className="text-[13px] text-muted tabular">{t('progress.hint', { done: counts?.done ?? 0, open: openTotal })}</span>
            </div>
            <Progress value={donePct} tone="success" className="mt-3 h-2" label={t('progress.title')} />
            <ul className="mt-4 flex flex-col gap-2 text-[13.5px]">
              {(['overdue', 'today', 'upcoming'] as const).map((v) => (
                <li key={v} className="flex items-center gap-2">
                  <span aria-hidden className={cn('size-2 rounded-full bg-tone', toneClass(VIEW_META[v].tone))} />
                  <span className="flex-1 text-muted">{t(`tabs.${v}`)}</span>
                  <span className="font-semibold tabular">{counts?.[v] ?? '·'}</span>
                </li>
              ))}
            </ul>
          </SectionCard>
          <PushCard />
        </aside>
      </div>
    </div>
  );
}
