'use client';

/* ─── Loading skeleton ─── */

export function PeriodComparisonSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-36 bg-[var(--aura-noir-bright)] rounded animate-shimmer" />
        <div className="h-5 w-16 bg-[var(--aura-noir-bright)] rounded animate-shimmer" />
      </div>
      <div className="h-44 flex items-end gap-1">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-[var(--aura-noir-bright)] rounded-t animate-shimmer"
            style={{
              height: `${Math.max(15, Math.random() * 80 + 15)}%`,
              animationDelay: `${i * 0.05}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Error state ─── */

export function PeriodComparisonError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-6">
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <svg className="w-10 h-10 text-[var(--aura-danger)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="text-sm text-[var(--aura-text-body)] mb-3">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full
              border border-[var(--aura-chrome-light)] text-[var(--aura-chrome-light)]
              hover:bg-[rgba(201,214,223,0.08)] transition-all duration-300"
          >
            Thu lai
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Empty state ─── */

export function PeriodComparisonEmpty() {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-6">
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <svg className="w-10 h-10 text-[var(--aura-text-muted)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
        <p className="text-sm text-[var(--aura-text-muted)]">Chua co du lieu so sanh</p>
      </div>
    </div>
  );
}
