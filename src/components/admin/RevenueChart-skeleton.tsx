export function RevenueChartSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-24 bg-[var(--aura-noir-bright)] rounded animate-shimmer" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 w-12 bg-[var(--aura-noir-bright)] rounded-full animate-shimmer" />
          ))}
        </div>
      </div>
      <div className="h-40 flex items-end gap-1">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-[var(--aura-noir-bright)] rounded-t animate-shimmer"
            style={{
              height: `${Math.max(15, Math.random() * 85 + 10)}%`,
              animationDelay: `${i * 0.05}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
