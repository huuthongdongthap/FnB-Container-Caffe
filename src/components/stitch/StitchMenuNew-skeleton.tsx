'use client';

import { useTranslation } from 'react-i18next';

/**
 * StitchMenuNewSkeleton — Dedicated loading skeleton for the AURA CAFE digital menu.
 * Matches StitchMenuNew visual hierarchy with zero Cumulative Layout Shift (CLS).
 */
export function StitchMenuNewSkeleton() {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={t('stitch.menuLoading', 'Đang tải thực đơn AURA CAFE...')}
      className="relative min-h-screen bg-[var(--aura-surface-dim)] text-[var(--aura-chrome-bright)] overflow-x-hidden"
    >
      <main className="min-h-screen pt-28 pb-40">
        <div className="mx-auto max-w-7xl px-6">
          {/* Header Skeleton */}
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between animate-pulse">
            <div className="space-y-3">
              <div className="h-10 w-64 sm:w-80 rounded-lg bg-white/15" />
              <div className="h-4 w-full max-w-md rounded bg-white/10" />
              <div className="h-4 w-3/4 max-w-sm rounded bg-white/5" />
            </div>

            {/* Search bar placeholder */}
            <div className="h-12 w-full md:w-80 rounded-xl bg-white/10" />
          </div>

          {/* Category Filter Pills Skeleton */}
          <div className="mb-8 flex gap-3 overflow-x-hidden pb-4">
            {[100, 140, 110, 95, 120, 130].map((width, i) => (
              <div
                key={i}
                style={{ width: `${width}px` }}
                className="h-11 rounded-full bg-white/10 shrink-0 animate-pulse border border-white/5"
              />
            ))}
          </div>

          {/* Favorites Filter Skeleton */}
          <div className="mb-6 flex items-center">
            <div className="h-11 w-36 rounded-full bg-white/10 animate-pulse border border-white/5" />
          </div>

          {/* Menu Cards Grid Skeleton (8 cards matching standard desktop view) */}
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((cardId) => (
              <div
                key={cardId}
                className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-[8px] animate-pulse shadow-lg"
              >
                {/* Image Placeholder */}
                <div className="relative h-64 w-full bg-white/10">
                  <div className="absolute right-4 top-4 h-7 w-20 rounded bg-white/20" />
                </div>

                {/* Card Content Placeholder */}
                <div className="flex grow flex-col p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="h-6 w-3/4 rounded bg-white/15" />
                    <div className="h-6 w-6 rounded-full bg-white/10" />
                  </div>
                  <div className="h-4 w-full rounded bg-white/10" />
                  <div className="h-4 w-2/3 rounded bg-white/5" />

                  {/* Add to cart button placeholder */}
                  <div className="pt-4 mt-auto">
                    <div className="h-11 w-full rounded-sm bg-white/20" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <span className="sr-only">Đang tải thực đơn AURA CAFE...</span>
        </div>
      </main>
    </div>
  );
}

export default StitchMenuNewSkeleton;
