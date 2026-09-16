import * as React from 'react';
import { Checkbox as RCheckbox, RadioGroup as RRadio, Switch as RSwitch, Slider as RSlider, Label as RLabel } from 'radix-ui';
import { Check } from 'lucide-react';
import { cn } from '../lib/cn';

const field =
  'w-full rounded-button border border-border-strong bg-surface text-text placeholder:text-muted/80 transition-colors duration-150 focus:border-focus focus:outline-none focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-60 aria-[invalid=true]:border-danger';

export const Label = ({ className, ...p }: React.ComponentProps<typeof RLabel.Root>) => (
  <RLabel.Root className={cn('text-small font-medium text-text', className)} {...p} />
);

export type FieldProps = { label?: React.ReactNode; hint?: React.ReactNode; error?: React.ReactNode; required?: boolean; children: React.ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>; className?: string };

/** Label + control + hint/error with correct aria wiring. */
export function Field({ label, hint, error, required, children, className }: FieldProps) {
  const auto = React.useId();
  const id = children.props.id ?? auto;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label && (
        <Label htmlFor={id}>
          {label}
          {required && <span className="text-danger" aria-hidden> *</span>}
        </Label>
      )}
      {React.cloneElement(children, { id, 'aria-invalid': !!error || undefined, 'aria-describedby': describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-small text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-small text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & { suffix?: React.ReactNode; prefixIcon?: React.ReactNode };
export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input({ className, suffix, prefixIcon, ...props }, ref) {
  if (!suffix && !prefixIcon) return <input ref={ref} className={cn(field, 'h-10 px-3', className)} {...props} />;
  return (
    <div className={cn('relative flex items-center', className)}>
      {prefixIcon && <span className="pointer-events-none absolute left-3 text-muted">{prefixIcon}</span>}
      <input ref={ref} className={cn(field, 'h-10', prefixIcon ? 'pl-14' : 'pl-3', suffix ? 'pr-12' : 'pr-3')} {...props} />
      {suffix && <span className="pointer-events-none absolute right-3 text-small text-muted tabular">{suffix}</span>}
    </div>
  );
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(field, 'min-h-24 px-3 py-2 leading-relaxed', className)} {...props} />;
});

export type SelectOption = { value: string; label: string; disabled?: boolean };
export type SelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'children'> & { options: SelectOption[]; placeholder?: string };

/** Native select: best accessibility and mobile UX. */
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, options, placeholder, ...props }, ref) {
  return (
    <select ref={ref} className={cn(field, 'h-10 appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pl-3 pr-9', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238A968F' stroke-width='1.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
});

export const Checkbox = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof RCheckbox.Root> & { label?: React.ReactNode }>(function Checkbox({ className, label, id, ...props }, ref) {
  const auto = React.useId();
  const cid = id ?? auto;
  const box = (
    <RCheckbox.Root
      ref={ref}
      id={cid}
      className={cn('grid size-5 shrink-0 place-items-center rounded-[4px] border border-border-strong bg-surface data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-contrast', className)}
      {...props}
    >
      <RCheckbox.Indicator>
        <Check className="size-3.5" strokeWidth={2} aria-hidden />
      </RCheckbox.Indicator>
    </RCheckbox.Root>
  );
  if (!label) return box;
  return (
    <div className="flex items-center gap-2.5">
      {box}
      <label htmlFor={cid} className="cursor-pointer text-[15px] leading-snug">
        {label}
      </label>
    </div>
  );
});

export function RadioGroup({ options, className, ...props }: React.ComponentProps<typeof RRadio.Root> & { options: SelectOption[] }) {
  const base = React.useId();
  return (
    <RRadio.Root className={cn('flex flex-col gap-2', className)} {...props}>
      {options.map((o) => (
        <div key={o.value} className="flex items-center gap-2.5">
          <RRadio.Item id={`${base}-${o.value}`} value={o.value} disabled={o.disabled} className="grid size-5 place-items-center rounded-full border border-border-strong bg-surface data-[state=checked]:border-primary">
            <RRadio.Indicator className="size-2.5 rounded-full bg-primary" />
          </RRadio.Item>
          <label htmlFor={`${base}-${o.value}`} className="cursor-pointer text-[15px]">
            {o.label}
          </label>
        </div>
      ))}
    </RRadio.Root>
  );
}

export const Switch = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof RSwitch.Root> & { label?: React.ReactNode }>(function Switch({ className, label, id, ...props }, ref) {
  const auto = React.useId();
  const sid = id ?? auto;
  const sw = (
    <RSwitch.Root ref={ref} id={sid} className={cn('relative h-6 w-10 shrink-0 rounded-full border border-border-strong bg-surface-2 transition-colors duration-150 data-[state=checked]:border-primary data-[state=checked]:bg-primary', className)} {...props}>
      <RSwitch.Thumb className="block size-4.5 translate-x-0.5 rounded-full bg-surface shadow-none ring-1 ring-border-strong transition-transform duration-150 data-[state=checked]:translate-x-[18px] data-[state=checked]:ring-primary" />
    </RSwitch.Root>
  );
  if (!label) return sw;
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={sid} className="cursor-pointer text-[15px]">
        {label}
      </label>
      {sw}
    </div>
  );
});

export function Slider({ className, formatValue, ...props }: React.ComponentProps<typeof RSlider.Root> & { formatValue?: (v: number) => string }) {
  const values = props.value ?? props.defaultValue ?? [0];
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <RSlider.Root className="relative flex h-5 touch-none select-none items-center" {...props}>
        <RSlider.Track className="relative h-[2px] grow bg-border-strong">
          <RSlider.Range className="absolute h-full bg-primary" />
        </RSlider.Track>
        {values.map((_, i) => (
          <RSlider.Thumb key={i} className="block size-4 rounded-full border-2 border-primary bg-surface focus-visible:outline-2 focus-visible:outline-focus" aria-label={i === 0 ? 'მინიმუმი' : 'მაქსიმუმი'} />
        ))}
      </RSlider.Root>
      {formatValue && (
        <div className="flex justify-between text-small text-muted tabular">
          {values.map((v, i) => (
            <span key={i}>{formatValue(v)}</span>
          ))}
        </div>
      )}
    </div>
  );
}
