import { cn } from '@/lib/cn';

function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded bg-[color-mix(in_srgb,var(--aura-surface-container)_75%,transparent)] backdrop-blur-[20px]',
        className,
      )}
    />
  );
}

export function CheckoutNewSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading checkout"
      className="min-h-screen bg-[var(--aura-surface-container)] pt-24 pb-32"
    >
      <div className="mx-auto max-w-7xl px-10 space-y-12">
        <SkeletonBlock className="h-10 w-72" />
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="space-y-10 lg:col-span-7">
            <div className="rounded-xl p-6 space-y-6 bg-[color-mix(in_srgb,var(--aura-surface-container)_75%,transparent)] backdrop-blur-[20px] border border-[rgba(198,198,199,0.15)]">
              <SkeletonBlock className="h-6 w-48" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SkeletonBlock className="h-14 w-full" />
                <SkeletonBlock className="h-14 w-full" />
                <SkeletonBlock className="h-14 w-full md:col-span-2" />
                <SkeletonBlock className="h-20 w-full md:col-span-2" />
              </div>
            </div>
            <div className="rounded-xl p-6 space-y-6 bg-[color-mix(in_srgb,var(--aura-surface-container)_75%,transparent)] backdrop-blur-[20px] border border-[rgba(198,198,199,0.15)]">
              <SkeletonBlock className="h-6 w-44" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <SkeletonBlock className="h-20 w-full" />
                <SkeletonBlock className="h-20 w-full" />
              </div>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="rounded-xl p-8 space-y-6 bg-[color-mix(in_srgb,var(--aura-surface-container)_75%,transparent)] backdrop-blur-[20px] border border-[rgba(198,198,199,0.15)]">
              <SkeletonBlock className="h-6 w-40" />
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <SkeletonBlock className="h-16 w-16 shrink-0 rounded" />
                  <div className="flex-1 space-y-2">
                    <SkeletonBlock className="h-4 w-32" />
                    <SkeletonBlock className="h-3 w-24" />
                  </div>
                  <SkeletonBlock className="h-4 w-16" />
                </div>
              ))}
              <div className="space-y-3 border-t border-[color-mix(in_srgb,var(--aura-chrome-dim)_20%,transparent)] pt-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between">
                    <SkeletonBlock className="h-4 w-20" />
                    <SkeletonBlock className="h-4 w-14" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
