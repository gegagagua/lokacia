'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import { useTranslations } from 'next-intl';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';

export function UnsubscribeButton({ token }: { token: string }) {
  const t = useTranslations('alerts.unsubscribe');
  const [state, setState] = React.useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      {state === 'done' ? (
        <>
          <p className="flex items-center gap-2 rounded-xl bg-success/12 px-3 py-2 font-semibold text-success">
            <CheckCircle2 className="size-5" strokeWidth={2} aria-hidden />
            {t('done')}
          </p>
          <p className="text-small text-muted">{t('doneText')}</p>
          <Button asChild variant="secondary" className="self-start">
            <Link href="/account/saved-searches">{t('manage')}</Link>
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="danger"
            size="lg"
            className="self-start"
            loading={state === 'busy'}
            onClick={async () => {
              setState('busy');
              try {
                await apiFetch('/saved-searches/unsubscribe', { method: 'POST', body: { token } });
                setState('done');
              } catch {
                setState('error');
              }
            }}
          >
            {t('button')}
          </Button>
          {state === 'error' && (
            <p role="alert" className="text-small text-danger">
              {t('failed')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
