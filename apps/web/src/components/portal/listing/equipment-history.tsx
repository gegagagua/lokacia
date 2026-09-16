import { getTranslations } from 'next-intl/server';
import { AlertTriangle, Package } from 'lucide-react';
import { formatDateKa, formatMoney, type ListingDetail } from '@lokacia/contracts';

/** P11: transfer equipment with separate space vs equipment prices. */
export async function EquipmentTable({ listing: l }: { listing: ListingDetail }) {
  const t = await getTranslations('listing.equipment');
  const sum = l.equipment.reduce((s, e) => s + e.priceMinor * e.qty, 0);
  const equipmentMinor = l.equipmentPriceMinor ?? sum;
  return (
    <section aria-labelledby="equipment-title" className="flex flex-col gap-3">
      <div>
        <h2 id="equipment-title" className="flex items-center gap-2 text-h3 font-semibold">
          <Package className="size-5 text-link" strokeWidth={1.5} aria-hidden />
          {t('title')}
        </h2>
        <p className="text-small text-muted">{t('subtitle')}</p>
      </div>
      {l.equipment.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[480px] border-collapse text-left text-[15px] tabular">
            <thead>
              <tr className="border-b border-border-strong text-small text-muted">
                <th scope="col" className="px-3 py-2.5 font-medium">{t('name')}</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">{t('qty')}</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">{t('price')}</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">{t('sum')}</th>
              </tr>
            </thead>
            <tbody>
              {l.equipment.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2.5">{e.name}</td>
                  <td className="px-3 py-2.5 text-right">{e.qty}</td>
                  <td className="px-3 py-2.5 text-right">{formatMoney(e.priceMinor, l.currency)}</td>
                  <td className="px-3 py-2.5 text-right">{formatMoney(e.priceMinor * e.qty, l.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <dl className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-card border border-border bg-surface p-4">
          <dt className="text-small text-muted">{t('spacePrice')}</dt>
          <dd className="compact text-h3 font-semibold tabular">{formatMoney(l.priceMinor, l.currency)}</dd>
        </div>
        <div className="rounded-card border border-border bg-surface p-4">
          <dt className="text-small text-muted">{t('equipmentPrice')}</dt>
          <dd className="compact text-h3 font-semibold tabular">{formatMoney(equipmentMinor, l.currency)}</dd>
        </div>
        <div className="rounded-card border border-primary bg-surface p-4">
          <dt className="text-small text-muted">{t('total')}</dt>
          <dd className="compact text-h3 font-semibold tabular">{formatMoney(l.priceMinor + equipmentMinor, l.currency)}</dd>
        </div>
      </dl>
    </section>
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
  return (
    <section aria-labelledby="history-title" className="flex flex-col gap-3">
      <div>
        <h2 id="history-title" className="text-h3 font-semibold">
          {t('title')}
        </h2>
        <p className="text-small text-muted">{t('subtitle')}</p>
      </div>
      {l.closuresWarning && (
        <div role="note" className="flex gap-3 rounded-card border border-danger bg-danger/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-danger" strokeWidth={1.5} aria-hidden />
          <div>
            <p className="font-semibold text-danger">{t('warning')}</p>
            <p className="text-small text-muted">{t('warningHint')}</p>
          </div>
        </div>
      )}
      {l.history.length ? (
        <ol className="relative ml-2 border-l border-border-strong">
          {l.history.map((h) => (
            <li key={h.id} className="relative pb-4 pl-5 last:pb-0">
              <span className={`absolute -left-[5px] top-2 size-[9px] rounded-full border ${h.endedAt ? 'border-border-strong bg-surface' : 'border-primary bg-primary'}`} aria-hidden />
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className="font-medium">{h.businessName}</span>
                <span className="text-small text-muted tabular">{t('months', { n: monthsBetween(h.startedAt, h.endedAt ?? null) })}</span>
              </div>
              <div className="text-small text-muted">
                {h.businessType ? `${typeNames[h.businessType] ?? h.businessType} · ` : ''}
                <span className="tabular">
                  {formatDateKa(h.startedAt)} — {h.endedAt ? formatDateKa(h.endedAt) : t('present')}
                </span>
              </div>
              {h.note && <p className="mt-1 text-small">{h.note}</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-small text-muted">{t('empty')}</p>
      )}
    </section>
  );
}
