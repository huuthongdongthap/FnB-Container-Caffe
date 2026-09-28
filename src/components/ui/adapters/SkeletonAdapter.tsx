import { forwardRef, type HTMLAttributes } from 'react';

/**
 * SkeletonAdapter — backward-compatible skeleton loading component.
 * Built using M3-compatible primitives (no md3-skeleton exists).
 * Preserves legacy Skeleton API: variant (text|circular|rectangular).
 */
export type SkeletonVariant = 'text' | 'circular' | 'rectangular';

export interface SkeletonAdapterProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
}

const variantClasses: Record<SkeletonVariant, string> = {
  text: 'h-4 w-full rounded animate-pulse',
  circular: 'rounded-full animate-pulse',
  rectangular: 'rounded-lg animate-pulse',
};

export const Skeleton = forwardRef<HTMLDivElement, SkeletonAdapterProps>(
  function Skeleton({ className, variant = 'text', style, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={`${variantClasses[variant]} bg-[var(--aura-bg-high)]/30 ${className}`}
        style={style}
        aria-hidden="true"
        {...rest}
      />
    );
  },
);

Skeleton.displayName = 'Skeleton';