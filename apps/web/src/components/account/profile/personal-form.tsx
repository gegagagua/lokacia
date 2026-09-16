'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { SessionUser } from '@lokacia/contracts';
import { Avatar, Button, Card, Field, Input, Textarea, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError, uploadFile } from '@/lib/api-client';
import type { ProfileSettings } from './profile-tabs';

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

  return (
    <div className="flex max-w-2xl flex-col gap-6 pt-4">
      <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
        <Avatar src={avatarUrl} name={name || user.phone} size={72} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
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
      </Card>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save({ name: name.trim() || undefined, email: email.trim() || null, bio: bio.trim() || null });
        }}
      >
        <Field label={t('name')} error={errors.name} required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" minLength={2} maxLength={80} />
        </Field>
        <Field label={t('phone')} hint={t('phoneHint')}>
          <Input value={user.phone ?? ''} readOnly disabled className="tabular" />
        </Field>
        <Field label={t('email')} error={errors.email}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field label={t('bio')} hint={t('bioHint')} error={errors.bio}>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000} rows={4} />
        </Field>
        <div>
          <Button type="submit" loading={busy}>
            {t('save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
