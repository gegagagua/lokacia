'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Phone } from 'lucide-react';
import { CALL_OUTCOME_LABELS_KA, CALL_OUTCOMES } from '@lokacia/contracts';
import { Button, cn, Dialog, Field, Input, Select, Textarea, useToast } from '@lokacia/ui';
import { errorMessage } from '@/lib/api-client';
import { useApiMutation } from '@/lib/swr';

/**
 * C7 click-to-call: a real `tel:` link. After the click, the post-call dialog asks for outcome, duration and a note,
 * which becomes a `call` activity on the contact (or deal) timeline.
 */
export function CallButton({ phone, entity = 'contact', entityId, onLogged, variant = 'secondary', compact, className }: { phone: string; entity?: 'contact' | 'deal'; entityId: string; onLogged?: () => void; variant?: 'secondary' | 'ghost' | 'primary'; compact?: boolean; className?: string }) {
  const t = useTranslations('shell.call');
  const [open, setOpen] = React.useState(false);
  const startedAt = React.useRef<number>(0);
  return (
    <>
      <Button
        asChild
        variant={variant}
        size="sm"
        className={cn(compact && 'size-8 px-0', className)}
      >
        <a
          href={`tel:${phone.replace(/[^\d+]/g, '')}`}
          aria-label={`${t('call')} ${phone}`}
          onClick={() => {
            startedAt.current = Date.now();
            // give the dialer a moment, then prompt for the call result
            setTimeout(() => setOpen(true), 400);
          }}
        >
          <Phone className="size-3.5" strokeWidth={1.5} aria-hidden />
          {!compact && <span className="tabular">{phone}</span>}
        </a>
      </Button>
      {open && <CallLogDialog open={open} onOpenChange={setOpen} phone={phone} entity={entity} entityId={entityId} startedAt={startedAt.current} onLogged={onLogged} />}
    </>
  );
}

export function CallLogDialog({ open, onOpenChange, phone, entity, entityId, startedAt, onLogged }: { open: boolean; onOpenChange: (o: boolean) => void; phone: string; entity: 'contact' | 'deal'; entityId: string; startedAt?: number; onLogged?: () => void }) {
  const t = useTranslations('shell.call');
  const toast = useToast();
  const mutate = useApiMutation();
  const [outcome, setOutcome] = React.useState<(typeof CALL_OUTCOMES)[number]>('answered');
  const [minutes, setMinutes] = React.useState(() => String(Math.max(1, Math.round((Date.now() - (startedAt ?? Date.now())) / 60000))));
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await mutate('/crm/calls', { body: { entity, entityId, phone, outcome, durationSec: Math.round(Number(minutes || 0) * 60), note: note || null } });
      toast({ title: t('saved'), tone: 'success' });
      onOpenChange(false);
      onLogged?.();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('logTitle')}
      description={t('logDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('skip')}
          </Button>
          <Button onClick={save} loading={busy}>
            {t('save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-small text-muted tabular">{phone}</p>
        <Field label={t('outcome')}>
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value as typeof outcome)} options={CALL_OUTCOMES.map((o) => ({ value: o, label: CALL_OUTCOME_LABELS_KA[o] }))} />
        </Field>
        <Field label={t('duration')}>
          <Input type="number" min={0} step={1} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} className="tabular" />
        </Field>
        <Field label={t('note')}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
        </Field>
      </div>
    </Dialog>
  );
}
