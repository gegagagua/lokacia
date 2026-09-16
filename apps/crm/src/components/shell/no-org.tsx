'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { SessionUser } from '@lokacia/contracts';
import { ArrowRight, Building2, Phone } from 'lucide-react';
import { Button, Field, Input, Logo } from '@lokacia/ui';
import { apiFetch, errorMessage } from '@/lib/api-client';
import { writeOrgCookie } from '@/lib/org';

export function NoOrg({ user }: { user: SessionUser }) {
  const t = useTranslations('shell.noOrg');
  const [name, setName] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  return (
    <main id="main" className="crm-wash flex min-h-dvh flex-col items-center justify-center gap-6 bg-bg px-4 py-10">
      <Logo />
      <div className="card w-full max-w-md p-6 shadow-md sm:p-8">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-soft-text" aria-hidden>
          <Building2 className="size-7" strokeWidth={2} />
        </span>
        <h1 className="mt-5 text-[24px] font-bold leading-tight tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-muted">{t('body')}</p>
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-small font-medium tabular text-muted">
          <Phone className="size-3.5" strokeWidth={2} aria-hidden />
          {user.phone}
        </p>
        <form
          className="mt-6 flex flex-col gap-4"
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
          <Button type="submit" size="lg" loading={busy} className="w-full">
            {t('create')}
            {!busy && <ArrowRight className="size-4" strokeWidth={2.2} aria-hidden />}
          </Button>
        </form>
      </div>
    </main>
  );
}
