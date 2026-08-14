/**
 * StitchKDSNew — Loading skeleton state
 *
 * Animated placeholder grid displayed while ticket data is being fetched.
 */

'use client';

export function LoadingState() {
  return (
    <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="min-h-[400px] animate-pulse rounded-lg bg-[var(--aura-surface-container)]/40"
          aria-label="Loading ticket"
        >
          <div className="h-1 w-full rounded-t-lg bg-[var(--aura-chrome-soft)]/20" />
          <div className="space-y-4 p-6">
            <div className="flex justify-between">
              <div className="space-y-2">
                <div className="h-5 w-16 rounded bg-[#273647]" />
                <div className="h-3 w-24 rounded bg-[#273647]" />
              </div>
              <div className="space-y-2">
                <div className="h-8 w-16 rounded bg-[#273647]" />
                <div className="h-3 w-12 rounded bg-[#273647]" />
              </div>
            </div>
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="flex gap-4">
                <div className="h-5 w-8 shrink-0 rounded bg-[#273647]" />
                <div className="h-5 w-32 rounded bg-[#273647]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
