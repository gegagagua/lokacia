'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { formatMoney, type ListingCard, type PresentationRow } from '@lokacia/contracts';
import { Button, Dialog, Field, Input, Textarea } from '@lokacia/ui';
import { ContactPicker, ListingPicker } from '@/components/common/pickers';
import { errorMessage } from '@/lib/api-client';
import { useApiMutation } from '@/lib/swr';

type Picked = Pick<ListingCard, 'id' | 'title' | 'address' | 'priceMinor' | 'currency'>;

/** C10: create a presentation — pick spaces (chips), optional client, message. */
export function PresentationDialog({ onClose, onCreated, initialContact }: { onClose: () => void; onCreated: (p: PresentationRow) => void; initialContact?: { id: string; name: string } }) {
  const t = useTranslations('marketing.presentations.form');
  const mutate = useApiMutation();
  const [title, setTitle] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [contactId, setContactId] = React.useState<string | null>(initialContact?.id ?? null);
  const [picked, setPicked] = React.useState<Picked[]>([]);
  const [pickerKey, setPickerKey] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!picked.length) return setError(t('noListings'));
    setBusy(true);
    setError(null);
    try {
      const p = await mutate<PresentationRow>('/crm/presentations', { body: { title, message: message || null, contactId, listingIds: picked.map((l) => l.id) } });
      onCreated(p);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(o) => !o && onClose()}
      title={t('submit')}
      footer={
        <Button onClick={() => submit()} loading={busy} disabled={title.trim().length < 2 || !picked.length}>
          {t('submit')}
        </Button>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Field label={t('title')} required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('titlePlaceholder')} autoFocus />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-small font-medium">{t('contact')}</span>
          <ContactPicker value={contactId} onChange={(id) => setContactId(id)} initialLabel={initialContact?.name} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-small font-medium">
            {t('listings')} <span className="tabular text-muted">({picked.length}/20)</span>
          </span>
          <ListingPicker
            key={pickerKey}
            value={null}
            placeholder={t('addListing')}
            onChange={(id, l) => {
              if (id && l && !picked.some((p) => p.id === id) && picked.length < 20) setPicked((s) => [...s, l]);
              setPickerKey((k) => k + 1);
            }}
          />
          {picked.length > 0 && (
            <ol className="mt-1 flex flex-col divide-y divide-border rounded-card border border-border">
              {picked.map((l, i) => (
                <li key={l.id} className="flex items-center gap-2 px-3 py-2">
                  <span className="w-5 text-small text-muted tabular">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-[14px] font-medium">{l.title}</span>
                    <span className="line-clamp-1 text-small text-muted">{l.address}</span>
                  </span>
                  <span className="whitespace-nowrap text-small tabular">{formatMoney(l.priceMinor, l.currency)}</span>
                  <button type="button" onClick={() => setPicked((s) => s.filter((x) => x.id !== l.id))} className="grid size-7 place-items-center rounded-button text-muted hover:bg-surface-2" aria-label={t('remove')}>
                    <X className="size-3.5" strokeWidth={1.5} />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
        <Field label={t('message')} error={error}>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t('messagePlaceholder')} />
        </Field>
      </form>
    </Dialog>
  );
}
