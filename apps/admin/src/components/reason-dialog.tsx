'use client';
import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { REJECT_REASON_TEMPLATES_KA } from '@lokacia/contracts';
import { Button, Dialog, Field, Select, Textarea } from '@lokacia/ui';
import { fetcher } from '@/lib/api-client';

/** Reject dialog with reason templates + free text. */
export function ReasonDialog({ open, onOpenChange, title, description, confirmLabel, busy, onConfirm, templates = true }: { open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: string; confirmLabel: string; busy?: boolean; onConfirm: (reason: string) => void; templates?: boolean }) {
  const t = useTranslations('moderation');
  const { data } = useSWR<string[]>(templates && open ? '/admin/moderation/reject-reasons' : null, fetcher);
  const reasons = data ?? [...REJECT_REASON_TEMPLATES_KA];
  const [template, setTemplate] = React.useState('');
  const [text, setText] = React.useState('');
  React.useEffect(() => {
    if (!open) {
      setTemplate('');
      setText('');
    }
  }, [open]);
  const reason = [template, text.trim()].filter(Boolean).join('. ');
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button variant="danger" loading={busy} disabled={reason.length < 3} onClick={() => onConfirm(reason)}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {templates && (
          <Field label={t('reasonTemplate')}>
            <Select value={template} onChange={(e) => setTemplate(e.target.value)} placeholder={t('reasonTemplatePlaceholder')} options={reasons.map((r) => ({ value: r, label: r }))} />
          </Field>
        )}
        <Field label={templates ? t('reasonExtra') : t('reason')} hint={t('reasonHint')}>
          <Textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={400} />
        </Field>
      </div>
    </Dialog>
  );
}
