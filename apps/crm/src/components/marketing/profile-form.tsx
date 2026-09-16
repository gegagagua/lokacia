'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, Star, Upload } from 'lucide-react';
import { slugify, type BrokerProfile } from '@lokacia/contracts';
import { Avatar, Button, Card, Field, Input, Skeleton, Stat, Textarea, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { apiFetch, ClientApiError, errorMessage, uploadFile } from '@/lib/api-client';
import { useApi, useApiMutation } from '@/lib/swr';

/** C12: edit own public broker profile (portal mini-site `/broker/:slug`). */
export function ProfileForm() {
  const t = useTranslations('marketing.profile');
  const { data, mutate } = useApi<BrokerProfile>('/crm/profile');
  if (!data) return <Skeleton className="h-96" />;
  return <ProfileEditor key={data.id} profile={data} onSaved={(p) => void mutate(p, { revalidate: false })} t={t} />;
}

function ProfileEditor({ profile, onSaved, t }: { profile: BrokerProfile; onSaved: (p: BrokerProfile) => void; t: ReturnType<typeof useTranslations> }) {
  const toast = useToast();
  const mutate = useApiMutation();
  const [name, setName] = React.useState(profile.name ?? '');
  const [slug, setSlug] = React.useState(profile.slug ?? '');
  const [bio, setBio] = React.useState(profile.bio ?? '');
  const [avatarUrl, setAvatarUrl] = React.useState(profile.avatarUrl);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const id = await uploadFile(file, { kind: 'photo' });
      let url: string | null = null;
      for (let i = 0; i < 10 && !url; i++) {
        const m = await apiFetch<{ url: string; status: string; variants: Record<string, string> | null }>(`/media/${id}`);
        if (m.status === 'ready' || m.status === 'processing') url = m.variants?.sm ?? m.url;
        else await new Promise((r) => setTimeout(r, 400));
      }
      setAvatarUrl(url);
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setUploading(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    try {
      const body: Record<string, unknown> = { bio: bio || null, avatarUrl };
      if (name.trim().length >= 2) body.name = name.trim();
      if (slug) body.slug = slug;
      const p = await mutate<BrokerProfile>('/crm/profile', { method: 'PATCH', body });
      onSaved(p);
      toast({ title: t('saved'), tone: 'success' });
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 409) setErrors({ slug: t('slugTaken') });
      else if (err instanceof ClientApiError && err.problem?.errors?.length) setErrors(Object.fromEntries(err.problem.errors.map((x) => [x.path, x.message])));
      else toast({ title: errorMessage(err), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          profile.publicUrl ? (
            <a href={profile.publicUrl} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-button border border-border-strong px-3 text-small hover:bg-surface-2">
              <ExternalLink className="size-3.5" strokeWidth={1.5} aria-hidden />
              {t('publicLink')}
            </a>
          ) : (
            <span className="text-small text-muted">{t('noSlug')}</span>
          )
        }
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card className="p-5">
          <form onSubmit={save} className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <Avatar src={avatarUrl} name={name || profile.phone} size={72} />
              <div className="flex flex-col gap-1">
                <span className="text-small font-medium">{t('avatar')}</span>
                <Button type="button" size="sm" variant="secondary" loading={uploading} onClick={() => fileRef.current?.click()} icon={<Upload className="size-3.5" strokeWidth={1.5} aria-hidden />}>
                  {t('uploadAvatar')}
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
              </div>
            </div>
            <Field label={t('name')} error={errors.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <Field label={t('slug')} hint={`${t('slugHint')} · lokacia.ge/broker/${slug || '…'}`} error={errors.slug}>
              <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} onBlur={() => setSlug((s) => (s ? slugify(s) : s))} className="font-mono" spellCheck={false} autoCapitalize="none" />
            </Field>
            <Field label={t('bio')} error={errors.bio}>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t('bioPlaceholder')} className="min-h-40" maxLength={2000} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" loading={busy}>
                {t('save')}
              </Button>
            </div>
          </form>
        </Card>
        <div className="flex flex-col gap-3">
          <Stat label={t('listings')} value={profile.listingsCount} />
          <Stat label={t('reviews')} value={profile.reviews.count} hint={profile.reviews.avg !== null ? <span className="inline-flex items-center gap-1"><Star className="size-3.5 text-accent" strokeWidth={1.5} aria-hidden /> {t('rating')}: {profile.reviews.avg}</span> : undefined} />
        </div>
      </div>
    </div>
  );
}
