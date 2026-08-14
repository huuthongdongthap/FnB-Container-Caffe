/**
 * StitchKDSNew — Chrome-style action button
 *
 * Matches original .btn-chrome class:
 *  - Background: linear-gradient(135deg, #E2E8F0 0%, #94A3B8 50%, #475569 100%)
 *  - Color: #2c1700
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
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full rounded-lg py-4',
        'text-[12px] leading-none tracking-[0.1em] font-black uppercase',
        'btn-chrome',
        'transition-all duration-100',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'text-[#2c1700]',
        'bg-gradient-to-br from-[#E2E8F0] via-[#94A3B8] to-[#475569]',
        className,
      )}
      style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.3)' }}
      aria-label={typeof children === 'string' ? children : undefined}
    >
      {children}
    </button>
  );
}
