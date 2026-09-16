'use client';
import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useTranslations } from 'next-intl';
import { ChevronRight, Code2, Eye, FileText, Globe, Plus, Save, Trash2 } from 'lucide-react';
import { formatDateTimeKa, type CmsPageDto, type CmsPageInput } from '@lokacia/contracts';
import { Button, EmptyState, Field, Input, Select, Switch, Tabs, Textarea, cn } from '@lokacia/ui';
import { apiFetch, fetcher } from '@/lib/api-client';
import { useAction } from '@/lib/use-action';
import { useBusinessTypes } from '@/lib/business-types';
import { BackLink, PageHeader } from '@/components/page-header';
import { ErrorBlock, LoadingBlock } from '@/components/states';
import { StatusPill, TableCard, THead, td, th, tr } from '@/components/kit';

function CmsTable({ kind }: { kind: 'permits' | 'static' }) {
  const t = useTranslations('cms');
  const router = useRouter();
  const { data, error, mutate } = useSWR<CmsPageDto[]>(`/admin/cms?kind=${kind}`, fetcher);
  const { data: types } = useBusinessTypes();
  if (error) return <ErrorBlock error={error} retry={() => mutate()} />;
  if (!data) return <LoadingBlock />;
  if (!data.length)
    return (
      <EmptyState
        title={t('emptyTitle')}
        description={t('emptyText')}
        icon={<FileText className="size-6" strokeWidth={2} aria-hidden />}
        action={
          <Button asChild size="sm">
            <Link href={`/cms/new?kind=${kind}`}>{t('new')}</Link>
          </Button>
        }
      />
    );
  const typeName = (id?: string | null) => types?.find((b) => b.id === id)?.nameKa;
  return (
    <TableCard minWidth={720} label={kind === 'permits' ? t('tabPermits') : t('tabStatic')}>
      <THead>
        <th scope="col" className={th}>{t('pageTitle')}</th>
        <th scope="col" className={th}>{kind === 'permits' ? t('businessType') : t('slug')}</th>
        <th scope="col" className={th}>{t('locale')}</th>
        <th scope="col" className={th}>{t('state')}</th>
        <th scope="col" className={th}>{t('updated')}</th>
        <th scope="col" className={th}>
          <span className="sr-only">{t('edit')}</span>
        </th>
      </THead>
      <tbody>
        {data.map((p) => (
          <tr key={p.id} className={`${tr} cursor-pointer`} onClick={(e) => !(e.target as HTMLElement).closest('a,button') && router.push(`/cms/${p.id}`)}>
            <td className={td}>
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary-soft-text">
                  <FileText className="size-[18px]" strokeWidth={2} aria-hidden />
                </span>
                <Link href={`/cms/${p.id}`} className="min-w-0 truncate font-semibold hover:text-link hover:underline">
                  {p.title}
                </Link>
              </div>
            </td>
            <td className={td}>{kind === 'permits' ? (typeName(p.businessTypeId) ?? p.slug) : <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[13px]">/{p.slug}</span>}</td>
            <td className={td}>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-[12.5px] font-bold uppercase">
                <Globe className="size-3.5 text-muted" strokeWidth={2} aria-hidden />
                {p.locale}
              </span>
            </td>
            <td className={td}>{p.published ? <StatusPill tone="success">{t('published')}</StatusPill> : <StatusPill>{t('draft')}</StatusPill>}</td>
            <td className={`${td} whitespace-nowrap text-muted`}>{formatDateTimeKa(p.updatedAt)}</td>
            <td className={`${td} w-10 text-muted`}>
              <ChevronRight className="size-4" strokeWidth={2} aria-hidden />
            </td>
          </tr>
        ))}
      </tbody>
    </TableCard>
  );
}

export function CmsListView() {
  const t = useTranslations('cms');
  const [tab, setTab] = React.useState<'permits' | 'static'>('permits');
  return (
    <>
      <PageHeader
        icon={FileText}
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button asChild>
            <Link href={`/cms/new?kind=${tab}`}>
              <Plus className="size-4" strokeWidth={2} aria-hidden />
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
const SYNTAX = ['# ', '## ', '- ', '- [ ] ', '**…**', '[…](https://…)'];

function PaneHeader({ icon: Icon, children, extra }: { icon: React.ElementType; children: React.ReactNode; extra?: React.ReactNode }) {
  return (
    <div className="flex h-12 items-center justify-between gap-3 border-b border-border bg-surface-2/60 px-4">
      <span className="flex items-center gap-2 text-[14px] font-bold">
        <Icon className="size-4 text-muted" strokeWidth={2} aria-hidden />
        {children}
      </span>
      {extra}
    </div>
  );
}

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

  const words = form.bodyMd.trim() ? form.bodyMd.trim().split(/\s+/).length : 0;
  const stats = <span className="text-[12.5px] font-medium text-muted tabular">{t('words', { count: words })}</span>;
  const editor = (
    <Textarea
      aria-label={t('body')}
      value={form.bodyMd}
      onChange={(e) => set('bodyMd', e.target.value)}
      spellCheck={false}
      className="min-h-[560px] resize-y rounded-none border-0 bg-transparent px-5 py-4 font-sans text-[15px] leading-7 shadow-none focus:shadow-none focus-visible:shadow-none"
    />
  );
  const preview = (
    <div className="prose-ka min-h-[560px] overflow-auto px-6 py-5" aria-label={t('preview')}>
      {form.bodyMd.trim() ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{form.bodyMd}</ReactMarkdown> : <p className="text-muted">{t('previewEmpty')}</p>}
    </div>
  );

  return (
    <form onSubmit={save}>
      <BackLink href="/cms" label={t('title')} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="hidden size-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary-soft-text sm:grid">
            <FileText className="size-[22px]" strokeWidth={2} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="text-[26px] font-bold leading-tight tracking-tight [overflow-wrap:anywhere] md:text-[30px]">{id ? form.title || t('untitled') : t('new')}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {form.published ? <StatusPill tone="success">{t('published')}</StatusPill> : <StatusPill>{t('draft')}</StatusPill>}
              {data && <span className="text-small text-muted">{t('updatedAt', { date: formatDateTimeKa(data.updatedAt) })}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {id && (
            <Button type="button" variant="danger" onClick={remove} icon={<Trash2 className="size-4" strokeWidth={2} aria-hidden />}>
              {t('delete')}
            </Button>
          )}
          <Button type="submit" loading={busy} icon={<Save className="size-4" strokeWidth={2} aria-hidden />}>
            {id ? t('save') : t('create')}
          </Button>
        </div>
      </div>

      <div className="card mb-5 grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_160px]">
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
        <Field label={t('pageTitle')} className={cn('md:col-span-2', form.kind === 'permits' ? 'xl:col-span-3' : 'xl:col-span-2')}>
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} required />
        </Field>
        <div className="flex items-end pb-3">
          <Switch label={t('published')} checked={form.published} onCheckedChange={(v) => set('published', v)} />
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-small text-muted">
        <span className="mr-1 font-medium">{t('syntax')}</span>
        {SYNTAX.map((s) => (
          <code key={s} className="rounded-md bg-surface px-2 py-0.5 font-mono text-[12.5px] text-text ring-1 ring-inset ring-border">
            {s}
          </code>
        ))}
      </div>

      {/* split view on wide screens */}
      <div className="card hidden overflow-hidden lg:grid lg:grid-cols-2">
        <div className="min-w-0 border-r border-border">
          <PaneHeader icon={Code2} extra={stats}>
            {t('markdown')}
          </PaneHeader>
          {editor}
        </div>
        <div className="min-w-0 bg-bg/40">
          <PaneHeader icon={Eye} extra={<StatusPill tone="success" pulse>{t('live')}</StatusPill>}>
            {t('preview')}
          </PaneHeader>
          {preview}
        </div>
      </div>
      {/* tabs on narrow screens */}
      <div className="lg:hidden">
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as 'edit' | 'preview')}
          tabs={[
            { value: 'edit', label: t('edit'), content: <div className="card overflow-hidden">{editor}</div> },
            { value: 'preview', label: t('preview'), content: <div className="card overflow-hidden">{preview}</div> },
          ]}
        />
      </div>
    </form>
  );
}
