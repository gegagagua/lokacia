import type { ReactNode } from 'react';
import { getTranslations } from 'next-intl/server';
import {
  AppWindow, Banknote, CalendarClock, Check, Clock, DoorOpen, Droplets, Fan, Flame, Layers, Maximize2, MoveDiagonal, MoveHorizontal, MoveVertical, PanelTop, PlugZap, Receipt, Ruler,
  ShieldCheck, SquareParking, Truck, Warehouse, Wind, X, Zap, type LucideIcon,
} from 'lucide-react';
import { PASSPORT_FIELDS, areaUnit, formatAreaFor, formatDateFor, formatMoneyFor, formatNumberFor, localizeUnit, passportLabel, type ListingDetail } from '@lokacia/contracts';
import { SpacePlan, cn } from '@lokacia/ui';
import { getAppLocale } from '@/i18n/server';
import { IconTile, ListingSection, type IconTone } from './section';

const ICONS: Record<string, LucideIcon> = {
  zap: Zap, 'plug-zap': PlugZap, 'move-vertical': MoveVertical, 'panel-top': PanelTop, 'move-horizontal': MoveHorizontal, 'move-diagonal': MoveDiagonal,
  wind: Wind, flame: Flame, droplets: Droplets, warehouse: Warehouse, truck: Truck, clock: Clock, 'square-parking': SquareParking, 'app-window': AppWindow,
  'door-open': DoorOpen, fan: Fan,
};

