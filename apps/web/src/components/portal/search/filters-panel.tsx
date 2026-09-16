'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { DEAL_TYPES, DEAL_TYPE_LABELS_KA, PASSPORT_KEYS, type PassportKey, type SearchFilters } from '@lokacia/contracts';
import { Button, Checkbox, Input, Label, Select, Switch, cn } from '@lokacia/ui';
import { CITY_NAMES_KA } from '@/lib/site';

export type TypeOption = { slug: string; nameKa: string; icon: string; filterConfig: { filters: { key: string; kind: 'boolean' | 'min'; labelKa: string; unit?: string; min?: number; max?: number; step?: number }[] } };
export type DistrictOption = { slug: string; nameKa: string; city: string };

type Patch = Partial<Record<keyof SearchFilters, unknown>>;

/** Debounced numeric input: keeps a local draft and commits after 500 ms or on blur/Enter. */
export function DebouncedNumber({ value, onCommit, label, suffix, min, max, step, className, id }: { value: number | undefined; onCommit: (v: number | undefined) => void; label: string; suffix?: string; min?: number; max?: number; step?: number; className?: string; id?: string }) {
  const [draft, setDraft] = React.useState(value == null ? '' : String(value));
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const committed = React.useRef(value);
  React.useEffect(() => {
    if (value !== committed.current) {
      committed.current = value;
      setDraft(value == null ? '' : String(value));
    }
  }, [value]);
  const commit = (raw: string) => {
    if (timer.current) clearTimeout(timer.current);
    const n = raw.trim() === '' ? undefined : Number(raw.replace(',', '.'));
    const next = n === undefined || !Number.isFinite(n) || n < 0 ? undefined : n;
    if (next === committed.current) return;
    committed.current = next;
    onCommit(next);
  };
  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      aria-label={label}
      placeholder={label}
      suffix={suffix}
      value={draft}
      className={className}
      onChange={(e) => {
        const v = e.target.value;
        setDraft(v);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => commit(v), 500);
      }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
    />
  );
}

