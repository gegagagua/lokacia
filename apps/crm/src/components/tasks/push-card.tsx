'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { BellRing } from 'lucide-react';
import { Button, Card, useToast } from '@lokacia/ui';
import { useApiMutation } from '@/lib/swr';

/** Web push opt-in (C5). Real VAPID push is a HUMAN_TODO; the mock channel records pushes and the SW shows a local test notification. */
export function PushCard() {
  const t = useTranslations('tasks.reminders');
  const toast = useToast();
  const mutate = useApiMutation();
  const [state, setState] = React.useState<NotificationPermission | 'unsupported'>('default');
  React.useEffect(() => {
    setState(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  }, []);

  const enable = async () => {
    if (typeof Notification === 'undefined') return setState('unsupported');
    const p = await Notification.requestPermission();
    setState(p);
    if (p !== 'granted') return;
    let subscription: unknown = { endpoint: undefined };
    try {
      const reg = await navigator.serviceWorker?.ready;
      const sub = await reg?.pushManager?.subscribe({ userVisibleOnly: true }).catch(() => null);
      if (sub) subscription = sub.toJSON();
    } catch {
      /* no VAPID key in dev — mock provider */
    }
    await mutate('/crm/push/subscribe', { body: subscription }).catch(() => undefined);
  };

  const test = async () => {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(t('testTitle'), { body: t('testBody'), icon: '/icon-192.png', data: { link: '/tasks' } });
    else new Notification(t('testTitle'), { body: t('testBody') });
    toast({ title: t('testTitle'), description: t('testBody') });
  };

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        <BellRing className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
        {t('title')}
      </h2>
      <p className="text-small text-muted">{t('body')}</p>
      {state === 'granted' ? (
        <>
          <p className="text-small text-success">{t('pushEnabled')}</p>
          <Button size="sm" variant="secondary" onClick={test} className="self-start">
            {t('test')}
          </Button>
        </>
      ) : state === 'denied' ? (
        <p className="text-small text-danger">{t('pushDenied')}</p>
      ) : state === 'unsupported' ? (
        <p className="text-small text-muted">{t('pushUnsupported')}</p>
      ) : (
        <Button size="sm" variant="secondary" onClick={enable} className="self-start">
          {t('enablePush')}
        </Button>
      )}
    </Card>
  );
}