/** Key facts row: large icon stat tiles for the numbers tenants compare first. */
export async function ListingKeyFacts({ listing: l }: { listing: ListingDetail }) {
  const t = await getTranslations('listing.specs');
  const locale = await getAppLocale();
  const n = (v: number, d = 0) => formatNumberFor(v, locale, d);
  const p = l.passport;
  const unit = (k: string) => localizeUnit(PASSPORT_FIELDS.find((f) => f.key === k)?.unit, locale);
  const facts: { key: string; icon: LucideIcon; tone: IconTone; value: string; label: string }[] = [
    { key: 'area', icon: Maximize2, tone: 'primary' as const, value: formatAreaFor(l.areaM2, locale), label: t('area') },
    ...(l.floor !== null ? [{ key: 'floor', icon: Layers, tone: 'link' as const, value: l.floorsTotal ? t('floorOf', { floor: l.floor, total: l.floorsTotal }) : String(l.floor), label: t('floor') }] : []),
    ...(p.ceilingM ? [{ key: 'ceilingM', icon: MoveVertical, tone: 'success' as const, value: `${n(p.ceilingM, 1)} ${unit('ceilingM')}`, label: passportLabel('ceilingM', locale) }] : []),
    ...(p.powerKw ? [{ key: 'powerKw', icon: Zap, tone: 'accent' as const, value: `${n(p.powerKw)} ${unit('powerKw')}`, label: passportLabel('powerKw', locale) }] : []),
    ...(p.facadeM ? [{ key: 'facadeM', icon: PanelTop, tone: 'primary' as const, value: `${n(p.facadeM, 1)} ${unit('facadeM')}`, label: passportLabel('facadeM', locale) }] : []),
    ...(p.parking ? [{ key: 'parking', icon: SquareParking, tone: 'link' as const, value: n(p.parking), label: passportLabel('parking', locale) }] : []),
  ].slice(0, 4);
  return (
    <ul aria-label={t('keyFacts')} className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {facts.map((f) => (
        <li key={f.key} className="card flex flex-col gap-3 p-4 md:p-5">
          <IconTile tone={f.tone} size="sm">
            <f.icon className="size-[18px]" strokeWidth={2} />
          </IconTile>
          <div className="min-w-0">
            <div className="truncate text-[21px] font-bold leading-tight tracking-tight tabular">{f.value}</div>
            <div className="mt-0.5 truncate text-[13.5px] text-muted">{f.label}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function SpecItem({ icon, label, value, unit, state }: { icon?: ReactNode; label: string; value: ReactNode; unit?: string; state?: 'yes' | 'no' }) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-3">
      <span aria-hidden className={cn('grid size-9 shrink-0 place-items-center rounded-xl', state === 'no' ? 'bg-surface-2 text-muted' : 'bg-primary-soft text-primary-soft-text')}>
        {icon ?? <Ruler className="size-4" strokeWidth={2} />}
      </span>
      <dt className={cn('min-w-0 flex-1 text-[15px]', state === 'no' ? 'text-muted' : 'text-text')}>{label}</dt>
      <dd className="shrink-0 text-right">
        {state ? (
          <span className={cn('inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold', state === 'yes' ? 'bg-success/12 text-success' : 'bg-surface-2 text-muted')}>
            {state === 'yes' ? <Check className="size-3.5" strokeWidth={2.5} aria-hidden /> : <X className="size-3.5" strokeWidth={2.5} aria-hidden />}
            {value}
          </span>
        ) : (
          <span className="font-semibold tabular">
            {value}
            {unit && <span className="ml-1 text-small font-normal text-muted">{unit}</span>}
          </span>
        )}
      </dd>
    </div>
  );
}

/** Technical passport (P2): SpacePlan drawing card + lease terms + two-column spec grid with icons. */
export async function ListingSpecs({ listing: l }: { listing: ListingDetail }) {
  const t = await getTranslations('listing.specs');
  const locale = await getAppLocale();
  const formatNumber = (v: number, digits = 0) => formatNumberFor(v, locale, digits);
  const p = l.passport;
  const rows = PASSPORT_FIELDS.flatMap((f) => {
    const v = p[f.key];
    if (v === null || v === undefined) return [];
    const Icon = ICONS[f.icon];
    const isBool = typeof v === 'boolean';
    return [
      {
        key: f.key,
        label: passportLabel(f.key, locale),
        value: isBool ? (v ? t('yes') : t('no')) : formatNumber(v as number, f.kind === 'integer' ? 0 : 1),
        unit: isBool ? undefined : localizeUnit(f.unit, locale),
        icon: Icon ? <Icon className="size-4" strokeWidth={2} /> : undefined,
        state: isBool ? ((v ? 'yes' : 'no') as 'yes' | 'no') : undefined,
      },
    ];
  });
  // numbers first, then available amenities, then missing ones
  rows.sort((a, b) => (a.state === 'no' ? 2 : a.state ? 1 : 0) - (b.state === 'no' ? 2 : b.state ? 1 : 0));
  const isLease = l.dealType === 'rent' || l.dealType === 'short_term';
  const terms = [
    { key: 'area', icon: <Maximize2 className="size-4" strokeWidth={2} />, label: t('area'), value: formatNumber(l.areaM2, Number.isInteger(l.areaM2) ? 0 : 1), unit: areaUnit(locale) },
    ...(l.floor !== null ? [{ key: 'floor', icon: <Layers className="size-4" strokeWidth={2} />, label: t('floor'), value: l.floorsTotal ? t('floorOf', { floor: l.floor, total: l.floorsTotal }) : String(l.floor) }] : []),
    ...(isLease && l.depositMonths > 0 ? [{ key: 'deposit', icon: <ShieldCheck className="size-4" strokeWidth={2} />, label: t('deposit'), value: t('depositMonths', { n: formatNumber(l.depositMonths, 1) }) }] : []),
    ...(isLease && l.serviceFeeMinor > 0 ? [{ key: 'fee', icon: <Receipt className="size-4" strokeWidth={2} />, label: t('serviceFee'), value: formatMoneyFor(l.serviceFeeMinor, locale, l.currency) }] : []),
    ...(l.completionDate ? [{ key: 'completion', icon: <CalendarClock className="size-4" strokeWidth={2} />, label: t('completion'), value: formatDateFor(l.completionDate, locale) }] : []),
  ];
  return (
    <ListingSection id="specs-title" title={t('title')} subtitle={t('subtitle')} icon={<Ruler className="size-5" strokeWidth={2} />}>
      <div className="grid gap-5 md:grid-cols-2">
        <figure className="drawing-grid flex flex-col justify-center rounded-2xl border border-border p-4">
          <SpacePlan areaM2={l.areaM2} widthM={p.widthM} depthM={p.depthM} ceilingM={p.ceilingM} powerKw={p.powerKw} outline={p.outline} title={`${t('plan')}: ${formatAreaFor(l.areaM2, locale)}`} locale={locale} />
          <figcaption className="sr-only">{t('plan')}</figcaption>
        </figure>
        <dl className="flex flex-col justify-center [&>div:last-child]:border-b-0">
          {terms.map((r) => (
            <SpecItem key={r.key} icon={r.icon} label={r.label} value={r.value} unit={'unit' in r ? r.unit : undefined} />
          ))}
          {isLease && (
            <SpecItem icon={<Banknote className="size-4" strokeWidth={2} />} label={t('utilities')} value={l.utilitiesIncluded ? t('yes') : t('no')} state={l.utilitiesIncluded ? 'yes' : 'no'} />
          )}
        </dl>
      </div>
      {rows.length ? (
        <dl className="mt-4 grid gap-x-8 sm:grid-cols-2">
          {rows.map((r) => (
            <SpecItem key={r.key} label={r.label} value={r.value} unit={r.unit} icon={r.icon} state={r.state} />
          ))}
        </dl>
      ) : (
        <p className="mt-4 rounded-xl bg-surface-2 px-4 py-3 text-small text-muted">{t('empty')}</p>
      )}
    </ListingSection>
  );
}
