'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { PASSPORT_FIELDS, type BusinessTypeInput } from '@lokacia/contracts';
import { Button, Checkbox, Field, IconButton, Input, Select } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { useBusinessTypes } from '@/lib/business-types';
import { useIsAdmin } from '@/lib/session-context';
import { PageHeader, Section } from '@/components/page-header';
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
  return (
    <form onSubmit={save}>
      <PageHeader
        back={{ href: '/taxonomy', label: t('title') }}
        title={id ? form.nameKa : t('newType')}
        actions={
          <>
            {id && isAdmin && (
              <Button type="button" size="sm" variant="danger" onClick={remove}>
                {t('delete')}
              </Button>
            )}
            <Button type="submit" size="sm" loading={busy}>
              {id ? t('saveType') : t('createType')}
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-4">
        <Section title={t('basics')}>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label={t('nameKa')} required>
              <Input value={form.nameKa} onChange={(e) => set('nameKa', e.target.value)} required />
            </Field>
            <Field label={t('nameEn')} required>
              <Input value={form.nameEn} onChange={(e) => set('nameEn', e.target.value)} required lang="en" />
            </Field>
            <Field label={t('nameRu')} required>
              <Input value={form.nameRu} onChange={(e) => set('nameRu', e.target.value)} required lang="ru" />
            </Field>
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
          title={t('filterBuilder')}
          actions={
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<Plus className="size-4" strokeWidth={1.5} aria-hidden />}
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
            <p className="text-small text-muted">{t('noFilters')}</p>
          ) : (
            <ol className="flex flex-col gap-2">
              {form.filterConfig.filters.map((f, i) => (
                <li key={i} className="grid items-end gap-2 rounded-card border border-border p-3 md:grid-cols-[1.4fr_1fr_1.4fr_0.6fr_0.6fr_0.6fr_0.6fr_auto]">
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
                  <Field label={t('fKind')}>
                    <Select value={f.kind} onChange={(e) => updateFilter(i, { kind: e.target.value as Filter['kind'] })} options={[{ value: 'boolean', label: t('kinds.boolean') }, { value: 'min', label: t('kinds.min') }, { value: 'range', label: t('kinds.range') }]} />
                  </Field>
                  <Field label={t('fLabel')}>
                    <Input value={f.labelKa} onChange={(e) => updateFilter(i, { labelKa: e.target.value })} required />
                  </Field>
                  <Field label={t('fUnit')}>
                    <Input value={f.unit ?? ''} onChange={(e) => updateFilter(i, { unit: e.target.value || undefined })} disabled={f.kind === 'boolean'} />
                  </Field>
                  <Field label={t('fMin')}>
                    <Input inputMode="decimal" value={f.min ?? ''} onChange={(e) => updateFilter(i, { min: optNum(e.target.value) })} disabled={f.kind === 'boolean'} className="tabular" />
                  </Field>
                  <Field label={t('fMax')}>
                    <Input inputMode="decimal" value={f.max ?? ''} onChange={(e) => updateFilter(i, { max: optNum(e.target.value) })} disabled={f.kind === 'boolean'} className="tabular" />
                  </Field>
                  <Field label={t('fStep')}>
                    <Input inputMode="decimal" value={f.step ?? ''} onChange={(e) => updateFilter(i, { step: optNum(e.target.value) })} disabled={f.kind === 'boolean'} className="tabular" />
                  </Field>
                  <div className="flex gap-1 pb-0.5">
                    <IconButton type="button" size="sm" label={t('moveUp')} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="size-4" strokeWidth={1.5} />
                    </IconButton>
                    <IconButton type="button" size="sm" label={t('moveDown')} disabled={i === form.filterConfig.filters.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="size-4" strokeWidth={1.5} />
                    </IconButton>
                    <IconButton type="button" size="sm" label={t('removeFilter')} onClick={() => setFilters((fs) => fs.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4 text-danger" strokeWidth={1.5} />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Section>

        <Section title={t('requiredFields')}>
          <p className="mb-3 text-small text-muted">{t('requiredHint')}</p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {PASSPORT_FIELDS.map((p) => (
              <Checkbox key={p.key} label={p.labelKa} checked={form.filterConfig.required.includes(p.key)} onCheckedChange={(v) => toggleRequired(p.key, !!v)} />
            ))}
          </div>
        </Section>
      </div>
    </form>
  );
}
