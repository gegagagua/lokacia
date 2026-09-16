'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ExternalLink, MessagesSquare, Search } from 'lucide-react';
import { formatDateFor, type AppLocale, type ConversationDto, type MessageDto } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Avatar, Button, ChatThread, cn, Input, Skeleton, useToast, type ChatMessage } from '@lokacia/ui';
import { apiFetch, fetcher, uploadFile } from '@/lib/api-client';
import { useRealtime } from '../realtime';
import { tbilisi } from '../format';
import { AccountEmpty } from '../ui';

type Page = { items: MessageDto[]; nextCursor: string | null };

function timeLabel(iso: string, locale: AppLocale) {
  const d = tbilisi(iso);
  const now = tbilisi(new Date());
  if (d.toDateString() === now.toDateString()) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return formatDateFor(d, locale).replace(/,? \d{4}$/, '');
}

async function waitForMedia(id: string) {
  for (let i = 0; i < 30; i++) {
    const m = await apiFetch<{ status: string; url: string }>(`/media/${id}`);
    if (m.status === 'ready') return m.url;
    if (m.status === 'failed') throw new Error('failed');
    await new Promise((r) => setTimeout(r, 600));
  }
  throw new Error('timeout');
}

export function Inbox({ me, initialId }: { me: string; initialId: string | null }) {
  const t = useTranslations('chat');
  const f = useFormat();
  const router = useRouter();
  const pathname = usePathname();
  const [activeId, setActiveId] = React.useState<string | null>(initialId);
  const [q, setQ] = React.useState('');
  const live = useRealtime('message', (p) => {
    const m = p as MessageDto;
    void mutateList();
    if (m.conversationId === activeId) window.dispatchEvent(new CustomEvent('lk-chat-message', { detail: m }));
  });
  useRealtime('read', (p) => window.dispatchEvent(new CustomEvent('lk-chat-read', { detail: p })));
  const { data: list, mutate: mutateList } = useSWR<ConversationDto[]>('/conversations', fetcher, { refreshInterval: live ? 60_000 : 10_000 });

  const open = (id: string | null) => {
    setActiveId(id);
    router.replace(id ? `${pathname}?c=${id}` : pathname, { scroll: false });
  };
  const filtered = (list ?? []).filter((c) => !q || `${c.other?.name ?? ''} ${c.listing?.title ?? c.subject ?? ''}`.toLowerCase().includes(q.toLowerCase()));
  const active = list?.find((c) => c.id === activeId) ?? null;

  if (list && list.length === 0)
    return (
      <AccountEmpty
        icon={MessagesSquare}
        title={t('empty')}
        description={t('emptyHint')}
        action={
          <Button asChild>
            <Link href="/search">{t('emptySearch')}</Link>
          </Button>
        }
      />
    );

  const totalUnread = (list ?? []).reduce((a, c) => a + c.unread, 0);

  return (
    <div className="card grid h-[calc(100dvh-220px)] min-h-[520px] grid-cols-1 overflow-hidden p-0 md:grid-cols-[320px_minmax(0,1fr)] lg:h-[calc(100dvh-260px)]">
      <aside className={cn('flex min-h-0 min-w-0 flex-col border-border md:border-r', activeId && 'hidden md:flex')} aria-label={t('title')}>
        <div className="flex flex-col gap-3 border-b border-border p-4">
          <div className="flex items-center justify-between">
            <span className="text-[17px] font-bold">{t('title')}</span>
            {totalUnread > 0 && <span className="inline-grid h-6 min-w-6 place-items-center rounded-full bg-accent px-2 text-[12px] font-bold text-accent-contrast tabular">{totalUnread}</span>}
          </div>
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')} className="h-10 rounded-full bg-surface-2" prefixIcon={<Search className="size-4" strokeWidth={2} aria-hidden />} />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {!list && [0, 1, 2, 3].map((i) => <li key={i} className="flex gap-3 p-3"><Skeleton className="size-12 rounded-full" /><div className="flex flex-1 flex-col gap-2"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full" /></div></li>)}
          {filtered.map((c) => {
            const on = c.id === activeId;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => open(c.id)}
                  aria-current={on ? 'true' : undefined}
                  className={cn('flex w-full gap-3 rounded-2xl px-3 py-3 text-left transition-colors duration-150', on ? 'bg-primary-soft' : 'hover:bg-surface-2')}
                >
                  <span className="relative shrink-0">
                    <Avatar src={c.other?.avatarUrl} name={c.other?.name ?? '?'} size={48} />
                    {c.listing?.cover && <img src={c.listing.cover} alt="" className="absolute -bottom-1 -right-1 size-6 rounded-lg border-2 border-surface object-cover shadow-xs" />}
                    {c.unread > 0 && !c.listing?.cover && <span className="absolute right-0 top-0 size-3 rounded-full border-2 border-surface bg-accent" aria-hidden />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn('truncate text-[15px]', c.unread ? 'font-bold' : 'font-semibold')}>{c.other?.name ?? t('unknown')}</span>
                      {c.lastMessageAt && <span className={cn('shrink-0 text-[12px] tabular', c.unread ? 'font-semibold text-text' : 'text-muted')}>{timeLabel(c.lastMessageAt, f.locale)}</span>}
                    </span>
                    <span className={cn('block truncate text-[12.5px]', on ? 'text-primary-soft-text' : 'text-muted')}>{c.listing?.title ?? c.subject}</span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className={cn('truncate text-small', c.unread ? 'font-medium text-text' : 'text-muted')}>
                        {c.lastMessage ? `${c.lastMessage.mine ? `${t('you')}: ` : ''}${c.lastMessage.body}` : ''}
                      </span>
                      {c.unread > 0 && (
                        <span className="inline-grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[11.5px] font-bold text-accent-contrast tabular" aria-label={t('unread', { count: c.unread })}>
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
      </aside>
      <section className={cn('min-h-0 min-w-0 bg-bg/40', !activeId && 'hidden md:block')}>
        {active ? (
          <Conversation key={active.id} conv={active} me={me} live={live} onBack={() => open(null)} onChanged={() => void mutateList()} />
        ) : activeId && !list ? (
          <Skeleton className="h-full rounded-none" />
        ) : (
          <div className="grid h-full place-items-center p-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <span className="grid size-16 place-items-center rounded-[22px] bg-primary-soft text-primary-soft-text" aria-hidden>
                <MessagesSquare className="size-7" strokeWidth={2} />
              </span>
              <h2 className="text-h3 font-bold">{t('select')}</h2>
              <p className="max-w-sm text-muted">{t('selectHint')}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Conversation({ conv, me, live, onBack, onChanged }: { conv: ConversationDto; me: string; live: boolean; onBack: () => void; onChanged: () => void }) {
  const t = useTranslations('chat');
  const toast = useToast();
  const [items, setItems] = React.useState<MessageDto[] | null>(null);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);
  const [attaching, setAttaching] = React.useState(false);

  const markRead = React.useCallback(async () => {
    await apiFetch(`/conversations/${conv.id}/read`, { method: 'POST' }).catch(() => undefined);
    onChanged();
  }, [conv.id, onChanged]);

  const loadLatest = React.useCallback(async () => {
    const page = await apiFetch<Page>(`/conversations/${conv.id}/messages?limit=30`);
    setItems((prev) => {
      if (!prev) {
        setCursor(page.nextCursor);
        return page.items;
      }
      const byId = new Map(prev.map((m) => [m.id, m]));
      for (const m of page.items) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    });
    if (page.items.some((m) => m.senderId !== me && !m.readAt)) void markRead();
  }, [conv.id, me, markRead]);

  React.useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  // polling fallback when the WebSocket is not connected
  React.useEffect(() => {
    if (live) return;
    const id = setInterval(() => void loadLatest(), 5000);
    return () => clearInterval(id);
  }, [live, loadLatest]);

  React.useEffect(() => {
    const onMsg = (e: Event) => {
      const m = (e as CustomEvent<MessageDto>).detail;
      setItems((prev) => (prev && !prev.some((x) => x.id === m.id) ? [...prev, m] : prev));
      if (m.senderId !== me) void markRead();
    };
    const onRead = (e: Event) => {
      const r = (e as CustomEvent<{ conversationId: string; ids: string[]; at: string }>).detail;
      if (r.conversationId !== conv.id) return;
      const ids = new Set(r.ids);
      setItems((prev) => prev?.map((m) => (ids.has(m.id) ? { ...m, readAt: r.at } : m)) ?? prev);
    };
    window.addEventListener('lk-chat-message', onMsg);
    window.addEventListener('lk-chat-read', onRead);
    return () => {
      window.removeEventListener('lk-chat-message', onMsg);
      window.removeEventListener('lk-chat-read', onRead);
    };
  }, [conv.id, me, markRead]);

  const loadOlder = async () => {
    if (!cursor) return;
    const page = await apiFetch<Page>(`/conversations/${conv.id}/messages?limit=30&cursor=${encodeURIComponent(cursor)}`);
    setItems((prev) => [...page.items, ...(prev ?? [])]);
    setCursor(page.nextCursor);
  };

  const send = async (body: string, attachments?: { url: string; name: string; type: string }[]) => {
    setSending(true);
    try {
      const m = await apiFetch<MessageDto>(`/conversations/${conv.id}/messages`, { method: 'POST', body: { body, attachments } });
      setItems((prev) => (prev && !prev.some((x) => x.id === m.id) ? [...prev, m] : prev));
      onChanged();
    } catch {
      toast({ title: t('sendError'), tone: 'danger' });
    } finally {
      setSending(false);
    }
  };

  const attach = async (file: File) => {
    setAttaching(true);
    try {
      const kind = file.type.startsWith('image/') ? 'photo' : 'document';
      const id = await uploadFile(file, { kind });
      const url = await waitForMedia(id);
      await send(file.name, [{ url, name: file.name, type: file.type || 'application/octet-stream' }]);
    } catch {
      toast({ title: t('attachError'), tone: 'danger' });
    } finally {
      setAttaching(false);
    }
  };

  const messages: ChatMessage[] = (items ?? []).map((m) => ({ id: m.id, body: m.body, mine: m.senderId === me, at: tbilisi(m.createdAt).toISOString(), readAt: m.readAt, author: m.senderId === me ? undefined : (conv.other?.name ?? undefined), attachments: m.attachments }));

  return (
    <ChatThread
      className="h-full rounded-none border-0 shadow-none"
      messages={messages}
      onSend={(b) => send(b)}
      onAttach={(f) => void attach(f)}
      sending={sending || attaching}
      placeholder={attaching ? t('attaching') : t('placeholder')}
      header={
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="grid size-10 place-items-center rounded-full hover:bg-surface-2 md:hidden" aria-label={t('back')}>
            <ArrowLeft className="size-5" strokeWidth={2} />
          </button>
          <Avatar src={conv.other?.avatarUrl} name={conv.other?.name ?? '?'} size={42} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{conv.other?.name ?? t('unknown')}</div>
            {conv.listing ? (
              <Link href={`/listings/${conv.listing.slug}`} className="flex items-center gap-1 truncate text-small font-medium text-link hover:underline">
                <span className="truncate">{conv.listing.title}</span>
                <ExternalLink className="size-3 shrink-0" strokeWidth={1.5} aria-hidden />
              </Link>
            ) : (
              <div className="truncate text-small text-muted">{conv.subject}</div>
            )}
          </div>
          {conv.listing?.cover && <img src={conv.listing.cover} alt="" className="hidden size-11 rounded-xl object-cover shadow-xs lg:block" />}
          <span className={cn('hidden h-7 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 text-[12px] font-medium text-muted sm:inline-flex')} aria-live="polite">
            <span className={cn('size-1.5 rounded-full', live ? 'bg-success' : 'bg-border-strong')} aria-hidden />
            {live ? t('live') : t('polling')}
          </span>
          {cursor && (
            <Button size="sm" variant="ghost" onClick={() => void loadOlder()} className="hidden lg:inline-flex">
              {t('loadOlder')}
            </Button>
          )}
        </div>
      }
    />
  );
}
