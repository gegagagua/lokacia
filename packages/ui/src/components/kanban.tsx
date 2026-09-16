'use client';
import * as React from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../lib/cn';

/** `color` (any CSS colour) tints the header dot/bar; `subtitle` renders under the title (e.g. total value). */
export type KanbanColumn = { key: string; title: string; tone?: 'open' | 'won' | 'lost'; footer?: React.ReactNode; color?: string; subtitle?: React.ReactNode };
export type KanbanItem = { id: string; column: string };

function Item<T extends KanbanItem>({ item, render }: { item: T; render: (i: T) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, data: { column: item.column } });
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} {...attributes} {...listeners} className={cn('touch-none rounded-2xl outline-none transition-opacity focus-visible:shadow-ring', isDragging && 'opacity-35')}>
      {render(item)}
    </div>
  );
}

function Column<T extends KanbanItem>({ col, items, render }: { col: KanbanColumn; items: T[]; render: (i: T) => React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col.key}`, data: { column: col.key } });
  const color = col.color ?? (col.tone === 'won' ? 'var(--success)' : col.tone === 'lost' ? 'var(--danger)' : 'var(--primary-500)');
  return (
    <section
      aria-label={col.title}
      className={cn('flex max-h-full min-h-0 w-[300px] shrink-0 flex-col rounded-card border transition-all duration-200', isOver ? 'border-primary bg-primary-soft/40 shadow-ring' : 'border-border/60 bg-surface-3/45')}
      style={{ ['--kb-color' as string]: color }}
    >
      <header className="relative px-3.5 pb-2.5 pt-3.5">
        <span aria-hidden className="absolute inset-x-3.5 top-0 h-[3px] rounded-b-full bg-[var(--kb-color)]" />
        <div className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-[var(--kb-color)] shadow-[0_0_0_3px_color-mix(in_srgb,var(--kb-color)_22%,transparent)]" />
          <h3 className={cn('min-w-0 flex-1 truncate text-[14.5px] font-semibold', col.tone === 'won' && 'text-success', col.tone === 'lost' && 'text-danger')}>{col.title}</h3>
          <span className="grid h-6 min-w-6 place-items-center rounded-full bg-surface px-2 text-[12px] font-semibold tabular text-muted shadow-xs">{items.length}</span>
        </div>
        {col.subtitle && <div className="mt-1 pl-[18px] text-[13px] font-medium tabular text-muted">{col.subtitle}</div>}
      </header>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {/* div, not ul: sortable items carry role="button" (dnd-kit), which is invalid as a direct list child */}
        <div ref={setNodeRef} className="flex min-h-28 flex-1 flex-col gap-2.5 overflow-y-auto px-2.5 pb-2.5 pt-0.5 [scrollbar-width:thin]">
          {items.map((i) => (
            <Item key={i.id} item={i} render={render} />
          ))}
          {items.length === 0 && <div aria-hidden className="grid min-h-24 flex-1 place-items-center rounded-2xl border-2 border-dashed border-border text-[13px] text-muted" />}
        </div>
      </SortableContext>
      {col.footer && <footer className="border-t border-border/70 px-3.5 py-2.5 text-small text-muted">{col.footer}</footer>}
    </section>
  );
}

const colTitle = (columns: KanbanColumn[], id: string | number | undefined, fallback?: unknown) => {
  const key = (fallback as { column?: string } | undefined)?.column ?? String(id ?? '').replace(/^col:/, '');
  return columns.find((c) => c.key === key)?.title ?? key;
};

/** Drag-and-drop board. `onMove(itemId, toColumn, toIndex)` is called on drop (keyboard accessible). */
export function Kanban<T extends KanbanItem>({ columns, items, renderItem, onMove, className }: { columns: KanbanColumn[]; items: T[]; renderItem: (i: T) => React.ReactNode; onMove: (id: string, column: string, index: number) => void; className?: string }) {
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const overData = e.over.data.current as { column?: string } | undefined;
    const toCol = overData?.column ?? String(e.over.id).replace(/^col:/, '');
    const colItems = items.filter((i) => i.column === toCol && i.id !== e.active.id);
    const idx = colItems.findIndex((i) => i.id === e.over!.id);
    onMove(String(e.active.id), toCol, idx < 0 ? colItems.length : idx);
  };
  const active = items.find((i) => i.id === activeId);
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      accessibility={{
        screenReaderInstructions: { draggable: 'ბარათის ასაღებად დააჭირეთ Space ან Enter. ისრებით გადაადგილეთ, Space ან Enter — დადება, Escape — გაუქმება.' },
        announcements: {
          onDragStart: () => 'ბარათი აღებულია.',
          onDragOver: ({ over }) => (over ? `ბარათი სვეტზეა: ${colTitle(columns, over.id, over.data.current)}.` : 'ბარათი სვეტს გარეთა.'),
          onDragEnd: ({ over }) => (over ? `ბარათი დაიდო სვეტში: ${colTitle(columns, over.id, over.data.current)}.` : 'ბარათი დაიდო.'),
          onDragCancel: () => 'გადაადგილება გაუქმდა.',
        },
      }}
      onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onEnd} onDragCancel={() => setActiveId(null)}>
      <div className={cn('flex gap-4 overflow-x-auto pb-3', className)}>
        {columns.map((c) => (
          <Column key={c.key} col={c} items={items.filter((i) => i.column === c.key)} render={renderItem} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 220, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' }}>{active ? <div className="rotate-[2deg] scale-[1.02] cursor-grabbing rounded-2xl shadow-lg">{renderItem(active)}</div> : null}</DragOverlay>
    </DndContext>
  );
}
