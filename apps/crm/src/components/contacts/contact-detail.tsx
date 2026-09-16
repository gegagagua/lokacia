'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Building2, CalendarDays, CalendarPlus, ChevronRight, ClipboardList, Clock, Handshake, ListPlus, Mail, Pencil, Phone, Plus, SquareCheckBig, ThumbsUp, Trash2, UserRound, type LucideIcon } from 'lucide-react';
import { BUSINESS_TYPE_BY_SLUG, DEAL_TYPE_LABELS_KA, formatArea, formatDateKa, formatDateTimeKa, formatMoney, relativeDaysKa } from '@lokacia/contracts';
import { Button, cn, Dialog, EmptyState, Skeleton, Tabs, useToast } from '@lokacia/ui';
import { CallButton } from '@/components/common/call-button';
import { MemberSelect } from '@/components/common/pickers';
import { ActivityTimeline } from '@/components/common/timeline';
import { EmptyHint, IconTile, Pill, PersonAvatar, SectionCard, toneClass, toneFor } from '@/components/common/ui';
import { ClientApiError, errorMessage } from '@/lib/api-client';
import { Can, useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';
import { ContactFormDialog } from './contact-form-dialog';
import { TYPE_ICON, TYPE_TONE } from './contacts-list';
import { MatchesPanel } from './matches-panel';
import { PortalLink } from './portal-link';
import { RequirementsEditor } from './requirements-editor';
import type { ContactDetail, ContactFacets, District } from './types';

const TABS = ['timeline', 'deals', 'matches', 'tasks', 'requirements'] as const;
type Tab = (typeof TABS)[number];

function InfoRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-muted" aria-hidden>
        <Icon className="size-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] leading-4 text-muted">{label}</div>
        <div className="mt-0.5 break-words text-[14px] font-medium">{children}</div>
      </div>
    </div>
  );
}

