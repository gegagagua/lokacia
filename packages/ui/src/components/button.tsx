import * as React from 'react';
import { Slot } from 'radix-ui';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'link' | 'accent';
export type ButtonSize = 'sm' | 'md' | 'lg';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-contrast hover:bg-primary-hover border border-primary',
  secondary: 'bg-surface text-text border border-border-strong hover:bg-surface-2',
  ghost: 'bg-transparent text-text border border-transparent hover:bg-surface-2',
  danger: 'bg-transparent text-danger border border-danger hover:bg-danger/10',
  link: 'bg-transparent text-link underline-offset-4 hover:underline border border-transparent px-0',
  accent: 'bg-accent text-accent-contrast border border-accent hover:brightness-95',
};
const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-small gap-1.5',
  md: 'h-10 px-4 text-[15px] gap-2',
  lg: 'h-12 px-6 text-body gap-2',
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
        'inline-flex items-center justify-center whitespace-nowrap rounded-button font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 select-none',
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
  const dim = size === 'sm' ? 'size-8' : size === 'lg' ? 'size-12' : 'size-10';
  return <Button ref={ref} variant={variant} aria-label={label} title={label} className={cn(dim, 'px-0', className)} size={size} {...props} />;
});
