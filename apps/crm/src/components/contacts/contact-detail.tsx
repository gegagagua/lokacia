'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Mail, Pencil, Plus, Trash2 } from 'lucide-react';
import { BUSINESS_TYPE_BY_SLUG, DEAL_TYPE_LABELS_KA, formatArea, formatDateKa, formatDateTimeKa, formatMoney, relativeDaysKa } from '@lokacia/contracts';
import { Badge, Button, cn, Dialog, EmptyState, Skeleton, SpecRow, Tabs, useToast } from '@lokacia/ui';
import { CallButton } from '@/components/common/call-button';
import { PageHeader } from '@/components/common/page-header';
import { MemberSelect } from '@/components/common/pickers';
import { ActivityTimeline } from '@/components/common/timeline';
import { ClientApiError, errorMessage } from '@/lib/api-client';
import { Can, useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';
import { ContactFormDialog } from './contact-form-dialog';
import { TYPE_TONE } from './contacts-list';
import { MatchesPanel } from './matches-panel';
import { PortalLink } from './portal-link';
import { RequirementsEditor } from './requirements-editor';
import type { ContactDetail, ContactFacets, District } from './types';

const TABS = ['overview', 'requirements', 'matches', 'timeline'] as const;
type Tab = (typeof TABS)[number];

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
  const [tab, setTab] = React.useState<Tab>((TABS as readonly string[]).includes(initialTab ?? '') ? (initialTab as Tab) : 'overview');
  const [editing, setEditing] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [timelineKey, setTimelineKey] = React.useState(0);

  const stageName = (k: string) => workspace?.pipeline?.stages.find((s) => s.key === k)?.name ?? k;
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
  if (!c) return <Skeleton className="h-64" />;

  const refresh = () => {
    void mutate();
    setTimelineKey((k) => k + 1);
  };
  const req = c.requirements;
  const feedback = (c.matches.liked ?? 0) + (c.matches.disliked ?? 0);
  const matchesTotal = Object.values(c.matches).reduce((a, b) => a + (b ?? 0), 0);

  return (
    <div>
      <PageHeader
        back={
          <Link href="/contacts" className="inline-flex items-center gap-1 text-muted hover:text-text">
            <ArrowLeft className="size-3.5" strokeWidth={1.5} aria-hidden />
            {t('detail.back')}
          </Link>
        }
        title={c.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={TYPE_TONE[c.type]}>{t(`types.${c.type}`)}</Badge>
            {c.company && <span>{c.company}</span>}
            {c.tags.map((tag) => (
              <Badge key={tag} tone="outline">
                {tag}
              </Badge>
            ))}
          </span>
        }
        actions={
          <>
            {c.phones.map((p) => (
              <CallButton key={p} phone={p} entityId={c.id} onLogged={refresh} />
            ))}
            {c.emails[0] && (
              <Button asChild variant="secondary" size="sm">
                <a href={`mailto:${c.emails[0]}`}>
                  <Mail className="size-3.5" strokeWidth={1.5} aria-hidden />
                  {c.emails[0]}
                </a>
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)} icon={<Pencil className="size-3.5" strokeWidth={1.5} aria-hidden />}>
              {t('detail.edit')}
            </Button>
            <Can perm="records.delete">
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)} aria-label={t('detail.delete')} icon={<Trash2 className="size-3.5" strokeWidth={1.5} aria-hidden />}>
                <span className="sr-only sm:not-sr-only">{t('detail.delete')}</span>
              </Button>
            </Can>
          </>
        }
      />

      <Tabs
        value={tab}
        onValueChange={changeTab}
        tabs={[
          {
            value: 'overview',
            label: t('detail.tabs.overview'),
            content: (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="flex flex-col gap-4">
                  <section className="rounded-card border border-border bg-surface p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="font-semibold">{t('detail.deals')}</h2>
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/deals?new=1&contactId=${c.id}`}>
                          <Plus className="size-3.5" strokeWidth={1.5} aria-hidden />
                          {t('detail.newDeal')}
                        </Link>
                      </Button>
                    </div>
                    {c.deals.length === 0 ? (
                      <p className="text-small text-muted">{t('detail.noDeals')}</p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {c.deals.map((d) => (
                          <li key={d.id} className="flex items-center justify-between gap-3 py-2">
                            <Link href={`/deals/${d.id}`} className="min-w-0 truncate hover:underline">
                              {d.title}
                            </Link>
                            <span className="flex shrink-0 items-center gap-2 text-small tabular">
                              <Badge tone="neutral">{stageName(d.stage)}</Badge>
                              {formatMoney(d.valueMinor)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                  <div className="grid gap-4 md:grid-cols-2">
                    <section className="rounded-card border border-border bg-surface p-4">
                      <h2 className="mb-2 font-semibold">
                        <Link href="/tasks" className="hover:underline">
                          {t('detail.tasks')}
                        </Link>
                      </h2>
                      {c.tasks.length === 0 ? (
                        <p className="text-small text-muted">{t('detail.noTasks')}</p>
                      ) : (
                        <ul className="divide-y divide-border text-[14px]">
                          {c.tasks.map((task) => {
                            const overdue = !task.doneAt && task.dueAt && new Date(task.dueAt) < new Date();
                            return (
                              <li key={task.id} className="flex items-baseline justify-between gap-2 py-1.5">
                                <span className={cn('min-w-0 truncate', task.doneAt && 'text-muted line-through')}>{task.title}</span>
                                <span className={cn('shrink-0 text-small tabular', overdue ? 'text-danger' : 'text-muted')}>{task.doneAt ? t('detail.done') : task.dueAt ? formatDateKa(task.dueAt) : ''}</span>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>
                    <section className="rounded-card border border-border bg-surface p-4">
                      <h2 className="mb-2 font-semibold">
                        <Link href="/calendar" className="hover:underline">
                          {t('detail.viewings')}
                        </Link>
                      </h2>
                      {c.viewings.length === 0 ? (
                        <p className="text-small text-muted">{t('detail.noViewings')}</p>
                      ) : (
                        <ul className="divide-y divide-border text-[14px]">
                          {c.viewings.map((v) => (
                            <li key={v.id} className="py-1.5">
                              <div className={cn('truncate', v.status === 'cancelled' && 'text-muted line-through')}>{v.title}</div>
                              <div className="text-small text-muted tabular">{formatDateTimeKa(v.startsAt)}</div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </div>
                </div>
                <aside className="flex flex-col gap-4">
                  <section className="rounded-card border border-border bg-surface p-4">
                    <div className="flex flex-col">
                      <div className="border-b border-border pb-2">
                        <div className="mb-1 text-small text-muted">{t('detail.owner')}</div>
                        {role === 'agent' ? (
                          <div className="font-medium">{c.ownerAgentName ?? '—'}</div>
                        ) : (
                          <MemberSelect
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
                        )}
                      </div>
                      <SpecRow label={t('detail.source')} value={facets?.sources.find((s) => s.key === c.source)?.name ?? c.source ?? '—'} />
                      <SpecRow label={t('detail.lastContacted')} value={c.lastContactedAt ? relativeDaysKa(c.lastContactedAt) : '—'} />
                      <SpecRow label={t('detail.created')} value={formatDateKa(c.createdAt)} />
                      {c.phones.length === 0 && <p className="pt-2 text-small text-muted">{t('detail.noPhone')}</p>}
                    </div>
                    {c.notes && (
                      <div className="mt-3 border-t border-border pt-3">
                        <div className="text-small text-muted">{t('detail.notes')}</div>
                        <p className="whitespace-pre-wrap text-[14px]">{c.notes}</p>
                      </div>
                    )}
                  </section>
                  <section className="rounded-card border border-border bg-surface p-4">
                    <div className="mb-1 flex items-center justify-between">
                      <h2 className="font-semibold">{t('requirements.title')}</h2>
                      <button type="button" className="text-small text-link hover:underline" onClick={() => changeTab('requirements')}>
                        {t('detail.edit')}
                      </button>
                    </div>
                    {req ? (
                      <div>
                        {req.businessType && <SpecRow label={t('requirements.businessType')} value={BUSINESS_TYPE_BY_SLUG[req.businessType]?.nameKa ?? req.businessType} />}
                        {req.dealType && <SpecRow label={t('requirements.dealType')} value={DEAL_TYPE_LABELS_KA[req.dealType]} />}
                        {(req.areaMin != null || req.areaMax != null) && <SpecRow label={t('requirements.area')} value={`${req.areaMin != null ? formatArea(req.areaMin) : '…'} – ${req.areaMax != null ? formatArea(req.areaMax) : '…'}`} />}
                        {req.budgetMaxMinor != null && <SpecRow label={t('requirements.budget')} value={formatMoney(req.budgetMaxMinor)} />}
                        {!!req.districtIds?.length && <SpecRow label={t('requirements.districts')} value={req.districtIds.map((d) => districts.find((x) => x.id === d)?.nameKa ?? '').filter(Boolean).join(', ')} />}
                      </div>
                    ) : (
                      <p className="text-small text-muted">{t('requirements.none')}</p>
                    )}
                    {matchesTotal > 0 && (
                      <button type="button" onClick={() => changeTab('matches')} className="mt-3 w-full rounded-button border border-border px-3 py-2 text-left text-small hover:bg-surface-2">
                        <span className="font-medium tabular">{matchesTotal}</span> {t('detail.tabs.matches')}
                        {feedback > 0 && (
                          <span className="text-muted">
                            {' '}
                            · {t('matches.feedback')}: <span className="tabular">{feedback}</span>
                          </span>
                        )}
                      </button>
                    )}
                  </section>
                  <PortalLink contactId={c.id} token={c.portalToken} onChanged={() => mutate()} />
                </aside>
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
          { value: 'matches', label: t('detail.tabs.matches'), count: matchesTotal, content: <MatchesPanel contactId={c.id} onChanged={refresh} /> },
          { value: 'timeline', label: t('detail.tabs.timeline'), content: <ActivityTimeline key={timelineKey} entity="contact" entityId={c.id} stageName={stageName} /> },
        ]}
      />

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
