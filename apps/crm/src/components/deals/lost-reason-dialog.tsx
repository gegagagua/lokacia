'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Button, Dialog, Field, Textarea } from '@lokacia/ui';

/** Asked when a deal is dropped on / marked as the lost stage (reason is required by the API). */
export function LostReasonDialog({ open, onCancel, onConfirm }: { open: boolean; onCancel: () => void; onConfirm: (reason: string) => Promise<void> | void }) {
  const t = useTranslations('deals.lost');
  const common = useTranslations('shell.common');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    if (open) setReason('');
  }, [open]);
  const presets = ['budget', 'other', 'postponed', 'noResponse'] as const;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onCancel()}
      title={t('title')}
      description={t('description')}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {common('cancel')}
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={!reason.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm(reason.trim());
              } finally {
                setBusy(false);
              }
            }}
          >
            {t('confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p} type="button" onClick={() => setReason(t(`presets.${p}`))} className="rounded-button border border-border-strong px-2.5 py-1 text-small hover:bg-surface-2">
              {t(`presets.${p}`)}
            </button>
          ))}
        </div>
        <Field label={t('reason')} required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
        </Field>
      </div>
    </Dialog>
  );
}