export function ContactDetailView({ id, initialTab }: { id: string; initialTab?: string }) {
  const t = useTranslations('contacts');
  const common = useTranslations('shell.common');
  const router = useRouter();
  const toast = useToast();
  const mutateApi = useApiMutation();
  const { role, workspace } = useCrm();
  const { data: c, error, mutate } = useApi<ContactDetail>(`/crm/contacts/${id}`);
  const { data: districts = [] } = useApi<District[]>('/taxonomy/districts?city=tbilisi');
  const { data: facets } = useApi<ContactFacets>('/crm/contacts/facets');
  const [tab, setTab] = React.useState<Tab>(() => {
    const v = initialTab === 'overview' ? 'timeline' : initialTab;
    return (TABS as readonly string[]).includes(v ?? '') ? (v as Tab) : 'timeline';
  });
  const [editing, setEditing] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [timelineKey, setTimelineKey] = React.useState(0);

  const stage = (k: string) => workspace?.pipeline?.stages.find((s) => s.key === k);
  const stageName = (k: string) => stage(k)?.name ?? k;
  const changeTab = (v: string) => {
    setTab(v as Tab);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', v);
    window.history.replaceState(null, '', url);
  };

  if (error) {
    return (
      <EmptyState
        title={error instanceof ClientApiError && error.status === 404 ? t('empty') : errorMessage(error)}
        action={
          <Button asChild variant="secondary">
            <Link href="/contacts">{t('detail.back')}</Link>
          </Button>
        }
      />
    );
  }
  if (!c)
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-56 rounded-card" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Skeleton className="h-96 rounded-card" />
          <Skeleton className="h-96 rounded-card" />
        </div>
      </div>
    );

  const refresh = () => {
    void mutate();
    setTimelineKey((k) => k + 1);
  };
  const req = c.requirements;
  const liked = c.matches.liked ?? 0;
  const feedback = liked + (c.matches.disliked ?? 0);
  const matchesTotal = Object.values(c.matches).reduce((a, b) => a + (b ?? 0), 0);
  const openTasks = c.tasks.filter((x) => !x.doneAt).length;
  const now = Date.now();
  const TypeIcon = TYPE_ICON[c.type];

  const stats = [
    { key: 'deals', label: t('detail.deals'), value: c.deals.length, icon: Handshake, tone: 1 as const, tab: 'deals' },
    { key: 'matches', label: t('detail.tabs.matches'), value: matchesTotal, icon: Building2, tone: 2 as const, tab: 'matches' },
    { key: 'liked', label: t('detail.liked'), value: liked, icon: ThumbsUp, tone: 5 as const, tab: 'matches' },
    { key: 'tasks', label: t('detail.openTasks'), value: openTasks, icon: SquareCheckBig, tone: 4 as const, tab: 'tasks' },
  ];

  return (
    <div>
      <Link href="/contacts" className="mb-4 inline-flex items-center gap-1.5 rounded-full text-[14px] font-medium text-muted transition-colors hover:text-text">
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden />
        {t('detail.back')}
      </Link>

      {/* Profile header */}
      <section className="card mb-5 overflow-hidden" aria-labelledby="contact-name">
        <div className={cn('relative h-20 md:h-24', toneClass(TYPE_TONE[c.type]))} aria-hidden>
          <div className="absolute inset-0 bg-tone-soft" />
          <div className="absolute inset-0 bg-[radial-gradient(420px_160px_at_85%_0%,color-mix(in_srgb,var(--accent)_22%,transparent),transparent_70%),radial-gradient(520px_200px_at_10%_120%,color-mix(in_srgb,var(--tone)_30%,transparent),transparent_70%)]" />
        </div>
        <div className="px-4 pb-4 md:px-6 md:pb-5">
          <div className="flex flex-col gap-4">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <span className="-mt-11 inline-grid w-fit shrink-0 rounded-full bg-surface p-1 shadow-md sm:-mb-10">
                <PersonAvatar name={c.name} size={84} />
              </span>
              <div className="min-w-0 sm:pt-3">
                <h1 id="contact-name" className="break-words text-[24px] font-bold leading-8 tracking-tight md:text-[28px] md:leading-9">
                  {c.name}
                </h1>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Pill tone={TYPE_TONE[c.type]} icon={TypeIcon}>
                    {t(`types.${c.type}`)}
                  </Pill>
                  {c.company && (
                    <Pill tone="neutral" icon={Building2}>
                      {c.company}
                    </Pill>
                  )}
                  {c.tags.map((tag) => (
                    <Pill key={tag} tone={toneFor(tag)} dot>
                      {tag}
                    </Pill>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:pl-[108px]">
              {c.phones.slice(0, 1).map((p) => (
                <CallButton key={p} phone={p} entityId={c.id} variant="primary" onLogged={refresh} />
              ))}
              {c.emails[0] && (
                <Button asChild variant="secondary" size="sm">
                  <a href={`mailto:${c.emails[0]}`} aria-label={`${t('detail.email')}: ${c.emails[0]}`}>
                    <Mail className="size-4" strokeWidth={2} aria-hidden />
                    {t('detail.email')}
                  </a>
                </Button>
              )}
              <Button asChild variant="secondary" size="sm">
                <Link href={`/deals?new=1&contactId=${c.id}`}>
                  <Plus className="size-4" strokeWidth={2} aria-hidden />
                  {t('detail.newDeal')}
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm" className="w-9 px-0 xl:w-auto xl:px-3.5">
                <Link href={`/tasks?new=1&contactId=${c.id}`} aria-label={t('detail.newTask')} title={t('detail.newTask')}>
                  <ListPlus className="size-4" strokeWidth={2} aria-hidden />
                  <span className="hidden xl:inline">{t('detail.newTask')}</span>
                </Link>
              </Button>
              <Button asChild variant="secondary" size="sm" className="w-9 px-0 xl:w-auto xl:px-3.5">
                <Link href={`/calendar?new=1&contactId=${c.id}`} aria-label={t('detail.newViewing')} title={t('detail.newViewing')}>
                  <CalendarPlus className="size-4" strokeWidth={2} aria-hidden />
                  <span className="hidden xl:inline">{t('detail.newViewing')}</span>
                </Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)} aria-label={t('detail.edit')} title={t('detail.edit')} className="size-9 px-0">
                <Pencil className="size-4" strokeWidth={2} aria-hidden />
              </Button>
              <Can perm="records.delete">
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} aria-label={t('detail.delete')} title={t('detail.delete')} className="size-9 px-0 text-danger hover:bg-danger/10">
                  <Trash2 className="size-4" strokeWidth={2} aria-hidden />
                </Button>
              </Can>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 md:grid-cols-4">
            {stats.map((s) => (
              <button key={s.key} type="button" onClick={() => changeTab(s.tab)} className="flex items-center gap-3 rounded-2xl border border-border bg-surface-2/50 p-3 text-left transition-all duration-200 hover:border-border-strong hover:bg-surface focus-visible:shadow-ring focus-visible:outline-none">
                <IconTile icon={s.icon} tone={s.tone} size="sm" />
                <span className="min-w-0">
                  <span className="block text-[20px] font-bold leading-6 tabular">{s.value}</span>
                  <span className="block truncate text-[12.5px] text-muted">{s.label}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <Tabs
            value={tab}
            onValueChange={changeTab}
            listClassName="scrollbar-none"
            tabs={[
              { value: 'timeline', label: t('detail.tabs.activity'), content: <ActivityTimeline key={timelineKey} entity="contact" entityId={c.id} stageName={stageName} /> },
              {
                value: 'deals',
                label: t('detail.deals'),
                count: c.deals.length,
                content: (
                  <SectionCard
                    title={t('detail.deals')}
                    icon={Handshake}
                    tone={1}
                    bodyClassName="p-2 md:p-2"
                    action={
                      <Button asChild size="sm" variant="secondary">
                        <Link href={`/deals?new=1&contactId=${c.id}`}>
                          <Plus className="size-4" strokeWidth={2} aria-hidden />
                          {t('detail.newDeal')}
                        </Link>
                      </Button>
                    }
                  >
                    {c.deals.length === 0 ? (
                      <EmptyHint icon={Handshake} title={t('detail.noDeals')} />
                    ) : (
                      <ul className="flex flex-col">
                        {c.deals.map((d) => {
                          const st = stage(d.stage);
                          const tone = st?.kind === 'won' ? 'success' : st?.kind === 'lost' ? 'danger' : toneFor(d.stage);
                          return (
                            <li key={d.id}>
                              <Link href={`/deals/${d.id}`} className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface-2">
                                <IconTile icon={Handshake} tone={tone} size="sm" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-semibold">{d.title}</span>
                                  <span className="block text-[12.5px] text-muted">{relativeDaysKa(d.updatedAt)}</span>
                                </span>
                                <Pill tone={tone} dot size="sm" className="hidden sm:inline-flex">
                                  {stageName(d.stage)}
                                </Pill>
                                <span className="shrink-0 font-semibold tabular">{formatMoney(d.valueMinor)}</span>
                                <ChevronRight className="size-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" strokeWidth={2} aria-hidden />
                              </Link>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </SectionCard>
                ),
              },
              { value: 'matches', label: t('detail.tabs.matches'), count: matchesTotal, content: <MatchesPanel contactId={c.id} onChanged={refresh} /> },
              {
                value: 'tasks',
                label: t('detail.tabs.tasks'),
                count: openTasks,
                content: (
                  <div className="grid gap-5 xl:grid-cols-2">
                    <SectionCard
                      title={t('detail.tasks')}
                      icon={SquareCheckBig}
                      tone={4}
                      bodyClassName="p-2 md:p-2"
                      action={
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/tasks?new=1&contactId=${c.id}`} aria-label={t('detail.newTask')}>
                            <Plus className="size-4" strokeWidth={2} aria-hidden />
                          </Link>
                        </Button>
                      }
                    >
                      {c.tasks.length === 0 ? (
                        <EmptyHint icon={SquareCheckBig} title={t('detail.noTasks')} />
                      ) : (
                        <ul className="flex flex-col">
                          {c.tasks.map((task) => {
                            const overdue = !task.doneAt && !!task.dueAt && new Date(task.dueAt).getTime() < now;
                            return (
                              <li key={task.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                                <span className={cn('grid size-5 shrink-0 place-items-center rounded-md border-2', task.doneAt ? 'border-primary bg-primary text-primary-contrast' : overdue ? 'border-danger' : 'border-border-strong')} aria-hidden>
                                  {task.doneAt && <SquareCheckBig className="size-3" strokeWidth={3} />}
                                </span>
                                <span className={cn('min-w-0 flex-1 truncate text-[14px] font-medium', task.doneAt && 'text-muted line-through')}>{task.title}</span>
                                {task.priority === 'high' && !task.doneAt && (
                                  <Pill tone="danger" size="sm">
                                    !
                                  </Pill>
                                )}
                                <Pill tone={task.doneAt ? 'success' : overdue ? 'danger' : 'neutral'} size="sm" icon={Clock}>
                                  {task.doneAt ? t('detail.done') : task.dueAt ? formatDateKa(task.dueAt) : '—'}
                                </Pill>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                      <div className="px-3 pb-2 pt-1">
                        <Link href="/tasks" className="text-[13.5px] font-medium text-link hover:underline">
                          {t('detail.allTasks')} →
                        </Link>
                      </div>
                    </SectionCard>
                    <SectionCard
                      title={t('detail.viewings')}
                      icon={CalendarDays}
                      tone={7}
                      bodyClassName="p-2 md:p-2"
                      action={
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/calendar?new=1&contactId=${c.id}`} aria-label={t('detail.newViewing')}>
                            <Plus className="size-4" strokeWidth={2} aria-hidden />
                          </Link>
                        </Button>
                      }
                    >
                      {c.viewings.length === 0 ? (
                        <EmptyHint icon={CalendarDays} title={t('detail.noViewings')} />
                      ) : (
                        <ul className="flex flex-col">
                          {c.viewings.map((v) => {
                            const d = new Date(v.startsAt);
                            return (
                              <li key={v.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                                <span className={cn('grid w-12 shrink-0 place-items-center rounded-xl py-1 text-center leading-none', v.status === 'cancelled' ? 'bg-surface-2 text-muted' : 'bg-tone-soft text-tone-ink tone-7')}>
                                  <span className="text-[18px] font-bold tabular">{d.getDate()}</span>
                                  <span className="mt-0.5 text-[10.5px] font-semibold tabular">{formatDateTimeKa(v.startsAt).split(', ').pop()}</span>
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className={cn('block truncate text-[14px] font-medium', v.status === 'cancelled' && 'text-muted line-through')}>{v.title}</span>
                                  <span className="block truncate text-[12.5px] text-muted">{v.address ?? formatDateKa(v.startsAt)}</span>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </SectionCard>
                  </div>
                ),
              },
              {
                value: 'requirements',
                label: t('detail.tabs.requirements'),
                content: (
                  <RequirementsEditor
                    key={JSON.stringify(req)}
                    contactId={c.id}
                    value={req}
                    onSaved={() => {
                      refresh();
                      changeTab('matches');
                    }}
                  />
                ),
              },
            ]}
          />
        </div>

        {/* Right info panel */}
        <aside className="flex flex-col gap-4 lg:pt-[60px]">
          <SectionCard title={t('detail.contactInfo')} icon={UserRound} tone={2} bodyClassName="px-4 pb-3 pt-1 md:px-5 md:pb-4 md:pt-1">
            <div className="divide-y divide-border">
              <InfoRow icon={Phone} label={t('columns.phone')}>
                {c.phones.length ? (
                  <span className="flex flex-col gap-1">
                    {c.phones.map((p) => (
                      <CallButton key={p} phone={p} entityId={c.id} variant="ghost" onLogged={refresh} className="-ml-3 h-8 self-start" />
                    ))}
                  </span>
                ) : (
                  <span className="font-normal text-muted">{t('detail.noPhone')}</span>
                )}
              </InfoRow>
              {c.emails.length > 0 && (
                <InfoRow icon={Mail} label={t('detail.email')}>
                  {c.emails.map((e) => (
                    <a key={e} href={`mailto:${e}`} className="block truncate text-link hover:underline">
                      {e}
                    </a>
                  ))}
                </InfoRow>
              )}
              <InfoRow icon={ClipboardList} label={t('detail.source')}>
                {facets?.sources.find((s) => s.key === c.source)?.name ?? c.source ?? '—'}
              </InfoRow>
              <InfoRow icon={Clock} label={t('detail.lastContacted')}>
                {c.lastContactedAt ? relativeDaysKa(c.lastContactedAt) : '—'}
                <span className="font-normal text-muted"> · {t('detail.created')} {formatDateKa(c.createdAt)}</span>
              </InfoRow>
            </div>
            <div className="mt-2 rounded-2xl bg-surface-2/70 p-3">
              <div className="mb-2 text-[12.5px] font-medium text-muted">{t('detail.owner')}</div>
              {role === 'agent' ? (
                <div className="flex items-center gap-2 font-semibold">
                  {c.ownerAgentName && <PersonAvatar name={c.ownerAgentName} size={28} />}
                  {c.ownerAgentName ?? '—'}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <PersonAvatar name={c.ownerAgentName ?? '?'} size={32} />
                  <MemberSelect
                    className="min-w-0 flex-1"
                    value={c.ownerAgentId}
                    onChange={async (v) => {
                      try {
                        await mutateApi(`/crm/contacts/${c.id}`, { method: 'PATCH', body: { ownerAgentId: v } });
                        toast({ title: t('detail.reassigned'), tone: 'success' });
                        void mutate();
                      } catch (e) {
                        toast({ title: errorMessage(e), tone: 'danger' });
                      }
                    }}
                  />
                </div>
              )}
            </div>
            {c.notes && (
              <div className="mt-3 rounded-2xl border border-accent/30 bg-accent-soft p-3">
                <div className="text-[12.5px] font-semibold text-muted">{t('detail.notes')}</div>
                <p className="mt-1 whitespace-pre-wrap text-[14px]">{c.notes}</p>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={t('requirements.title')}
            icon={ClipboardList}
            tone={3}
            bodyClassName="px-4 pb-4 pt-2 md:px-5 md:pb-5 md:pt-2"
            action={
              <Button variant="ghost" size="sm" onClick={() => changeTab('requirements')} aria-label={`${t('detail.edit')}: ${t('requirements.title')}`} className="size-8 px-0">
                <Pencil className="size-4" strokeWidth={2} aria-hidden />
              </Button>
            }
          >
            {req ? (
              <dl className="grid grid-cols-2 gap-2">
                {req.businessType && <ReqItem label={t('requirements.businessType')} value={BUSINESS_TYPE_BY_SLUG[req.businessType]?.nameKa ?? req.businessType} wide />}
                {req.dealType && <ReqItem label={t('requirements.dealType')} value={DEAL_TYPE_LABELS_KA[req.dealType]} />}
                {req.budgetMaxMinor != null && <ReqItem label={t('requirements.budget')} value={formatMoney(req.budgetMaxMinor)} />}
                {(req.areaMin != null || req.areaMax != null) && <ReqItem label={t('requirements.area')} value={`${req.areaMin != null ? formatArea(req.areaMin) : '…'} – ${req.areaMax != null ? formatArea(req.areaMax) : '…'}`} wide />}
                {!!req.districtIds?.length && (
                  <div className="col-span-2">
                    <dt className="mb-1 text-[12.5px] text-muted">{t('requirements.districts')}</dt>
                    <dd className="flex flex-wrap gap-1">
                      {req.districtIds
                        .map((d) => districts.find((x) => x.id === d)?.nameKa)
                        .filter(Boolean)
                        .map((n) => (
                          <Pill key={n} tone={2} size="sm">
                            {n}
                          </Pill>
                        ))}
                    </dd>
                  </div>
                )}
              </dl>
            ) : (
              <button type="button" onClick={() => changeTab('requirements')} className="w-full rounded-2xl border-2 border-dashed border-border p-4 text-center text-[13.5px] text-muted transition-colors hover:border-border-strong hover:text-text">
                {t('requirements.none')}
              </button>
            )}
            {matchesTotal > 0 && (
              <button type="button" onClick={() => changeTab('matches')} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-primary-soft px-3 py-2.5 text-left text-primary-soft-text transition-all hover:shadow-sm">
                <Building2 className="size-4 shrink-0" strokeWidth={2} aria-hidden />
                <span className="min-w-0 flex-1 text-[13.5px]">
                  <span className="font-bold tabular">{matchesTotal}</span> {t('detail.tabs.matches')}
                  {feedback > 0 && (
                    <span className="opacity-80">
                      {' '}
                      · {t('matches.feedback')}: <span className="tabular">{feedback}</span>
                    </span>
                  )}
                </span>
                <ChevronRight className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              </button>
            )}
          </SectionCard>

          <PortalLink contactId={c.id} token={c.portalToken} onChanged={() => mutate()} />
        </aside>
      </div>

      {editing && <ContactFormDialog open={editing} onOpenChange={setEditing} contact={c} onSaved={refresh} />}
      <Dialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t('detail.delete')}
        description={t('detail.deleteConfirm')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {common('cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  await mutateApi(`/crm/contacts/${c.id}`, { method: 'DELETE' });
                  toast({ title: t('detail.deleted') });
                  router.push('/contacts');
                } catch (e) {
                  toast({ title: errorMessage(e), tone: 'danger' });
                }
              }}
            >
              {t('detail.delete')}
            </Button>
          </>
        }
      />
    </div>
  );
}

function ReqItem({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn('rounded-xl bg-surface-2/70 px-3 py-2', wide && 'col-span-2')}>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="truncate text-[14px] font-semibold tabular">{value}</dd>
    </div>
  );
}
