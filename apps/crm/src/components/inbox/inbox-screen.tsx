'use client';
import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Globe, Link2, MessageCircle, MessagesSquare, Search, Send, Smartphone, UserPlus, UserRound, Zap, type LucideIcon } from 'lucide-react';
import { INBOX_CHANNEL_LABELS, relativeDaysKa, type InboxChannel, type InboxConversation, type InboxMessage } from '@lokacia/contracts';
import { Button, ChatThread, cn, Dialog, Field, Input, Popover, Select, Skeleton, Textarea, useToast } from '@lokacia/ui';
import { EmptyHint, PersonAvatar, Pill } from '@/components/common/ui';
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

/** Brand colours for messenger channels (badges on avatars, chips). */
export const CHANNEL_COLOR: Record<InboxChannel, string> = { portal: 'var(--primary-500)', whatsapp: '#25a55f', viber: '#7360f2', telegram: '#2a9fd8' };

function ChannelBadge({ channel, size = 18, className }: { channel: InboxChannel; size?: number; className?: string }) {
  const Icon = CHANNEL_ICON[channel];
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-full text-white ring-2 ring-surface', className)} style={{ width: size, height: size, background: CHANNEL_COLOR[channel] }} title={INBOX_CHANNEL_LABELS[channel]}>
      <Icon style={{ width: size * 0.58, height: size * 0.58 }} strokeWidth={2.4} aria-label={INBOX_CHANNEL_LABELS[channel]} />
    </span>
  );
}

