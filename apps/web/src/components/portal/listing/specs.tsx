import { getTranslations } from 'next-intl/server';
import {
  AppWindow, Clock, DoorOpen, Droplets, Fan, Flame, MoveDiagonal, MoveHorizontal, MoveVertical, PanelTop, PlugZap, SquareParking, Truck, Warehouse, Wind, Zap,
  type LucideIcon,
} from 'lucide-react';
import { PASSPORT_FIELDS, areaUnit, formatAreaFor, formatDateFor, formatMoneyFor, formatNumberFor, localizeUnit, passportLabel, type ListingDetail } from '@lokacia/contracts';
import { getAppLocale } from '@/i18n/server';
import { SpacePlan, SpecRow } from '@lokacia/ui';

const ICONS: Record<string, LucideIcon> = {
  zap: Zap, 'plug-zap': PlugZap, 'move-vertical': MoveVertical, 'panel-top': PanelTop, 'move-horizontal': MoveHorizontal, 'move-diagonal': MoveDiagonal,
  wind: Wind, flame: Flame, droplets: Droplets, warehouse: Warehouse, truck: Truck, clock: Clock, 'square-parking': SquareParking, 'app-window': AppWindow,
  'door-open': DoorOpen, fan: Fan,
};

/** Technical passport (P2): SpacePlan drawing + SpecRows for every filled passport field and money terms. */
export async function ListingSpecs({ listing: l }: { listing: ListingDetail }) {
  const t = await getTranslations('listing.specs');
  const locale = await getAppLocale();
  const formatNumber = (v: number, digits = 0) => formatNumberFor(v, locale, digits);
  const p = l.passport;
  const rows = PASSPORT_FIELDS.flatMap((f) => {
    const v = p[f.key];
    if (v === null || v === undefined) return [];
    const Icon = ICONS[f.icon];
    const value = typeof v === 'boolean' ? (v ? t('yes') : t('no')) : formatNumber(v as number, f.kind === 'integer' ? 0 : 1);
    return [{ key: f.key, label: passportLabel(f.key, locale), value, unit: typeof v === 'boolean' ? undefined : localizeUnit(f.unit, locale), icon: Icon ? <Icon className="size-4" strokeWidth={1.5} aria-hidden /> : undefined, muted: v === false }];
  });
  const isLease = l.dealType === 'rent' || l.dealType === 'short_term';
  return (
    <section aria-labelledby="specs-title" className="grid gap-6 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="flex flex-col gap-2">
        <h2 id="specs-title" className="text-h3 font-semibold">
          {t('title')}
        </h2>
        <div className="drawing-grid rounded-card border border-border bg-bg p-4">
          <SpacePlan areaM2={l.areaM2} widthM={p.widthM} depthM={p.depthM} ceilingM={p.ceilingM} powerKw={p.powerKw} outline={p.outline} title={`${t('plan')}: ${formatAreaFor(l.areaM2, locale)}`} locale={locale} />
        </div>
      </div>
      <div className="rounded-card border border-border bg-surface px-4 py-2">
        <SpecRow label={t('area')} value={formatNumber(l.areaM2, Number.isInteger(l.areaM2) ? 0 : 1)} unit={areaUnit(locale)} />
        {l.floor !== null && <SpecRow label={t('floor')} value={l.floorsTotal ? t('floorOf', { floor: l.floor, total: l.floorsTotal }) : l.floor} />}
        {rows.map((r) => (
          <SpecRow key={r.key} label={r.label} value={r.value} unit={r.unit} icon={r.icon} muted={r.muted} />
        ))}
        {isLease && l.depositMonths > 0 && <SpecRow label={t('deposit')} value={t('depositMonths', { n: formatNumber(l.depositMonths, 1) })} />}
        {isLease && l.serviceFeeMinor > 0 && <SpecRow label={t('serviceFee')} value={formatMoneyFor(l.serviceFeeMinor, locale, l.currency)} />}
        {isLease && <SpecRow label={t('utilities')} value={l.utilitiesIncluded ? t('yes') : t('no')} muted={!l.utilitiesIncluded} />}
        {l.completionDate && <SpecRow label={t('completion')} value={formatDateFor(l.completionDate, locale)} />}
        {!rows.length && <p className="py-3 text-small text-muted">{t('empty')}</p>}
      </div>
    </section>
  );
}
