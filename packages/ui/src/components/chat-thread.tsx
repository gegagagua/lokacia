'use client';
import * as React from 'react';
import { Check, CheckCheck, Paperclip, Send } from 'lucide-react';
import { formatDateTimeKa } from '@lokacia/contracts';
import { cn } from '../lib/cn';

export type ChatMessage = { id: string; body: string; mine: boolean; at: string; readAt?: string | null; author?: string; attachments?: { url: string; name: string; type: string }[]; channel?: string };

export function ChatThread({ messages, onSend, onAttach, sending, placeholder = 'შეტყობინება…', className, header }: { messages: ChatMessage[]; onSend: (body: string) => void | Promise<void>; onAttach?: (file: File) => void; sending?: boolean; placeholder?: string; className?: string; header?: React.ReactNode }) {
  const [draft, setDraft] = React.useState('');
  const end = React.useRef<HTMLDivElement>(null);
  const file = React.useRef<HTMLInputElement>(null);
  React.useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);
  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    await onSend(body);
  };
  const dayOf = (iso: string) => formatDateTimeKa(iso).split(', ').slice(0, -1).join(', ');
  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-sm', className)}>
      {header && <div className="border-b border-border bg-surface px-4 py-3">{header}</div>}
      <div className="flex-1 overflow-y-auto bg-surface-2/40 px-3 py-4 [scrollbar-width:thin] md:px-5" role="log" aria-live="polite">
        <div className="flex flex-col gap-1.5">
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || dayOf(prev.at) !== dayOf(m.at);
            const grouped = !!prev && !newDay && prev.mine === m.mine && prev.author === m.author;
            return (
              <React.Fragment key={m.id}>
                {newDay && (
                  <div className="my-3 flex justify-center" aria-hidden>
                    <span className="rounded-full bg-surface px-3 py-1 text-[11.5px] font-semibold text-muted shadow-xs ring-1 ring-border">{dayOf(m.at)}</span>
                  </div>
                )}
                <div className={cn('flex', m.mine ? 'justify-end' : 'justify-start', !grouped && i > 0 && !newDay && 'mt-2')}>
                  <div
                    className={cn(
                      'max-w-[85%] px-3.5 py-2 shadow-xs md:max-w-[70%]',
                      m.mine ? 'rounded-[18px] bg-primary text-primary-contrast' : 'rounded-[18px] border border-border bg-surface text-text',
                      !grouped && (m.mine ? 'rounded-br-md' : 'rounded-bl-md'),
                    )}
                  >
                    {m.author && !m.mine && !grouped && <div className="mb-0.5 text-[12px] font-semibold text-primary-soft-text">{m.author}{m.channel && m.channel !== 'portal' ? ` · ${m.channel}` : ''}</div>}
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.body}</p>
                    {m.attachments?.map((a) => (
                      <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className={cn('mt-1 flex items-center gap-1 text-small underline', m.mine ? 'text-primary-contrast' : 'text-link')}>
                        <Paperclip className="size-3" aria-hidden /> {a.name}
                      </a>
                    ))}
                    <div className={cn('mt-0.5 flex items-center justify-end gap-1 text-[11px] tabular', m.mine ? 'text-primary-contrast/75' : 'text-muted')}>
                      {formatDateTimeKa(m.at).split(', ').slice(-1)[0]}
                      {m.mine && (m.readAt ? <CheckCheck className="size-3.5" aria-label="წაკითხულია" /> : <Check className="size-3.5" aria-label="გაგზავნილია" />)}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>
        <div ref={end} />
      </div>
      <form onSubmit={submit} className="flex items-end gap-2 border-t border-border bg-surface p-3">
        {onAttach && (
          <>
            <button type="button" onClick={() => file.current?.click()} className="grid size-11 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-text" aria-label="ფაილის მიმაგრება">
              <Paperclip className="size-[18px]" strokeWidth={2} />
            </button>
            <input ref={file} type="file" className="sr-only" tabIndex={-1} aria-label="ფაილის მიმაგრება" onChange={(e) => e.target.files?.[0] && onAttach(e.target.files[0])} />
          </>
        )}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          rows={1}
          placeholder={placeholder}
          aria-label="შეტყობინება"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-border bg-surface-2 px-4 py-2.5 text-[15px] transition-colors placeholder:text-muted focus:border-focus focus:bg-surface focus:outline-none"
        />
        <button type="submit" disabled={sending || !draft.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-contrast shadow-sm transition-all duration-200 hover:bg-primary-hover hover:shadow-md active:scale-95 disabled:opacity-40 disabled:shadow-none" aria-label="გაგზავნა">
          <Send className="size-[18px]" strokeWidth={2} />
        </button>
      </form>
    </div>
  );
}
