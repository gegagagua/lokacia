import type { Metadata } from 'next';
import Link from '@/i18n/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BadgeCheck, Columns3, Eye, Trophy } from 'lucide-react';
import {
  PASSPORT_FIELDS, type CompareListingDto, type PassportKey,
} from '@lokacia/contracts';
import { EmptyState, SpacePlan } from '@lokacia/ui';
import { getCompareShared } from '@/components/portal/data';
import { CopyLinkButton } from '@/components/portal/copy-link-button';
import { getFormat } from '@/i18n/server';
import { HeroGlow } from '@/components/portal/hero-glow';
import { localizeListing } from '@/i18n/content';

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const data = await getCompareShared(token);
  const t = await getTranslations('favorites.table');
  return { title: data ? data.name : t('metaTitle'), robots: { index: false, follow: false } };
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
  const f = await getFormat();
  const formatNumber = f.number;
  const formatMoney = f.money;
  const L: CompareListingDto[] = data.listings.map((l) => localizeListing(l, f.locale));
  const yesNo = (v: boolean | null | undefined) => (v == null ? t('dash') : v ? t('yes') : t('no'));
  const num = (v: number | null | undefined, unit?: string) => (v == null ? t('dash') : `${formatNumber(v, Number.isInteger(v) ? 0 : 1)}${unit ? ` ${unit}` : ''}`);

  const rows: Row[] = [
    { key: 'price', label: t('price'), values: L.map((l) => `${formatMoney(l.priceMinor, l.currency)}${l.pricePeriod === 'month' ? f.period('month') : ''}`), numbers: L.map((l) => l.priceMinor), best: 'min' },
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
    { key: 'area', label: t('area'), values: L.map((l) => `${formatNumber(l.areaM2)} ${f.areaUnit}`), numbers: L.map((l) => l.areaM2), best: 'max' },
    { key: 'deal', label: t('dealType'), values: L.map((l) => f.dealType(l.dealType)) },
    { key: 'district', label: t('district'), values: L.map((l) => l.districtName ?? t('dash')) },
    { key: 'floor', label: t('floor'), values: L.map((l) => num(l.floor)) },
    { key: 'fee', label: t('serviceFee'), values: L.map((l) => (l.serviceFeeMinor ? formatMoney(l.serviceFeeMinor) : t('dash'))), numbers: L.map((l) => l.serviceFeeMinor), best: 'min' },
    { key: 'deposit', label: t('deposit'), values: L.map((l) => t('depositMonths', { count: formatNumber(l.depositMonths, 1) })), numbers: L.map((l) => l.depositMonths), best: 'min' },
    { key: 'utilities', label: t('utilities'), values: L.map((l) => yesNo(l.utilitiesIncluded)) },
  ];
  const maxBetter: PassportKey[] = ['powerKw', 'ceilingM', 'parking', 'wetPoints', 'facadeM', 'gateWM'];
  const passportRows: Row[] = PASSPORT_FIELDS.filter((pf) => L.some((l) => l.passportFull[pf.key] != null)).map((pf) => {
    const vals = L.map((l) => l.passportFull[pf.key] as number | boolean | null | undefined);
    if (pf.kind === 'boolean') return { key: pf.key, label: f.passport(pf.key), values: vals.map((v) => yesNo(v as boolean | null)) };
    return { key: pf.key, label: f.passport(pf.key), values: vals.map((v) => num(v as number | null, f.unit(pf.unit))), numbers: vals.map((v) => (typeof v === 'number' ? v : null)), best: maxBetter.includes(pf.key) ? 'max' : undefined };
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
    { key: 'confirmed', label: t('confirmed'), values: L.map((l) => (l.lastConfirmedAt ? f.date(l.lastConfirmedAt) : t('dash'))), numbers: L.map((l) => (l.lastConfirmedAt ? new Date(l.lastConfirmedAt).setHours(0, 0, 0, 0) : null)), best: 'max' },
    { key: 'score', label: t('score'), values: L.map((l) => num(l.locationScore)), numbers: L.map((l) => l.locationScore), best: 'max' },
  ];

  const renderRows = (list: Row[]) =>
    list.map((r) => {
      const best = bestIndexes(r.numbers, r.best);
      return (
        <tr key={r.key} className="border-b border-border transition-colors last:border-b-0 hover:bg-surface-2/60">
          <th scope="row" className="sticky left-0 z-10 w-44 min-w-36 bg-surface px-4 py-3 text-left text-small font-medium text-muted shadow-[1px_0_0_var(--border)]">
            {r.label}
          </th>
          {r.values.map((v, i) => (
            <td key={i} className="min-w-48 px-4 py-3 align-top tabular">
              {best.has(i) ? (
                <span className="inline-flex items-start gap-1.5 rounded-xl bg-primary-soft px-2.5 py-1 font-semibold text-primary-soft-text">
                  <Trophy className="mt-1 size-3.5 shrink-0" strokeWidth={2} aria-hidden />
                  <span>{v}</span>
                </span>
              ) : (
                v
              )}
              {best.has(i) && <span className="sr-only"> ({t('best')})</span>}
            </td>
          ))}
        </tr>
      );
    });

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-border bg-surface">
        <HeroGlow />
        <div className="container-page relative flex flex-wrap items-end justify-between gap-4 pb-10 pt-8 md:pb-12 md:pt-12">
          <div className="min-w-0 max-w-3xl">
            <p className="eyebrow">
              <Columns3 className="size-3.5" strokeWidth={2} aria-hidden />
              {t('title')}
            </p>
            <h1 className="mt-4 break-words text-[32px] font-bold leading-[40px] tracking-tight md:text-h1">{data.name}</h1>
            <p className="mt-2 flex flex-wrap items-center gap-2 text-[15px] text-muted">
              <Eye className="size-4" strokeWidth={2} aria-hidden />
              {t('readOnly')} {t('updated', { date: f.date(data.updatedAt) })}
            </p>
          </div>
          <CopyLinkButton path={`/compare/${token}`} label={t('copy')} copiedLabel={t('copied')} />
        </div>
      </section>

      <div className="container-page py-8 md:py-12">
      {!L.length ? (
        <EmptyState title={t('empty')} />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full border-collapse text-[15px]">
            <caption className="sr-only">{data.name}</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="sticky left-0 z-10 bg-surface px-4 py-4 text-left align-bottom text-small font-medium text-muted shadow-[1px_0_0_var(--border)]">
                  {t('parameter')}
                </th>
                {L.map((l) => (
                  <th key={l.id} scope="col" className="min-w-48 px-4 py-4 text-left align-top font-normal">
                    <div className="mb-3 rounded-photo bg-surface-2 p-2">
                      <SpacePlan compact areaM2={l.areaM2} widthM={l.passport.widthM} depthM={l.passport.depthM} locale={f.locale} />
                    </div>
                    <Link href={`/listings/${l.slug}`} className="line-clamp-3 text-[15.5px] font-semibold leading-snug hover:text-link">
                      {l.title}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderRows(rows)}
              <tr className="border-b border-border bg-surface-2">
                <th scope="colgroup" colSpan={L.length + 1} className="sticky left-0 px-4 py-2.5 text-left text-small font-bold">
                  {t('passport')}
                </th>
              </tr>
              {renderRows(passportRows)}
              <tr className="border-b border-border bg-surface-2">
                <th scope="colgroup" colSpan={L.length + 1} className="sticky left-0 px-4 py-2.5 text-left text-small font-bold">
                  {t('contact')}
                </th>
              </tr>
              {renderRows(trustRows)}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </>
  );
}
