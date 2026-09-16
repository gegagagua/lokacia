'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Archive, RotateCcw, Send } from 'lucide-react';
import { PASSPORT_FIELDS, type ListingStatus } from '@lokacia/contracts';
import { Button, useToast } from '@lokacia/ui';
import { ClientApiError, errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApiMutation } from '@/lib/swr';

const LABEL = Object.fromEntries(PASSPORT_FIELDS.map((f) => [f.key, f.labelKa]));

/** C9 one-click publish (draft → moderation), archive and restore through the listings lifecycle API. */
export function ListingActions({ id, status, onChanged, size = 'sm', compact }: { id: string; status: ListingStatus; onChanged: () => void; size?: 'sm' | 'md'; compact?: boolean }) {
  const t = useTranslations('listings');
  const toast = useToast();
  const { can } = useCrm();
  const mutate = useApiMutation();
  const [busy, setBusy] = React.useState<string | null>(null);
  if (!can('listings.publish')) return null;

  const change = async (to: ListingStatus, ok: string) => {
    setBusy(to);
    try {
      await mutate(`/listings/${id}/status`, { body: { status: to } });
      toast({ title: ok, description: to === 'pending_review' ? t('publishHint') : undefined, tone: 'success' });
      onChanged();
    } catch (e) {
      if (e instanceof ClientApiError && e.problem?.type.endsWith('passport-incomplete')) {
        const fields = (e.problem.errors ?? []).map((er) => LABEL[er.path.replace(/^passport\./, '')] ?? er.path).join(', ');
        toast({ title: t('incomplete', { fields }), tone: 'danger' });
      } else toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      {(status === 'draft' || status === 'rejected') && (
        <Button size={size} loading={busy === 'pending_review'} icon={<Send className="size-4" strokeWidth={2} aria-hidden />} onClick={() => change('pending_review', t('published'))}>
          {t('publish')}
        </Button>
      )}
      {['draft', 'active', 'stale', 'rented', 'sold'].includes(status) && (
        <Button
          size={size}
          variant="ghost"
          loading={busy === 'archived'}
          aria-label={t('archive')}
          title={t('archive')}
          icon={<Archive className="size-4" strokeWidth={2} aria-hidden />}
          onClick={() => {
            if (window.confirm(t('archiveConfirm'))) void change('archived', t('archived'));
          }}
        >
          {!compact && t('archive')}
        </Button>
      )}
      {status === 'archived' && (
        <Button size={size} variant="secondary" loading={busy === 'draft'} icon={<RotateCcw className="size-4" strokeWidth={2} aria-hidden />} onClick={() => change('draft', t('restore'))}>
          {t('restore')}
        </Button>
      )}
    </div>
  );
}
