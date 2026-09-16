'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Download, LogOut, Trash2 } from 'lucide-react';
import { Button, Card, Dialog, Field, Input, Switch, useToast } from '@lokacia/ui';
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
    <div className="flex max-w-2xl flex-col gap-4 pt-4">
      <Card className="p-4">
        <h2 className="mb-3 text-h3 font-semibold">{t('consentsTitle')}</h2>
        <div className="flex flex-col gap-3">
          {KINDS.map((k) => (
            <Switch key={k} label={t(`consents.${k}`)} checked={state[k]} onCheckedChange={(v) => void setConsent(k, v)} />
          ))}
        </div>
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-h3 font-semibold">{t('exportTitle')}</h2>
        <p className="text-muted">{t('exportBody')}</p>
        <div>
          <Button asChild variant="secondary">
            <a href="/api/v1/users/me/export" download>
              <Download className="size-4" strokeWidth={1.5} aria-hidden />
              {t('exportAction')}
            </a>
          </Button>
        </div>
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="text-h3 font-semibold">{t('sessionsTitle')}</h2>
        <p className="text-muted">{t('sessionsBody')}</p>
        <div>
          <Button variant="secondary" loading={busy === 'logout'} onClick={() => void logoutAll()}>
            <LogOut className="size-4" strokeWidth={1.5} aria-hidden />
            {t('logoutAll')}
          </Button>
        </div>
      </Card>
      <Card className="flex flex-col gap-3 border-danger/40 p-4">
        <h2 className="text-h3 font-semibold text-danger">{t('deleteTitle')}</h2>
        <p className="text-muted">{t('deleteBody')}</p>
        <div>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="size-4" strokeWidth={1.5} aria-hidden />
            {t('deleteAction')}
          </Button>
        </div>
      </Card>
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
