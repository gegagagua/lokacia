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
  return (
    <div className={cn('flex h-full min-h-0 flex-col rounded-card border border-border bg-surface', className)}>
      {header && <div className="border-b border-border px-4 py-3">{header}</div>}
      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-4" role="log" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
            <div className={cn('max-w-[80%] rounded-[12px] border px-3 py-2', m.mine ? 'border-primary/30 bg-primary/10' : 'border-border bg-bg')}>
              {m.author && !m.mine && <div className="mb-0.5 text-[12px] font-medium text-muted">{m.author}{m.channel && m.channel !== 'portal' ? ` · ${m.channel}` : ''}</div>}
              <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{m.body}</p>
              {m.attachments?.map((a) => (
                <a key={a.url} href={a.url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-small text-link underline">
                  <Paperclip className="size-3" aria-hidden /> {a.name}
                </a>
              ))}
              <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-muted tabular">
                {formatDateTimeKa(m.at).split(', ').slice(-1)[0]}
                {m.mine && (m.readAt ? <CheckCheck className="size-3.5 text-link" aria-label="წაკითხულია" /> : <Check className="size-3.5" aria-label="გაგზავნილია" />)}
              </div>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form onSubmit={submit} className="flex items-end gap-2 border-t border-border p-3">
        {onAttach && (
          <>
            <button type="button" onClick={() => file.current?.click()} className="grid size-10 shrink-0 place-items-center rounded-button border border-border text-muted hover:bg-surface-2" aria-label="ფაილის მიმაგრება">
              <Paperclip className="size-4" strokeWidth={1.5} />
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
          className="max-h-32 min-h-10 flex-1 resize-none rounded-button border border-border-strong bg-surface px-3 py-2 text-[15px] focus:border-focus focus:outline-none"
        />
        <button type="submit" disabled={sending || !draft.trim()} className="grid size-10 shrink-0 place-items-center rounded-button bg-primary text-primary-contrast disabled:opacity-50" aria-label="გაგზავნა">
          <Send className="size-4" strokeWidth={1.5} />
        </button>
      </form>
    </div>
  );
}
