import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BadgeCheck } from 'lucide-react';
import {
  DEAL_TYPE_LABELS_KA, PASSPORT_FIELDS, formatDateKa, formatMoney, formatNumber, type CompareListingDto, type PassportKey,
} from '@lokacia/contracts';
import { EmptyState, SpacePlan } from '@lokacia/ui';
import { getCompareShared } from '@/components/portal/data';
import { CopyLinkButton } from '@/components/portal/copy-link-button';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await getCompareShared(token);
  return { title: data ? data.name : 'შედარება', robots: { index: false, follow: false } };
}

type Row = {
  key: string;
  label: string;
  values: React.ReactNode[];
  /** numeric values for "best" highlighting */
  numbers?: (number | null)[];
  best?: 'min' | 'max';
};

function bestIndexes(nums: (number | null)[] | undefined, mode: 'min' | 'max' | undefined) {
  if (!nums || !mode) return new Set<number>();
  const valid = nums.filter((n): n is number => n != null && Number.isFinite(n));
  if (valid.length < 2) return new Set<number>();
  const target = mode === 'min' ? Math.min(...valid) : Math.max(...valid);
  if (valid.every((v) => v === target)) return new Set<number>();
  return new Set(nums.flatMap((n, i) => (n === target ? [i] : [])));
}

