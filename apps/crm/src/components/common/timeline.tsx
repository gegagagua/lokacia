'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, FileText, GitMerge, History, Mail, MessageSquare, NotebookPen, Phone, Presentation, Repeat, Building2, CalendarDays, SquareCheckBig, Upload, type LucideIcon } from 'lucide-react';
import { CALL_OUTCOME_LABELS_KA, formatDateTimeKa, relativeDaysKa, type CrmActivity } from '@lokacia/contracts';
import { Button, cn, Skeleton, Textarea, useToast } from '@lokacia/ui';
import { errorMessage } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { useApi, useApiMutation } from '@/lib/swr';
import { EmptyHint, PersonAvatar, toneClass, type Tone } from './ui';

const KINDS: Record<string, { icon: LucideIcon; tone: Tone }> = {
  note: { icon: NotebookPen, tone: 3 },
  call: { icon: Phone, tone: 1 },
  stage_change: { icon: ArrowRight, tone: 4 },
  email: { icon: Mail, tone: 2 },
  sms: { icon: MessageSquare, tone: 6 },
  message: { icon: MessageSquare, tone: 6 },
  viewing: { icon: CalendarDays, tone: 7 },
  merge: { icon: GitMerge, tone: 8 },
  import: { icon: Upload, tone: 8 },
  task: { icon: SquareCheckBig, tone: 5 },
  match: { icon: Building2, tone: 2 },
  document: { icon: FileText, tone: 8 },
  presentation: { icon: Presentation, tone: 4 },
  sequence: { icon: Repeat, tone: 6 },
};

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

/** Activity timeline with an inline "add note" composer. Used on contact, deal and listing pages. */
export function ActivityTimeline({ entity, entityId, stageName = (k) => k, canAdd = true }: { entity: 'contact' | 'deal' | 'listing'; entityId: string; stageName?: (key: string) => string; canAdd?: boolean }) {
  const t = useTranslations('shell.timeline');
  const toast = useToast();
  const mutateApi = useApiMutation();
  const { user } = useCrm();
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
    <section aria-label={t('title')} className="flex flex-col gap-5">
      {canAdd && entity !== 'listing' && (
        <div className="card flex gap-3 p-3 transition-shadow focus-within:shadow-md md:p-4">
          <PersonAvatar name={user.name ?? user.phone} src={user.avatarUrl} size={36} className="hidden sm:inline-grid" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void add();
              }}
              placeholder={t('notePlaceholder')}
              aria-label={t('addNote')}
              className="min-h-20 resize-y border-transparent bg-surface-2 focus:bg-surface"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="hidden items-center gap-1 text-[12px] text-muted sm:flex" aria-hidden>
                <kbd>Ctrl</kbd>
                <kbd>↵</kbd>
              </span>
              <Button size="sm" onClick={add} loading={busy} disabled={!note.trim()} className="ml-auto" icon={<NotebookPen className="size-4" strokeWidth={2} aria-hidden />}>
                {t('addNote')}
              </Button>
            </div>
          </div>
        </div>
      )}
      {isLoading && (
        <div className="flex flex-col gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="size-9 rounded-full" />
              <Skeleton className="h-16 flex-1 rounded-2xl" />
            </div>
          ))}
        </div>
      )}
      {data && data.length === 0 && <EmptyHint icon={History} title={t('empty')} className="card" />}
      {!!data?.length && (
        <ol className="relative flex flex-col">
          {data.map((a, i) => {
            const kind = KINDS[a.type] ?? { icon: NotebookPen, tone: 8 as Tone };
            const Icon = kind.icon;
            const text = describe(a, stageName);
            const last = i === data.length - 1;
            return (
              <li key={a.id} className="relative flex gap-3 pb-5 last:pb-0 md:gap-4">
                {!last && <span aria-hidden className="absolute bottom-0 left-[17px] top-10 w-px bg-border" />}
                <span className={cn('relative z-[1] grid size-9 shrink-0 place-items-center rounded-full bg-tone-soft text-tone-ink ring-4 ring-bg', toneClass(kind.tone))} aria-hidden>
                  <Icon className="size-4" strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px]">
                    <span className="font-semibold text-text">{t.has(`types.${a.type}`) ? t(`types.${a.type}`) : a.type}</span>
                    {a.createdByName && (
                      <span className="inline-flex items-center gap-1.5 text-muted">
                        <PersonAvatar name={a.createdByName} size={18} />
                        {a.createdByName}
                      </span>
                    )}
                    <time dateTime={a.createdAt} title={formatDateTimeKa(a.createdAt)} className="ml-auto text-[12.5px] text-muted tabular">
                      {relativeDaysKa(a.createdAt)} · {formatDateTimeKa(a.createdAt).split(', ').pop()}
                    </time>
                  </div>
                  {text && (
                    <p className={cn('mt-1.5 whitespace-pre-wrap break-words text-[14px] leading-6', a.type === 'note' ? 'rounded-2xl rounded-tl-md border border-border bg-surface px-3.5 py-2.5 shadow-xs' : 'text-muted')}>{text}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
