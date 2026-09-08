'use client';

/**
 * Loading skeleton for StitchContainerNew1.
 */
export function ContainerCafeSkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--aura-noir-void, #050D1A)' }}>
      {/* Nav skeleton */}
      <div
        className="fixed top-0 z-50 w-full"
        style={{ backgroundColor: 'rgba(12, 32, 56, 0.6)', backdropFilter: 'blur(12px)' }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between px-8 py-6">
          <div className="h-6 w-32 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest, #2A3548)' }} />
          <div className="hidden gap-12 md:flex">
            <div className="h-4 w-12 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest, #2A3548)' }} />
            <div className="h-4 w-14 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest, #2A3548)' }} />
            <div className="h-4 w-16 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest, #2A3548)' }} />
          </div>
          <div className="h-10 w-28 animate-pulse rounded-full" style={{ backgroundColor: 'var(--st-surface-container-highest, #2A3548)' }} />
        </div>
      </div>

      {/* Hero skeleton */}
      <div className="flex min-h-screen items-center justify-center px-8 pt-20">
        <div className="mx-auto max-w-4xl space-y-6 text-center">
          <div className="mx-auto h-4 w-40 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest, #2A3548)' }} />
          <div className="mx-auto h-16 w-3/4 animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest, #2A3548)' }} />
          <div className="mx-auto h-4 w-full max-w-xl animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest, #2A3548)' }} />
          <div className="mx-auto h-4 w-3/4 max-w-md animate-pulse rounded" style={{ backgroundColor: 'var(--st-surface-container-highest, #2A3548)' }} />
          <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
            <div className="h-12 w-44 animate-pulse rounded-none" style={{ backgroundColor: 'var(--st-surface-container-highest, #2A3548)' }} />
            <div className="h-12 w-36 animate-pulse rounded-none" style={{ backgroundColor: 'var(--st-surface-container-highest, #2A3548)' }} />
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="mx-auto max-w-[1200px] space-y-20 px-8 pb-20">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <div className="h-96 animate-pulse rounded-xl md:col-span-7" style={{ backgroundColor: 'rgba(var(--aura-noir-deep), 0.6)' }} />
          <div className="flex flex-col gap-6 md:col-span-5">
            <div className="h-40 animate-pulse rounded-xl" style={{ backgroundColor: 'rgba(var(--aura-noir-deep), 0.6)' }} />
            <div className="h-40 animate-pulse rounded-xl" style={{ backgroundColor: 'rgba(var(--aura-noir-deep), 0.6)' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
