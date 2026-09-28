import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/**
 * BadgeAdapter — backward-compatible Badge rendering with Material Design 3 tokens.
 * Preserves legacy Badge API: variant (default|success|warning|destructive|info|outline).
 */
export interface BadgeAdapterProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'outline';
}

const variantClasses: Record<NonNullable<BadgeAdapterProps['variant']>, string> = {
  default: 'bg-md-surface-container-low text-md-on-surface border border-md-outline-variant',
  success: 'bg-green-500/15 text-green-400',
  warning: 'bg-yellow-500/15 text-yellow-400',
  destructive: 'bg-red-500/15 text-red-400',
  info: 'bg-blue-500/15 text-blue-400',
  outline: 'border border-current bg-transparent',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeAdapterProps>(
  function Badge({ className, variant = 'default', children, ...rest }, ref) {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-md-full px-2.5 py-0.5 text-xs font-medium font-utility',
          variantClasses[variant],
          className,
        )}
        {...rest}
      >
        {children}
      </span>
    );
  },
);

Badge.displayName = 'Badge';