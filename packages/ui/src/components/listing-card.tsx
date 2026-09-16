import * as React from 'react';
import { BadgeCheck, Building2, Camera, Clock, Heart, Layers, MapPin, Maximize2, MoveVertical, Zap } from 'lucide-react';
import { areaUnit, DEAL_TYPE_LABELS, formatMoneyFor, formatNumberFor, formatMonthYearFor, localizedText, pricePeriodSuffix, relativeDaysFor, type AppLocale, type ListingCard as Card } from '@lokacia/contracts';
import { cn } from '../lib/cn';
import { Badge, VipBadge } from './display';
import { SpacePlan } from './space-plan';

const CARD_LABELS: Record<AppLocale, { score: string; offPlan: string; verifiedOwner: string; owner: string; broker: string; confirmed: (when: string) => string; favAdd: string; favRemove: string }> = {
  ka: { score: 'ლოკაციის ქულა', offPlan: 'მშენებლე', verifiedOwner: 'ვერიფ. მესაკუთრე', owner: 'მესაკუთრე', broker: 'ბროკერი', confirmed: (w) => `დადასტურდა ${w}`, favAdd: 'ფავორიტებში დამატება', favRemove: 'ფავორიტებიდან წაშლა' },
  en: { score: 'Location score', offPlan: 'Off-plan', verifiedOwner: 'Verified owner', owner: 'Owner', broker: 'Broker', confirmed: (w) => `Confirmed ${w}`, favAdd: 'Add to favorites', favRemove: 'Remove from favorites' },
  ru: { score: 'Оценка локации', offPlan: 'Строится', verifiedOwner: 'Провер. собственник', owner: 'Собственник', broker: 'Брокер', confirmed: (w) => `Подтверждено ${w}`, favAdd: 'Добавить в избранное', favRemove: 'Удалить из избранного' },
};

export function PriceTag({ priceMinor, currency = 'GEL', period, areaM2, size = 'md', className, locale = 'ka' }: { priceMinor: number; currency?: string; period?: 'month' | 'total' | 'day' | 'hour'; areaM2?: number; size?: 'sm' | 'md' | 'lg'; className?: string; locale?: AppLocale }) {
  const perM2 = areaM2 ? Math.round(priceMinor / areaM2 / 100) * 100 : null;
  const suffix = pricePeriodSuffix(period, locale);
  return (
    <div className={cn('flex flex-col', className)}>
      <span className={cn('font-bold tabular leading-tight tracking-tight text-text', size === 'lg' ? 'text-[40px]' : size === 'sm' ? 'text-[18px]' : 'text-[22px]')}>
        {formatMoneyFor(priceMinor, locale, currency)}
        <span className="ml-0.5 text-[14px] font-medium text-muted">{suffix}</span>
      </span>
      {perM2 !== null && <span className="text-[13px] font-medium text-muted tabular">{formatMoneyFor(perM2, locale, currency)} / {areaUnit(locale)}</span>}
    </div>
  );
}

export type ListingCardProps = {
  listing: Card;
  href: string;
  businessTypeName?: (slug: string) => string;
  onFavorite?: () => void;
  favorite?: boolean;
  layout?: 'grid' | 'row';
  className?: string;
  priority?: boolean;
  LinkComponent?: React.ElementType;
  /** UI language (Phase 22); titles/district names use the per-locale fields with ka fallback. */
  locale?: AppLocale;
};

/** Deterministic (server == browser) number formatting — `toLocaleString` differs between Node and Chromium ICU and broke hydration. */
function fmt(n: number, locale: AppLocale, digits = 0) {
  return formatNumberFor(n, locale, digits);
}

