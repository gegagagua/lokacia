'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import type { CheckoutRequest } from '@lokacia/contracts';
import { Button, useToast, type ButtonProps } from '@lokacia/ui';
import { ClientApiError } from '@/lib/api-client';
import { startCheckout } from './checkout';

type Props = Omit<ButtonProps, 'onClick'> & {
  planKey: string;
  body?: Omit<Partial<CheckoutRequest>, 'planKey'>;
  loginNext?: string;
  disabledReason?: string;
};

/** Generic "buy" button: POST /v1/billing/checkout → provider page / result page. */
export function CheckoutButton({ planKey, body, loginNext, children, disabledReason, disabled, ...props }: Props) {
  const t = useTranslations('billing.checkout');
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      {...props}
      disabled={disabled || !!disabledReason}
      title={disabledReason}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await startCheckout({ planKey, ...body }, { loginNext });
          if (!r) return;
        } catch (e) {
          toast({ title: t('error'), description: e instanceof ClientApiError ? e.message : undefined, tone: 'danger' });
          setBusy(false);
        }
      }}
    >
      {children ?? t('buy')}
    </Button>
  );
}
