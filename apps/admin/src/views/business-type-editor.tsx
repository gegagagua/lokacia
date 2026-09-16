'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Languages, ListChecks, Plus, Save, SlidersHorizontal, Store, Trash2 } from 'lucide-react';
import { PASSPORT_FIELDS, type BusinessTypeInput } from '@lokacia/contracts';
import { Button, Checkbox, Field, IconButton, Input, Select, cn } from '@lokacia/ui';
import { InlineEmpty, StatusPill } from '@/components/kit';
import { apiFetch } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { useBusinessTypes } from '@/lib/business-types';
import { useIsAdmin } from '@/lib/session-context';
import { BackLink, Section } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';

type Filter = BusinessTypeInput['filterConfig']['filters'][number];
type Form = Omit<BusinessTypeInput, 'fitoutPerM2Minor' | 'utilityCoef' | 'sort'> & { fitoutGel: string; utilityCoef: string; sort: string };

const EMPTY: Form = { slug: '', nameKa: '', nameEn: '', nameRu: '', icon: 'store', utilityCoef: '3', fitoutGel: '300', sort: '0', filterConfig: { filters: [], required: [] } };
const optNum = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));

export function BusinessTypeEditorView({ id }: { id?: string }) {
  const t = useTranslations('taxonomy');
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const { data, error, mutate } = useBusinessTypes();
  const [form, setForm] = React.useState<Form | null>(id ? null : EMPTY);
  const { run, busy } = useAction();
  React.useEffect(() => {
    if (!id || !data || form) return;
    const b = data.find((x) => x.id === id);
    if (b) setForm({ slug: b.slug, nameKa: b.nameKa, nameEn: b.nameEn, nameRu: b.nameRu, icon: b.icon, utilityCoef: String(b.utilityCoef), fitoutGel: String(b.fitoutPerM2Minor / 100), sort: String(b.sort), filterConfig: { filters: b.filterConfig.filters ?? [], required: b.filterConfig.required ?? [] } });
  }, [id, data, form]);
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (id && data && !data.some((x) => x.id === id)) return <ErrorBlock error={new Error(t('notFound'))} />;
  if (!form) return <LoadingBlock rows={10} />;

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setFilters = (fn: (f: Filter[]) => Filter[]) => setForm((f) => (f ? { ...f, filterConfig: { ...f.filterConfig, filters: fn(f.filterConfig.filters) } } : f));
  const updateFilter = (i: number, patch: Partial<Filter>) => setFilters((fs) => fs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i: number, d: -1 | 1) =>
    setFilters((fs) => {
      const n = [...fs];
      const j = i + d;
      if (j < 0 || j >= n.length) return n;
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });
  const toggleRequired = (key: string, on: boolean) =>
    setForm((f) => (f ? { ...f, filterConfig: { ...f.filterConfig, required: on ? [...new Set([...f.filterConfig.required, key])] : f.filterConfig.required.filter((k) => k !== key) } } : f));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const body: BusinessTypeInput = {
      slug: form.slug,
      nameKa: form.nameKa,
      nameEn: form.nameEn,
      nameRu: form.nameRu,
      icon: form.icon,
      utilityCoef: Number(form.utilityCoef.replace(',', '.')),
      fitoutPerM2Minor: Math.round(Number(form.fitoutGel.replace(',', '.')) * 100),
      sort: Number(form.sort) || 0,
      filterConfig: form.filterConfig,
    };
    if (id) {
      if (await run(() => apiFetch(`/admin/business-types/${id}`, { method: 'PATCH', body }), t('saved'))) await mutate();
    } else {
      const created = await run(() => apiFetch<{ id: string }>('/admin/business-types', { method: 'POST', body }), t('created'));
      if (created) {
        await mutate();
        router.replace(`/taxonomy/${created.id}`);
      }
    }
  };
  const remove = async () => {
    if (!id || !window.confirm(t('confirmDelete'))) return;
    if (await run(() => apiFetch(`/admin/business-types/${id}`, { method: 'DELETE' }), t('deleted'))) {
      await mutate();
      router.push('/taxonomy');
    }
  };

  const usedKeys = new Set(form.filterConfig.filters.map((f) => f.key));
  const kinds: Filter['kind'][] = ['boolean', 'min', 'range'];
  return (
    <form onSubmit={save}>
      <BackLink href="/taxonomy" label={t('title')} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-soft-text sm:grid">
            <Store className="size-[22px]" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight md:text-[30px]">{id ? form.nameKa || t('newType') : t('newType')}</h1>
            {form.slug && <span className="mt-1 inline-block rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[13px] text-muted">{form.slug}</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {id && isAdmin && (
            <Button type="button" variant="danger" onClick={remove} icon={<Trash2 className="size-4" strokeWidth={2} aria-hidden />}>
              {t('delete')}
            </Button>
          )}
          <Button type="submit" loading={busy} icon={<Save className="size-4" strokeWidth={2} aria-hidden />}>
            {id ? t('saveType') : t('createType')}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <Section icon={Languages} title={t('basics')}>
          <h3 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">{t('names')}</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label={t('nameKa')} required>
              <Input value={form.nameKa} onChange={(e) => set('nameKa', e.target.value)} required />
            </Field>
            <Field label={t('nameEn')} required>
              <Input value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} required lang="en" />
            </Field>
            <Field label={t('nameRu')} required>
              <Input value={form.nameRu} onChange={(e) => set('nameRu', e.target.value)} required lang="ru" />
            </Field>
          </div>
          <h3 className="mb-3 mt-6 text-[13px] font-semibold uppercase tracking-[0.04em] text-muted">{t('technical')}</h3>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Field label={t('slug')} hint={t('slugHint')} required>
              <Input value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} pattern="[a-z0-9_-]+" required className="font-mono" />
            </Field>
            <Field label={t('icon')} hint={t('iconHint')}>
              <Input value={form.icon} onChange={(e) => set('icon', e.target.value)} className="font-mono" />
            </Field>
            <Field label={t('sort')}>
              <Input type="number" value={form.sort} onChange={(e) => set('sort', e.target.value)} className="tabular" />
            </Field>
            <Field label={t('utilityCoef')} hint={t('utilityHint')}>
              <Input inputMode="decimal" value={form.utilityCoef} onChange={(e) => set('utilityCoef', e.target.value)} className="tabular" required />
            </Field>
            <Field label={t('fitout')} hint={t('fitoutHint')}>
              <Input inputMode="decimal" value={form.fitoutGel} onChange={(e) => set('fitoutGel', e.target.value)} suffix="₾" className="tabular" required />
            </Field>
          </div>
        </Section>

        <Section
          icon={SlidersHorizontal}
          title={t('filterBuilder')}
          description={form.filterConfig.filters.length ? t('filtersCount', { count: form.filterConfig.filters.length }) : undefined}
          actions={
            <Button
              type="button"
              size="sm"
              icon={<Plus className="size-4" strokeWidth={2} aria-hidden />}
              onClick={() => {
                const f = PASSPORT_FIELDS.find((p) => !usedKeys.has(p.key)) ?? PASSPORT_FIELDS[0]!;
                setFilters((fs) => [...fs, { key: f.key, kind: f.kind === 'boolean' ? 'boolean' : 'min', labelKa: f.labelKa, unit: f.unit }]);
              }}
            >
              {t('addFilter')}
            </Button>
          }
        >
          {form.filterConfig.filters.length === 0 ? (
            <InlineEmpty icon={SlidersHorizontal}>{t('noFilters')}</InlineEmpty>
          ) : (
            <ol className="grid gap-4 xl:grid-cols-2">
              {form.filterConfig.filters.map((f, i) => (
                <li key={i} className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-xs transition-shadow hover:shadow-sm">
                  <div className="flex items-center gap-3 border-b border-border bg-surface-2/60 px-4 py-2.5">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary text-[13px] font-bold tabular text-primary-contrast">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{f.labelKa || t('filterN', { n: i + 1 })}</span>
                    <div className="flex gap-0.5">
                      <IconButton type="button" size="sm" className="rounded-full" label={t('moveUp')} disabled={i === 0} onClick={() => move(i, -1)}>
                        <ArrowUp className="size-4" strokeWidth={2} />
                      </IconButton>
                      <IconButton type="button" size="sm" className="rounded-full" label={t('moveDown')} disabled={i === form.filterConfig.filters.length - 1} onClick={() => move(i, 1)}>
                        <ArrowDown className="size-4" strokeWidth={2} />
                      </IconButton>
                      <IconButton type="button" size="sm" className="rounded-full text-danger hover:bg-danger/10" label={t('removeFilter')} onClick={() => setFilters((fs) => fs.filter((_, j) => j !== i))}>
                        <Trash2 className="size-4" strokeWidth={2} />
                      </IconButton>
                    </div>
                  </div>
                  <div className="grid gap-3 p-4 sm:grid-cols-2">
                    <Field label={t('fKey')}>
                      <Select
                        value={f.key}
                        onChange={(e) => {
                          const meta = PASSPORT_FIELDS.find((p) => p.key === e.target.value);
                          updateFilter(i, { key: e.target.value, labelKa: meta?.labelKa ?? f.labelKa, unit: meta?.unit, kind: meta?.kind === 'boolean' ? 'boolean' : f.kind === 'boolean' ? 'min' : f.kind });
                        }}
                        options={PASSPORT_FIELDS.map((p) => ({ value: p.key, label: p.labelKa }))}
                      />
                    </Field>
                    <Field label={t('fLabel')}>
                      <Input value={f.labelKa} onChange={(e) => updateFilter(i, { labelKa: e.target.value })} required />
                    </Field>
                    <div className="sm:col-span-2">
                      <div className="mb-1.5 text-[14px] font-medium" id={`kind-${i}`}>
                        {t('fKind')}
                      </div>
                      <div role="radiogroup" aria-labelledby={`kind-${i}`} className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-surface-2 p-1">
                        {kinds.map((k) => (
                          <button
                            key={k}
                            type="button"
                            role="radio"
                            aria-checked={f.kind === k}
                            onClick={() => updateFilter(i, { kind: k })}
                            className={cn('h-8 shrink-0 rounded-full px-3.5 text-[13.5px] font-semibold transition-all focus-visible:shadow-ring focus-visible:outline-none', f.kind === k ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text')}
                          >
                            {t(`kinds.${k}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                    {f.kind !== 'boolean' && (
                      <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-4">
                        <Field label={t('fUnit')}>
                          <Input value={f.unit ?? ''} onChange={(e) => updateFilter(i, { unit: e.target.value || undefined })} />
                        </Field>
                        <Field label={t('fMin')}>
                          <Input inputMode="decimal" value={f.min ?? ''} onChange={(e) => updateFilter(i, { min: optNum(e.target.value) })} className="tabular" />
                        </Field>
                        <Field label={t('fMax')}>
                          <Input inputMode="decimal" value={f.max ?? ''} onChange={(e) => updateFilter(i, { max: optNum(e.target.value) })} className="tabular" />
                        </Field>
                        <Field label={t('fStep')}>
                          <Input inputMode="decimal" value={f.step ?? ''} onChange={(e) => updateFilter(i, { step: optNum(e.target.value) })} className="tabular" />
                        </Field>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section icon={ListChecks} title={t('requiredFields')} description={t('requiredHint')} actions={<StatusPill tone="primary">{t('requiredCount', { count: form.filterConfig.required.length })}</StatusPill>}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {PASSPORT_FIELDS.map((p) => {
              const on = form.filterConfig.required.includes(p.key);
              return (
                <div key={p.key} className={cn('rounded-xl border px-3 py-2.5 transition-colors', on ? 'border-primary/40 bg-primary-soft' : 'border-border hover:bg-surface-2')}>
                  <Checkbox label={p.labelKa} checked={on} onCheckedChange={(v) => toggleRequired(p.key, !!v)} />
                </div>
              );
            })}
          </div>
        </Section>
      </div>
    </form>
  );
}
