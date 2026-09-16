'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import useSWR from 'swr';
import { Search, Sparkles, X } from 'lucide-react';
import { filtersToParams, type SearchFilters, type SearchParseResponse } from '@lokacia/contracts';
import { Button, Input, Popover, cn } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { useLocalizedPath } from '@/i18n/link';
import { useFormat } from '@/i18n/use-format';
import { filterChips, removeChip, type Chip } from './search/chips';

type NameMap = Record<string, string>;

type NamedDto = { slug: string; nameKa: string; nameEn?: string | null; nameRu?: string | null };

function useNames(typeNames?: NameMap, districtNames?: NameMap) {
  const fmt = useFormat();
  const needTypes = !typeNames;
  const needDistricts = !districtNames;
  const { data: types } = useSWR<NamedDto[]>(needTypes ? '/taxonomy/business-types' : null, (p: string) => apiFetch(p), { revalidateOnFocus: false });
  const { data: districts } = useSWR<NamedDto[]>(needDistricts ? '/taxonomy/districts' : null, (p: string) => apiFetch(p), { revalidateOnFocus: false });
  return {
    typeNames: typeNames ?? Object.fromEntries((types ?? []).map((t) => [t.slug, fmt.name(t)])),
    districtNames: districtNames ?? Object.fromEntries((districts ?? []).map((d) => [d.slug, fmt.name(d)])),
  };
}

