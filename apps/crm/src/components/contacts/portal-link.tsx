'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Copy, ExternalLink, RotateCcw } from 'lucide-react';
import { Button, Input, useToast } from '@lokacia/ui';
import { errorMessage } from '@/lib/api-client';
import { useApiMutation } from '@/lib/swr';

/** C8: client portal link for this contact (copy / open / rotate). */
export function PortalLink({ contactId, token, onChanged }: { contactId: string; token: string | null; onChanged: () => void }) {
  const t = useTranslations('contacts.portal');
  const toast = useToast();
  const mutate = useApiMutation();
  const [origin, setOrigin] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => setOrigin(window.location.origin), []);
  const url = token ? `${origin}/portal/${token}` : '';
  const call = async (path: string, msg?: string) => {
    setBusy(true);
    try {
      await mutate(path);
      if (msg) toast({ title: msg });
      onChanged();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-card border border-border bg-surface p-4">
      <h2 className="font-semibold">{t('title')}</h2>
      <p className="mb-3 text-small text-muted">{t('hint')}</p>
      {token ? (
        <div className="flex flex-col gap-2">
          <Input readOnly value={url} aria-label={t('title')} onFocus={(e) => e.currentTarget.select()} className="text-small" />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              icon={<Copy className="size-3.5" strokeWidth={1.5} aria-hidden />}
              onClick={async () => {
                await navigator.clipboard?.writeText(url).catch(() => undefined);
                toast({ title: t('copied'), tone: 'success' });
              }}
            >
              {t('copy')}
            </Button>
            <Button asChild size="sm" variant="ghost">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-3.5" strokeWidth={1.5} aria-hidden />
                {t('open')}
              </a>
            </Button>
            <Button size="sm" variant="ghost" loading={busy} icon={<RotateCcw className="size-3.5" strokeWidth={1.5} aria-hidden />} onClick={() => call(`/crm/contacts/${contactId}/portal/rotate`, t('rotated'))}>
              {t('rotate')}
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" loading={busy} onClick={() => call(`/crm/contacts/${contactId}/portal/token`)}>
          {t('create')}
        </Button>
      )}
    </section>
  );
}
