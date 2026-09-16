'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Building2, CalendarPlus, CircleUserRound, ListPlus, Moon, Plus, Search, SquareKanban, type LucideIcon } from 'lucide-react';
import type { CrmSearchResult } from '@lokacia/contracts';
import { cn, Dialog } from '@lokacia/ui';
import { apiFetch } from '@/lib/api-client';
import { useCrm } from '@/lib/crm-context';
import { NAV_ITEMS } from '@/lib/nav';
import { toggleTheme } from './theme-toggle';

type Entry = { id: string; group: 'pages' | 'actions' | 'contacts' | 'deals' | 'listings'; label: string; hint?: string; icon: LucideIcon; run: () => void };

/** Cmd/Ctrl+K: jump to pages, run quick actions, search contacts (name/phone), deals and org listings. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations('shell');
  const router = useRouter();
  const { can, org, workspace } = useCrm();
  const [q, setQ] = React.useState('');
  const [active, setActive] = React.useState(0);
  const [results, setResults] = React.useState<CrmSearchResult | null>(null);
  const listRef = React.useRef<HTMLUListElement>(null);

  React.useEffect(() => {
    if (!open) {
      setQ('');
      setResults(null);
      setActive(0);
    }
  }, [open]);

  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return setResults(null);
    const ctl = setTimeout(() => {
      apiFetch<CrmSearchResult>(`/crm/search?q=${encodeURIComponent(term)}`, { orgId: org.id })
        .then(setResults)
        .catch(() => setResults(null));
    }, 180);
    return () => clearTimeout(ctl);
  }, [q, org.id]);

  const go = React.useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

  const entries = React.useMemo<Entry[]>(() => {
    const term = q.trim().toLowerCase();
    const match = (s: string) => !term || s.toLowerCase().includes(term);
    const pages: Entry[] = NAV_ITEMS.filter((i) => !i.perm || can(i.perm))
      .map((i) => ({ id: `page:${i.key}`, group: 'pages' as const, label: t(`nav.${i.key}`), icon: i.icon, run: () => go(i.href) }))
      .filter((e) => match(e.label));
    const actions: Entry[] = [
      { id: 'act:contact', group: 'actions' as const, label: t('palette.newContact'), icon: CircleUserRound, run: () => go('/contacts?new=1') },
      { id: 'act:deal', group: 'actions' as const, label: t('palette.newDeal'), icon: Plus, run: () => go('/deals?new=1') },
      { id: 'act:task', group: 'actions' as const, label: t('palette.newTask'), icon: ListPlus, run: () => go('/tasks?new=1') },
      { id: 'act:viewing', group: 'actions' as const, label: t('palette.newViewing'), icon: CalendarPlus, run: () => go('/calendar?new=1') },
      {
        id: 'act:theme',
        group: 'actions' as const,
        label: t('palette.toggleTheme'),
        icon: Moon,
        run: () => {
          toggleTheme();
          onOpenChange(false);
        },
      },
    ].filter((e) => match(e.label));
    const found: Entry[] = results
      ? [
          ...results.contacts.map((c) => ({ id: `c:${c.id}`, group: 'contacts' as const, label: c.name, hint: c.phone ?? undefined, icon: CircleUserRound, run: () => go(`/contacts/${c.id}`) })),
          ...results.deals.map((d) => ({ id: `d:${d.id}`, group: 'deals' as const, label: d.title, hint: workspace?.pipeline?.stages.find((st) => st.key === d.stage)?.name ?? d.stage, icon: SquareKanban, run: () => go(`/deals/${d.id}`) })),
          ...results.listings.map((l) => ({ id: `l:${l.id}`, group: 'listings' as const, label: l.title, hint: l.address, icon: Building2, run: () => go(`/listings/${l.id}`) })),
        ]
      : [];
    return [...found, ...pages, ...actions];
  }, [q, results, can, t, go, onOpenChange, workspace]);

  React.useEffect(() => setActive(0), [entries.length]);
  React.useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, entries.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      entries[active]?.run();
    }
  };

  let lastGroup = '';
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t('palette.open')} size="lg" className="top-[12%] translate-y-0 overflow-hidden">
      <div className="-mx-6 -my-5 flex flex-col">
        <div className="flex items-center gap-3 border-b border-border px-5">
          <Search className="size-5 text-muted" strokeWidth={2} aria-hidden />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('palette.placeholder')}
            aria-label={t('palette.placeholder')}
            role="combobox"
            aria-expanded
            aria-controls="lk-palette-list"
            aria-activedescendant={entries[active] ? `lk-pal-${active}` : undefined}
            className="h-14 w-full bg-transparent text-[16px] outline-none placeholder:text-muted"
          />
        </div>
        <ul id="lk-palette-list" ref={listRef} role="listbox" className="max-h-[50dvh] overflow-y-auto py-2">
          {entries.length === 0 && <li className="px-4 py-6 text-center text-small text-muted">{t('palette.empty')}</li>}
          {entries.map((e, i) => {
            const header = e.group !== lastGroup ? t(`palette.${e.group}`) : null;
            lastGroup = e.group;
            const Icon = e.icon;
            return (
              <React.Fragment key={e.id}>
                {header && (
                  <li role="presentation" className="px-5 pb-1.5 pt-3 text-[11.5px] font-semibold uppercase tracking-[0.06em] text-muted">
                    {header}
                  </li>
                )}
                <li
                  id={`lk-pal-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onClick={e.run}
                  className={cn('mx-2 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 transition-colors', i === active && 'bg-primary-soft text-primary-soft-text')}
                >
                  <span className={cn('grid size-8 shrink-0 place-items-center rounded-[10px]', i === active ? 'bg-surface text-primary-soft-text shadow-xs' : 'bg-surface-2 text-muted')} aria-hidden>
                    <Icon className="size-4" strokeWidth={2} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[14.5px] font-medium">{e.label}</span>
                  {e.hint && <span className="max-w-[40%] truncate text-small text-muted tabular">{e.hint}</span>}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
        <div className="border-t border-border bg-surface-2/60 px-5 py-2.5 text-[12.5px] text-muted">{t('palette.hint')}</div>
      </div>
    </Dialog>
  );
}