function ConversationList({ items, activeId, onSelect }: { items: InboxConversation[]; activeId: string | null; onSelect: (id: string) => void }) {
  const t = useTranslations('inbox');
  return (
    <ul className="flex flex-col gap-0.5 p-2">
      {items.map((c) => {
        const active = c.id === activeId;
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={active ? 'true' : undefined}
              className={cn('flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors focus-visible:shadow-ring focus-visible:outline-none', active ? 'bg-primary-soft' : 'hover:bg-surface-2')}
            >
              <span className="relative shrink-0">
                <PersonAvatar name={c.counterpart ?? c.contactName ?? '?'} size={44} />
                <ChannelBadge channel={c.channel} className="absolute -bottom-0.5 -right-0.5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={cn('truncate text-[14.5px]', c.unread ? 'font-bold' : 'font-semibold', active && 'text-primary-soft-text')}>{c.counterpart ?? '—'}</span>
                  {c.lastMessageAt && <span className={cn('shrink-0 text-[11.5px]', c.unread ? 'font-semibold text-primary-soft-text' : 'text-muted')}>{relativeDaysKa(c.lastMessageAt)}</span>}
                </span>
                <span className="mt-0.5 flex items-center justify-between gap-2">
                  <span className={cn('truncate text-[13px]', c.unread ? 'text-text' : 'text-muted')}>{c.lastMessage ?? c.listingTitle ?? ''}</span>
                  {c.unread > 0 && (
                    <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-contrast tabular" aria-label={t('unread', { count: c.unread })}>
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
  if (!conv) return <Skeleton className="m-4 h-[calc(100%-32px)] min-h-96 rounded-card" />;
  const contactPanel = (
    <>
        <h3 className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">{t('contact.title')}</h3>
        {conv.contactId ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl bg-surface-2 p-4 text-center">
            <PersonAvatar name={conv.contactName} size={56} />
            <Link href={`/contacts/${conv.contactId}`} className="font-semibold hover:text-primary-soft-text">
              {conv.contactName}
            </Link>
            {conv.contactPhone && <div className="text-small text-muted tabular">{conv.contactPhone}</div>}
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {conv.contactPhone && <CallButton phone={conv.contactPhone} entityId={conv.contactId} compact />}
              <Button asChild size="sm" variant="secondary">
                <Link href={`/contacts/${conv.contactId}`}>
                  <UserRound className="size-4" strokeWidth={2} aria-hidden />
                  {t('contact.open')}
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border-strong p-4 text-center">
            <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft" aria-hidden>
              <UserPlus className="size-5" strokeWidth={2} />
            </span>
            <p className="text-small text-muted">{t('contact.none')}</p>
          </div>
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
          <Button size="sm" variant="secondary" onClick={() => setLinking(true)} icon={<Link2 className="size-4" strokeWidth={2} aria-hidden />}>
            {t('contact.link')}
          </Button>
        )}
        {conv.externalId && conv.externalId !== conv.contactPhone && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2 text-small">
            <span className="text-muted">ID</span>
            <span className="truncate font-medium tabular">{conv.externalId}</span>
          </div>
        )}
    </>
  );
  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_280px]">
      <ChatThread
        className="h-full min-h-0 rounded-none border-0 shadow-none"
        sending={sending}
        placeholder={t('reply')}
        header={
          <div className="flex items-center gap-3">
            <button type="button" onClick={onBack} className="-ml-1 grid size-9 place-items-center rounded-full hover:bg-surface-2 md:hidden" aria-label={t('back')}>
              <ArrowLeft className="size-[18px]" strokeWidth={2} />
            </button>
            <span className="relative shrink-0">
              <PersonAvatar name={conv.counterpart ?? '?'} size={40} />
              <ChannelBadge channel={conv.channel} size={16} className="absolute -bottom-0.5 -right-0.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{conv.counterpart}</div>
              <div className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-muted">
                <span className="shrink-0 font-semibold" style={{ color: `color-mix(in srgb, ${CHANNEL_COLOR[conv.channel]} 75%, var(--text))` }}>
                  {INBOX_CHANNEL_LABELS[conv.channel]}
                </span>
                {conv.listingTitle && <span className="truncate">· {t('about')}: {conv.listingTitle}</span>}
              </div>
            </div>
            {conv.contactPhone && conv.contactId && <CallButton phone={conv.contactPhone} entityId={conv.contactId} compact variant="ghost" className="xl:hidden" />}
            <div className="xl:hidden">
              <Popover
                align="end"
                className="flex w-[min(320px,calc(100vw-24px))] flex-col gap-4 p-4"
                trigger={
                  <button type="button" className="grid size-9 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label={t('contact.title')} title={t('contact.title')}>
                    <UserRound className="size-[18px]" strokeWidth={2} aria-hidden />
                  </button>
                }
              >
                {contactPanel}
              </Popover>
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
      <aside className="hidden flex-col gap-4 border-l border-border p-4 xl:flex">{contactPanel}</aside>
    </div>
  );
}

export function InboxScreen() {
  const t = useTranslations('inbox');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = React.useState('');
  const [channel, setChannel] = React.useState<'' | InboxChannel>('');
  const [simulating, setSimulating] = React.useState(false);
  const activeId = params.get('c');
  const qs = new URLSearchParams();
  if (q.trim()) qs.set('q', q.trim());
  if (channel) qs.set('channel', channel);
  const { data, isLoading, mutate } = useApi<InboxConversation[]>(`/crm/inbox?${qs}`, { refreshInterval: 20_000 });
  const select = (id: string | null) => router.replace(id ? `${pathname}?c=${id}` : pathname);
  const unreadTotal = (data ?? []).reduce((a, c) => a + c.unread, 0);

  return (
    <div>
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        className={cn(activeId && 'hidden md:flex')}
        actions={
          <Button variant="secondary" icon={<Zap className="size-4" strokeWidth={2} aria-hidden />} onClick={() => setSimulating(true)}>
            {t('simulate.button')}
          </Button>
        }
      />
      <div className="card grid h-[calc(100dvh-190px)] min-h-[520px] grid-cols-[minmax(0,1fr)] overflow-hidden md:h-[calc(100dvh-230px)] md:grid-cols-[340px_minmax(0,1fr)]">
        <section aria-label={t('title')} className={cn('flex min-h-0 flex-col border-border md:border-r', activeId && 'hidden md:flex')}>
          <div className="flex flex-col gap-2.5 border-b border-border p-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[15px] font-bold">{t('conversations')}</span>
              {unreadTotal > 0 && <Pill tone="primary" size="sm">{t('unread', { count: unreadTotal })}</Pill>}
            </div>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')} prefixIcon={<Search className="size-4" strokeWidth={2} aria-hidden />} className="h-10 border-transparent bg-surface-2" />
            <div role="group" aria-label={t('channels.all')} className="scrollbar-none -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {(['', 'portal', 'whatsapp', 'viber', 'telegram'] as const).map((c) => {
                const on = channel === c;
                return (
                  <button
                    key={c || 'all'}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setChannel(c)}
                    className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px] font-semibold transition-all', on ? 'border-transparent bg-text text-surface' : 'border-border bg-surface text-muted hover:text-text')}
                  >
                    {c && <span aria-hidden className="size-2 rounded-full" style={{ background: CHANNEL_COLOR[c] }} />}
                    {c ? INBOX_CHANNEL_LABELS[c] : t('channels.all')}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin]">
            {isLoading && !data && (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-14 rounded-2xl" />
                ))}
              </div>
            )}
            {data && data.length === 0 && <EmptyHint icon={MessagesSquare} title={t('empty')} description={t('emptyHint')} />}
            {data && <ConversationList items={data} activeId={activeId} onSelect={select} />}
          </div>
        </section>
        <section className={cn('min-h-0 min-w-0', !activeId && 'hidden md:block')}>
          {activeId ? (
            <Thread key={activeId} id={activeId} onBack={() => select(null)} onChanged={() => void mutate()} />
          ) : (
            <div className="grid h-full place-items-center bg-surface-2/40 p-6">
              <EmptyHint icon={MessagesSquare} title={data?.length === 0 ? t('empty') : t('select')} description={data?.length === 0 ? t('emptyHint') : t('selectHint')} />
            </div>
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
