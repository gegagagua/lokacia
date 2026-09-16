'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Building, ImageIcon, Palette, Phone, Save, Upload } from 'lucide-react';
import { Button, Field, Input, Skeleton, Textarea, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { RequirePerm } from '@/components/common/require-perm';
import { SectionCard } from '@/components/common/ui';
import { errorMessage, uploadFile } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';

type Org = { id: string; name: string; phone: string | null; email: string | null; address: string | null; website: string | null; about: string | null; logoUrl: string | null; brandColor: string | null };

export default function OrganizationSettingsPage() {
  return (
    <RequirePerm perm="settings.manage">
      <OrgForm />
    </RequirePerm>
  );
}

function OrgForm() {
  const t = useTranslations('team.org');
  const settings = useTranslations('team.settings');
  const toast = useToast();
  const mutateApi = useApiMutation();
  const { refreshWorkspace } = useCrm();
  const { data, mutate } = useApi<Org>('/orgs/current');
  const [form, setForm] = React.useState<Org | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  if (!form) return <Skeleton className="h-96 rounded-card" />;
  const bind = (k: keyof Org) => ({ value: (form[k] as string | null) ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value }) });

  const brand = form.brandColor && /^#[0-9a-f]{6}$/i.test(form.brandColor) ? form.brandColor : null;
  return (
    <div className="max-w-6xl">
      <PageHeader
        back={
          <Link href="/settings" className="inline-flex items-center gap-1 hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden /> {settings('title')}
          </Link>
        }
        title={t('title')}
        actions={
          <Button type="submit" form="org-form" loading={busy} icon={<Save className="size-4" strokeWidth={2} aria-hidden />}>
            {t('save')}
          </Button>
        }
      />
      <form
        id="org-form"
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            const nil = (v: string | null) => (v && v.trim() ? v.trim() : null);
            await mutateApi('/orgs/current', {
              method: 'PATCH',
              body: { name: form.name, phone: form.phone || undefined, email: form.email || undefined, address: nil(form.address), website: nil(form.website), about: form.about || undefined, logoUrl: nil(form.logoUrl), brandColor: nil(form.brandColor) },
            });
            toast({ title: t('saved'), tone: 'success' });
            await Promise.all([mutate(), refreshWorkspace()]);
          } catch (err) {
            toast({ title: errorMessage(err), tone: 'danger' });
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <SectionCard title={t('identity')} description={t('identityHint')} icon={Building} tone={4} bodyClassName="grid gap-4">
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-border-strong bg-surface-2/50 p-4">
              <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
                {form.logoUrl ? <img src={form.logoUrl} alt={t('logo')} className="size-full object-contain" /> : <ImageIcon className="size-7 text-muted" strokeWidth={2} aria-label={t('logo')} />}
              </div>
              <div className="min-w-0">
                <div className="font-semibold">{t('logo')}</div>
                <div className="mb-2 text-[13px] text-muted">{t('logoHint')}</div>
                <Button type="button" variant="secondary" size="sm" loading={uploading} icon={<Upload className="size-4" strokeWidth={2} aria-hidden />} onClick={() => fileRef.current?.click()}>
                  {t('uploadLogo')}
                </Button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const id = await uploadFile(file, { kind: 'photo' });
                    let url: string | null = null;
                    for (let i = 0; i < 10 && !url; i++) {
                      const m = await mutateApi<{ url: string; status: string; variants: Record<string, string> | null }>(`/media/${id}`, { method: 'GET' });
                      if (m.status === 'ready' || m.url) url = m.variants?.md ?? m.url;
                      else await new Promise((r) => setTimeout(r, 500));
                    }
                    if (url) setForm((f) => (f ? { ...f, logoUrl: url } : f));
                  } catch (err) {
                    toast({ title: errorMessage(err), tone: 'danger' });
                  } finally {
                    setUploading(false);
                    e.target.value = '';
                  }
                }}
              />
            </div>
            <Field label={t('name')} required>
              <Input {...bind('name')} required minLength={2} />
            </Field>
            <Field label={t('about')}>
              <Textarea {...bind('about')} className="min-h-28" />
            </Field>
          </SectionCard>
          <SectionCard title={t('contacts')} description={t('contactsHint')} icon={Phone} tone={2} bodyClassName="grid gap-4 sm:grid-cols-2">
            <Field label={t('phone')}>
              <Input {...bind('phone')} inputMode="tel" />
            </Field>
            <Field label={t('email')}>
              <Input {...bind('email')} type="email" />
            </Field>
            <Field label={t('address')}>
              <Input {...bind('address')} />
            </Field>
            <Field label={t('website')}>
              <Input {...bind('website')} type="url" placeholder="https://" />
            </Field>
          </SectionCard>
        </div>
        <div className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-24">
          <SectionCard title={t('brand')} icon={Palette} tone={7} bodyClassName="flex flex-col gap-4">
            <Field label={t('brandColor')} hint={t('brandHint')}>
              <div className="flex items-center gap-2">
                <input type="color" aria-label={t('brandColor')} value={form.brandColor ?? '#1E4A42'} onChange={(e) => setForm({ ...form, brandColor: e.target.value.toUpperCase() })} className="h-12 w-14 shrink-0 cursor-pointer rounded-button border border-border bg-surface p-1" />
                <Input value={form.brandColor ?? ''} onChange={(e) => setForm({ ...form, brandColor: e.target.value })} placeholder="#1E4A42" className="tabular" />
              </div>
            </Field>
            <div>
              <div className="mb-1 text-[13px] font-semibold">{t('preview')}</div>
              <p className="mb-2 text-[12.5px] text-muted">{t('previewHint')}</p>
              <div className="overflow-hidden rounded-2xl border border-border shadow-sm" aria-hidden>
                <div className="flex items-center gap-2 bg-surface px-3 py-2">
                  <span className="grid size-6 place-items-center rounded-lg text-[11px] font-bold text-white" style={{ background: brand ?? 'var(--primary-500)' }}>
                    {form.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate text-[12px] font-bold">{form.name}</span>
                </div>
                <div
                  className={brand ? 'px-4 py-5' : 'hero-gradient px-4 py-5'}
                  style={brand ? { background: `linear-gradient(135deg, color-mix(in srgb, ${brand} 42%, #06120e), color-mix(in srgb, ${brand} 72%, #06120e))` } : undefined}
                >
                  <div className="mb-2 h-3 w-20 rounded-full bg-white/20" />
                  <div className="text-[17px] font-bold text-white">{t('previewGreeting')}</div>
                  <div className="mt-2 h-2 w-4/5 rounded-full bg-white/20" />
                  <div className="mt-1.5 h-2 w-3/5 rounded-full bg-white/20" />
                </div>
              </div>
            </div>
          </SectionCard>
          <Button type="submit" loading={busy} size="lg" className="w-full lg:hidden">
            {t('save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