export default async function ComparePage({ params }: Props) {
  const { token } = await params;
  const data = await getCompareShared(token);
  if (!data) notFound();
  const t = await getTranslations('favorites.table');
  const L: CompareListingDto[] = data.listings;
  const yesNo = (v: boolean | null | undefined) => (v == null ? t('dash') : v ? t('yes') : t('no'));
  const num = (v: number | null | undefined, unit?: string) => (v == null ? t('dash') : `${formatNumber(v, Number.isInteger(v) ? 0 : 1)}${unit ? ` ${unit}` : ''}`);

  const rows: Row[] = [
    { key: 'price', label: t('price'), values: L.map((l) => `${formatMoney(l.priceMinor, l.currency)}${l.pricePeriod === 'month' ? ' / თვე' : ''}`), numbers: L.map((l) => l.priceMinor), best: 'min' },
    {
      key: 'ppm',
      label: t('pricePerM2'),
      values: L.map((l) =>
        l.pricePerM2Minor == null ? (
          t('dash')
        ) : (
          <span className="flex flex-col">
            <span>{formatMoney(l.pricePerM2Minor, l.currency)}</span>
            {l.districtAvgPriceM2Minor && l.pricePeriod === 'month' ? (
              <span className="text-small text-muted">
                {t('districtAvg')}: {formatMoney(l.districtAvgPriceM2Minor)}
              </span>
            ) : null}
          </span>
        ),
      ),
      numbers: L.map((l) => l.pricePerM2Minor),
      best: 'min',
    },
    { key: 'area', label: t('area'), values: L.map((l) => `${formatNumber(l.areaM2)} მ²`), numbers: L.map((l) => l.areaM2), best: 'max' },
    { key: 'deal', label: t('dealType'), values: L.map((l) => DEAL_TYPE_LABELS_KA[l.dealType]) },
    { key: 'district', label: t('district'), values: L.map((l) => l.districtName ?? t('dash')) },
    { key: 'floor', label: t('floor'), values: L.map((l) => num(l.floor)) },
    { key: 'fee', label: t('serviceFee'), values: L.map((l) => (l.serviceFeeMinor ? formatMoney(l.serviceFeeMinor) : t('dash'))), numbers: L.map((l) => l.serviceFeeMinor), best: 'min' },
    { key: 'deposit', label: t('deposit'), values: L.map((l) => t('depositMonths', { count: formatNumber(l.depositMonths, 1) })), numbers: L.map((l) => l.depositMonths), best: 'min' },
    { key: 'utilities', label: t('utilities'), values: L.map((l) => yesNo(l.utilitiesIncluded)) },
  ];
  const maxBetter: PassportKey[] = ['powerKw', 'ceilingM', 'parking', 'wetPoints', 'facadeM', 'gateWM'];
  const passportRows: Row[] = PASSPORT_FIELDS.filter((f) => L.some((l) => l.passportFull[f.key] != null)).map((f) => {
    const vals = L.map((l) => l.passportFull[f.key] as number | boolean | null | undefined);
    if (f.kind === 'boolean') return { key: f.key, label: f.labelKa, values: vals.map((v) => yesNo(v as boolean | null)) };
    return { key: f.key, label: f.labelKa, values: vals.map((v) => num(v as number | null, f.unit)), numbers: vals.map((v) => (typeof v === 'number' ? v : null)), best: maxBetter.includes(f.key) ? 'max' : undefined };
  });
  const trustRows: Row[] = [
    {
      key: 'contact',
      label: t('contact'),
      values: L.map((l) => (l.isOwner ? t('owner') : `${t('broker')}${l.commissionPct ? ` · ${t('commission', { pct: formatNumber(l.commissionPct, 1) })}` : ''}`)),
    },
    {
      key: 'verified',
      label: t('verified'),
      values: L.map((l) =>
        l.verifiedOwner ? (
          <span className="inline-flex items-center gap-1 text-success">
            <BadgeCheck className="size-4" strokeWidth={1.5} aria-hidden />
            {t('yes')}
          </span>
        ) : (
          t('no')
        ),
      ),
    },
    { key: 'confirmed', label: t('confirmed'), values: L.map((l) => (l.lastConfirmedAt ? formatDateKa(l.lastConfirmedAt) : t('dash'))), numbers: L.map((l) => (l.lastConfirmedAt ? new Date(l.lastConfirmedAt).setHours(0, 0, 0, 0) : null)), best: 'max' },
    { key: 'score', label: t('score'), values: L.map((l) => num(l.locationScore)), numbers: L.map((l) => l.locationScore), best: 'max' },
  ];

  const renderRows = (list: Row[]) =>
    list.map((r) => {
      const best = bestIndexes(r.numbers, r.best);
      return (
        <tr key={r.key} className="border-b border-border last:border-b-0">
          <th scope="row" className="sticky left-0 z-10 w-40 min-w-36 bg-surface px-3 py-2.5 text-left text-small font-medium text-muted">
            {r.label}
          </th>
          {r.values.map((v, i) => (
            <td key={i} className={`min-w-44 px-3 py-2.5 align-top tabular ${best.has(i) ? 'bg-primary/10 font-semibold text-text' : ''}`}>
              {v}
              {best.has(i) && <span className="sr-only"> ({t('best')})</span>}
            </td>
          ))}
        </tr>
      );
    });

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-small text-muted">{t('title')}</p>
          <h1 className="text-h2 font-semibold md:text-h1">{data.name}</h1>
          <p className="mt-1 text-small text-muted">
            {t('readOnly')} {t('updated', { date: formatDateKa(data.updatedAt) })}
          </p>
        </div>
        <CopyLinkButton path={`/compare/${token}`} label={t('copy')} copiedLabel={t('copied')} />
      </div>

      {!L.length ? (
        <EmptyState className="mt-8" title={t('empty')} />
      ) : (
        <div className="mt-6 overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full border-collapse text-[15px]">
            <caption className="sr-only">{data.name}</caption>
            <thead>
              <tr className="border-b border-border-strong">
                <th scope="col" className="sticky left-0 z-10 bg-surface px-3 py-3 text-left text-small font-medium text-muted">
                  {t('parameter')}
                </th>
                {L.map((l) => (
                  <th key={l.id} scope="col" className="min-w-44 px-3 py-3 text-left align-top font-normal">
                    <div className="drawing-grid mb-2 rounded-photo border border-border bg-bg p-1">
                      <SpacePlan compact areaM2={l.areaM2} widthM={l.passport.widthM} depthM={l.passport.depthM} />
                    </div>
                    <Link href={`/listings/${l.slug}`} className="line-clamp-3 font-semibold leading-snug hover:text-link">
                      {l.title}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderRows(rows)}
              <tr className="border-b border-border bg-surface-2">
                <th scope="colgroup" colSpan={L.length + 1} className="sticky left-0 px-3 py-2 text-left text-small font-semibold uppercase tracking-wide">
                  {t('passport')}
                </th>
              </tr>
              {renderRows(passportRows)}
              <tr className="border-b border-border bg-surface-2">
                <th scope="colgroup" colSpan={L.length + 1} className="sticky left-0 px-3 py-2 text-left text-small font-semibold uppercase tracking-wide">
                  {t('contact')}
                </th>
              </tr>
              {renderRows(trustRows)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
