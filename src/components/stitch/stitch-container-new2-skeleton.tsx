/**
 * Loading skeleton for StitchContainerNew2.
 * Pulse-animated placeholder matching the page layout.
 */
'use client';

import { COLORS } from './stitch-container-new2-types';

export function ContainerCafeNew2Skeleton() {
  return (
    <div className="min-h-screen overflow-x-hidden" style={{ backgroundColor: COLORS.background }}>
      {/* Nav skeleton */}
      <nav
        className="fixed top-0 z-50 flex w-full items-center justify-between px-5 py-6 md:px-[64px]"
        style={{
          backgroundColor: 'color-mix(in srgb, var(--aura-surface-dim) 80%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid color-mix(in srgb, var(--aura-chrome-dim) 20%, transparent)',
        }}
      >
        <div className="h-8 w-36 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
        <div className="hidden items-center space-x-8 md:flex">
          <div className="h-4 w-12 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
          <div className="h-4 w-14 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
          <div className="h-4 w-16 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
        </div>
        <div className="h-10 w-28 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
      </nav>

      {/* Hero skeleton */}
      <section className="flex h-[921px] items-center px-5 pt-24 md:px-[64px]">
        <div className="w-full max-w-3xl space-y-8">
          <div className="h-4 w-48 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
          <div className="h-16 w-3/4 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
          <div className="h-12 w-1/2 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
          <div className="h-5 w-full max-w-xl animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
          <div className="flex flex-wrap gap-4">
            <div className="h-14 w-40 animate-pulse" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
            <div className="h-14 w-40 animate-pulse" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
          </div>
        </div>
      </section>

      {/* Content skeletons */}
      <div className="mx-auto max-w-[1280px] space-y-20 px-5 pb-20 md:px-[64px]">
        <div className="space-y-4">
          <div className="h-8 w-64 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
          <div className="h-px w-24 animate-pulse" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--aura-surface-container) 60%, transparent)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
