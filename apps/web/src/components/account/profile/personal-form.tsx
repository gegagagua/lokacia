'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { SessionUser } from '@lokacia/contracts';
import { Camera, Lock, Mail } from 'lucide-react';
import { Avatar, Button, Input, Textarea, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError, uploadFile } from '@/lib/api-client';
import type { ProfileSettings } from './profile-tabs';
import { SettingsRow } from '../ui';

async function waitForMedia(id: string) {
  for (let i = 0; i < 30; i++) {
    const m = await apiFetch<{ status: string; url: string; variants: Record<string, string> | null }>(`/media/${id}`);
    if (m.status === 'ready') return m.variants?.sm ?? m.url;
    if (m.status === 'failed') throw new Error('failed');
    await new Promise((r) => setTimeout(r, 700));
  }
  throw new Error('timeout');
}

export function PersonalForm({ user, settings }: { user: SessionUser; settings: ProfileSettings }) {
  const t = useTranslations('account.profile');
  const toast = useToast();
  const router = useRouter();
  const [name, setName] = React.useState(user.name ?? '');
  const [email, setEmail] = React.useState(user.email ?? '');
  const [bio, setBio] = React.useState(settings.bio ?? '');
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(user.avatarUrl);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [busy, setBusy] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const save = async (patch: Record<string, unknown>) => {
    setBusy(true);
    setErrors({});
    try {
      await apiFetch('/users/me', { method: 'PATCH', body: patch });
      toast({ title: t('saved'), tone: 'success' });
      router.refresh();
    } catch (e) {
      if (e instanceof ClientApiError && e.problem?.errors) setErrors(Object.fromEntries(e.problem.errors.map((x) => [x.path, x.message])));
      toast({ title: e instanceof ClientApiError ? e.message : t('saveError'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const onAvatar = async (file: File) => {
    setUploading(true);
    try {
      const id = await uploadFile(file, { kind: 'photo' });
      const url = await waitForMedia(id);
      const abs = url.startsWith('http') ? url : `${window.location.origin}${url}`;
      setAvatarUrl(abs);
      await save({ avatarUrl: abs });
    } catch {
      toast({ title: t('saveError'), tone: 'danger' });
    } finally {
      setUploading(false);
    }
  };

  const err = (k: string) =>
    errors[k] ? (
      <p id={`pf-${k}-err`} role="alert" className="mt-1.5 text-small font-medium text-danger">
        {errors[k]}
      </p>
    ) : null;

  return (
    <form
      className="card overflow-hidden"
      onSubmit={(e) => {
        e.preventDefault();
        void save({ name: name.trim() || undefined, email: email.trim() || null, bio: bio.trim() || null });
      }}
    >
      <div className="p-5 sm:p-7">
        <SettingsRow label={t('avatar')}>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar src={avatarUrl} name={name || user.phone} size={72} className="ring-4 ring-primary-soft" />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()} icon={<Camera className="size-4" strokeWidth={2} aria-hidden />}>
                {uploading ? t('avatarUploading') : t('avatarUpload')}
              </Button>
              {avatarUrl && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAvatarUrl(null);
                    void save({ avatarUrl: null });
                  }}
                >
                  {t('avatarRemove')}
                </Button>
              )}
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={t('avatarUpload')} onChange={(e) => e.target.files?.[0] && void onAvatar(e.target.files[0])} />
            </div>
          </div>
        </SettingsRow>
        <SettingsRow label={<>{t('name')} <span className="text-danger" aria-hidden>*</span></>} htmlFor="pf-name">
          <Input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" minLength={2} maxLength={80} required aria-invalid={!!errors.name || undefined} aria-describedby={errors.name ? 'pf-name-err' : undefined} />
          {err('name')}
        </SettingsRow>
        <SettingsRow label={t('phone')} description={t('phoneHint')} htmlFor="pf-phone">
          <Input id="pf-phone" value={user.phone ?? ''} readOnly disabled className="tabular" prefixIcon={<Lock className="size-4" strokeWidth={2} aria-hidden />} />
        </SettingsRow>
        <SettingsRow label={t('email')} htmlFor="pf-email">
          <Input id="pf-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" prefixIcon={<Mail className="size-4" strokeWidth={2} aria-hidden />} aria-invalid={!!errors.email || undefined} aria-describedby={errors.email ? 'pf-email-err' : undefined} />
          {err('email')}
        </SettingsRow>
        <SettingsRow label={t('bio')} description={t('bioHint')} htmlFor="pf-bio">
          <Textarea id="pf-bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000} rows={4} aria-invalid={!!errors.bio || undefined} aria-describedby={errors.bio ? 'pf-bio-err' : undefined} />
          {err('bio')}
        </SettingsRow>
      </div>
      <div className="flex justify-end border-t border-border bg-surface-2/50 px-5 py-4 sm:px-7">
        <Button type="submit" loading={busy}>
          {t('save')}
        </Button>
      </div>
    </form>
  );
}
