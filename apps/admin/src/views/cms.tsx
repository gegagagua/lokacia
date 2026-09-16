'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslations } from 'next-intl';
import { Plus } from 'lucide-react';
import { formatDateTimeKa, type CmsPageDto, type CmsPageInput } from '@lokacia/contracts';
import { Badge, Button, EmptyState, Field, Input, Select, Switch, Tabs, Textarea } from '@lokacia/ui';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { useBusinessTypes } from '@/lib/business-types';
import { PageHeader } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';

function CmsTable({ kind }: { kind: 'permits' | 'static' }) {
  const t = useTranslations('cms');
  const { data, error, mutate } = useSWR<CmsPageDto[]>(`/admin/cms?kind=${kind}`, fetcher);
  const { data: types } = useBusinessTypes();
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock />;
  if (!data.length)
    return (
      <EmptyState
        title={t('emptyTitle')}
        description={t('emptyText')}
        action={
          <Button asChild size="sm">
            <Link href={`/cms/new?kind=${kind}`}>{t('new')}</Link>
          </Button>
        }
      />
    );
  const typeName = (id?: string | null) => types?.find((b) => b.id === id)?.nameKa;
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-border-strong text-small text-muted">
            <th scope="col" className="px-3 py-2 font-medium">{t('pageTitle')}</th>
            <th scope="col" className="px-3 py-2 font-medium">{kind === 'permits' ? t('businessType') : t('slug')}</th>
            <th scope="col" className="px-3 py-2 font-medium">{t('locale')}</th>
            <th scope="col" className="px-3 py-2 font-medium">{t('state')}</th>
            <th scope="col" className="px-3 py-2 font-medium">{t('updated')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.id} className="border-b border-border last:border-b-0 hover:bg-surface-2">
              <td className="px-3 py-2">
                <Link href={`/cms/${p.id}`} className="font-medium text-link hover:underline">
                  {p.title}
                </Link>
              </td>
              <td className="px-3 py-2">{kind === 'permits' ? (typeName(p.businessTypeId) ?? p.slug) : <span className="font-mono text-[13px]">/{p.slug}</span>}</td>
              <td className="px-3 py-2 font-mono text-[13px]">{p.locale}</td>
              <td className="px-3 py-2">{p.published ? <Badge tone="success">{t('published')}</Badge> : <Badge>{t('draft')}</Badge>}</td>
              <td className="px-3 py-2 text-small text-muted tabular">{formatDateTimeKa(p.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CmsListView() {
  const t = useTranslations('cms');
  const [tab, setTab] = React.useState<'permits' | 'static'>('permits');
  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button asChild size="sm">
            <Link href={`/cms/new?kind=${tab}`}>
              <Plus className="size-4" strokeWidth={1.5} aria-hidden />
              {t('new')}
            </Link>
          </Button>
        }
      />
      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as 'permits' | 'static')}
        tabs={[
          { value: 'permits', label: t('tabPermits'), content: <CmsTable kind="permits" /> },
          { value: 'static', label: t('tabStatic'), content: <CmsTable kind="static" /> },
        ]}
      />
    </>
  );
}

const EMPTY: CmsPageInput = { kind: 'permits', slug: '', businessTypeId: null, locale: 'ka', title: '', bodyMd: '', published: true };

