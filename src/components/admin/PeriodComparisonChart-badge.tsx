'use client';

import { cn } from '@/lib/cn';

export function ChangeBadge({ value }: { value: number }) {
  const isUp = value >= 0;
  const absValue = Math.abs(value);
  const label = `${isUp ? '+' : '-'}${absValue.toFixed(1)}%`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full',
        isUp
          ? 'text-green-400 bg-green-400/10'
          : 'text-red-400 bg-red-400/10',
      )}
    >
      {isUp ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      )}
      {label}
    </span>
  );
}
