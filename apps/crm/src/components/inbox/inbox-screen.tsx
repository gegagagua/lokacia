'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Globe, MessageCircle, MessagesSquare, Send, Smartphone, Zap, type LucideIcon } from 'lucide-react';
import { INBOX_CHANNEL_LABELS, relativeDaysKa, type InboxChannel, type InboxConversation, type InboxMessage } from '@lokacia/contracts';
import { Badge, Button, ChatThread, cn, Dialog, EmptyState, Field, Input, Select, Skeleton, Textarea, useToast } from '@lokacia/ui';
import { CallButton } from '@/components/common/call-button';
import { PageHeader } from '@/components/common/page-header';
import { ContactPicker } from '@/components/common/pickers';
import { errorMessage } from '@/lib/api-client';
import { useApi, useApiMutation } from '@/lib/swr';

export const CHANNEL_ICON: Record<InboxChannel, LucideIcon> = { portal: Globe, whatsapp: MessageCircle, viber: Smartphone, telegram: Send };

function SimulateDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: (conversationId: string) => void }) {
  const t = useTranslations('inbox.simulate');
  const toast = useToast();
  const mutate = useApiMutation();
  const [channel, setChannel] = React.useState<'whatsapp' | 'viber' | 'telegram'>('whatsapp');
  const [from, setFrom] = React.useState('+995599123456');
  const [name, setName] = React.useState('ნინო კაპანაძე');
  const [text, setText] = React.useState('გამარჯობა! ვაკეში 60 მ² ფართს ეძებ კაფესთვის. ისევ ხელმისაწვდომია?');
  const [busy, setBusy] = React.useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('title')}
      description={t('description')}
      footer={
        <Button
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await mutate<{ conversationId: string }>('/crm/inbox/simulate', { body: { channel, from, name: name || undefined, text } });
              toast({ title: t('done'), tone: 'success' });
              onOpenChange(false);
              onDone(r.conversationId);
            } catch (e) {
              toast({ title: errorMessage(e), tone: 'danger' });
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('submit')}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label={t('channel')}>
          <Select value={channel} onChange={(e) => setChannel(e.target.value as typeof channel)} options={(['whatsapp', 'viber', 'telegram'] as const).map((c) => ({ value: c, label: INBOX_CHANNEL_LABELS[c] }))} />
        </Field>
        <Field label={t('from')}>
          <Input value={from} onChange={(e) => setFrom(e.target.value)} className="tabular" />
        </Field>
        <Field label={t('name')}>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t('text')}>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}

