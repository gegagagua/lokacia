import { getTranslations } from 'next-intl/server';
import { AlertTriangle, History, Package, Store } from 'lucide-react';
import type { ListingDetail } from '@lokacia/contracts';
import { cn } from '@lokacia/ui';
import { getFormat } from '@/i18n/server';
import { ListingSection } from './section';

/** P11: transfer equipment with separate space vs equipment prices. */
export async function EquipmentTable({ listing: l }: { listing: ListingDetail }) {
  const t = await getTranslations('listing.equipment');
  const { money: formatMoney } = await getFormat();
  const sum = l.equipment.reduce((s, e) => s + e.priceMinor * e.qty, 0);
  const equipmentMinor = l.equipmentPriceMinor ?? sum;
  return (
    <ListingSection id="equipment-title" title={t('title')} subtitle={t('subtitle')} icon={<Package className="size-5" strokeWidth={2} />} tone="link">
      <dl className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-surface-2 p-4">
          <dt className="text-small text-muted">{t('spacePrice')}</dt>
          <dd className="mt-0.5 text-[20px] font-bold tracking-tight tabular">{formatMoney(l.priceMinor, l.currency)}</dd>
        </div>
        <div className="rounded-2xl bg-surface-2 p-4">
          <dt className="text-small text-muted">{t('equipmentPrice')}</dt>
          <dd className="mt-0.5 text-[20px] font-bold tracking-tight tabular">{formatMoney(equipmentMinor, l.currency)}</dd>
        </div>
        <div className="rounded-2xl bg-primary-soft p-4 text-primary-soft-text">
          <dt className="text-small font-medium">{t('total')}</dt>
          <dd className="mt-0.5 text-[20px] font-bold tracking-tight tabular">{formatMoney(l.priceMinor + equipmentMinor, l.currency)}</dd>
        </div>
      </dl>
      {l.equipment.length > 0 && (
        <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[480px] border-collapse text-left text-[15px] tabular">
            <thead className="bg-surface-2">
              <tr className="text-small text-muted">
                <th scope="col" className="px-4 py-3 font-semibold">{t('name')}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{t('qty')}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{t('price')}</th>
                <th scope="col" className="px-4 py-3 text-right font-semibold">{t('sum')}</th>
              </tr>
            </thead>
            <tbody>
              {l.equipment.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{e.name}</td>
                  <td className="px-4 py-3 text-right">{e.qty}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(e.priceMinor, l.currency)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatMoney(e.priceMinor * e.qty, l.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ListingSection>
  );
}

function monthsBetween(a: string, b: string | null) {
  const s = new Date(a);
  const e = b ? new Date(b) : new Date();
  return Math.max(1, (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth());
}

/** P10: space history timeline with the frequent-closures warning. */
export async function HistoryTimeline({ listing: l, typeNames }: { listing: ListingDetail; typeNames: Record<string, string> }) {
  const t = await getTranslations('listing.history');
  const { date: formatDate } = await getFormat();
  return (
    <ListingSection id="history-title" title={t('title')} subtitle={t('subtitle')} icon={<History className="size-5" strokeWidth={2} />}>
      {l.closuresWarning && (
        <div role="note" className="mb-5 flex gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4">
          <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-danger/15 text-danger">
            <AlertTriangle className="size-[18px]" strokeWidth={2} />
          </span>
          <div>
            <p className="font-semibold text-danger">{t('warning')}</p>
            <p className="text-small text-muted">{t('warningHint')}</p>
          </div>
        </div>
      )}
      {l.history.length ? (
        <ol className="relative flex flex-col gap-3">
          <span aria-hidden className="absolute bottom-6 left-[17px] top-6 w-0.5 rounded-full bg-border" />
          {l.history.map((h) => {
            const active = !h.endedAt;
            return (
              <li key={h.id} className="relative flex gap-4">
                <span aria-hidden className={cn('relative z-[1] mt-2 grid size-9 shrink-0 place-items-center rounded-full ring-4 ring-surface', active ? 'bg-primary text-primary-contrast' : 'bg-surface-2 text-muted')}>
                  <Store className="size-4" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1 rounded-2xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <span className="font-semibold">{h.businessName}</span>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold tabular', active ? 'bg-success/12 text-success' : 'bg-surface-2 text-muted')}>{t('months', { n: monthsBetween(h.startedAt, h.endedAt ?? null) })}</span>
                  </div>
                  <div className="mt-1 text-small text-muted">
                    {h.businessType ? `${typeNames[h.businessType] ?? h.businessType} · ` : ''}
                    <span className="tabular">
                      {formatDate(h.startedAt)} — {h.endedAt ? formatDate(h.endedAt) : t('present')}
                    </span>
                  </div>
                  {h.note && <p className="mt-2 text-small">{h.note}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-xl bg-surface-2 px-4 py-3 text-small text-muted">{t('empty')}</p>
      )}
    </ListingSection>
  );
}
