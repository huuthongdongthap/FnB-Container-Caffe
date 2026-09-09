/**
 * StitchKDSNew — Chrome-style action button
 *
 * Matches original .btn-chrome class:
 *  - Background: linear-gradient(135deg, var(--aura-chrome-bright) 0%, var(--aura-text-secondary) 50%, var(--aura-text-muted) 100%)
 *  - Color: var(--aura-noir-void)
 *  - Box shadow: 0 4px 0 rgba(0,0,0,0.3)
 *  - Active: translateY(2px), scale(0.98)
 */

'use client';

import { cn } from '@/lib/cn';

export function ActionButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full rounded-lg py-4',
        'text-[12px] leading-none tracking-[0.1em] font-black uppercase',
        'btn-chrome',
        'transition-all duration-100',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'text-[var(--aura-noir-void,#2c1700)]',
        'bg-gradient-to-br from-[var(--aura-chrome-bright,#E2E8F0)] via-[var(--aura-text-secondary,#94A3B8)] to-[var(--aura-text-muted,#475569)]',
        className,
      )}
      style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.3)' }}
      aria-label={typeof children === 'string' ? children : undefined}
    >
      {children}
    </button>
  );
}
