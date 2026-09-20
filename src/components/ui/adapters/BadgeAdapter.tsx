import { forwardRef, type HTMLAttributes } from 'react';
import { MD3Chip, type MD3ChipProps } from '@/components/md3/md3-chip';

/**
 * BadgeAdapter — backward-compatible wrapper around MD3Chip.
 * Preserves legacy Badge API: variant (default|success|warning|destructive|info|outline).
 */
export interface BadgeAdapterProps extends HTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info' | 'outline';
}

const variantMap: Record<NonNullable<BadgeAdapterProps['variant']>, MD3ChipProps['variant']> = {
  default: 'suggestion',
  success: 'assist',
  warning: 'filter',
  destructive: 'filter',
  info: 'assist',
  outline: 'filter',
};

const variantClasses: Record<NonNullable<BadgeAdapterProps['variant']>, string> = {
  default: 'bg-md-surface-container-low text-md-on-surface border border-md-outline-variant',
  success: 'bg-green-500/15 text-green-400',
  warning: 'bg-yellow-500/15 text-yellow-400',
  destructive: 'bg-red-500/15 text-red-400',
  info: 'bg-blue-500/15 text-blue-400',
  outline: 'border border-current bg-transparent',
};

export const Badge = forwardRef<HTMLButtonElement, BadgeAdapterProps>(
  function Badge({ className, variant = 'default', children, ...rest }, ref) {
    const md3Variant = variantMap[variant];

    return (
      <MD3Chip
        ref={ref}
        variant={md3Variant}
        elevated={variant === 'outline'}
        className={`${variantClasses[variant] ?? ''} ${className}`}
        {...rest}
      >
        {children}
      </MD3Chip>
    );
  },
);

Badge.displayName = 'Badge';