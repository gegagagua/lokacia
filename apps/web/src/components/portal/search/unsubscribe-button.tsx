'use client';
import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';

export function UnsubscribeButton({ token }: { token: string }) {
  const t = useTranslations('alerts.unsubscribe');
  const [state, setState] = React.useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      {state === 'done' ? (
        <>
          <p className="font-medium text-success">{t('done')}</p>
          <p className="text-small text-muted">{t('doneText')}</p>
          <Button asChild variant="secondary" className="self-start">
            <Link href="/account/saved-searches">{t('manage')}</Link>
          </Button>
        </>
      ) : (
        <>
          <Button
            variant="danger"
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
