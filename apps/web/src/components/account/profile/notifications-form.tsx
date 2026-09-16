'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
import { Badge, Button, Checkbox, Dialog, useToast } from '@lokacia/ui';
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
    <div className="flex flex-col gap-5">
      <section aria-labelledby="messengers" className="card p-5 sm:p-7">
        <h2 id="messengers" className="mb-4 text-[17px] font-bold">{t('messengersTitle')}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(['telegram', 'viber'] as const).map((ch) => (
            <div key={ch} className="flex items-center gap-3 rounded-2xl border border-border p-4">
              <span className={`grid size-11 shrink-0 place-items-center rounded-2xl text-white ${ch === 'telegram' ? 'bg-[#2AABEE]' : 'bg-[#7360F2]'}`} aria-hidden>
                <Send className="size-5" strokeWidth={2} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{t(ch)}</div>
                <Badge tone={linked[ch] ? 'success' : 'outline'} className="mt-1">{linked[ch] ? t('linked') : t('notLinked')}</Badge>
              </div>
              {linked[ch] ? (
                <Button variant="ghost" size="sm" onClick={() => void unlink(ch)}>{t('unlink')}</Button>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => void startLink(ch)}>{t('link')}</Button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="prefs" className="card overflow-hidden">
        <div className="p-5 pb-4 sm:px-7 sm:pt-7">
          <h2 id="prefs" className="text-[17px] font-bold">{t('notificationsIntro')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-[15px]">
            <thead>
              <tr className="border-y border-border bg-surface-2/60 text-[13px] text-muted">
                <th scope="col" className="px-5 py-3 font-semibold sm:px-7">{t('category')}</th>
                {CHANNELS.map((ch) => (
                  <th key={ch} scope="col" className="px-2 py-3 text-center font-semibold">{t(`channels.${ch}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CATEGORIES.map((cat) => (
                <tr key={cat} className="border-b border-border transition-colors last:border-b-0 hover:bg-surface-2/40">
                  <th scope="row" className="px-5 py-3.5 font-medium sm:px-7">{t(`categories.${cat}`)}</th>
                  {CHANNELS.map((ch) => (
                    <td key={ch} className="px-2 py-3.5 text-center">
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
        <div className="flex justify-end border-t border-border bg-surface-2/50 px-5 py-4 sm:px-7">
          <Button onClick={save} loading={busy}>{t('savePrefs')}</Button>
        </div>
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
