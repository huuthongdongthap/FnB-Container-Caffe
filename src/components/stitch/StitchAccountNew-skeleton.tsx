/**
 * Loading skeleton for StitchAccountNew.
 * Extracted from StitchAccountNew.tsx to keep individual files under 200 LOC.
 */

'use client';

/* ─── Reusable Glass Card Wrapper ─────────────────────────────── */

function GlassSkeletonCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: 'rgba(255,255,255,0.03)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {children}
    </div>
  );
}

/* ─── Skeleton ────────────────────────────────────────────────── */

export function AccountNewSkeleton() {
  return (
    <div
      className="min-h-screen bg-[var(--aura-bg-page, #0A1A2E)] animate-pulse"
      aria-label="Loading account dashboard"
    >
      <div className="px-5 pt-24 pb-32 max-w-lg mx-auto space-y-6">
        {/* App bar skeleton */}
        <div className="flex items-center justify-between h-16 mb-2">
          <div className="w-8 h-8 rounded-lg bg-[#1e3550]" />
          <div className="w-28 h-5 rounded bg-[#1e3550]" />
          <div className="w-8 h-8 rounded-full bg-[#1e3550]" />
        </div>

        {/* Profile card skeleton */}
        <GlassSkeletonCard>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-[#1e3550]" />
            <div className="space-y-2">
              <div className="w-32 h-5 rounded bg-[#1e3550]" />
              <div className="w-20 h-3 rounded bg-[#1e3550]" />
            </div>
          </div>
        </GlassSkeletonCard>

        {/* Loyalty skeleton */}
        <GlassSkeletonCard>
          <div className="w-full h-2 rounded-full bg-[#1e3550]" />
        </GlassSkeletonCard>

        {/* Quick order skeleton */}
        <div className="h-14 rounded-xl bg-[#1e3550]" />

        {/* Order skeletons */}
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg p-4"
              style={{
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-[#1e3550]" />
                <div className="space-y-2 flex-1">
                  <div className="w-36 h-4 rounded bg-[#1e3550]" />
                  <div className="w-24 h-3 rounded bg-[#1e3550]" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Settings cards skeleton */}
        <div className="grid grid-cols-2 gap-4">
          <GlassSkeletonCard>
            <div className="w-6 h-6 rounded bg-[#1e3550] mb-3" />
            <div className="w-16 h-3 rounded bg-[#1e3550] mb-1" />
            <div className="w-20 h-4 rounded bg-[#1e3550]" />
          </GlassSkeletonCard>
          <GlassSkeletonCard>
            <div className="w-6 h-6 rounded bg-[#1e3550] mb-3" />
            <div className="w-16 h-3 rounded bg-[#1e3550] mb-1" />
            <div className="w-20 h-4 rounded bg-[#1e3550]" />
          </GlassSkeletonCard>
        </div>
      </div>
    </div>
  );
}
