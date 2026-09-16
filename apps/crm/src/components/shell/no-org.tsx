'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { SessionUser } from '@lokacia/contracts';
import { Button, Card, Field, Input, Logo } from '@lokacia/ui';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { writeOrgCookie } from '@/lib/org';

export function NoOrg({ user }: { user: SessionUser }) {
  const t = useTranslations('shell.noOrg');
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <main id="main" className="drawing-grid flex min-h-dvh flex-col items-center justify-center gap-6 px-4">
      <Logo />
      <Card className="w-full max-w-md p-6">
        <h1 className="text-h3 font-semibold">{t('title')}</h1>
        <p className="mt-1 text-muted">{t('body')}</p>
        <p className="mt-2 text-small text-muted tabular">{user.phone}</p>
        <form
          className="mt-5 flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              const org = await apiFetch<{ id: string }>('/orgs', { method: 'POST', body: { name, type: 'agency' }, noOrg: true });
              writeOrgCookie(org.id);
              window.location.href = '/dashboard';
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          <Field label={t('name')} error={error}>
            <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
          </Field>
          <Button type="submit" loading={busy}>
            {t('create')}
          </Button>
        </form>
      </Card>
    </main>
  );
}
