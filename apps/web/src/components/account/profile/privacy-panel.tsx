'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Download, LogOut, Trash2, TriangleAlert } from 'lucide-react';
import { Button, Dialog, Field, Input, Switch, useToast } from '@lokacia/ui';
import { SettingsRow } from '../ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';
import { useLocalizedPath } from '@/i18n/link';

const KINDS = ['terms', 'marketing', 'analytics'] as const;

export function PrivacyPanel({ consents }: { consents: { kind: string; granted: boolean }[] }) {
  const t = useTranslations('account.profile');
  const lp = useLocalizedPath();
  const toast = useToast();
  const [state, setState] = React.useState<Record<string, boolean>>(() => Object.fromEntries(KINDS.map((k) => [k, consents.find((c) => c.kind === k)?.granted ?? false])));
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [word, setWord] = React.useState('');
  const [busy, setBusy] = React.useState<string | null>(null);

  const setConsent = async (kind: string, granted: boolean) => {
    setState((s) => ({ ...s, [kind]: granted }));
    try {
      await apiFetch('/users/me/consents', { method: 'POST', body: { kind, granted } });
      toast({ title: t('consentSaved'), tone: 'success' });
    } catch (e) {
      setState((s) => ({ ...s, [kind]: !granted }));
      toast({ title: e instanceof ClientApiError ? e.message : t('saveError'), tone: 'danger' });
    }
  };

  const logoutAll = async () => {
    setBusy('logout');
    await apiFetch('/auth/logout-all', { method: 'POST' }).catch(() => undefined);
    window.location.href = lp('/login');
  };
  const deleteAccount = async () => {
    setBusy('delete');
    try {
      await apiFetch('/users/me', { method: 'DELETE' });
      await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
      window.location.href = lp('/');
    } catch (e) {
      setBusy(null);
      toast({ title: e instanceof ClientApiError ? e.message : t('saveError'), tone: 'danger' });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <section className="card p-5 sm:p-7">
        <SettingsRow label={t('consentsTitle')}>
          <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
            {KINDS.map((k) => (
              <li key={k} className="px-4 py-3">
                <Switch label={t(`consents.${k}`)} checked={state[k]} onCheckedChange={(v) => void setConsent(k, v)} />
              </li>
            ))}
          </ul>
        </SettingsRow>
        <SettingsRow label={t('exportTitle')} description={t('exportBody')}>
          <Button asChild variant="secondary">
            <a href="/api/v1/users/me/export" download>
              <Download className="size-4" strokeWidth={2} aria-hidden />
              {t('exportAction')}
            </a>
          </Button>
        </SettingsRow>
        <SettingsRow label={t('sessionsTitle')} description={t('sessionsBody')}>
          <Button variant="secondary" loading={busy === 'logout'} onClick={() => void logoutAll()}>
            <LogOut className="size-4" strokeWidth={2} aria-hidden />
            {t('logoutAll')}
          </Button>
        </SettingsRow>
      </section>
      <section className="rounded-card border border-danger/30 bg-danger/[0.05] p-5 sm:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-danger/12 text-danger" aria-hidden>
            <TriangleAlert className="size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-bold text-danger">{t('deleteTitle')}</h2>
            <p className="text-small text-muted">{t('deleteBody')}</p>
          </div>
          <Button variant="danger" onClick={() => setConfirmOpen(true)} className="self-start md:self-auto">
            <Trash2 className="size-4" strokeWidth={2} aria-hidden />
            {t('deleteAction')}
          </Button>
        </div>
      </section>
      <Dialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('deleteConfirmTitle')}
        description={t('deleteBody')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>{t('cancel')}</Button>
            <Button variant="danger" disabled={word.trim() !== t('deleteWord')} loading={busy === 'delete'} onClick={() => void deleteAccount()}>
              {t('deleteConfirm')}
            </Button>
          </>
        }
      >
        <Field label={t('deleteConfirmBody', { word: t('deleteWord') })}>
          <Input value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" />
        </Field>
      </Dialog>
    </div>
  );
}
