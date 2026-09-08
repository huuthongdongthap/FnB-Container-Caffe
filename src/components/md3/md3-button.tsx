import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface MD3ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'filled' | 'outlined' | 'text' | 'elevated' | 'tonal';
  size?: 'default' | 'compact';
  startIcon?: ReactNode;
  endIcon?: ReactNode;
}

const variantClasses: Record<NonNullable<MD3ButtonProps['variant']>, string> = {
  filled:
    'bg-md-primary text-md-on-primary hover:shadow-[inset_0_0_0_0_rgba(255,255,255,0)] active:bg-md-primary/88',
  outlined:
    'bg-transparent text-md-primary border border-md-outline hover:bg-md-primary/8 active:bg-md-primary/12',
  text: 'bg-transparent text-md-primary hover:bg-md-primary/8 active:bg-md-primary/12',
  elevated:
    'bg-md-surface-container-low text-md-primary shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_1px_3px_1px_rgba(0,0,0,0.15)] hover:shadow-[0px_1px_2px_rgba(0,0,0,0.3),0px_2px_6px_2px_rgba(0,0,0,0.15)] active:bg-md-primary/12',
  tonal:
    'bg-md-secondary-container text-md-on-secondary-container hover:shadow-[inset_0_0_0_0] active:bg-md-secondary-container/88',
};

const sizeClasses: Record<NonNullable<MD3ButtonProps['size']>, string> = {
  default: 'h-10 px-6',
  compact: 'h-8 px-4',
};

/**
 * Material Design 3 Button component.
 * Supports five variants: filled, outlined, text, elevated, tonal.
 * Height 40px default, rounded-full, label-large typography.
 */
export const MD3Button = forwardRef<HTMLButtonElement, MD3ButtonProps>(
  function MD3Button(
    {
      variant = 'filled',
      size = 'default',
      startIcon,
      endIcon,
      className,
      children,
      disabled,
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          // Base styles — label-large (14px, weight 500, tracking 0.1px)
          'inline-flex items-center justify-center gap-2',
          'rounded-md-full text-sm font-medium tracking-[0.1px] leading-[1.43]',
          'select-none whitespace-nowrap',
          'transition-colors duration-[var(--md-sys-motion-duration-short4)] ease-[var(--md-sys-motion-easing-standard)]',
          // Touch target: min 48px hit area via py padding
          'min-h-[48px]',
          // Focus visible ring
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-md-primary',
          // State layers — hover 8%, active 12% via pseudo overlay
          'relative overflow-hidden',
          variantClasses[variant],
          sizeClasses[size],
          disabled && 'pointer-events-none opacity-38',
          className,
        )}
        {...rest}
      >
        {startIcon && (
          <span className="inline-flex shrink-0 [&>svg]:h-5 [&>svg]:w-5">
            {startIcon}
          </span>
        )}
        {children}
        {endIcon && (
          <span className="inline-flex shrink-0 [&>svg]:h-5 [&>svg]:w-5">
            {endIcon}
          </span>
        )}
      </button>
    );
  },
);
