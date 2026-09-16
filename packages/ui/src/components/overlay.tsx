'use client';
import * as React from 'react';
import { Dialog as RDialog, Popover as RPopover, Tooltip as RTooltip, Tabs as RTabs, Toast as RToast } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '../lib/cn';

export function Dialog({ open, onOpenChange, title, description, children, footer, trigger, className, size = 'md' }: { open?: boolean; onOpenChange?: (o: boolean) => void; title: React.ReactNode; description?: React.ReactNode; children?: React.ReactNode; footer?: React.ReactNode; trigger?: React.ReactNode; className?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const w = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)]" />
        <RDialog.Content className={cn('fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-modal border border-border bg-surface text-text focus:outline-none', w, className)}>
          <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
            <div>
              <RDialog.Title className="text-h3 font-semibold">{title}</RDialog.Title>
              {description ? <RDialog.Description className="mt-1 text-small text-muted">{description}</RDialog.Description> : <RDialog.Description className="sr-only">{typeof title === 'string' ? title : ''}</RDialog.Description>}
            </div>
            <RDialog.Close className="grid size-8 place-items-center rounded-button text-muted hover:bg-surface-2" aria-label="დახურვა">
              <X className="size-4" strokeWidth={1.5} />
            </RDialog.Close>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-border px-6 py-4">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

export function Drawer({ open, onOpenChange, title, children, side = 'right', trigger, footer, className }: { open?: boolean; onOpenChange?: (o: boolean) => void; title: React.ReactNode; children?: React.ReactNode; side?: 'right' | 'left' | 'bottom'; trigger?: React.ReactNode; footer?: React.ReactNode; className?: string }) {
  const pos = { right: 'right-0 top-0 h-dvh w-full max-w-md border-l', left: 'left-0 top-0 h-dvh w-full max-w-md border-r', bottom: 'bottom-0 left-0 max-h-[85dvh] w-full rounded-t-modal border-t' }[side];
  return (
    <RDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RDialog.Trigger asChild>{trigger}</RDialog.Trigger>}
      <RDialog.Portal>
        <RDialog.Overlay className="fixed inset-0 z-50 bg-[var(--overlay)]" />
        <RDialog.Content className={cn('fixed z-50 flex flex-col border-border bg-surface text-text focus:outline-none', pos, className)}>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <RDialog.Title className="text-h3 font-semibold">{title}</RDialog.Title>
            <RDialog.Description className="sr-only">{typeof title === 'string' ? title : ''}</RDialog.Description>
            <RDialog.Close className="grid size-8 place-items-center rounded-button text-muted hover:bg-surface-2" aria-label="დახურვა">
              <X className="size-4" strokeWidth={1.5} />
            </RDialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="border-t border-border px-5 py-3">{footer}</div>}
        </RDialog.Content>
      </RDialog.Portal>
    </RDialog.Root>
  );
}

export function Popover({ trigger, children, align = 'start', className, open, onOpenChange }: { trigger: React.ReactNode; children: React.ReactNode; align?: 'start' | 'center' | 'end'; className?: string; open?: boolean; onOpenChange?: (o: boolean) => void }) {
  return (
    <RPopover.Root open={open} onOpenChange={onOpenChange}>
      <RPopover.Trigger asChild>{trigger}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content align={align} sideOffset={6} className={cn('z-50 min-w-56 rounded-card border border-border bg-surface p-3 text-text focus:outline-none', className)}>
          {children}
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

export function Tooltip({ content, children, side = 'top' }: { content: React.ReactNode; children: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <RTooltip.Provider delayDuration={250}>
      <RTooltip.Root>
        <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
        <RTooltip.Portal>
          <RTooltip.Content side={side} sideOffset={6} className="z-50 max-w-xs rounded-[6px] bg-basalt px-2.5 py-1.5 text-small text-plaster">
            {content}
            <RTooltip.Arrow className="fill-basalt" />
          </RTooltip.Content>
        </RTooltip.Portal>
      </RTooltip.Root>
    </RTooltip.Provider>
  );
}

export function Tabs({ tabs, value, defaultValue, onValueChange, className, listClassName }: { tabs: { value: string; label: React.ReactNode; content: React.ReactNode; count?: number }[]; value?: string; defaultValue?: string; onValueChange?: (v: string) => void; className?: string; listClassName?: string }) {
  return (
    <RTabs.Root value={value} defaultValue={defaultValue ?? tabs[0]?.value} onValueChange={onValueChange} className={className}>
      <RTabs.List className={cn('flex gap-1 overflow-x-auto border-b border-border', listClassName)}>
        {tabs.map((t) => (
          <RTabs.Trigger key={t.value} value={t.value} className="-mb-px flex h-10 items-center gap-2 whitespace-nowrap border-b-2 border-transparent px-3 text-[15px] text-muted transition-colors hover:text-text data-[state=active]:border-primary data-[state=active]:text-text">
            {t.label}
            {t.count !== undefined && <span className="rounded-full bg-surface-2 px-1.5 text-[11px] tabular text-muted">{t.count}</span>}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {tabs.map((t) => (
        <RTabs.Content key={t.value} value={t.value} className="pt-5 focus:outline-none">
          {t.content}
        </RTabs.Content>
      ))}
    </RTabs.Root>
  );
}

/* ---------- Toasts ---------- */
type ToastItem = { id: number; title: string; description?: string; tone?: 'default' | 'success' | 'danger' };
const ToastCtx = React.createContext<(t: Omit<ToastItem, 'id'>) => void>(() => undefined);
export const useToast = () => React.useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const push = React.useCallback((t: Omit<ToastItem, 'id'>) => setItems((s) => [...s, { ...t, id: Date.now() + Math.random() }]), []);
  return (
    <ToastCtx.Provider value={push}>
      <RToast.Provider swipeDirection="right" duration={4500}>
        {children}
        {items.map((t) => (
          <RToast.Root
            key={t.id}
            onOpenChange={(o) => !o && setItems((s) => s.filter((x) => x.id !== t.id))}
            className={cn('flex flex-col gap-1 rounded-card border bg-surface px-4 py-3 text-text', t.tone === 'danger' ? 'border-danger' : t.tone === 'success' ? 'border-success' : 'border-border-strong')}
          >
            <RToast.Title className="font-medium">{t.title}</RToast.Title>
            {t.description && <RToast.Description className="text-small text-muted">{t.description}</RToast.Description>}
          </RToast.Root>
        ))}
        <RToast.Viewport className="fixed bottom-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-2 outline-none" />
      </RToast.Provider>
    </ToastCtx.Provider>
  );
}
