'use client';

/**
 * Loading skeleton for StitchAbout page.
 */
export function AboutSkeleton() {
  return (
    <div className="min-h-screen pt-16" style={{ backgroundColor: 'var(--aura-bg-page, #0A1A2E)' }}>
      <div className="mx-auto max-w-[1440px] px-[var(--aura-container-padding,24px)]">
        {/* Hero skeleton */}
        <div className="flex min-h-[80vh] flex-col items-center justify-center gap-6">
          <div className="h-4 w-48 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          <div className="h-16 w-3/4 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          <div className="h-0.5 w-24 animate-pulse" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
        </div>

        {/* Story skeleton */}
        <div className="mb-8 space-y-4">
          <div className="h-8 w-48 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          <div className="h-4 w-96 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <div className="col-span-7 h-96 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          <div className="col-span-5 space-y-6">
            <div className="h-48 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
            <div className="h-48 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          </div>
        </div>

        {/* Timeline skeleton */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="my-16 flex items-center gap-8">
            <div className="flex-1 space-y-3">
              <div className="h-4 w-24 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
              <div className="h-6 w-48 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
              <div className="h-3 w-72 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
            </div>
            <div className="h-32 w-48 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--aura-bg-elevated, #162a3d)' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
