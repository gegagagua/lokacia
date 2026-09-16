'use client';
import * as React from 'react';
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '../lib/cn';

export type KanbanColumn = { key: string; title: string; tone?: 'open' | 'won' | 'lost'; footer?: React.ReactNode };
export type KanbanItem = { id: string; column: string };

function Item<T extends KanbanItem>({ item, render }: { item: T; render: (i: T) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, data: { column: item.column } });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), transition }} {...attributes} {...listeners} className={cn('touch-none list-none', isDragging && 'opacity-40')}>
      {render(item)}
    </li>
  );
}

function Column<T extends KanbanItem>({ col, items, render }: { col: KanbanColumn; items: T[]; render: (i: T) => React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col.key}`, data: { column: col.key } });
  return (
    <section aria-label={col.title} className={cn('flex w-72 shrink-0 flex-col rounded-card border bg-bg', isOver ? 'border-primary' : 'border-border')}>
      <header className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <h3 className={cn('text-[15px] font-semibold', col.tone === 'won' && 'text-success', col.tone === 'lost' && 'text-danger')}>{col.title}</h3>
        <span className="rounded-full bg-surface-2 px-2 text-small tabular text-muted">{items.length}</span>
      </header>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 p-2">
          {items.map((i) => (
            <Item key={i.id} item={i} render={render} />
          ))}
        </ul>
      </SortableContext>
      {col.footer && <footer className="border-t border-border px-3 py-2 text-small text-muted">{col.footer}</footer>}
    </section>
  );
}

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
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))} onDragEnd={onEnd} onDragCancel={() => setActiveId(null)}>
      <div className={cn('flex gap-3 overflow-x-auto pb-2', className)}>
        {columns.map((c) => (
          <Column key={c.key} col={c} items={items.filter((i) => i.column === c.key)} render={renderItem} />
        ))}
      </div>
      <DragOverlay>{active ? <div className="rotate-1">{renderItem(active)}</div> : null}</DragOverlay>
    </DndContext>
  );
}
