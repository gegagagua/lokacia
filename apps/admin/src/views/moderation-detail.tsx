'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Check, ExternalLink, X } from 'lucide-react';
import {
  BUSINESS_TYPE_BY_SLUG, DEAL_TYPE_LABELS_KA, LISTING_STATUS_LABELS_KA, PASSPORT_FIELDS, formatArea, formatDateKa, formatDateTimeKa, formatMoney, type ModerationDetail,
} from '@lokacia/contracts';
import { Badge, Button, SpacePlan, SpecRow } from '@lokacia/ui';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { PageHeader, Section } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { ReasonDialog } from '@/components/reason-dialog';
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

  const approve = async () => {
    const r = await run(() => apiFetch(`/admin/moderation/listings/${id}/approve`, { method: 'POST' }), t('approved'));
    if (r) router.push('/moderation');
  };
  const reject = async (reason: string) => {
    const r = await run(() => apiFetch(`/admin/moderation/listings/${id}/reject`, { method: 'POST', body: { reason } }), t('rejected'));
    if (r) {
      setRejectOpen(false);
      router.push('/moderation');
    }
  };

  const passportRows = PASSPORT_FIELDS.filter((f) => l.passport[f.key] !== undefined && l.passport[f.key] !== null);

  return (
    <>
      <PageHeader
        back={{ href: '/moderation', label: t('back') }}
        title={l.title}
        subtitle={`${l.districtName ? `${l.districtName}, ` : ''}${l.address}`}
        actions={
          <>
            <Badge tone={pending ? 'accent' : 'neutral'}>{LISTING_STATUS_LABELS_KA[l.status]}</Badge>
            <Button asChild variant="ghost" size="sm">
              <a href={`${PORTAL}/listings/${l.slug}`} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" strokeWidth={1.5} aria-hidden />
                {t('openOnPortal')}
              </a>
            </Button>
            {pending && (
              <>
                <Button variant="danger" size="sm" icon={<X className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => setRejectOpen(true)}>
                  {t('reject')}
                </Button>
                <Button size="sm" loading={busy} icon={<Check className="size-4" strokeWidth={1.5} aria-hidden />} onClick={approve}>
                  {t('approve')}
                </Button>
              </>
            )}
          </>
        }
      />
      {!pending && <p className="mb-4 rounded-card border border-border bg-surface-2 px-4 py-2 text-small">{t('notPending')}</p>}

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Section title={`${t('gallery')} · ${photos.length}`}>
            {current ? (
              <>
                <img src={current.variants?.lg ?? current.url} alt={current.alt ?? l.title} className="aspect-[16/10] w-full rounded-photo border border-border bg-surface-2 object-contain" />
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {photos.map((m, i) => (
                    <button key={m.id} type="button" aria-label={`${t('gallery')} ${i + 1}`} aria-pressed={i === photo} onClick={() => setPhoto(i)} className={`shrink-0 rounded-photo border-2 ${i === photo ? 'border-primary' : 'border-transparent'}`}>
                      <img src={m.variants?.sm ?? m.url} alt="" className="h-14 w-20 rounded-photo object-cover" />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-muted">{t('noPhotos')}</p>
            )}
          </Section>

          <div className="grid gap-4 md:grid-cols-2">
            <Section title={t('passport')}>
              <SpacePlan widthM={l.passport.widthM} depthM={l.passport.depthM} areaM2={l.areaM2} ceilingM={l.passport.ceilingM} powerKw={l.passport.powerKw} outline={l.passport.outline as [number, number][] | null | undefined} compact className="mb-3" />
              {passportRows.map((f) => {
                const v = l.passport[f.key];
                return <SpecRow key={f.key} label={f.labelKa} value={typeof v === 'boolean' ? (v ? '✓' : '—') : String(v)} unit={typeof v === 'boolean' ? undefined : f.unit} />;
              })}
            </Section>
            <Section title={t('facts')}>
              <SpecRow label={t('status')} value={LISTING_STATUS_LABELS_KA[l.status]} />
              <SpecRow label={t('deal')} value={DEAL_TYPE_LABELS_KA[l.dealType]} />
              <SpecRow label={t('types')} value={l.businessTypes.map((b) => BUSINESS_TYPE_BY_SLUG[b]?.nameKa ?? b).join(', ')} />
              <SpecRow label={t('price')} value={formatMoney(l.priceMinor)} />
              <SpecRow label={t('area')} value={formatArea(l.areaM2)} />
              {l.floor !== null && <SpecRow label={t('floor')} value={l.floorsTotal ? `${l.floor} / ${l.floorsTotal}` : l.floor} />}
              {l.commissionPct !== null && <SpecRow label={t('commission')} value={`${l.commissionPct}%`} />}
              <h3 className="mb-1 mt-4 text-small font-medium">{t('description')}</h3>
              <p className="whitespace-pre-line text-[14px]">{l.description || '—'}</p>
            </Section>
          </div>

          <Section title={t('history')}>
            {l.closuresWarning && (
              <p className="mb-2 flex items-center gap-2 text-small text-danger">
                <AlertTriangle className="size-4" strokeWidth={1.5} aria-hidden />
                {t('closuresWarning')}
              </p>
            )}
            {l.history.length ? (
              <ul className="flex flex-col">
                {l.history.map((h) => (
                  <li key={h.id} className="flex justify-between border-b border-border py-1.5 text-[14px] last:border-b-0">
                    <span>{h.businessName}</span>
                    <span className="tabular text-muted">
                      {formatDateKa(h.startedAt)} — {h.endedAt ? formatDateKa(h.endedAt) : '…'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-small text-muted">{t('noHistory')}</p>
            )}
          </Section>

          <Section title={t('audit')}>
            <AuditTable items={data.audit} compact />
          </Section>
        </div>

        <div className="flex flex-col gap-4">
          <Section title={t('price')}>
            <SpecRow label={t('priceM2')} value={formatMoney(data.priceCheck.priceM2Minor)} />
            <SpecRow label={t('districtAvg')} value={data.priceCheck.districtAvgM2Minor ? formatMoney(data.priceCheck.districtAvgM2Minor) : '—'} />
            <SpecRow
              label={t('delta')}
              value={
                data.priceCheck.deltaPct === null ? '—' : (
                  <span className={Math.abs(data.priceCheck.deltaPct) > 30 ? 'text-danger' : undefined}>
                    {data.priceCheck.deltaPct > 0 ? '+' : ''}
                    {data.priceCheck.deltaPct}%
                  </span>
                )
              }
            />
            {data.priceCheck.verdict && <p className="mt-2 text-small text-muted">{t(`verdict.${data.priceCheck.verdict}`)}</p>}
          </Section>

          <Section title={t('owner')}>
            <Link href={`/users/${data.owner.id}`} className="font-medium text-link hover:underline">
              {data.owner.name ?? '—'}
            </Link>
            <div className="text-small text-muted tabular">{data.owner.phone}</div>
            {data.owner.bannedAt && (
              <Badge tone="danger" className="mt-2">
                {t('banned')}
              </Badge>
            )}
            <div className="mt-2">
              <SpecRow label={t('ownerSince')} value={formatDateKa(data.owner.createdAt)} />
              <SpecRow label={t('ownerListings')} value={data.owner.listingsCount} />
              <SpecRow label={t('ownerRejected')} value={data.owner.rejectedCount} />
              {l.contact.orgName && <SpecRow label={t('owner')} value={l.contact.orgName} />}
            </div>
          </Section>

          <Section title={t('verification')}>
            {data.verification ? <VerificationCard v={data.verification} onDone={() => mutate()} compact /> : <p className="text-small text-muted">{t('noVerification')}</p>}
          </Section>
          <p className="text-[11px] text-muted">{formatDateTimeKa(l.updatedAt)}</p>
        </div>
      </div>

      <ReasonDialog open={rejectOpen} onOpenChange={setRejectOpen} title={t('rejectTitle')} description={l.title} confirmLabel={t('reject')} busy={busy} onConfirm={reject} />
    </>
  );
}
