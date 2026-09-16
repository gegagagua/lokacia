'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { BellRing, CheckCircle2 } from 'lucide-react';
import { Button, useToast } from '@lokacia/ui';
import { SectionCard } from '@/components/common/ui';
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
    <SectionCard title={t('title')} description={t('body')} icon={BellRing} tone={3} className="overflow-hidden">
      {state === 'granted' ? (
        <div className="flex flex-col gap-3">
          <p className="flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-[13.5px] font-medium text-success">
            <CheckCircle2 className="size-4 shrink-0" strokeWidth={2} aria-hidden />
            {t('pushEnabled')}
          </p>
          <Button size="sm" variant="secondary" onClick={test} className="self-start">
            {t('test')}
          </Button>
        </div>
      ) : state === 'denied' ? (
        <p className="rounded-xl bg-danger/10 px-3 py-2 text-[13.5px] text-danger">{t('pushDenied')}</p>
      ) : state === 'unsupported' ? (
        <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13.5px] text-muted">{t('pushUnsupported')}</p>
      ) : (
        <Button size="sm" onClick={enable} className="w-full" icon={<BellRing className="size-4" strokeWidth={2} aria-hidden />}>
          {t('enablePush')}
        </Button>
      )}
    </SectionCard>
  );
}