/** Listing card v2: photo-first, glass badges, bold price, spec pills; mini SpacePlan kept as the signature detail. */
export function ListingCard({ listing: l, href, businessTypeName, onFavorite, favorite, layout = 'grid', className, priority, LinkComponent = 'a', locale = 'ka' }: ListingCardProps) {
  const Link = LinkComponent;
  const L = CARD_LABELS[locale] ?? CARD_LABELS.ka;
  const title = localizedText(l.title, l.titleEn, l.titleRu, locale);
  const districtName = l.districtName ? localizedText(l.districtName, l.districtNameEn, l.districtNameRu, locale) : null;
  const unit = areaUnit(locale);
  const specs = [
    { icon: <Maximize2 className="size-3.5" strokeWidth={2} aria-hidden />, text: `${fmt(l.areaM2, locale, 1)} ${unit}` },
    l.passport.ceilingM ? { icon: <MoveVertical className="size-3.5" strokeWidth={2} aria-hidden />, text: `${fmt(l.passport.ceilingM, locale, 1)} ${locale === 'ka' ? 'მ' : locale === 'ru' ? 'м' : 'm'}` } : null,
    l.passport.powerKw ? { icon: <Zap className="size-3.5" strokeWidth={2} aria-hidden />, text: `${fmt(l.passport.powerKw, locale)} ${locale === 'ka' ? 'კვტ' : locale === 'ru' ? 'кВт' : 'kW'}` } : null,
    l.floor != null ? { icon: <Layers className="size-3.5" strokeWidth={2} aria-hidden />, text: `${l.floor}` } : null,
  ].filter(Boolean) as { icon: React.ReactNode; text: string }[];
  return (
    <article
      className={cn(
        'group relative flex w-full min-w-0 overflow-hidden rounded-card border border-border bg-surface shadow-sm transition-all duration-300 ease-out hover:-translate-y-1 hover:border-border-strong hover:shadow-md',
        layout === 'grid' ? 'flex-col' : 'flex-col sm:flex-row',
        className,
      )}
    >
      <div className={cn('relative shrink-0 overflow-hidden bg-surface-2', layout === 'row' ? 'aspect-[4/3] sm:aspect-auto sm:w-[280px]' : 'aspect-[4/3]')}>
        {l.cover ? (
          <img src={l.cover} alt="" loading={priority ? 'eager' : 'lazy'} decoding="async" {...(priority ? { fetchPriority: 'high' as const } : {})} className="absolute inset-0 size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]" />
        ) : (
          <div className="grid size-full place-items-center text-muted">
            <Building2 className="size-10" strokeWidth={1.5} aria-hidden />
          </div>
        )}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {l.vip && <VipBadge />}
          <span className="inline-flex h-7 items-center rounded-full bg-white/90 px-2.5 text-[12.5px] font-semibold text-basalt shadow-xs backdrop-blur">{(DEAL_TYPE_LABELS[locale] ?? DEAL_TYPE_LABELS.ka)[l.dealType]}</span>
        </div>
        {l.photosCount > 0 && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[12px] font-medium text-white tabular backdrop-blur">
            <Camera className="size-3.5" strokeWidth={2} aria-hidden />
            {l.photosCount}
          </span>
        )}
        <div className="absolute bottom-3 right-3 hidden w-20 rounded-xl bg-white/92 p-1 shadow-sm backdrop-blur sm:block" aria-hidden>
          <SpacePlan compact areaM2={l.areaM2} widthM={l.passport.widthM} depthM={l.passport.depthM} locale={locale} className="text-basalt" />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-5">
        <div className="flex items-start justify-between gap-3">
          <PriceTag priceMinor={l.priceMinor} currency={l.currency} period={l.pricePeriod} areaM2={l.pricePeriod === 'month' ? l.areaM2 : undefined} locale={locale} />
          {l.locationScore != null && (
            <span
              title={`${L.score} (0–100)`}
              className={cn(
                'inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-bold tabular',
                l.locationScore >= 70 ? 'bg-success/12 text-success' : l.locationScore >= 50 ? 'bg-accent-soft text-text' : 'bg-surface-2 text-muted',
              )}
            >
              <span aria-hidden>◎</span>
              {l.locationScore}
              <span className="sr-only">{L.score}</span>
            </span>
          )}
        </div>
        <h3 className="line-clamp-2 text-[16.5px] font-semibold leading-snug">
          <Link href={href} className="after:absolute after:inset-0 after:z-[1] focus-visible:outline-none">
            {title}
          </Link>
        </h3>
        <p className="flex items-center gap-1.5 text-[14px] text-muted">
          <MapPin className="size-4 shrink-0 text-primary-500" strokeWidth={2} aria-hidden />
          <span className="truncate">{districtName ? `${districtName} · ` : ''}{l.address}</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {specs.map((sp, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-[12.5px] font-medium text-text tabular">
              <span className="text-muted">{sp.icon}</span>
              {sp.text}
            </span>
          ))}
          {l.businessTypes.slice(0, 2).map((b) => (
            <Badge key={b} tone="primary" className="h-[26px] rounded-lg">
              {businessTypeName?.(b) ?? b}
            </Badge>
          ))}
          {l.offPlan && <Badge tone="link" className="h-[26px] rounded-lg">{L.offPlan}{l.completionDate ? ` · ${formatMonthYearFor(l.completionDate, locale).split(' ').pop() ?? ''}` : ''}</Badge>}
        </div>
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3 text-[12.5px] text-muted">
          {l.isOwner ? (
            <span className={cn('inline-flex min-w-0 items-center gap-1 truncate whitespace-nowrap font-medium', l.verifiedOwner && 'text-success')}>
              {l.verifiedOwner && <BadgeCheck className="size-4" strokeWidth={2} aria-hidden />}
              {l.verifiedOwner ? L.verifiedOwner : L.owner}
            </span>
          ) : (
            <span className="truncate whitespace-nowrap font-medium">{L.broker}{l.commissionPct ? ` · ${l.commissionPct}%` : ''}</span>
          )}
          {l.lastConfirmedAt && (
            <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
              <Clock className="size-3.5" strokeWidth={2} aria-hidden />
              {L.confirmed(relativeDaysFor(l.lastConfirmedAt, locale))}
            </span>
          )}
        </div>
      </div>
      {onFavorite && (
        <button type="button" onClick={onFavorite} aria-pressed={favorite} aria-label={favorite ? L.favRemove : L.favAdd} className={cn('absolute right-3 top-3 z-10 grid size-10 place-items-center rounded-full bg-white/90 text-basalt shadow-sm backdrop-blur transition-transform hover:scale-110 active:scale-95', layout === 'row' && 'sm:left-[228px] sm:right-auto')}>
          <Heart className={cn('size-[18px]', favorite && 'fill-danger text-danger')} strokeWidth={2} />
        </button>
      )}
    </article>
  );
}
