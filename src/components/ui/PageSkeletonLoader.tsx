import { Skeleton } from './skeleton';

export function PageSkeletonLoader() {
  return (
    <div
      role="status"
      aria-label="Đang tải trang..."
      className="min-h-screen bg-[#0A1A2E] text-[var(--aura-chrome-bright)] font-body p-6 sm:p-10 max-w-7xl mx-auto flex flex-col gap-8 animate-pulse"
    >
      {/* Top bar placeholder */}
      <div className="flex items-center justify-between border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/10" />
          <div className="space-y-2">
            <div className="w-32 h-4 rounded bg-white/10" />
            <div className="w-20 h-3 rounded bg-white/5" />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-24 h-9 rounded-full bg-white/10 hidden sm:block" />
          <div className="w-9 h-9 rounded-full bg-white/10" />
        </div>
      </div>

      {/* Hero / Header placeholder */}
      <div className="space-y-3 max-w-lg">
        <div className="w-28 h-3 rounded bg-[#4A7C59]/30" />
        <div className="w-72 sm:w-96 h-8 rounded-lg bg-white/15" />
        <div className="w-full h-4 rounded bg-white/10" />
        <div className="w-3/4 h-4 rounded bg-white/5" />
      </div>

      {/* Filter / Tabs placeholder */}
      <div className="flex gap-2 overflow-x-hidden pt-2">
        <div className="w-20 h-8 rounded-full bg-white/15" />
        <div className="w-28 h-8 rounded-full bg-white/10" />
        <div className="w-24 h-8 rounded-full bg-white/10" />
        <div className="w-20 h-8 rounded-full bg-white/10" />
        <div className="w-24 h-8 rounded-full bg-white/10 hidden sm:block" />
      </div>

      {/* Content Grid placeholder */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <div
            key={n}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 flex flex-col gap-4 overflow-hidden"
          >
            <div className="w-full h-44 rounded-xl bg-white/10" />
            <div className="space-y-2 flex-1">
              <div className="w-3/4 h-4 rounded bg-white/15" />
              <div className="w-1/2 h-3 rounded bg-white/10" />
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div className="w-16 h-5 rounded bg-white/15" />
              <div className="w-24 h-8 rounded-lg bg-white/10" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Đang tải dữ liệu...</span>
    </div>
  );
}

export default PageSkeletonLoader;
