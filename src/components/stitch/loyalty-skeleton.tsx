export function LoyaltySkeleton() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--aura-surface-dim)' }}>
      <div className="mx-auto max-w-[1440px] px-[64px] pt-32 pb-24">
        <div className="mb-8 flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
          <div className="h-10 w-32 animate-pulse rounded-full" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
        </div>
        <div
          className="mb-8 rounded-xl p-[24px] backdrop-blur-xl"
          style={{ backgroundColor: 'color-mix(in srgb, var(--aura-bg-high) 40%, transparent)', border: '1px solid color-mix(in srgb, var(--aura-chrome-bright) 30%, transparent)' }}
        >
          <div className="flex flex-col gap-[24px] md:flex-row">
            <div className="flex-1 space-y-4">
              <div className="h-6 w-32 animate-pulse rounded-full" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
              <div className="h-10 w-64 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
              <div className="h-4 w-80 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
              <div className="h-2 w-full animate-pulse rounded-full" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
            </div>
            <div className="h-32 w-48 animate-pulse rounded" style={{ backgroundColor: 'var(--aura-bg-high)' }} />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-[24px] lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl" style={{ backgroundColor: 'color-mix(in srgb, var(--aura-bg-high) 40%, transparent)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
