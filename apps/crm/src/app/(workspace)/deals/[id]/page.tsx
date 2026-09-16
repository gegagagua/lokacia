'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowUpRight, Briefcase, Building2, Calculator, CalendarCheck, CalendarClock, CalendarPlus, CalendarPlus2, Check, ClipboardList, Clock3, FilePlus2, Flag, History, ListPlus, Mail, MapPin, Megaphone, Presentation, RotateCcw, Sparkles, Trash2, Trophy, UserRound, XCircle, type LucideIcon } from 'lucide-react';
import { dealFinance, formatArea, formatDateKa, formatDateTimeKa, formatMoney } from '@lokacia/contracts';
import { Button, cn, EmptyState, Field, IconButton, Input, Skeleton, Tabs, useToast } from '@lokacia/ui';
import { CallButton } from '@/components/common/call-button';
import { EmptyHint, IconTile, PersonAvatar, Pill, SectionCard, toneClass, type Tone } from '@/components/common/ui';
import { dueState, stageColor } from '@/components/deals/deal-card';
import { MemberSelect } from '@/components/common/pickers';
import { ActivityTimeline } from '@/components/common/timeline';
import { LostReasonDialog } from '@/components/deals/lost-reason-dialog';
import { toGel, toMinor, type DealDetail } from '@/components/deals/types';
import { ClientApiError, errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';

export default function DealPage() {
  const { id } = useParams<{ id: string }>();
  const t = useTranslations('deals');
  const router = useRouter();
  const toast = useToast();
  const mutateApi = useApiMutation();
  const { can } = useCrm();
  const { data: deal, mutate, error } = useApi<DealDetail>(`/crm/deals/${id}`);
  const [lostOpen, setLostOpen] = React.useState(false);
  const [timelineKey, setTimelineKey] = React.useState(0);

  if (error instanceof ClientApiError && error.status === 404) return <EmptyState title={t('empty')} action={<Link href="/deals" className="text-link underline">{t('detail.back')}</Link>} />;
  if (!deal) return <Skeleton className="h-96" />;

  const stages = deal.pipeline.stages;
  const stageName = (k: string) => stages.find((s) => s.key === k)?.name ?? k;
  const kind = stages.find((s) => s.key === deal.stage)?.kind ?? 'open';
  const firstOpen = stages.find((s) => s.kind === 'open')?.key ?? stages[0]!.key;

  const move = async (stage: string, lostReason?: string) => {
    try {
      const updated = await mutateApi<DealDetail>(`/crm/deals/${id}/move`, { body: { stage, position: 0, ...(lostReason ? { lostReason } : {}) } });
      await mutate(updated, { revalidate: false });
      setTimelineKey((k) => k + 1);
      toast({ title: t('moved', { stage: stageName(stage) }), tone: 'success' });
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    }
  };
  const patch = async (body: Record<string, unknown>) => {
    try {
      const updated = await mutateApi<DealDetail>(`/crm/deals/${id}`, { method: 'PATCH', body });
      await mutate(updated, { revalidate: false });
      toast({ title: t('detail.saved'), tone: 'success' });
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    }
  };

  let openCount = -1;
  const colors = stages.map((s) => (s.kind === 'open' ? stageColor('open', ++openCount) : stageColor(s.kind, 0)));
  const colorOf = (k: string) => colors[stages.findIndex((s) => s.key === k)] ?? 'var(--tone-8)';
  const openStages = stages.filter((s) => s.kind === 'open');
  const currentIdx = openStages.findIndex((s) => s.key === deal.stage);
  const due = dueState(deal);

  const overview = (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-5">
        <SectionCard title={t('fields.contact')} icon={UserRound} tone={2} action={deal.contact && <Button asChild variant="ghost" size="sm"><Link href={`/contacts/${deal.contact.id}`}>{t('detail.openContact')} <ArrowUpRight className="size-4" strokeWidth={2} aria-hidden /></Link></Button>}>
          {deal.contact ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3.5">
                <PersonAvatar name={deal.contact.name} size={48} />
                <div className="min-w-0">
                  <Link href={`/contacts/${deal.contact.id}`} className="block truncate text-[16px] font-semibold hover:text-primary-soft-text">
                    {deal.contact.name}
                  </Link>
                  {deal.contact.company && <div className="flex items-center gap-1.5 text-small text-muted"><Briefcase className="size-3.5" strokeWidth={2} aria-hidden />{deal.contact.company}</div>}
                  {deal.contact.emails[0] && <div className="flex items-center gap-1.5 text-small text-muted"><Mail className="size-3.5" strokeWidth={2} aria-hidden />{deal.contact.emails[0]}</div>}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {deal.contact.phones.map((p) => (
                  <CallButton key={p} phone={p} entity="deal" entityId={deal.id} onLogged={() => setTimelineKey((k) => k + 1)} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted">{t('detail.noContact')}</p>
          )}
        </SectionCard>
        <SectionCard title={t('fields.listing')} icon={Building2} tone={6} action={deal.listing && <Button asChild variant="ghost" size="sm"><Link href={`/listings/${deal.listing.id}`}>{t('detail.openListing')} <ArrowUpRight className="size-4" strokeWidth={2} aria-hidden /></Link></Button>}>
          {deal.listing ? (
            <Link href={`/listings/${deal.listing.id}`} className="group flex flex-col gap-4 sm:flex-row">
              <div className="aspect-[4/3] w-full shrink-0 overflow-hidden rounded-photo bg-surface-2 sm:w-44">
                {deal.listing.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={deal.listing.cover} alt="" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                ) : (
                  <span className="grid size-full place-items-center text-muted"><Building2 className="size-8" strokeWidth={1.5} aria-hidden /></span>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[16px] font-semibold leading-6 group-hover:text-primary-soft-text">{deal.listing.title}</div>
                <div className="mt-1 flex items-center gap-1.5 text-small text-muted"><MapPin className="size-3.5 shrink-0" strokeWidth={2} aria-hidden /><span className="truncate">{deal.listing.address}</span></div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill tone="primary">{formatMoney(deal.listing.priceMinor)}</Pill>
                  <Pill tone="neutral">{formatArea(deal.listing.areaM2)}</Pill>
                </div>
              </div>
            </Link>
          ) : (
            <EmptyHint icon={Building2} title={t('detail.noListing')} className="py-4" />
          )}
        </SectionCard>
        <SectionCard title={t('detail.stageHistory')} icon={History} tone={4}>
          <ol className="relative flex flex-col gap-4 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-0.5 before:rounded-full before:bg-border">
            {deal.stageHistory.map((h, i) => (
              <li key={i} className="relative flex flex-wrap items-start justify-between gap-x-4 gap-y-0.5 pl-7">
                <span aria-hidden className="absolute left-0 top-1 size-4 rounded-full border-[3px] border-surface" style={{ background: colorOf(h.to), boxShadow: `0 0 0 2px color-mix(in srgb, ${colorOf(h.to)} 30%, transparent)` }} />
                <span className="text-[14px]">
                  {h.from ? <span className="text-muted">{stageName(h.from)} → </span> : ''}
                  <span className="font-semibold">{stageName(h.to)}</span>
                  {h.lostReason && <span className="text-danger"> — {h.lostReason}</span>}
                </span>
                <span className="text-small text-muted tabular">
                  {formatDateTimeKa(h.at)}
                  {h.by ? ` · ${h.by}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </SectionCard>
      </div>
      <div className="flex flex-col gap-5">
        <SectionCard title={t('detail.details')} icon={ClipboardList} tone={8}>
          <dl className="flex flex-col gap-3 text-[14px]">
            <DetailRow icon={Flag} label={t('fields.stage')}>
              <StagePill name={stageName(deal.stage)} color={colorOf(deal.stage)} />
            </DetailRow>
            <DetailRow icon={Megaphone} label={t('fields.source')}>{deal.source ?? '—'}</DetailRow>
            <DetailRow icon={CalendarPlus2} label={t('fields.createdAt')}>{formatDateKa(deal.createdAt)}</DetailRow>
            {deal.closedAt && <DetailRow icon={CalendarCheck} label={t('fields.closedAt')}>{formatDateKa(deal.closedAt)}</DetailRow>}
          </dl>
          <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
            <Field label={t('fields.expectedCloseAt')}>
              <Input type="date" defaultValue={deal.expectedCloseAt?.slice(0, 10) ?? ''} onBlur={(e) => e.target.value !== (deal.expectedCloseAt?.slice(0, 10) ?? '') && patch({ expectedCloseAt: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })} />
            </Field>
            <Field label={t('agent')}>
              {can('deals.viewAll') ? <MemberSelect value={deal.agentId} onChange={(v) => patch({ agentId: v })} /> : <Input value={deal.agentName ?? '—'} readOnly />}
            </Field>
          </div>
        </SectionCard>
        <SectionCard title={t('detail.nextSteps')} icon={Sparkles} tone={3}>
          <div className="grid grid-cols-2 gap-2.5">
            <NextStep href={`/calendar?new=1&dealId=${deal.id}&contactId=${deal.contactId}${deal.listingId ? `&listingId=${deal.listingId}` : ''}`} icon={CalendarPlus} tone={7} label={t('detail.planViewing')} />
            <NextStep href={`/tasks?new=1&dealId=${deal.id}&contactId=${deal.contactId}`} icon={ListPlus} tone={4} label={t('detail.addTask')} />
            <NextStep href={`/documents?new=1&dealId=${deal.id}&contactId=${deal.contactId}`} icon={FilePlus2} tone={2} label={t('detail.createDocument')} />
            <NextStep href={`/presentations?new=1&contactId=${deal.contactId}${deal.listingId ? `&listingIds=${deal.listingId}` : ''}`} icon={Presentation} tone={5} label={t('detail.createPresentation')} />
          </div>
        </SectionCard>
      </div>
    </div>
  );

  const tabs = [
    { value: 'overview', label: t('detail.overview'), content: overview },
    ...(deal.finance ? [{ value: 'finance', label: t('detail.finance'), content: <FinanceTab deal={deal} onSave={patch} /> }] : []),
    { value: 'timeline', label: t('detail.timeline'), content: <div className="card max-w-3xl p-4 md:p-6"><ActivityTimeline key={timelineKey} entity="deal" entityId={deal.id} stageName={stageName} /></div> },
  ];

  const toStage = (key: string) => {
    if (key === deal.stage) return;
    if (stages.find((s) => s.key === key)?.kind === 'lost') setLostOpen(true);
    else void move(key);
  };

  return (
    <div>
      <div className="mb-3">
        <Link href="/deals" className="inline-flex items-center gap-1.5 rounded-full px-1 text-small font-medium text-muted transition-colors hover:text-text">
          <ArrowLeft className="size-4" strokeWidth={2} aria-hidden /> {t('detail.back')}
        </Link>
      </div>
      <header className="card relative mb-5 overflow-hidden">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: colorOf(deal.stage) }} />
        <div className="crm-wash flex flex-col gap-5 p-5 md:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <PersonAvatar name={deal.contactName ?? deal.title} size={56} className="hidden sm:inline-grid" />
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                {kind === 'open' && <StagePill name={stageName(deal.stage)} color={colorOf(deal.stage)} />}
                {kind === 'won' && <Pill tone="success" icon={Trophy}>{t('detail.won')}</Pill>}
                {kind === 'lost' && <Pill tone="danger" icon={XCircle}>{t('detail.lost')}</Pill>}
                {due === 'overdue' && kind === 'open' && <Pill tone="danger" icon={CalendarClock}>{t('due.overdue')}</Pill>}
                <Pill tone="neutral" icon={Clock3}>{t('daysInStage', { days: deal.daysInStage })}</Pill>
              </div>
              <h1 className="text-[22px] font-bold leading-8 tracking-tight md:text-[28px] md:leading-9">{deal.title}</h1>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-muted">
                {deal.contactName && <span className="inline-flex items-center gap-1.5"><UserRound className="size-4" strokeWidth={2} aria-hidden />{deal.contactName}</span>}
                {deal.agentName && (
                  <span className="inline-flex items-center gap-1.5">
                    <PersonAvatar name={deal.agentName} size={20} />
                    {deal.agentName}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-3 lg:items-end">
            {deal.valueMinor != null && (
              <div className="lg:text-right">
                <div className="text-[12.5px] font-medium text-muted">{t('fields.value')}</div>
                <div className="text-[30px] font-bold leading-9 tracking-tight tabular">{formatMoney(deal.valueMinor)}</div>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2">
              {kind === 'open' ? (
                <>
                  <Button size="sm" variant="secondary" icon={<Trophy className="size-4 text-success" strokeWidth={2} aria-hidden />} onClick={() => move(stages.find((s) => s.kind === 'won')!.key)}>
                    {t('detail.markWon')}
                  </Button>
                  <Button size="sm" variant="danger" icon={<XCircle className="size-4" strokeWidth={2} aria-hidden />} onClick={() => setLostOpen(true)}>
                    {t('detail.markLost')}
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="secondary" icon={<RotateCcw className="size-4" strokeWidth={2} aria-hidden />} onClick={() => move(firstOpen)}>
                  {t('detail.reopen')}
                </Button>
              )}
              {can('records.delete') && (
                <IconButton
                  size="sm"
                  variant="ghost"
                  label={t('detail.delete')}
                  className="text-danger hover:bg-danger/10"
                  onClick={async () => {
                    if (!window.confirm(t('detail.deleteConfirm'))) return;
                    try {
                      await mutateApi(`/crm/deals/${id}`, { method: 'DELETE' });
                      toast({ title: t('detail.deleted'), tone: 'success' });
                      router.push('/deals');
                    } catch (e) {
                      toast({ title: errorMessage(e), tone: 'danger' });
                    }
                  }}
                >
                  <Trash2 className="size-4" strokeWidth={2} aria-hidden />
                </IconButton>
              )}
            </div>
          </div>
        </div>
        <nav aria-label={t('fields.stage')} className="border-t border-border bg-surface-2/50 px-3 py-3 md:px-5">
          <ol className="scrollbar-none flex items-stretch gap-1.5 overflow-x-auto">
            {stages.map((s, i) => {
              const current = s.key === deal.stage;
              const passed = kind === 'won' ? s.kind === 'open' : kind === 'open' && s.kind === 'open' && openStages.indexOf(s) < currentIdx;
              const c = colors[i]!;
              return (
                <li key={s.key} className={cn('min-w-[112px] flex-1', s.kind !== 'open' && 'min-w-[104px] flex-none md:flex-1')}>
                  <button
                    type="button"
                    onClick={() => toStage(s.key)}
                    aria-current={current ? 'step' : undefined}
                    className={cn(
                      'flex h-10 w-full items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition-all duration-200 focus-visible:shadow-ring focus-visible:outline-none',
                      current ? 'text-surface shadow-sm' : passed ? 'hover:brightness-95' : 'bg-surface text-muted ring-1 ring-inset ring-border hover:text-text hover:ring-border-strong',
                    )}
                    style={current ? { background: c } : passed ? { background: `color-mix(in srgb, ${c} 16%, transparent)`, color: `color-mix(in srgb, ${c} 70%, var(--text))` } : undefined}
                  >
                    {passed && <Check className="size-3.5 shrink-0" strokeWidth={2.6} aria-hidden />}
                    {s.kind === 'won' && !passed && <Trophy className="size-3.5 shrink-0" strokeWidth={2.2} aria-hidden />}
                    {s.kind === 'lost' && <XCircle className="size-3.5 shrink-0" strokeWidth={2.2} aria-hidden />}
                    <span className="truncate">{s.name}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>
      <Tabs tabs={tabs} />
      <LostReasonDialog
        open={lostOpen}
        onCancel={() => setLostOpen(false)}
        onConfirm={async (reason) => {
          setLostOpen(false);
          await move(stages.find((s) => s.kind === 'lost')!.key, reason);
        }}
      />
    </div>
  );
}

function StagePill({ name, color }: { name: string; color: string }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold" style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color: `color-mix(in srgb, ${color} 72%, var(--text))` }}>
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: color }} />
      {name}
    </span>
  );
}

function DetailRow({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-muted">
        <Icon className="size-4 shrink-0" strokeWidth={2} aria-hidden />
        {label}
      </dt>
      <dd className="min-w-0 truncate text-right font-semibold">{children}</dd>
    </div>
  );
}

function NextStep({ href, icon, tone, label }: { href: string; icon: LucideIcon; tone: Tone; label: string }) {
  return (
    <Link href={href} className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-surface p-3 text-[13.5px] font-semibold leading-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-sm focus-visible:shadow-ring focus-visible:outline-none">
      <IconTile icon={icon} tone={tone} size="sm" />
      {label}
    </Link>
  );
}

/** C18: commission calculator with live preview; saves value/commission%/agent share to the deal. */
function FinanceTab({ deal, onSave }: { deal: DealDetail; onSave: (b: Record<string, unknown>) => Promise<void> }) {
  const t = useTranslations('deals');
  const f = deal.finance!;
  const [value, setValue] = React.useState(toGel(f.valueMinor));
  const [pct, setPct] = React.useState(String(f.commissionPct));
  const [share, setShare] = React.useState(String(f.agentSharePct));
  const [busy, setBusy] = React.useState(false);
  const live = dealFinance(toMinor(value), Number(pct || 0), Number(share || 0));
  const expected = Math.round((live.commissionMinor * f.probabilityPct) / 100);
  const commissionShare = live.commissionMinor ? Math.round((live.agentMinor / live.commissionMinor) * 100) : 0;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <SectionCard title={t('finance.calculator')} description={t('finance.calculatorHint')} icon={Calculator} tone={2}>
        <div className="flex flex-col gap-4">
          <Field label={t('fields.value')}>
            <Input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className="tabular" suffix="₾" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('fields.commissionPct')}>
              <Input type="number" min={0} max={100} step="0.01" value={pct} onChange={(e) => setPct(e.target.value)} className="tabular" />
            </Field>
            <Field label={t('fields.agentSharePct')}>
              <Input type="number" min={0} max={100} step="1" value={share} onChange={(e) => setShare(e.target.value)} className="tabular" />
            </Field>
          </div>
          <Button
            loading={busy}
            className="self-start"
            onClick={async () => {
              setBusy(true);
              await onSave({ valueMinor: toMinor(value), commissionPct: Number(pct || 0), agentSharePct: Number(share || 0) });
              setBusy(false);
            }}
          >
            {t('finance.save')}
          </Button>
        </div>
      </SectionCard>
      <section className="card overflow-hidden" aria-live="polite" aria-label={t('finance.commission')}>
        <div className="hero-gradient p-5 md:p-6">
          <div className="text-[13px] font-medium opacity-80">{t('finance.commission')}</div>
          <div className="mt-1 text-[36px] font-bold leading-[44px] tracking-tight tabular">{formatMoney(live.commissionMinor)}</div>
          <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/15" role="img" aria-label={`${t('finance.agentShare')} ${commissionShare}%`}>
            <div className="rounded-full bg-accent transition-[width] duration-500" style={{ width: `${commissionShare}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[12.5px] font-medium opacity-85 tabular">
            <span>{t('finance.agentShare')} · {commissionShare}%</span>
            <span>{t('finance.agencyShare')} · {100 - commissionShare}%</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 p-5 md:p-6">
          <FinanceFigure tone="accent" label={t('finance.agentShare')} value={formatMoney(live.agentMinor)} />
          <FinanceFigure tone="primary" label={t('finance.agencyShare')} value={formatMoney(live.agencyMinor)} />
          <FinanceFigure tone={4} label={t('finance.probability')} value={`${f.probabilityPct}%`} />
          <FinanceFigure tone={2} label={t('finance.expected')} value={formatMoney(expected)} />
        </div>
      </section>
    </div>
  );
}

function FinanceFigure({ tone, label, value }: { tone: Tone; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-3.5">
      <div className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
        <span aria-hidden className={cn('size-2 rounded-full bg-tone', toneClass(tone))} />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1 text-[18px] font-bold tracking-tight tabular">{value}</div>
    </div>
  );
}