function Section({ title, children, className }: { title: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <fieldset className={cn('flex flex-col gap-2.5 border-b border-border py-4 first:pt-0 last:border-b-0', className)}>
      <legend className="float-left mb-2.5 w-full text-small font-semibold uppercase tracking-wide text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

export function FiltersPanel({ filters, onChange, types, districts }: { filters: SearchFilters; onChange: (patch: Patch) => void; types: TypeOption[]; districts: DistrictOption[] }) {
  const t = useTranslations('search');
  const type = types.find((x) => x.slug === filters.businessType);
  const city = filters.city ?? 'tbilisi';
  const cityDistricts = districts.filter((d) => d.city === city);
  const selected = new Set(filters.districts ?? []);
  const ids = React.useId();

  const changeType = (slug: string) => {
    const next = types.find((x) => x.slug === slug);
    const allowed = new Set(next?.filterConfig.filters.map((f) => f.key) ?? []);
    const patch: Patch = { businessType: slug || undefined };
    for (const k of PASSPORT_KEYS) if (filters[k] !== undefined && !allowed.has(k)) patch[k] = undefined; // swap the passport filter set
    onChange(patch);
  };

  return (
    <div className="flex flex-col">
      <Section title={t('businessTypes')}>
        <Select aria-label={t('businessTypes')} value={filters.businessType ?? ''} onChange={(e) => changeType(e.target.value)} placeholder={t('allTypes')} options={types.map((x) => ({ value: x.slug, label: x.nameKa }))} />
      </Section>

      {type && type.filterConfig.filters.length > 0 && (
        <Section title={t('passport')}>
          <p className="-mt-1 text-small text-muted">{t('passportHint', { type: type.nameKa })}</p>
          {type.filterConfig.filters.map((f) => {
            const key = f.key as PassportKey;
            if (f.kind === 'boolean')
              return <Checkbox key={f.key} label={f.labelKa} checked={filters[key] === true} onCheckedChange={(v) => onChange({ [key]: v === true ? true : undefined })} />;
            const id = `${ids}-${f.key}`;
            return (
              <div key={f.key} className="flex flex-col gap-1.5">
                <Label htmlFor={id}>{f.labelKa}</Label>
                <DebouncedNumber id={id} label={f.labelKa} suffix={f.unit} min={f.min} max={f.max} step={f.step} value={typeof filters[key] === 'number' ? (filters[key] as number) : undefined} onCommit={(v) => onChange({ [key]: v })} />
              </div>
            );
          })}
        </Section>
      )}

      <Section title={t('dealType')}>
        <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label={t('dealType')}>
          {[undefined, ...DEAL_TYPES].map((d) => {
            const active = filters.dealType === d;
            return (
              <button
                key={d ?? 'any'}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => onChange({ dealType: d })}
                className={cn('h-9 rounded-button border px-2 text-small transition-colors duration-150', active ? 'border-primary bg-primary text-primary-contrast' : 'border-border-strong bg-surface hover:bg-surface-2')}
              >
                {d ? DEAL_TYPE_LABELS_KA[d] : t('anyDeal')}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title={t('city')}>
        <Select aria-label={t('city')} value={filters.city ?? ''} placeholder={t('anyDeal')} onChange={(e) => onChange({ city: e.target.value || undefined, districts: undefined })} options={Object.entries(CITY_NAMES_KA).map(([value, label]) => ({ value, label }))} />
        {cityDistricts.length > 0 && (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-small">
              <span className="font-medium">{t('districts')}</span>
              {selected.size > 0 && <span className="text-muted">{t('districtsSelected', { count: selected.size })}</span>}
            </div>
            <div className="flex max-h-56 flex-col gap-2 overflow-y-auto rounded-button border border-border p-2.5">
              {cityDistricts.map((d) => (
                <Checkbox
                  key={d.slug}
                  label={d.nameKa}
                  checked={selected.has(d.slug)}
                  onCheckedChange={(v) => {
                    const next = new Set(selected);
                    if (v) next.add(d.slug);
                    else next.delete(d.slug);
                    onChange({ districts: next.size ? [...next] : undefined });
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </Section>

      <Section title={t('price')}>
        <div className="grid grid-cols-2 gap-2">
          <DebouncedNumber label={t('from')} suffix="₾" value={filters.priceMin} onCommit={(v) => onChange({ priceMin: v })} />
          <DebouncedNumber label={t('to')} suffix="₾" value={filters.priceMax} onCommit={(v) => onChange({ priceMax: v })} />
        </div>
      </Section>

      <Section title={t('area')}>
        <div className="grid grid-cols-2 gap-2">
          <DebouncedNumber label={t('from')} suffix="მ²" value={filters.areaMin} onCommit={(v) => onChange({ areaMin: v })} />
          <DebouncedNumber label={t('to')} suffix="მ²" value={filters.areaMax} onCommit={(v) => onChange({ areaMax: v })} />
        </div>
      </Section>

      <Section title={t('filters')}>
        <Switch label={t('onlyOwners')} checked={!!filters.onlyOwners} onCheckedChange={(v) => onChange({ onlyOwners: v || undefined })} />
        <Switch label={t('verifiedOnly')} checked={!!filters.verifiedOnly} onCheckedChange={(v) => onChange({ verifiedOnly: v || undefined })} />
        <Switch label={t('offPlan')} checked={!!filters.offPlan} onCheckedChange={(v) => onChange({ offPlan: v || undefined })} />
        <Switch label={t('hasVideo')} checked={!!filters.hasVideo} onCheckedChange={(v) => onChange({ hasVideo: v || undefined })} />
        <div className="flex items-center justify-between gap-3 pt-1">
          <Label htmlFor={`${ids}-score`}>{t('scoreMin')}</Label>
          <Select
            id={`${ids}-score`}
            className="w-36"
            value={filters.scoreMin != null ? String(filters.scoreMin) : ''}
            onChange={(e) => onChange({ scoreMin: e.target.value ? Number(e.target.value) : undefined })}
            placeholder={t('scoreAny')}
            options={[50, 60, 70, 80, 90].map((s) => ({ value: String(s), label: t('scoreAtLeast', { score: s }) }))}
          />
        </div>
      </Section>

      <Section title={t('keyword')}>
        <KeywordInput value={filters.q} onCommit={(q) => onChange({ q })} label={t('keyword')} placeholder={t('keywordPlaceholder')} />
      </Section>
    </div>
  );
}

function KeywordInput({ value, onCommit, label, placeholder }: { value?: string; onCommit: (v: string | undefined) => void; label: string; placeholder: string }) {
  const [draft, setDraft] = React.useState(value ?? '');
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => setDraft(value ?? ''), [value]);
  const commit = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    const next = v.trim() || undefined;
    if (next !== value) onCommit(next);
  };
  return (
    <Input
      type="search"
      aria-label={label}
      placeholder={placeholder}
      value={draft}
      maxLength={200}
      onChange={(e) => {
        setDraft(e.target.value);
        if (timer.current) clearTimeout(timer.current);
        const v = e.target.value;
        timer.current = setTimeout(() => commit(v), 600);
      }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && commit((e.target as HTMLInputElement).value)}
    />
  );
}

export function ResetButton({ onReset, label }: { onReset: () => void; label: string }) {
  return (
    <Button variant="ghost" size="sm" onClick={onReset}>
      {label}
    </Button>
  );
}
