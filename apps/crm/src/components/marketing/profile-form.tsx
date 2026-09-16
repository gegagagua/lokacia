'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Building2, ExternalLink, Link2, NotebookPen, Save, Star, Upload, UserRound } from 'lucide-react';
import { slugify, type BrokerProfile } from '@lokacia/contracts';
import { Button, Field, Input, Skeleton, Textarea, useToast } from '@lokacia/ui';
import { PageHeader } from '@/components/common/page-header';
import { PersonAvatar, SectionCard } from '@/components/common/ui';
import { apiFetch, ClientApiError, errorMessage, uploadFile } from '@/lib/api-client';
import { useApi, useApiMutation } from '@/lib/swr';

/** C12: edit own public broker profile (portal mini-site `/broker/:slug`). */
export function ProfileForm() {
  const t = useTranslations('marketing.profile');
  const { data, mutate } = useApi<BrokerProfile>('/crm/profile');
  if (!data) return <Skeleton className="h-96 rounded-card" />;
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

  const displayName = name || profile.name || profile.phone;
  return (
    <div className="flex flex-col">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          profile.publicUrl ? (
            <Button asChild variant="secondary" size="sm">
              <a href={profile.publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" strokeWidth={2} aria-hidden />
                {t('publicLink')}
              </a>
            </Button>
          ) : (
            <span className="rounded-full bg-accent-soft px-3 py-1.5 text-[13px] font-medium">{t('noSlug')}</span>
          )
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <form onSubmit={save} className="flex min-w-0 flex-col gap-5">
          <SectionCard title={t('basics')} description={t('basicsHint')} icon={UserRound} tone={2} bodyClassName="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-dashed border-border-strong bg-surface-2/50 p-4">
              <PersonAvatar src={avatarUrl} name={displayName} size={72} className="shadow-sm" />
              <div className="flex min-w-0 flex-col items-start gap-1">
                <span className="font-semibold">{t('avatar')}</span>
                <span className="text-[13px] text-muted">{t('avatarHint')}</span>
                <Button type="button" size="sm" variant="secondary" className="mt-1" loading={uploading} onClick={() => fileRef.current?.click()} icon={<Upload className="size-4" strokeWidth={2} aria-hidden />}>
                  {t('uploadAvatar')}
                </Button>
                <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
              </div>
            </div>
            <Field label={t('name')} error={errors.name}>
              <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
            </Field>
            <Field label={t('slug')} hint={`${t('slugHint')} · lokacia.ge/broker/${slug || '…'}`} error={errors.slug}>
              <Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} onBlur={() => setSlug((s) => (s ? slugify(s) : s))} className="font-mono" spellCheck={false} autoCapitalize="none" prefixIcon={<Link2 className="size-4" strokeWidth={2} aria-hidden />} />
            </Field>
          </SectionCard>
          <SectionCard title={t('bio')} description={t('bioHint')} icon={NotebookPen} tone={4}>
            <Field label={t('bio')} error={errors.bio}>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder={t('bioPlaceholder')} className="min-h-40" maxLength={2000} />
            </Field>
            <div className="mt-1 text-right text-[12px] text-muted tabular">{bio.length} / 2000</div>
          </SectionCard>
          <div className="flex justify-end">
            <Button type="submit" size="lg" loading={busy} className="w-full sm:w-auto" icon={<Save className="size-4" strokeWidth={2} aria-hidden />}>
              {t('save')}
            </Button>
          </div>
        </form>
        <aside className="card overflow-hidden lg:sticky lg:top-24" aria-label={t('publicCard')}>
          <div className="hero-gradient h-24" aria-hidden />
          <div className="-mt-10 flex flex-col items-center px-5 pb-5 text-center">
            <span className="rounded-full bg-surface p-1 shadow-md">
              <PersonAvatar src={avatarUrl} name={displayName} size={80} />
            </span>
            <div className="mt-3 text-[18px] font-bold leading-6">{displayName}</div>
            <div className="mt-0.5 font-mono text-[12.5px] text-muted">lokacia.ge/broker/{slug || '…'}</div>
            {bio && <p className="mt-3 line-clamp-4 text-[14px] leading-relaxed text-muted">{bio}</p>}
            <dl className="mt-5 grid w-full grid-cols-2 gap-2">
              <div className="flex flex-col-reverse rounded-2xl bg-surface-2 p-3">
                <dt className="text-[12.5px] text-muted">{t('listings')}</dt>
                <dd className="flex items-center justify-center gap-1.5 text-[22px] font-bold tabular">
                  <Building2 className="size-4 text-tone tone-2" strokeWidth={2} aria-hidden />
                  {profile.listingsCount}
                </dd>
              </div>
              <div className="flex flex-col-reverse rounded-2xl bg-surface-2 p-3">
                <dt className="text-[12.5px] text-muted">{t('reviews')}</dt>
                <dd className="flex items-center justify-center gap-1.5 text-[22px] font-bold tabular">
                  {profile.reviews.count}
                  {profile.reviews.avg !== null && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[12px] font-semibold" title={t('rating')}>
                      <Star className="size-3 fill-accent text-accent" strokeWidth={2} aria-hidden />
                      <span className="sr-only">{t('rating')}:</span>
                      {profile.reviews.avg}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
