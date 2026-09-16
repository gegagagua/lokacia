'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, FileText, GitMerge, Mail, MessageSquare, NotebookPen, Phone, Repeat, Building2, CalendarDays, SquareCheckBig, type LucideIcon } from 'lucide-react';
import { CALL_OUTCOME_LABELS_KA, formatDateTimeKa, type CrmActivity } from '@lokacia/contracts';
import { Button, Skeleton, Textarea, useToast } from '@lokacia/ui';
import { errorMessage } from '@/lib/api-client';
import { useApi, useApiMutation } from '@/lib/swr';

const ICONS: Record<string, LucideIcon> = { note: NotebookPen, call: Phone, stage_change: ArrowRight, email: Mail, sms: MessageSquare, message: MessageSquare, viewing: CalendarDays, merge: GitMerge, import: FileText, task: SquareCheckBig, match: Building2, document: FileText, presentation: FileText, sequence: Repeat };

function describe(a: CrmActivity, stageName: (k: string) => string): string {
  const p = a.payload as Record<string, string | number | undefined>;
  switch (a.type) {
    case 'note':
      return String(p.body ?? '');
    case 'call': {
      const outcome = CALL_OUTCOME_LABELS_KA[p.outcome as keyof typeof CALL_OUTCOME_LABELS_KA] ?? '';
      const min = p.durationSec ? ` · ${Math.round(Number(p.durationSec) / 60)} წთ` : '';
      return `${outcome}${min}${p.note ? ` — ${p.note}` : ''}`;
    }
    case 'stage_change':
      return `${stageName(String(p.from ?? ''))} → ${stageName(String(p.to ?? ''))}${p.lostReason ? ` (${p.lostReason})` : ''}`;
    default:
      return String(p.body ?? p.title ?? p.text ?? p.summary ?? '');
  }
}

/** Activity timeline with an inline "add note" box. Used on contact and deal pages. */
export function ActivityTimeline({ entity, entityId, stageName = (k) => k, canAdd = true }: { entity: 'contact' | 'deal' | 'listing'; entityId: string; stageName?: (key: string) => string; canAdd?: boolean }) {
  const t = useTranslations('shell.timeline');
  const toast = useToast();
  const mutateApi = useApiMutation();
  const { data, mutate, isLoading } = useApi<CrmActivity[]>(`/crm/activities?entity=${entity}&entityId=${entityId}`);
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const add = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await mutateApi('/crm/activities', { body: { entity, entityId, type: 'note', payload: { body: note.trim() } } });
      setNote('');
      await mutate();
    } catch (e) {
      toast({ title: errorMessage(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-label={t('title')} className="flex flex-col gap-3">
      {canAdd && entity !== 'listing' && (
        <div className="flex flex-col gap-2 rounded-card border border-border bg-surface p-3">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('notePlaceholder')} aria-label={t('addNote')} className="min-h-16" />
          <div className="flex justify-end">
            <Button size="sm" onClick={add} loading={busy} disabled={!note.trim()}>
              {t('addNote')}
            </Button>
          </div>
        </div>
      )}
      {isLoading && <Skeleton className="h-24" />}
      {data && data.length === 0 && <p className="py-6 text-center text-small text-muted">{t('empty')}</p>}
      <ol className="relative flex flex-col">
        {data?.map((a) => {
          const Icon = ICONS[a.type] ?? NotebookPen;
          return (
            <li key={a.id} className="relative flex gap-3 border-l border-border pb-4 pl-5 last:pb-0">
              <span className="absolute -left-3 top-0 grid size-6 place-items-center rounded-full border border-border-strong bg-surface text-muted">
                <Icon className="size-3.5" strokeWidth={1.5} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 text-small">
                  <span className="font-medium text-text">{t.has(`types.${a.type}`) ? t(`types.${a.type}`) : a.type}</span>
                  <span className="text-muted tabular">{formatDateTimeKa(a.createdAt)}</span>
                  {a.createdByName && <span className="text-muted">· {a.createdByName}</span>}
                </div>
                <p className="mt-0.5 whitespace-pre-wrap break-words text-[14px]">{describe(a, stageName)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
