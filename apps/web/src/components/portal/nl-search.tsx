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
}: {
  size?: 'md' | 'lg';
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
      <form onSubmit={onSubmit} role="search" className={cn('flex flex-col gap-2 sm:flex-row', lg && 'sm:gap-3')}>
        <label htmlFor={inputId} className="sr-only">
          {t('label')}
        </label>
        <div className="relative flex-1">
          <Sparkles className={cn('pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted', lg ? 'size-5' : 'size-4')} strokeWidth={1.5} aria-hidden />
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
              'w-full rounded-button border border-border-strong bg-surface text-text placeholder:text-muted/80 focus:border-focus focus:outline-none focus-visible:outline-2 focus-visible:outline-focus',
              lg ? 'h-14 pl-11 pr-4 text-[17px]' : 'h-11 pl-10 pr-3 text-[15px]',
            )}
          />
        </div>
        <Button type="submit" size={lg ? 'lg' : 'md'} loading={busy} icon={<Search className="size-4" strokeWidth={1.5} aria-hidden />} className={cn(lg && 'h-14')}>
          {busy ? t('parsing') : filters && parsedFor === text.trim() ? t('search') : t('parse')}
        </Button>
      </form>

      <div aria-live="polite" className="mt-3">
        {filters && chips.length > 0 && (
          <div className="rounded-card border border-border bg-surface p-3">
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
        <div className="mt-2 flex flex-wrap items-center gap-2 text-small text-muted">
          <span>{t('examples')}:</span>
          {[t('example1'), t('example2'), t('example3')].map((ex) => (
            <button
              key={ex}
              type="button"
              className="rounded-button border border-border px-2 py-1 text-left hover:border-border-strong hover:text-text"
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
    <span className="inline-flex h-8 items-center overflow-hidden rounded-button border border-border-strong bg-surface-2 text-small">
      {chip.numeric !== undefined ? (
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) setDraft(String(chip.numeric ?? ''));
          }}
          trigger={
            <button type="button" className="h-full px-2.5 hover:bg-surface" aria-label={`${editLabel}: ${chip.label}`}>
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
        <span className="px-2.5">{body}</span>
      )}
      <button type="button" onClick={onRemove} className="grid h-full w-7 place-items-center border-l border-border-strong text-muted hover:bg-surface hover:text-text" aria-label={removeLabel}>
        <X className="size-3.5" strokeWidth={1.5} aria-hidden />
      </button>
    </span>
  );
}
