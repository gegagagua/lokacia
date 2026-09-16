'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ShieldCheck } from 'lucide-react';
import type { EscrowDto } from '@lokacia/contracts';
import { Button, useToast } from '@lokacia/ui';
import { apiFetch, ClientApiError } from '@/lib/api-client';
import { useLocalizedPath } from '@/i18n/link';

/** V3: creates a deposit escrow + digital contract for an accepted offer. For the offers page (stream B). */
export function EscrowStartButton({ offerId, onCreated }: { offerId: string; onCreated?: (e: EscrowDto) => void }) {
  const t = useTranslations('v2.escrow');
  const toast = useToast();
  const lp = useLocalizedPath();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={busy}
      icon={<ShieldCheck className="size-4" strokeWidth={1.5} aria-hidden />}
      onClick={async () => {
        setBusy(true);
        try {
          const e = await apiFetch<EscrowDto>('/escrow', { method: 'POST', body: { offerId } });
          toast({ title: t('created'), tone: 'success' });
          if (onCreated) onCreated(e);
          else window.location.href = lp('/account/billing#escrow');
        } catch (err) {
          toast({ title: t('error'), description: err instanceof ClientApiError ? err.message : undefined, tone: 'danger' });
        } finally {
          setBusy(false);
        }
      }}
    >
      {t('start')}
    </Button>
  );
}