function ConversationList({ items, activeId, onSelect }: { items: InboxConversation[]; activeId: string | null; onSelect: (id: string) => void }) {
  const t = useTranslations('inbox');
  return (
    <ul className="flex flex-col divide-y divide-border">
      {items.map((c) => {
        const Icon = CHANNEL_ICON[c.channel];
        return (
          <li key={c.id}>
            <button type="button" onClick={() => onSelect(c.id)} aria-current={c.id === activeId ? 'true' : undefined} className={cn('flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-surface-2', c.id === activeId && 'bg-surface-2')}>
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-border-strong bg-surface text-muted" title={INBOX_CHANNEL_LABELS[c.channel]}>
                <Icon className="size-4" strokeWidth={1.5} aria-label={INBOX_CHANNEL_LABELS[c.channel]} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cn('truncate text-[14px]', c.unread ? 'font-semibold' : 'font-medium')}>{c.counterpart ?? '—'}</span>
                  {c.lastMessageAt && <span className="shrink-0 text-[11px] text-muted">{relativeDaysKa(c.lastMessageAt)}</span>}
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-small text-muted">{c.lastMessage ?? c.listingTitle ?? ''}</span>
                  {c.unread > 0 && (
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1 text-[11px] font-semibold text-accent-contrast tabular" aria-label={t('unread', { count: c.unread })}>
                      {c.unread}
                    </span>
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Thread({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const t = useTranslations('inbox');
  const toast = useToast();
  const mutateApi = useApiMutation();
  const { data: conv, mutate: reloadConv } = useApi<InboxConversation>(`/crm/inbox/${id}`);
  const { data: msgs, mutate } = useApi<InboxMessage[]>(`/crm/inbox/${id}/messages`, { refreshInterval: 15_000 });
  const [sending, setSending] = React.useState(false);
  const [linking, setLinking] = React.useState(false);
  React.useEffect(() => {
    if (msgs) onChanged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msgs?.length]);
  if (!conv) return <Skeleton className="h-full min-h-96" />;
  const Icon = CHANNEL_ICON[conv.channel];
  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
      <ChatThread
        className="h-[calc(100dvh-220px)] min-h-96"
        sending={sending}
        placeholder={t('reply')}
        header={
          <div className="flex items-center gap-2">
            <button type="button" onClick={onBack} className="grid size-8 place-items-center rounded-button hover:bg-surface-2 md:hidden" aria-label={t('back')}>
              <ArrowLeft className="size-4" strokeWidth={1.5} />
            </button>
            <Icon className="size-4 text-muted" strokeWidth={1.5} aria-hidden />
            <div className="min-w-0">
              <div className="truncate font-medium">{conv.counterpart}</div>
              <div className="truncate text-small text-muted">
                {INBOX_CHANNEL_LABELS[conv.channel]}
                {conv.listingTitle ? ` · ${t('about')}: ${conv.listingTitle}` : ''}
              </div>
            </div>
          </div>
        }
        messages={(msgs ?? []).map((m) => ({ id: m.id, body: m.body, mine: m.direction === 'out', at: m.createdAt, readAt: m.readAt, author: m.direction === 'in' ? (conv.counterpart ?? m.externalSender ?? undefined) : (m.senderName ?? undefined), channel: conv.channel }))}
        onSend={async (body) => {
          setSending(true);
          try {
            await mutateApi(`/crm/inbox/${id}/messages`, { body: { body } });
            await mutate();
            onChanged();
          } catch (e) {
            toast({ title: errorMessage(e), tone: 'danger' });
          } finally {
            setSending(false);
          }
        }}
      />
      <aside className="flex flex-col gap-3 rounded-card border border-border bg-surface p-3">
        <h3 className="text-small font-medium text-muted">{t('contact.title')}</h3>
        {conv.contactId ? (
          <>
            <Link href={`/contacts/${conv.contactId}`} className="font-medium text-link hover:underline">
              {conv.contactName}
            </Link>
            {conv.contactPhone && <CallButton phone={conv.contactPhone} entityId={conv.contactId} className="self-start" />}
          </>
        ) : (
          <p className="text-small text-muted">{t('contact.none')}</p>
        )}
        {linking ? (
          <ContactPicker
            value={conv.contactId}
            initialLabel={conv.contactName ?? undefined}
            onChange={async (contactId) => {
              try {
                await mutateApi(`/crm/inbox/${id}/link`, { body: { contactId } });
                toast({ title: t('contact.linked'), tone: 'success' });
                setLinking(false);
                await reloadConv();
                onChanged();
              } catch (e) {
                toast({ title: errorMessage(e), tone: 'danger' });
              }
            }}
          />
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setLinking(true)} className="self-start">
            {t('contact.link')}
          </Button>
        )}
        {conv.externalId && conv.externalId !== conv.contactPhone && <Badge tone="outline" className="self-start tabular">{conv.externalId}</Badge>}
      </aside>
    </div>
  );
}

export function InboxScreen() {
  const t = useTranslations('inbox');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = React.useState('');
  const [channel, setChannel] = React.useState('');
  const [simulating, setSimulating] = React.useState(false);
  const activeId = params.get('c');
  const qs = new URLSearchParams();
  if (q.trim()) qs.set('q', q.trim());
  if (channel) qs.set('channel', channel);
  const { data, isLoading, mutate } = useApi<InboxConversation[]>(`/crm/inbox?${qs}`, { refreshInterval: 20_000 });
  const select = (id: string | null) => router.replace(id ? `${pathname}?c=${id}` : pathname);

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <Button variant="secondary" icon={<Zap className="size-4" strokeWidth={1.5} aria-hidden />} onClick={() => setSimulating(true)}>
            {t('simulate.button')}
          </Button>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[320px_minmax(0,1fr)]">
        <section className={cn('flex min-h-0 flex-col rounded-card border border-border bg-surface', activeId && 'hidden md:flex')}>
          <div className="flex flex-col gap-2 border-b border-border p-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')} />
            <Select value={channel} onChange={(e) => setChannel(e.target.value)} aria-label={t('channels.all')} placeholder={t('channels.all')} options={(['portal', 'whatsapp', 'viber', 'telegram'] as const).map((c) => ({ value: c, label: INBOX_CHANNEL_LABELS[c] }))} />
          </div>
          <div className="max-h-[calc(100dvh-280px)] overflow-y-auto">
            {isLoading && !data && <Skeleton className="m-2 h-40" />}
            {data && data.length === 0 && <p className="p-6 text-center text-small text-muted">{t('empty')}</p>}
            {data && <ConversationList items={data} activeId={activeId} onSelect={select} />}
          </div>
        </section>
        <section className={cn('min-w-0', !activeId && 'hidden md:block')}>
          {activeId ? (
            <Thread key={activeId} id={activeId} onBack={() => select(null)} onChanged={() => void mutate()} />
          ) : (
            <EmptyState icon={<MessagesSquare className="size-5" strokeWidth={1.5} aria-hidden />} title={data?.length === 0 ? t('empty') : t('select')} description={data?.length === 0 ? t('emptyHint') : t('selectHint')} className="h-full" />
          )}
        </section>
      </div>
      <SimulateDialog
        open={simulating}
        onOpenChange={setSimulating}
        onDone={(id) => {
          void mutate();
          select(id);
        }}
      />
    </div>
  );
}