export function CmsEditorView({ id, kind }: { id?: string; kind?: 'permits' | 'static' }) {
  const t = useTranslations('cms');
  const router = useRouter();
  const { data, error, mutate } = useSWR<CmsPageDto>(id ? `/admin/cms/${id}` : null, fetcher);
  const { data: types } = useBusinessTypes();
  const [form, setForm] = React.useState<CmsPageInput | null>(id ? null : { ...EMPTY, kind: kind ?? 'permits' });
  const [view, setView] = React.useState<'edit' | 'preview'>('edit');
  const { run, busy } = useAction();
  React.useEffect(() => {
    if (data) setForm({ kind: data.kind, slug: data.slug, businessTypeId: data.businessTypeId ?? null, locale: data.locale, title: data.title, bodyMd: data.bodyMd, published: data.published });
  }, [data]);
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!form) return <LoadingBlock rows={10} />;
  const set = <K extends keyof CmsPageInput>(k: K, v: CmsPageInput[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { ...form, businessTypeId: form.kind === 'permits' ? form.businessTypeId : null };
    if (id) {
      if (await run(() => apiFetch(`/admin/cms/${id}`, { method: 'PATCH', body }), t('saved'))) await mutate();
    } else {
      const created = await run(() => apiFetch<CmsPageDto>('/admin/cms', { method: 'POST', body }), t('created'));
      if (created) router.replace(`/cms/${created.id}`);
    }
  };
  const remove = async () => {
    if (!id || !window.confirm(t('confirmDelete'))) return;
    if (await run(() => apiFetch(`/admin/cms/${id}`, { method: 'DELETE' }), t('deleted'))) router.push('/cms');
  };

  const onType = (typeId: string) => {
    const bt = types?.find((b) => b.id === typeId);
    setForm((f) => (f ? { ...f, businessTypeId: typeId || null, slug: bt?.slug ?? f.slug, title: f.title || (bt ? t('permitsTitle', { name: bt.nameKa }) : f.title) } : f));
  };

  const editor = <Textarea aria-label={t('body')} value={form.bodyMd} onChange={(e) => set('bodyMd', e.target.value)} className="min-h-[480px] font-mono text-[14px] leading-6" />;
  const preview = (
    <div className="prose-ka min-h-[480px] overflow-auto rounded-card border border-border bg-bg p-4" aria-label={t('preview')}>
      {form.bodyMd.trim() ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.bodyMd}</ReactMarkdown> : <p className="text-muted">{t('previewEmpty')}</p>}
    </div>
  );

  return (
    <form onSubmit={save}>
      <PageHeader
        back={{ href: '/cms', label: t('title') }}
        title={id ? form.title || t('untitled') : t('new')}
        actions={
          <>
            {id && (
              <Button type="button" variant="danger" size="sm" onClick={remove}>
                {t('delete')}
              </Button>
            )}
            <Button type="submit" size="sm" loading={busy}>
              {id ? t('save') : t('create')}
            </Button>
          </>
        }
      />
      <div className="mb-4 grid gap-3 rounded-card border border-border bg-surface p-4 md:grid-cols-4">
        <Field label={t('kind')}>
          <Select value={form.kind} onChange={(e) => set('kind', e.target.value as 'permits' | 'static')} disabled={!!id} options={[{ value: 'permits', label: t('tabPermits') }, { value: 'static', label: t('tabStatic') }]} />
        </Field>
        {form.kind === 'permits' ? (
          <Field label={t('businessType')}>
            <Select value={form.businessTypeId ?? ''} onChange={(e) => onType(e.target.value)} placeholder={t('chooseType')} options={(types ?? []).map((b) => ({ value: b.id, label: b.nameKa }))} />
          </Field>
        ) : null}
        <Field label={t('slug')} hint={form.kind === 'static' ? t('slugHint') : undefined}>
          <Input value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} pattern="[a-z0-9-]+" required className="font-mono" />
        </Field>
        <Field label={t('locale')}>
          <Select value={form.locale} onChange={(e) => set('locale', e.target.value as 'ka' | 'en' | 'ru')} options={[{ value: 'ka', label: 'ქართული' }, { value: 'en', label: 'English' }, { value: 'ru', label: 'Русский' }]} />
        </Field>
        <Field label={t('pageTitle')} className="md:col-span-3">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} required />
        </Field>
        <div className="flex items-end pb-2">
          <Switch label={t('published')} checked={form.published} onCheckedChange={(v) => set('published', v)} />
        </div>
      </div>
      <p className="mb-2 text-small text-muted">{t('markdownHint')}</p>
      {/* side-by-side on wide screens, tabs on narrow */}
      <div className="hidden gap-4 lg:grid lg:grid-cols-2">
        {editor}
        {preview}
      </div>
      <div className="lg:hidden">
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as 'edit' | 'preview')}
          tabs={[
            { value: 'edit', label: t('edit'), content: editor },
            { value: 'preview', label: t('preview'), content: preview },
          ]}
        />
      </div>
    </form>
  );
}
