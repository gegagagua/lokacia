'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Upload } from 'lucide-react';
import { Button, Card, Field, Input, Skeleton, Textarea, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { RequirePerm } from '@/components/common/require-perm';
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
  if (!form) return <Skeleton className="h-96" />;
  const bind = (k: keyof Org) => ({ value: (form[k] as string | null) ?? '', onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value }) });

  return (
    <div className="max-w-2xl">
      <PageHeader
        back={
          <Link href="/settings" className="inline-flex items-center gap-1 text-link hover:underline">
            <ArrowLeft className="size-3.5" strokeWidth={1.5} aria-hidden /> {settings('title')}
          </Link>
        }
        title={t('title')}
      />
      <Card className="p-4">
        <form
          className="grid gap-4 sm:grid-cols-2"
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
          <div className="flex items-center gap-4 sm:col-span-2">
            <div className="grid size-20 place-items-center overflow-hidden rounded-card border border-border bg-surface-2">
              {form.logoUrl ? <img src={form.logoUrl} alt={t('logo')} className="size-full object-contain" /> : <span className="text-small text-muted">{t('logo')}</span>}
            </div>
            <Button type="button" variant="secondary" size="sm" loading={uploading} icon={<Upload className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => fileRef.current?.click()}>
              {t('uploadLogo')}
            </Button>
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
          <div className="sm:col-span-2">
            <Field label={t('name')} required>
              <Input {...bind('name')} required minLength={2} />
            </Field>
          </div>
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
          <div className="sm:col-span-2">
            <Field label={t('about')}>
              <Textarea {...bind('about')} />
            </Field>
          </div>
          <Field label={t('brandColor')} hint={t('brandHint')}>
            <div className="flex items-center gap-2">
              <input type="color" aria-label={t('brandColor')} value={form.brandColor ?? '#1E4A42'} onChange={(e) => setForm({ ...form, brandColor: e.target.value.toUpperCase() })} className="h-10 w-12 cursor-pointer rounded-button border border-border-strong bg-surface" />
              <Input value={form.brandColor ?? ''} onChange={(e) => setForm({ ...form, brandColor: e.target.value })} placeholder="#1E4A42" className="tabular" />
            </div>
          </Field>
          <div className="flex items-end justify-end sm:col-span-2">
            <Button type="submit" loading={busy}>
              {t('save')}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
