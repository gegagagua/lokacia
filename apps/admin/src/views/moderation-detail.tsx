'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { AlertTriangle, BadgeCheck, Check, ChevronLeft, ChevronRight, ExternalLink, FileText, Gavel, History, ImageIcon, Info, Ruler, Store, UserRound, X } from 'lucide-react';
import {
  BUSINESS_TYPE_BY_SLUG, DEAL_TYPE_LABELS_KA, LISTING_STATUS_LABELS_KA, PASSPORT_FIELDS, formatArea, formatDateKa, formatDateTimeKa, formatMoney, type ModerationDetail,
} from '@lokacia/contracts';
import { Button, SpacePlan, SpecRow, cn } from '@lokacia/ui';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { PageHeader, Section } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { ReasonDialog } from '@/components/reason-dialog';
import { DeltaMeter, InlineEmpty, KeyValues, Person, StatusPill, type Tone } from '@/components/kit';
import { VerificationCard } from './verifications';
import { AuditTable } from './audit';

const PORTAL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3100';

export function ModerationDetailView({ id }: { id: string }) {
  const t = useTranslations('moderation');
  const router = useRouter();
  const { data, error, mutate } = useSWR<ModerationDetail>(`/admin/moderation/listings/${id}`, fetcher);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [photo, setPhoto] = React.useState(0);
  const { run, busy } = useAction();
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock rows={10} />;
  const l = data.listing;
  const photos = l.media.filter((m) => m.kind === 'photo' || m.kind === 'plan');
  const pending = l.status === 'pending_review';
  const current = photos[photo];
  const statusTone: Tone = pending ? 'accent' : l.status === 'active' ? 'success' : l.status === 'rejected' ? 'danger' : 'neutral';

  const approve = async () => {
    const r = await run(() => apiFetch(`/admin/moderation/listings/${id}/approve`, { method: 'POST' }), t('approved'));
    if (r !== undefined) router.push('/moderation');
  };
  const reject = async (reason: string) => {
    const r = await run(() => apiFetch(`/admin/moderation/listings/${id}/reject`, { method: 'POST', body: { reason } }), t('rejected'));
    if (r !== undefined) {
      setRejectOpen(false);
      router.push('/moderation');
    }
  };

  const passportRows = PASSPORT_FIELDS.filter((f) => l.passport[f.key] !== undefined && l.passport[f.key] !== null);
  const pc = data.priceCheck;

  const decisionButtons = (
    <>
      <Button variant="danger" onClick={() => setRejectOpen(true)} icon={<X className="size-[18px]" strokeWidth={2} aria-hidden />}>
        {t('reject')}
      </Button>
      <Button loading={busy} onClick={approve} icon={<Check className="size-[18px]" strokeWidth={2} aria-hidden />}>
        {t('approve')}
      </Button>
    </>
  );

  return (
    <div className={cn(pending && 'pb-24 xl:pb-0')}>
      <PageHeader
        back={{ href: '/moderation', label: t('back') }}
        title={l.title}
        subtitle={`${l.districtName ? `${l.districtName}, ` : ''}${l.address}`}
        actions={
          <>
            <StatusPill tone={statusTone}>{LISTING_STATUS_LABELS_KA[l.status]}</StatusPill>
            <Button asChild variant="secondary" size="sm">
              <a href={`${PORTAL}/listings/${l.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" strokeWidth={2} aria-hidden />
                {t('openOnPortal')}
              </a>
            </Button>
          </>
        }
      />
      {!pending && (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-border bg-surface-2 px-4 py-3 text-[15px]" role="status">
          <Info className="size-5 shrink-0 text-link" strokeWidth={2} aria-hidden />
          {t('notPending')}
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* ---------- left: evidence ---------- */}
        <div className="flex min-w-0 flex-col gap-5">
          <section className="card overflow-hidden" aria-label={t('gallery')}>
            {current ? (
              <>
                <div className="relative bg-surface-2">
                  <img src={current.variants?.lg ?? current.url} alt={current.alt ?? l.title} className="aspect-[16/10] w-full object-contain" />
                  <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-3 py-1 text-[13px] font-semibold text-white backdrop-blur tabular">
                    <ImageIcon className="size-3.5" strokeWidth={2} aria-hidden />
                    {photo + 1} / {photos.length}
                  </span>
                  {photos.length > 1 && (
                    <>
                      <button type="button" aria-label={t('prevPhoto')} onClick={() => setPhoto((p) => (p - 1 + photos.length) % photos.length)} className="absolute left-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-text shadow-md backdrop-blur transition-transform hover:scale-105 focus-visible:shadow-ring focus-visible:outline-none">
                        <ChevronLeft className="size-5" strokeWidth={2} aria-hidden />
                      </button>
                      <button type="button" aria-label={t('nextPhoto')} onClick={() => setPhoto((p) => (p + 1) % photos.length)} className="absolute right-3 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-text shadow-md backdrop-blur transition-transform hover:scale-105 focus-visible:shadow-ring focus-visible:outline-none">
                        <ChevronRight className="size-5" strokeWidth={2} aria-hidden />
                      </button>
                    </>
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto p-3">
                  {photos.map((m, i) => (
                    <button
                      key={m.id}
                      type="button"
                      aria-label={`${t('gallery')} ${i + 1}`}
                      aria-pressed={i === photo}
                      onClick={() => setPhoto(i)}
                      className={cn('shrink-0 overflow-hidden rounded-xl ring-2 ring-offset-2 ring-offset-surface transition-all focus-visible:shadow-ring focus-visible:outline-none', i === photo ? 'ring-primary' : 'ring-transparent opacity-70 hover:opacity-100')}
                    >
                      <img src={m.variants?.sm ?? m.url} alt="" className="h-16 w-24 object-cover" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="p-5">
                <InlineEmpty icon={ImageIcon}>{t('noPhotos')}</InlineEmpty>
              </div>
            )}
          </section>

          <Section icon={Store} title={t('facts')}>
            <KeyValues
              cols={3}
              items={[
                { label: t('deal'), value: DEAL_TYPE_LABELS_KA[l.dealType] },
                { label: t('colPrice'), value: formatMoney(l.priceMinor) },
                { label: t('area'), value: formatArea(l.areaM2) },
                ...(l.floor !== null ? [{ label: t('floor'), value: l.floorsTotal ? `${l.floor} / ${l.floorsTotal}` : String(l.floor) }] : []),
                ...(l.commissionPct !== null ? [{ label: t('commission'), value: `${l.commissionPct}%` }] : []),
                { label: t('types'), value: l.businessTypes.map((b) => BUSINESS_TYPE_BY_SLUG[b]?.nameKa ?? b).join(', '), wide: true },
              ]}
            />
            <h3 className="mb-2 mt-5 flex items-center gap-2 text-[15px] font-bold">
              <FileText className="size-4 text-muted" strokeWidth={2} aria-hidden />
              {t('description')}
            </h3>
            <p className="whitespace-pre-line text-[15.5px] leading-relaxed">{l.description || '—'}</p>
          </Section>

          <Section icon={Ruler} title={t('passport')}>
            <div className="grid gap-6 md:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
              <div className="drawing-grid rounded-2xl p-3">
                <SpacePlan widthM={l.passport.widthM} depthM={l.passport.depthM} areaM2={l.areaM2} ceilingM={l.passport.ceilingM} powerKw={l.passport.powerKw} outline={l.passport.outline as [number, number][] | null | undefined} compact />
              </div>
              <div className="min-w-0 sm:columns-2 sm:gap-6 md:columns-1 2xl:columns-2">
                {passportRows.map((f) => {
                  const v = l.passport[f.key];
                  return <SpecRow key={f.key} className="break-inside-avoid py-2.5" label={f.labelKa} value={typeof v === 'boolean' ? (v ? '✓' : '—') : String(v)} unit={typeof v === 'boolean' ? undefined : f.unit} />;
                })}
              </div>
            </div>
          </Section>

          <Section icon={History} title={t('history')}>
            {l.closuresWarning && (
              <div className="mb-4 flex items-center gap-2.5 rounded-2xl bg-danger/10 px-4 py-3 text-[15px] font-semibold text-danger" role="note">
                <AlertTriangle className="size-5 shrink-0" strokeWidth={2} aria-hidden />
                {t('closuresWarning')}
              </div>
            )}
            {l.history.length ? (
              <ol className="relative ml-2 border-l-2 border-border pl-6">
                {l.history.map((h) => (
                  <li key={h.id} className="relative pb-5 last:pb-0">
                    <span className={cn('absolute -left-[31px] top-1.5 size-3 rounded-full ring-4 ring-surface', h.endedAt ? 'bg-border-strong' : 'bg-primary-500')} aria-hidden />
                    <div className="font-semibold">{h.businessName}</div>
                    <div className="text-small text-muted tabular">
                      {formatDateKa(h.startedAt)} — {h.endedAt ? formatDateKa(h.endedAt) : '…'}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <InlineEmpty icon={History}>{t('noHistory')}</InlineEmpty>
            )}
          </Section>

          <Section icon={History} title={t('audit')}>
            <AuditTable items={data.audit} compact />
          </Section>
        </div>

        {/* ---------- right: sticky decision panel ---------- */}
        <aside className="flex min-w-0 flex-col gap-5 xl:sticky xl:top-24">
          <section className="card overflow-hidden" aria-labelledby="decision-title">
            <div className="hero-gradient px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <h2 id="decision-title" className="flex items-center gap-2 text-[17px] font-bold text-white">
                  <Gavel className="size-[18px]" strokeWidth={2} aria-hidden />
                  {t('decision')}
                </h2>
                <span className="text-[22px] font-bold tabular text-white">{formatMoney(l.priceMinor)}</span>
              </div>
              <p className="mt-1 text-[13.5px] text-white/75">{t('decisionHint')}</p>
            </div>
            <div className="flex flex-col gap-4 p-5">
              <div>
                <div className="mb-2 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">{t('price')}</div>
                {pc.deltaPct === null ? <div className="text-small text-muted">{t('noDelta')}</div> : <DeltaMeter pct={pc.deltaPct} label={t('delta')} />}
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-surface-2/70 px-3 py-2.5">
                    <div className="text-[12.5px] text-muted">{t('priceM2')}</div>
                    <div className="font-bold tabular">{formatMoney(pc.priceM2Minor)}</div>
                  </div>
                  <div className="rounded-xl bg-surface-2/70 px-3 py-2.5">
                    <div className="text-[12.5px] text-muted">{t('districtAvg')}</div>
                    <div className="font-bold tabular">{pc.districtAvgM2Minor ? formatMoney(pc.districtAvgM2Minor) : '—'}</div>
                  </div>
                </div>
                {pc.verdict && <p className="mt-2 text-small text-muted">{t(`verdict.${pc.verdict}`)}</p>}
              </div>
              {pending ? (
                <div className="hidden grid-cols-2 gap-2 xl:grid">{decisionButtons}</div>
              ) : (
                <p className="rounded-xl bg-surface-2 px-3 py-2.5 text-small text-muted">{t('notPending')}</p>
              )}
            </div>
          </section>

          <Section icon={UserRound} title={t('owner')}>
            <Person name={data.owner.name} href={`/users/${data.owner.id}`} size={44} sub={data.owner.phone} extra={data.owner.bannedAt ? <StatusPill tone="danger">{t('banned')}</StatusPill> : undefined} />
            <KeyValues
              className="mt-4"
              cols={2}
              items={[
                { label: t('ownerSince'), value: formatDateKa(data.owner.createdAt), wide: true },
                { label: t('ownerListings'), value: data.owner.listingsCount },
                { label: t('ownerRejected'), value: <span className={data.owner.rejectedCount > 0 ? 'text-danger' : undefined}>{data.owner.rejectedCount}</span> },
                ...(l.contact.orgName ? [{ label: t('org'), value: l.contact.orgName, wide: true }] : []),
              ]}
            />
          </Section>

          <Section icon={BadgeCheck} title={t('verification')}>
            {data.verification ? <VerificationCard v={data.verification} onDone={() => mutate()} compact /> : <InlineEmpty icon={BadgeCheck}>{t('noVerification')}</InlineEmpty>}
          </Section>
          <p className="px-1 text-[13px] text-muted">{t('updatedAt', { date: formatDateTimeKa(l.updatedAt) })}</p>
        </aside>
      </div>

      {/* mobile/tablet sticky decision bar */}
      {pending && (
        <div className="glass fixed inset-x-0 bottom-0 z-40 border-t border-border px-4 py-3 shadow-lg xl:hidden lg:left-[272px]">
          <div className="mx-auto grid max-w-xl grid-cols-2 gap-2">{decisionButtons}</div>
        </div>
      )}

      <ReasonDialog open={rejectOpen} onOpenChange={setRejectOpen} title={t('rejectTitle')} description={l.title} confirmLabel={t('reject')} busy={busy} onConfirm={reject} />
    </div>
  );
}
