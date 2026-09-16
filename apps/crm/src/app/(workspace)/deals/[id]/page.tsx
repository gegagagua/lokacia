'use client';
import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CalendarPlus, FilePlus2, ListPlus, Presentation, RotateCcw, Trash2, Trophy, XCircle } from 'lucide-react';
import { dealFinance, formatArea, formatDateKa, formatDateTimeKa, formatMoney } from '@lokacia/contracts';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Skeleton, SpecRow, Tabs, useToast } from '@lokacia/ui';
import { CallButton } from '@/components/common/call-button';
import { PageHeader } from '@/components/common/page-header';
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

  const overview = (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">{t('fields.contact')}</h2>
          {deal.contact ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Link href={`/contacts/${deal.contact.id}`} className="font-medium hover:underline">
                  {deal.contact.name}
                </Link>
                {deal.contact.company && <div className="text-small text-muted">{deal.contact.company}</div>}
                {deal.contact.emails[0] && <div className="text-small text-muted">{deal.contact.emails[0]}</div>}
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
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">{t('fields.listing')}</h2>
          {deal.listing ? (
            <div className="flex gap-3">
              {deal.listing.cover && <img src={deal.listing.cover} alt="" className="h-20 w-28 shrink-0 rounded-photo border border-border object-cover" />}
              <div className="min-w-0">
                <Link href={`/listings/${deal.listing.id}`} className="font-medium hover:underline">
                  {deal.listing.title}
                </Link>
                <div className="text-small text-muted">{deal.listing.address}</div>
                <div className="mt-1 text-small tabular">
                  {formatMoney(deal.listing.priceMinor)} · {formatArea(deal.listing.areaM2)}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted">{t('detail.noListing')}</p>
          )}
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">{t('detail.stageHistory')}</h2>
          <ol className="flex flex-col">
            {deal.stageHistory.map((h, i) => (
              <li key={i} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border py-1.5 text-small last:border-b-0">
                <span>
                  {h.from ? `${stageName(h.from)} → ` : ''}
                  <span className="font-medium">{stageName(h.to)}</span>
                  {h.lostReason && <span className="text-danger"> — {h.lostReason}</span>}
                </span>
                <span className="text-muted tabular">
                  {formatDateTimeKa(h.at)}
                  {h.by ? ` · ${h.by}` : ''}
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <SpecRow label={t('fields.stage')} value={stageName(deal.stage)} />
          {deal.valueMinor != null && <SpecRow label={t('fields.value')} value={formatMoney(deal.valueMinor)} />}
          <SpecRow label={t('fields.source')} value={deal.source ?? '—'} />
          <SpecRow label={t('fields.createdAt')} value={formatDateKa(deal.createdAt)} />
          {deal.closedAt && <SpecRow label={t('fields.closedAt')} value={formatDateKa(deal.closedAt)} />}
          <div className="mt-3 flex flex-col gap-3">
            <Field label={t('fields.expectedCloseAt')}>
              <Input type="date" defaultValue={deal.expectedCloseAt?.slice(0, 10) ?? ''} onBlur={(e) => e.target.value !== (deal.expectedCloseAt?.slice(0, 10) ?? '') && patch({ expectedCloseAt: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })} />
            </Field>
            <Field label={t('agent')}>
              {can('deals.viewAll') ? <MemberSelect value={deal.agentId} onChange={(v) => patch({ agentId: v })} /> : <Input value={deal.agentName ?? '—'} readOnly />}
            </Field>
          </div>
        </Card>
        <Card className="p-4">
          <h2 className="mb-2 font-semibold">{t('detail.nextSteps')}</h2>
          <div className="flex flex-col gap-2">
            <Button asChild variant="secondary" size="sm" className="justify-start">
              <Link href={`/calendar?new=1&dealId=${deal.id}&contactId=${deal.contactId}${deal.listingId ? `&listingId=${deal.listingId}` : ''}`}>
                <CalendarPlus className="size-4" strokeWidth={1.5} aria-hidden /> {t('detail.planViewing')}
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="justify-start">
              <Link href={`/tasks?new=1&dealId=${deal.id}&contactId=${deal.contactId}`}>
                <ListPlus className="size-4" strokeWidth={1.5} aria-hidden /> {t('detail.addTask')}
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="justify-start">
              <Link href={`/documents?new=1&dealId=${deal.id}&contactId=${deal.contactId}`}>
                <FilePlus2 className="size-4" strokeWidth={1.5} aria-hidden /> {t('detail.createDocument')}
              </Link>
            </Button>
            <Button asChild variant="secondary" size="sm" className="justify-start">
              <Link href={`/presentations?new=1&contactId=${deal.contactId}${deal.listingId ? `&listingIds=${deal.listingId}` : ''}`}>
                <Presentation className="size-4" strokeWidth={1.5} aria-hidden /> {t('detail.createPresentation')}
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );

  const tabs = [
    { value: 'overview', label: t('detail.overview'), content: overview },
    ...(deal.finance ? [{ value: 'finance', label: t('detail.finance'), content: <FinanceTab deal={deal} onSave={patch} /> }] : []),
    { value: 'timeline', label: t('detail.timeline'), content: <div className="max-w-2xl"><ActivityTimeline key={timelineKey} entity="deal" entityId={deal.id} stageName={stageName} /></div> },
  ];

  return (
    <div>
      <PageHeader
        back={
          <Link href="/deals" className="inline-flex items-center gap-1 text-link hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={1.5} aria-hidden /> {t('detail.back')}
          </Link>
        }
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {deal.title}
            {kind === 'won' && <Badge tone="success">{t('detail.won')}</Badge>}
            {kind === 'lost' && <Badge tone="danger">{t('detail.lost')}</Badge>}
          </span>
        }
        subtitle={deal.contactName ?? undefined}
        actions={
          <>
            <Select aria-label={t('fields.stage')} value={deal.stage} className="w-44" options={stages.map((s) => ({ value: s.key, label: s.name }))} onChange={(e) => (stages.find((s) => s.key === e.target.value)?.kind === 'lost' ? setLostOpen(true) : move(e.target.value))} />
            {kind === 'open' ? (
              <>
                <Button variant="secondary" icon={<Trophy className="size-4 text-success" strokeWidth={1.5} aria-hidden />} onClick={() => move(stages.find((s) => s.kind === 'won')!.key)}>
                  {t('detail.markWon')}
                </Button>
                <Button variant="danger" icon={<XCircle className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => setLostOpen(true)}>
                  {t('detail.markLost')}
                </Button>
              </>
            ) : (
              <Button variant="secondary" icon={<RotateCcw className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => move(firstOpen)}>
                {t('detail.reopen')}
              </Button>
            )}
            {can('records.delete') && (
              <Button
                variant="ghost"
                aria-label={t('detail.delete')}
                icon={<Trash2 className="size-4 text-danger" strokeWidth={1.5} aria-hidden />}
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
              />
            )}
          </>
        }
      />
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
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <h2 className="font-semibold">{t('finance.calculator')}</h2>
        <p className="mb-4 text-small text-muted">{t('finance.calculatorHint')}</p>
        <div className="flex flex-col gap-3">
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
      </Card>
      <Card className="p-4" aria-live="polite">
        <SpecRow label={t('finance.commission')} value={formatMoney(live.commissionMinor)} />
        <SpecRow label={t('finance.agentShare')} value={formatMoney(live.agentMinor)} />
        <SpecRow label={t('finance.agencyShare')} value={formatMoney(live.agencyMinor)} />
        <div className="my-3 flex h-3 overflow-hidden rounded-[2px] border border-border-strong" role="img" aria-label={`${t('finance.agentShare')} ${commissionShare}%`}>
          <div className="bg-primary" style={{ width: `${commissionShare}%` }} />
          <div className="flex-1 bg-surface-2" />
        </div>
        <SpecRow label={t('finance.probability')} value={`${f.probabilityPct}%`} muted />
        <SpecRow label={t('finance.expected')} value={formatMoney(expected)} />
      </Card>
    </div>
  );
}
