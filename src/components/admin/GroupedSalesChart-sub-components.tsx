/* ─── Loading skeleton ─── */

export function GroupedSalesSkeleton({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-5">
      <div className="h-4 w-32 bg-[var(--aura-noir-bright)] rounded animate-shimmer mb-4" />

      {/* Mobile: horizontal bar skeleton */}
      <div className="space-y-3 md:hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 w-20 bg-[var(--aura-noir-bright)] rounded animate-shimmer shrink-0" />
            <div className="flex-1 h-5 bg-[var(--aura-noir-bright)] rounded animate-shimmer" />
            <div className="h-3 w-16 bg-[var(--aura-noir-bright)] rounded animate-shimmer shrink-0" />
          </div>
        ))}
      </div>

      {/* Desktop: vertical bar skeleton */}
      <div className="hidden md:flex items-end gap-2 h-40">
        {[40, 70, 90, 55, 30].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-[var(--aura-noir-bright)] rounded-t animate-shimmer"
              style={{ height: `${h}%` }}
            />
            <div className="h-3 w-full bg-[var(--aura-noir-bright)] rounded animate-shimmer mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Error state ─── */

export function GroupedSalesError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-5">
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <svg
          className="w-8 h-8 text-[var(--aura-danger)] mb-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
        <p className="text-xs text-[var(--aura-text-body)] mb-3">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full
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

export function GroupedSalesEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-5">
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <svg
          className="w-8 h-8 text-[var(--aura-text-muted)] mb-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
          />
        </svg>
        <p className="text-sm text-[var(--aura-text-muted)]">{message}</p>
      </div>
    </div>
  );
}
