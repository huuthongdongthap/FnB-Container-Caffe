/**
 * Loading skeleton placeholder for the referral page.
 * Shown when data is being fetched.
 */

export function ReferralSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--aura-bg-page, var(--aura-bg-surface))]">
      <div className="mx-auto max-w-[600px] px-5 pt-20 pb-32">
        {/* Hero skeleton */}
        <div className="mb-8 rounded-xl bg-[var(--aura-noir-deep,#0A1A2E)]/60 p-6 text-center backdrop-blur-[8px]">
          <div className="mx-auto mb-4 h-3 w-28 animate-pulse rounded bg-[var(--aura-noir-deep,#0A1A2E)]" />
          <div className="mx-auto mb-2 h-6 w-36 animate-pulse rounded bg-[var(--aura-noir-deep,#0A1A2E)]" />
          <div className="mx-auto mb-4 h-16 w-40 animate-pulse rounded bg-[var(--aura-noir-deep,#0A1A2E)]" />
          <div className="mx-auto h-3 w-56 animate-pulse rounded bg-[var(--aura-noir-deep,#0A1A2E)]" />
        </div>

        {/* Code skeleton */}
        <div className="mb-8 space-y-3">
          <div className="h-14 animate-pulse rounded-lg bg-[var(--aura-noir-deep,#0A1A2E)]" />
          <div className="flex gap-3">
            <div className="h-12 flex-1 animate-pulse rounded-lg bg-[var(--aura-noir-deep,#0A1A2E)]" />
            <div className="h-12 flex-1 animate-pulse rounded-lg bg-[var(--aura-noir-deep,#0A1A2E)]" />
            <div className="h-12 flex-1 animate-pulse rounded-lg bg-[var(--aura-noir-deep,#0A1A2E)]" />
          </div>
        </div>

        {/* Progress skeleton */}
        <div className="mb-8 space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-[var(--aura-noir-deep,#0A1A2E)]" />
          <div className="h-2 w-full animate-pulse rounded-full bg-[var(--aura-noir-deep,#0A1A2E)]" />
        </div>

        {/* Member tier skeleton */}
        <div className="mb-8 rounded-xl bg-[var(--aura-noir-deep,#0A1A2E)]/60 p-4 backdrop-blur-[8px]">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 animate-pulse rounded bg-[var(--aura-noir-deep,#0A1A2E)]" />
            <div className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-[var(--aura-noir-deep,#0A1A2E)]" />
              <div className="h-3 w-32 animate-pulse rounded bg-[var(--aura-noir-deep,#0A1A2E)]" />
            </div>
          </div>
        </div>

        {/* List skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-[var(--aura-noir-deep,#0A1A2E)] p-3">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-[var(--aura-noir-deep,#0A1A2E)]" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-24 animate-pulse rounded bg-[var(--aura-noir-deep,#0A1A2E)]" />
                <div className="h-3 w-32 animate-pulse rounded bg-[var(--aura-noir-deep,#0A1A2E)]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
