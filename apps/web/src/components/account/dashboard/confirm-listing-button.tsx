'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Check } from 'lucide-react';
import { Button, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';

export function ConfirmListingButton({ listingId, label, doneLabel }: { listingId: string; label: string; doneLabel: string }) {
  const t = useTranslations('account.dashboard');
  const [state, setState] = React.useState<'idle' | 'busy' | 'done'>('idle');
  const toast = useToast();
  const router = useRouter();
  if (state === 'done')
    return (
      <span className="inline-flex items-center gap-1 text-small text-success" role="status">
        <Check className="size-4" strokeWidth={1.5} aria-hidden /> {doneLabel}
      </span>
    );
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={state === 'busy'}
      onClick={async () => {
        setState('busy');
        try {
          await apiFetch(`/listings/${listingId}/confirm-owner`, { method: 'POST' });
          setState('done');
          router.refresh();
        } catch (e) {
          setState('idle');
          toast({ title: e instanceof ClientApiError ? e.message : t('error'), tone: 'danger' });
        }
      }}
    >
      {label}
    </Button>
  );
}
