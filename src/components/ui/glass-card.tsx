/**
 * GlassCard — Shared glassmorphism card primitive.
 *
 * Replaces 200+ hand-written `backdrop-filter: blur(20px)` divs across Stitch
 * components with a single, consistent primitive.
 *
 * Design token: --aura-surface-dim / --aura-chrome-soft (see src/theme/aura-tokens.ts)
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type GlassVariant = 'default' | 'dim' | 'bright' | 'bronze';

const variantStyles: Record<GlassVariant, string> = {
  default: 'bg-[var(--aura-surface-dim)]/60 backdrop-blur-xl border border-[var(--aura-chrome-soft)]/15',
  dim: 'bg-[var(--aura-surface-dim)]/80 backdrop-blur-2xl border border-[var(--aura-chrome-soft)]/20',
  bright: 'bg-[var(--aura-chrome-bright)]/10 backdrop-blur-xl border border-[var(--aura-chrome-bright)]/25',
  bronze: 'bg-[var(--aura-bronze-shimmer)]/10 backdrop-blur-xl border border-[var(--aura-bronze-shimmer)]/20',
};

export interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  children?: ReactNode;
  glow?: boolean;
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ className, variant = 'default', glow = false, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl transition-all duration-300',
          variantStyles[variant],
          glow && 'shadow-[0_0_24px_-4px_var(--aura-bronze-shimmer)] hover:shadow-[0_0_32px_-4px_var(--aura-bronze-shimmer)]',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

GlassCard.displayName = 'GlassCard';