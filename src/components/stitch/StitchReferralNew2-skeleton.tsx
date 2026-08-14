/**
 * Loading skeleton placeholder for the referral page.
 * Shown when data is being fetched.
 */

export function ReferralSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--aura-bg-page, #0A1A2E)]">
      <div className="mx-auto max-w-[600px] px-5 pt-20 pb-32">
        {/* Hero skeleton */}
        <div className="mb-8 rounded-xl bg-[#162a3d]/60 p-6 text-center backdrop-blur-xl">
          <div className="mx-auto mb-4 h-3 w-28 animate-pulse rounded bg-[#1e3550]" />
          <div className="mx-auto mb-2 h-6 w-36 animate-pulse rounded bg-[#1e3550]" />
          <div className="mx-auto mb-4 h-16 w-40 animate-pulse rounded bg-[#1e3550]" />
          <div className="mx-auto h-3 w-56 animate-pulse rounded bg-[#1e3550]" />
        </div>

        {/* Code skeleton */}
        <div className="mb-8 space-y-3">
          <div className="h-14 animate-pulse rounded-lg bg-[#162a3d]" />
          <div className="flex gap-3">
            <div className="h-12 flex-1 animate-pulse rounded-lg bg-[#162a3d]" />
            <div className="h-12 flex-1 animate-pulse rounded-lg bg-[#162a3d]" />
            <div className="h-12 flex-1 animate-pulse rounded-lg bg-[#162a3d]" />
          </div>
        </div>

        {/* Progress skeleton */}
        <div className="mb-8 space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-[#162a3d]" />
          <div className="h-2 w-full animate-pulse rounded-full bg-[#162a3d]" />
        </div>

        {/* Member tier skeleton */}
        <div className="mb-8 rounded-xl bg-[#162a3d]/60 p-4 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 animate-pulse rounded bg-[#1e3550]" />
            <div className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-[#1e3550]" />
              <div className="h-3 w-32 animate-pulse rounded bg-[#1e3550]" />
            </div>
          </div>
        </div>

        {/* List skeleton */}
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl bg-[#162a3d] p-3">
              <div className="h-10 w-10 animate-pulse rounded-lg bg-[#1e3550]" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-24 animate-pulse rounded bg-[#1e3550]" />
                <div className="h-3 w-32 animate-pulse rounded bg-[#1e3550]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