/** P13: natural-language search → editable filter chips → /search URL. Falls back to keyword search. */
export function NlSearchBox({
  size = 'md',
  autoFocus,
  className,
  typeNames: tn,
  districtNames: dn,
  showExamples,
  onDark,
}: {
  size?: 'md' | 'lg';
  /** Rendered over a dark hero band (light example chips). */
  onDark?: boolean;
  autoFocus?: boolean;
  className?: string;
  typeNames?: NameMap;
  districtNames?: NameMap;
  showExamples?: boolean;
}) {
  const t = useTranslations('search.nl');
  const tc = useTranslations('search');
  const fmt = useFormat();
  const lp = useLocalizedPath();
  const router = useRouter();
  const names = useNames(tn, dn);
  const inputId = React.useId();
  const [text, setText] = React.useState('');
  const [parsedFor, setParsedFor] = React.useState<string | null>(null);
  const [filters, setFilters] = React.useState<SearchFilters | null>(null);
  const [busy, setBusy] = React.useState(false);

  const go = (f: SearchFilters | null, fallbackText: string) => {
    const params = f ? filtersToParams(f) : new URLSearchParams();
    if (!params.toString() && fallbackText) params.set('q', fallbackText);
    const qs = params.toString();
    router.push(lp(qs ? `/search?${qs}` : '/search'));
  };

  const parse = async (value: string) => {
    const v = value.trim();
    if (v.length < 2) {
      go(null, '');
      return;
    }
    setBusy(true);
    try {
      const r = await apiFetch<SearchParseResponse>('/search/parse', { method: 'POST', body: { text: v } });
      const f = r.filters;
      const hasAny = filtersToParams(f).toString().length > 0;
      setParsedFor(v);
      setFilters(hasAny ? f : null);
      if (!hasAny) go(null, v);
    } catch {
      go(null, v);
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (filters && parsedFor === text.trim()) go(filters, text.trim());
    else void parse(text);
  };

  const chips = filters ? filterChips(filters, { typeNames: names.typeNames, districtNames: names.districtNames, t: (k, v) => tc(k as never, v as never), fmt }) : [];
  const lg = size === 'lg';

  return (
    <div className={cn('w-full', className)}>
      <form
        onSubmit={onSubmit}
        role="search"
        className={cn(
          'group/nl flex items-center gap-2 border bg-surface transition-shadow duration-200 focus-within:border-focus focus-within:shadow-ring',
          lg ? 'rounded-[22px] border-transparent p-2 shadow-lg sm:rounded-full' : 'rounded-full border-border p-1 shadow-xs hover:border-border-strong',
        )}
      >
        <label htmlFor={inputId} className="sr-only">
          {t('label')}
        </label>
        <div className="relative min-w-0 flex-1">
          <span aria-hidden className={cn('pointer-events-none absolute left-1.5 top-1/2 grid -translate-y-1/2 place-items-center rounded-full bg-primary-soft text-primary-soft-text', lg ? 'size-10' : 'size-8')}>
            <Sparkles className={lg ? 'size-5' : 'size-4'} strokeWidth={2} />
          </span>
          <input
            id={inputId}
            type="search"
            value={text}
            autoFocus={autoFocus}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('placeholder')}
            maxLength={300}
            enterKeyHint="search"
            className={cn(
              'w-full min-w-0 truncate rounded-full border-0 bg-transparent text-text placeholder:text-muted focus:outline-none focus-visible:outline-none',
              lg ? 'h-12 pl-14 pr-2 text-[16px] sm:h-14 sm:text-[17px]' : 'h-10 pl-11 pr-2 text-[15px]',
            )}
          />
        </div>
        <Button
          type="submit"
          size={lg ? 'lg' : 'md'}
          loading={busy}
          icon={<Search className="size-[18px]" strokeWidth={2} aria-hidden />}
          className={cn('shrink-0 rounded-full', lg ? 'h-12 px-4 sm:h-14 sm:px-7' : 'h-10 px-3 sm:px-5')}
        >
          <span className={cn(lg ? 'hidden sm:inline' : 'hidden sm:inline')}>{busy ? t('parsing') : filters && parsedFor === text.trim() ? t('search') : t('parse')}</span>
          <span className="sr-only sm:hidden">{t('search')}</span>
        </Button>
      </form>

      <div aria-live="polite" className="mt-3 empty:mt-0">
        {filters && chips.length > 0 && (
          <div className="rounded-card border border-border bg-surface p-4 text-text shadow-md">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-small font-medium">{t('chipsTitle')}</span>
              <span className="text-small text-muted">{t('chipsHint')}</span>
            </div>
            <ul className="flex flex-wrap gap-2">
              {chips.map((c) => (
                <li key={c.id}>
                  <EditableChip
                    chip={c}
                    onRemove={() => {
                      const next = removeChip(filters, c);
                      setFilters(filtersToParams(next).toString() ? next : null);
                    }}
                    onEdit={(value) => setFilters({ ...filters, [c.key]: value } as SearchFilters)}
                    editLabel={t('edit')}
                    applyLabel={t('apply')}
                    removeLabel={tc('removeChip', { label: c.label })}
                  />
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => go(filters, text.trim())}>
                {t('search')}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => go(null, text.trim())}>
                {t('fallback')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {showExamples && !filters && (
        <div className={cn('mt-1 flex flex-wrap items-center gap-2 text-small', onDark ? 'text-white/75' : 'text-muted')}>
          <span className="font-medium">{t('examples')}:</span>
          {[t('example1'), t('example2'), t('example3')].map((ex) => (
            <button
              key={ex}
              type="button"
              className={cn(
                'rounded-full px-3 py-1.5 text-left text-[13.5px] font-medium transition-all duration-200 focus-visible:outline-none focus-visible:shadow-ring',
                onDark ? 'bg-white/10 text-white ring-1 ring-inset ring-white/20 hover:bg-white/20' : 'bg-surface text-text ring-1 ring-inset ring-border hover:ring-border-strong hover:shadow-xs',
              )}
              onClick={() => {
                setText(ex);
                void parse(ex);
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EditableChip({ chip, onRemove, onEdit, editLabel, applyLabel, removeLabel }: { chip: Chip; onRemove: () => void; onEdit: (v: number) => void; editLabel: string; applyLabel: string; removeLabel: string }) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(String(chip.numeric ?? ''));
  const body = <span className="tabular">{chip.label}</span>;
  return (
    <span className="inline-flex h-9 items-center overflow-hidden rounded-full border border-border bg-primary-soft text-small font-medium text-primary-soft-text">
      {chip.numeric !== undefined ? (
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) setDraft(String(chip.numeric ?? ''));
          }}
          trigger={
            <button type="button" className="h-full pl-3.5 pr-2 hover:bg-surface/60" aria-label={`${editLabel}: ${chip.label}`}>
              {body}
            </button>
          }
        >
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(draft);
              if (Number.isFinite(n) && n >= 0) onEdit(n);
              setOpen(false);
            }}
          >
            <Input type="number" inputMode="numeric" min={0} value={draft} onChange={(e) => setDraft(e.target.value)} aria-label={chip.label} className="w-32" autoFocus />
            <Button type="submit" size="sm">
              {applyLabel}
            </Button>
          </form>
        </Popover>
      ) : (
        <span className="pl-3.5 pr-2">{body}</span>
      )}
      <button type="button" onClick={onRemove} className="grid h-full w-8 place-items-center hover:bg-surface/60" aria-label={removeLabel}>
        <X className="size-3.5" strokeWidth={1.5} aria-hidden />
      </button>
    </span>
  );
}
