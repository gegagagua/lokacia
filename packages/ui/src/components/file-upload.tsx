'use client';
import * as React from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ImagePlus, Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/cn';

export type UploadItem = { id: string; url: string; name?: string; status: 'uploading' | 'processing' | 'ready' | 'failed'; progress?: number; kind?: string };

function Tile({ item, onRemove, index, extra }: { item: UploadItem; onRemove?: (id: string) => void; index: number; extra?: (item: UploadItem) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <li ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={cn('relative aspect-[4/3] overflow-hidden rounded-photo border border-border bg-surface-2 shadow-xs', isDragging && 'z-10 ring-2 ring-focus')}>
      {item.url && item.status !== 'uploading' ? <img src={item.url} alt={item.name ?? ''} className="size-full object-cover" /> : null}
      {(item.status === 'uploading' || item.status === 'processing') && (
        <div className="absolute inset-0 grid place-items-center bg-surface/70 text-small text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="size-4 animate-spin" strokeWidth={1.5} aria-hidden />
            {item.status === 'uploading' ? `${item.progress ?? 0}%` : 'მუშავდება'}
          </span>
        </div>
      )}
      {item.status === 'failed' && (
        <div className="absolute inset-0 grid place-items-center bg-surface/80 text-small text-danger">
          <AlertTriangle className="size-4" aria-hidden /> შეცდომა
        </div>
      )}
      {index === 0 && <span className="absolute bottom-2 left-2 rounded-full bg-primary px-2.5 py-0.5 text-[11.5px] font-semibold text-primary-contrast shadow-sm">ყდა</span>}
      <div className="absolute right-2 top-2 flex gap-1">
        {extra?.(item)}
        <button type="button" {...attributes} {...listeners} aria-label="გადაადგილება" className="grid size-7 cursor-grab place-items-center rounded-lg bg-surface/95 text-text shadow-sm">
          <GripVertical className="size-3.5" strokeWidth={1.5} />
        </button>
        {onRemove && (
          <button type="button" onClick={() => onRemove(item.id)} aria-label="წაშლა" className="grid size-7 place-items-center rounded-lg bg-surface/95 text-danger shadow-sm">
            <Trash2 className="size-3.5" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </li>
  );
}

/** Drag & drop upload zone with sortable thumbnails (first = cover). */
export function FileUpload({ items, onFiles, onReorder, onRemove, accept = 'image/*', multiple = true, label = 'ფოტოების ატვირთვა', hint = 'ჩააგდეთ ფაილები ან აირჩიეთ კომპიუტერიდან. პირველი ფოტო — ყდა.', extra, className }: { items: UploadItem[]; onFiles: (files: File[]) => void; onReorder?: (ids: string[]) => void; onRemove?: (id: string) => void; accept?: string; multiple?: boolean; label?: string; hint?: string; extra?: (item: UploadItem) => React.ReactNode; className?: string }) {
  const [drag, setDrag] = React.useState(false);
  const input = React.useRef<HTMLInputElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = items.findIndex((i) => i.id === e.active.id);
    const to = items.findIndex((i) => i.id === e.over!.id);
    onReorder?.(arrayMove(items, from, to).map((i) => i.id));
  };
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const files = [...e.dataTransfer.files];
          if (files.length) onFiles(files);
        }}
        className={cn('drawing-grid flex flex-col items-center justify-center gap-3 rounded-card border-2 border-dashed px-6 py-10 text-center transition-all duration-200', drag ? 'scale-[1.01] border-primary bg-primary-soft' : 'border-border-strong hover:border-primary/50')}
      >
        <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-soft-text shadow-xs" aria-hidden>
          <ImagePlus className="size-6" strokeWidth={2} />
        </span>
        <button type="button" onClick={() => input.current?.click()} className="inline-flex h-11 items-center rounded-button bg-primary px-5 text-[15px] font-semibold text-primary-contrast shadow-sm transition-all hover:bg-primary-hover hover:shadow-md focus-visible:shadow-ring focus-visible:outline-none">
          {label}
        </button>
        <p className="max-w-md text-small text-muted">{hint}</p>
        <input
          ref={input}
          type="file"
          accept={accept}
          multiple={multiple}
          className="sr-only"
          tabIndex={-1}
          aria-label={label}
          onChange={(e) => {
            const files = [...(e.target.files ?? [])];
            if (files.length) onFiles(files);
            e.target.value = '';
          }}
        />
      </div>
      {items.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {items.map((it, i) => (
                <Tile key={it.id} item={it} index={i} onRemove={onRemove} extra={extra} />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
