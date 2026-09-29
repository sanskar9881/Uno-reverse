import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-card-yellow text-night shadow-[0_4px_0_var(--color-shadow-yellow)] hover:brightness-105 active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-shadow-yellow)]',
  secondary:
    'bg-veil/10 text-ink shadow-[0_4px_0_rgb(0_0_0/0.35)] hover:bg-veil/15 active:translate-y-[3px] active:shadow-[0_1px_0_rgb(0_0_0/0.35)]',
  ghost: 'bg-transparent text-muted hover:text-ink hover:bg-veil/5',
  danger:
    'bg-card-red text-white shadow-[0_4px_0_var(--color-shadow-red)] hover:brightness-105 active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-shadow-red)]',
};

const SIZES = {
  sm: 'h-9 px-3.5 text-sm rounded-xl',
  md: 'h-11 px-5 text-base rounded-2xl',
  lg: 'h-14 px-7 text-lg rounded-2xl',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: keyof typeof SIZES;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  loading,
  icon,
  disabled,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 font-bold transition-[transform,filter,background-color,box-shadow] duration-100 disabled:opacity-45 disabled:shadow-none disabled:active:translate-y-0',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}
