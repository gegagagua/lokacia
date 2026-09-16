'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Copy, ExternalLink, Globe, Link2, RotateCcw } from 'lucide-react';
import { Button, useToast } from '@lokacia/ui';
import { errorMessage } from '@/lib/api-client';
import { useApiMutation } from '@/lib/swr';
import { SectionCard } from '@/components/common/ui';

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
    <SectionCard title={t('title')} description={t('hint')} icon={Globe} tone={6}>
      {token ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-surface-2/70 py-1 pl-3 pr-1">
            <Link2 className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden />
            <input readOnly value={url} aria-label={t('title')} onFocus={(e) => e.currentTarget.select()} className="h-8 min-w-0 flex-1 bg-transparent text-[13px] text-muted outline-none" />
            <Button
              size="sm"
              variant="secondary"
              className="h-8 shrink-0 px-2.5"
              aria-label={t('copy')}
              title={t('copy')}
              onClick={async () => {
                await navigator.clipboard?.writeText(url).catch(() => undefined);
                toast({ title: t('copied'), tone: 'success' });
              }}
            >
              <Copy className="size-3.5" strokeWidth={2} aria-hidden />
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button asChild size="sm" variant="secondary">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" strokeWidth={2} aria-hidden />
                <span className="truncate">{t('open')}</span>
              </a>
            </Button>
            <Button size="sm" variant="ghost" loading={busy} icon={<RotateCcw className="size-4" strokeWidth={2} aria-hidden />} onClick={() => call(`/crm/contacts/${contactId}/portal/rotate`, t('rotated'))}>
              <span className="truncate">{t('rotate')}</span>
            </Button>
          </div>
        </div>
      ) : (
        <Button size="sm" loading={busy} onClick={() => call(`/crm/contacts/${contactId}/portal/token`)} icon={<Link2 className="size-4" strokeWidth={2} aria-hidden />} className="w-full">
          {t('create')}
        </Button>
      )}
    </SectionCard>
  );
}
