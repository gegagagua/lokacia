'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Badge, Button, Card, Checkbox, Dialog, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';
import type { ProfileSettings } from './profile-tabs';

const CATEGORIES = ['listing_alert', 'liveness', 'offers', 'viewings', 'messages', 'billing'] as const;
const CHANNELS = ['in_app', 'sms', 'email', 'telegram', 'viber'] as const;
const DEFAULTS: Record<string, string[]> = { listing_alert: ['in_app', 'email'], liveness: ['in_app', 'sms'], offers: ['in_app', 'sms'], viewings: ['in_app', 'sms', 'email'], messages: ['in_app'], billing: ['in_app', 'email'] };

export function NotificationsForm({ settings, hasEmail, mockMessengers }: { settings: ProfileSettings; hasEmail: boolean; mockMessengers: boolean }) {
  const t = useTranslations('account.profile');
  const toast = useToast();
  const router = useRouter();
  const [prefs, setPrefs] = React.useState<Record<string, string[]>>(() => Object.fromEntries(CATEGORIES.map((c) => [c, settings.notificationPrefs[c] ?? DEFAULTS[c]!])));
  const [linked, setLinked] = React.useState({ telegram: settings.telegramLinked, viber: settings.viberLinked });
  const [busy, setBusy] = React.useState(false);
  const [linking, setLinking] = React.useState<null | { channel: 'telegram' | 'viber'; url: string }>(null);

  const available = (ch: string) => (ch === 'telegram' ? linked.telegram : ch === 'viber' ? linked.viber : ch === 'email' ? hasEmail : true);
  const toggle = (cat: string, ch: string, on: boolean) => setPrefs((p) => ({ ...p, [cat]: on ? [...new Set([...(p[cat] ?? []), ch])] : (p[cat] ?? []).filter((x) => x !== ch) }));

  const save = async () => {
    setBusy(true);
    try {
      await apiFetch('/users/me', { method: 'PATCH', body: { notificationPrefs: prefs } });
      toast({ title: t('saved'), tone: 'success' });
    } catch (e) {
      toast({ title: e instanceof ClientApiError ? e.message : t('saveError'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const startLink = async (channel: 'telegram' | 'viber') => {
    try {
      const r = await apiFetch<{ url: string }>(`/users/me/${channel}-link`, { method: 'POST' });
      setLinking({ channel, url: r.url });
    } catch (e) {
      toast({ title: e instanceof ClientApiError ? e.message : t('saveError'), tone: 'danger' });
    }
  };
  const mockConfirm = async () => {
    if (!linking) return;
    await apiFetch(`/users/me/${linking.channel}-link/mock-confirm`, { method: 'POST' });
    setLinked((l) => ({ ...l, [linking.channel]: true }));
    setLinking(null);
    toast({ title: t('linked'), tone: 'success' });
    router.refresh();
  };
  const unlink = async (channel: 'telegram' | 'viber') => {
    await apiFetch(`/users/me/messengers/${channel}`, { method: 'DELETE' });
    setLinked((l) => ({ ...l, [channel]: false }));
    setPrefs((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.filter((x) => x !== channel)])));
  };

  return (
    <div className="flex flex-col gap-6 pt-4">
      <section aria-labelledby="messengers">
        <h2 id="messengers" className="mb-3 text-h3 font-semibold">{t('messengersTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['telegram', 'viber'] as const).map((ch) => (
            <Card key={ch} className="flex items-center justify-between gap-3 p-4">
              <div>
                <div className="font-medium">{t(ch)}</div>
                <Badge tone={linked[ch] ? 'success' : 'outline'} className="mt-1">{linked[ch] ? t('linked') : t('notLinked')}</Badge>
              </div>
              {linked[ch] ? (
                <Button variant="ghost" size="sm" onClick={() => void unlink(ch)}>{t('unlink')}</Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => void startLink(ch)}>{t('link')}</Button>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section aria-labelledby="prefs">
        <h2 id="prefs" className="text-h3 font-semibold">{t('notificationsIntro')}</h2>
        <div className="mt-3 overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full min-w-[560px] text-left text-[15px]">
            <thead>
              <tr className="border-b border-border text-small text-muted">
                <th scope="col" className="px-4 py-2 font-medium">{t('category')}</th>
                {CHANNELS.map((ch) => (
                  <th key={ch} scope="col" className="px-2 py-2 text-center font-medium">{t(`channels.${ch}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => (
                <tr key={cat} className="border-b border-border last:border-b-0">
                  <th scope="row" className="px-4 py-3 font-normal">{t(`categories.${cat}`)}</th>
                  {CHANNELS.map((ch) => (
                    <td key={ch} className="px-2 py-3 text-center">
                      <span className="inline-flex" title={available(ch) ? undefined : ch === 'email' ? t('channelNeedsEmail') : t('channelNeedsLink')}>
                        <Checkbox
                          aria-label={`${t(`categories.${cat}`)} — ${t(`channels.${ch}`)}`}
                          checked={(prefs[cat] ?? []).includes(ch)}
                          disabled={!available(ch)}
                          onCheckedChange={(v) => toggle(cat, ch, v === true)}
                        />
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Button className="mt-4" onClick={save} loading={busy}>{t('savePrefs')}</Button>
      </section>

      <Dialog
        open={!!linking}
        onOpenChange={(o) => !o && setLinking(null)}
        title={linking ? t('linkDialogTitle', { channel: t(linking.channel) }) : ''}
        description={t('linkDialogBody')}
        footer={
          <>
            {mockMessengers && <Button variant="secondary" onClick={() => void mockConfirm()}>{t('mockConfirm')}</Button>}
            {linking && (
              <Button asChild>
                <a href={linking.url} target="_blank" rel="noreferrer">{t('openBot')}</a>
              </Button>
            )}
          </>
        }
      >
        {mockMessengers && <p className="text-small text-muted">{t('mockHint')}</p>}
        {linking && <p className="mt-2 break-all text-small text-link">{linking.url}</p>}
      </Dialog>
    </div>
  );
}
