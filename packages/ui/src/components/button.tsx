import * as React from 'react';
import { Slot } from 'radix-ui';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-contrast shadow-sm hover:bg-primary-hover hover:shadow-md active:translate-y-px',
  secondary: 'bg-surface text-text border border-border shadow-xs hover:border-border-strong hover:bg-surface-2 active:translate-y-px',
  ghost: 'bg-transparent text-text hover:bg-surface-2',
  danger: 'bg-transparent text-danger border border-danger/40 hover:bg-danger/10',
  link: 'bg-transparent text-link underline-offset-4 hover:underline px-0',
  accent: 'bg-accent text-accent-contrast shadow-sm hover:brightness-105 hover:shadow-md active:translate-y-px',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-[14px] gap-1.5',
  md: 'h-11 px-5 text-[15px] gap-2',
  lg: 'h-13 px-7 text-[16px] gap-2.5',
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  asChild?: boolean;
  icon?: React.ReactNode;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, asChild, icon, className, children, disabled, type, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? 'button')}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-button font-semibold transition-all duration-200 ease-out disabled:pointer-events-none disabled:opacity-50 select-none focus-visible:outline-none focus-visible:shadow-ring',
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Loader2 className="size-4 animate-spin" strokeWidth={1.5} aria-hidden /> : icon}
          {children}
        </>
      )}
    </Comp>
  );
});

export type IconButtonProps = Omit<ButtonProps, 'icon' | 'children'> & { label: string; children: React.ReactNode };

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, size = 'md', className, variant = 'ghost', ...props }, ref) {
  const dim = size === 'sm' ? 'size-9' : size === 'lg' ? 'size-13' : 'size-11';
  return <Button ref={ref} variant={variant} aria-label={label} title={label} className={cn(dim, 'px-0', className)} size={size} {...props} />;
});
