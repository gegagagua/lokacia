'use client';
import * as React from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { cn } from '../lib/cn';

export type Column<T> = { key: string; header: React.ReactNode; cell: (row: T) => React.ReactNode; sortValue?: (row: T) => string | number | null; align?: 'left' | 'right' | 'center'; className?: string };

/** Sortable table (client-side sort). Numbers are tabular. */
export function Table<T>({ columns, rows, rowKey, empty, className, onRowClick, initialSort, stickyFirst }: { columns: Column<T>[]; rows: T[]; rowKey: (r: T) => string; empty?: React.ReactNode; className?: string; onRowClick?: (r: T) => void; initialSort?: { key: string; dir: 'asc' | 'desc' }; stickyFirst?: boolean }) {
  const [sort, setSort] = React.useState(initialSort ?? null);
  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va > vb ? 1 : -1) * (sort.dir === 'asc' ? 1 : -1);
    });
  }, [rows, sort, columns]);
  return (
    <div className={cn('relative overflow-x-auto rounded-card border border-border bg-surface shadow-sm', className)}>
      <table className="w-full border-collapse text-left text-[15px] tabular">
        <thead>
          <tr className="border-b border-border bg-surface-2/70">
            {columns.map((c, i) => {
              const active = sort?.key === c.key;
              return (
                <th key={c.key} scope="col" aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : undefined} className={cn('whitespace-nowrap px-4 py-3 text-[13px] font-semibold uppercase tracking-wide text-muted', c.align === 'right' && 'text-right', stickyFirst && i === 0 && 'sticky left-0 bg-surface', c.className)}>
                  {c.sortValue ? (
                    <button type="button" className="inline-flex items-center gap-1 hover:text-text" onClick={() => setSort(active && sort!.dir === 'asc' ? { key: c.key, dir: 'desc' } : { key: c.key, dir: 'asc' })}>
                      {c.header}
                      {active ? sort!.dir === 'asc' ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" /> : <ChevronsUpDown className="size-3.5 opacity-50" />}
                    </button>
                  ) : (
                    c.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-10 text-center text-muted">
                {empty ?? 'ცარიელია'}
              </td>
            </tr>
          )}
          {sorted.map((r) => (
            <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined} className={cn('border-b border-border transition-colors last:border-b-0 hover:bg-surface-2/60', onRowClick && 'cursor-pointer')}>
              {columns.map((c, i) => (
                <td key={c.key} className={cn('px-4 py-3.5 align-middle', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', stickyFirst && i === 0 && 'sticky left-0 bg-surface', c.className)}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, pages, onPage, className }: { page: number; pages: number; onPage: (p: number) => void; className?: string }) {
  if (pages <= 1) return null;
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages].filter((p) => p >= 1 && p <= pages))).sort((a, b) => a - b);
  return (
    <nav aria-label="გვერდები" className={cn('flex items-center gap-1', className)}>
      <button type="button" className="grid size-10 place-items-center rounded-xl border border-border bg-surface shadow-xs hover:bg-surface-2 disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="წინა">
        <ChevronLeft className="size-4" strokeWidth={1.5} />
      </button>
      {nums.map((n, i) => (
        <React.Fragment key={n}>
          {i > 0 && n - nums[i - 1]! > 1 && <span className="px-1 text-muted">…</span>}
          <button type="button" aria-current={n === page ? 'page' : undefined} onClick={() => onPage(n)} className={cn('h-10 min-w-10 rounded-xl px-3 font-semibold tabular transition-colors', n === page ? 'bg-primary text-primary-contrast shadow-sm' : 'bg-surface text-text hover:bg-surface-2')}>
            {n}
          </button>
        </React.Fragment>
      ))}
      <button type="button" className="grid size-10 place-items-center rounded-xl border border-border bg-surface shadow-xs hover:bg-surface-2 disabled:opacity-40" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="შემდეგი">
        <ChevronRight className="size-4" strokeWidth={1.5} />
      </button>
    </nav>
  );
}

/** Accessible combobox (listbox pattern) with type-ahead filtering. */
export function Combobox({ options, value, onChange, placeholder, label, className, emptyText = 'არაფერი მოიძებნა' }: { options: { value: string; label: string; hint?: string }[]; value?: string | null; onChange: (v: string | null) => void; placeholder?: string; label?: string; className?: string; emptyText?: string }) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [active, setActive] = React.useState(0);
  const selected = options.find((o) => o.value === value);
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  const commit = (v: string | null) => {
    onChange(v);
    setQuery('');
    setOpen(false);
  };
  return (
    <div className={cn('relative', className)}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open && filtered[active] ? `${id}-${filtered[active]!.value}` : undefined}
        aria-label={label}
        className="h-12 w-full rounded-button border border-border bg-surface px-4 text-text shadow-xs placeholder:text-muted/70 focus:border-focus focus:shadow-ring focus:outline-none"
        placeholder={selected?.label ?? placeholder}
        value={open ? query : (selected?.label ?? '')}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, filtered.length - 1));
          else if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
          else if (e.key === 'Enter' && filtered[active]) {
            e.preventDefault();
            commit(filtered[active]!.value);
          } else if (e.key === 'Escape') setOpen(false);
        }}
      />
      {open && (
        <ul id={`${id}-list`} role="listbox" className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-border bg-surface p-1 shadow-lg">
          {value && (
            <li role="option" aria-selected={false} className="cursor-pointer px-3 py-2 text-small text-muted hover:bg-surface-2" onMouseDown={() => commit(null)}>
              ✕ მოხსნა
            </li>
          )}
          {filtered.length === 0 && <li className="px-3 py-2 text-small text-muted">{emptyText}</li>}
          {filtered.map((o, i) => (
            <li key={o.value} id={`${id}-${o.value}`} role="option" aria-selected={o.value === value} onMouseDown={() => commit(o.value)} onMouseEnter={() => setActive(i)} className={cn('flex cursor-pointer items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[15px]', i === active && 'bg-surface-2', o.value === value && 'font-medium text-primary')}>
              {o.label}
              {o.hint && <span className="text-small text-muted">{o.hint}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
