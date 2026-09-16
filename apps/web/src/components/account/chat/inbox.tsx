'use client';
import * as React from 'react';
import Link from '@/i18n/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ExternalLink, Search } from 'lucide-react';
import { formatDateFor, type AppLocale, type ConversationDto, type MessageDto } from '@lokacia/contracts';
import { useFormat } from '@/i18n/use-format';
import { Avatar, Button, ChatThread, cn, EmptyState, Input, Skeleton, useToast, type ChatMessage } from '@lokacia/ui';
import { apiFetch, fetcher, uploadFile } from '@/lib/api-client';
import { useRealtime } from '../realtime';
import { tbilisi } from '../format';

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
      <EmptyState
        title={t('empty')}
        description={t('emptyHint')}
        action={
          <Button asChild>
            <Link href="/search">{t('emptySearch')}</Link>
          </Button>
        }
      />
    );

  return (
    <div className="grid h-[calc(100dvh-230px)] min-h-[480px] grid-cols-1 gap-4 md:grid-cols-[300px_minmax(0,1fr)]">
      <aside className={cn('flex min-h-0 min-w-0 flex-col rounded-card border border-border bg-surface', activeId && 'hidden md:flex')} aria-label={t('title')}>
        <div className="border-b border-border p-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')} prefixIcon={<Search className="size-4" strokeWidth={1.5} aria-hidden />} />
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {!list && [0, 1, 2].map((i) => <li key={i} className="p-3"><Skeleton className="h-12" /></li>)}
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => open(c.id)}
                aria-current={c.id === activeId ? 'true' : undefined}
                className={cn('flex w-full gap-3 border-b border-border px-3 py-3 text-left hover:bg-surface-2', c.id === activeId && 'bg-surface-2')}
              >
                <Avatar src={c.other?.avatarUrl} name={c.other?.name ?? '?'} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={cn('truncate', c.unread ? 'font-semibold' : 'font-medium')}>{c.other?.name ?? t('unknown')}</span>
                    {c.lastMessageAt && <span className="shrink-0 text-[11px] text-muted tabular">{timeLabel(c.lastMessageAt, f.locale)}</span>}
                  </span>
                  <span className="block truncate text-[12px] text-muted">{c.listing?.title ?? c.subject}</span>
                  <span className="flex items-center justify-between gap-2">
                    <span className={cn('truncate text-small', c.unread ? 'text-text' : 'text-muted')}>
                      {c.lastMessage ? `${c.lastMessage.mine ? `${t('you')}: ` : ''}${c.lastMessage.body}` : ''}
                    </span>
                    {c.unread > 0 && (
                      <span className="shrink-0 rounded-full bg-accent px-1.5 text-[11px] font-medium text-accent-contrast tabular" aria-label={t('unread', { count: c.unread })}>
                        {c.unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section className={cn('min-h-0 min-w-0', !activeId && 'hidden md:block')}>
        {active ? (
          <Conversation key={active.id} conv={active} me={me} live={live} onBack={() => open(null)} onChanged={() => void mutateList()} />
        ) : activeId && !list ? (
          <Skeleton className="h-full" />
        ) : (
          <div className="grid h-full place-items-center rounded-card border border-dashed border-border-strong p-6">
            <EmptyState title={t('select')} description={t('selectHint')} />
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
      className="h-full"
      messages={messages}
      onSend={(b) => send(b)}
      onAttach={(f) => void attach(f)}
      sending={sending || attaching}
      placeholder={attaching ? t('attaching') : t('placeholder')}
      header={
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="grid size-8 place-items-center rounded-button hover:bg-surface-2 md:hidden" aria-label={t('back')}>
            <ArrowLeft className="size-4" strokeWidth={1.5} />
          </button>
          <Avatar src={conv.other?.avatarUrl} name={conv.other?.name ?? '?'} size={36} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">{conv.other?.name ?? t('unknown')}</div>
            {conv.listing ? (
              <Link href={`/listings/${conv.listing.slug}`} className="flex items-center gap-1 truncate text-small text-link hover:underline">
                <span className="truncate">{conv.listing.title}</span>
                <ExternalLink className="size-3 shrink-0" strokeWidth={1.5} aria-hidden />
              </Link>
            ) : (
              <div className="truncate text-small text-muted">{conv.subject}</div>
            )}
          </div>
          <span className={cn('hidden items-center gap-1.5 text-[11px] text-muted sm:inline-flex')} aria-live="polite">
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
