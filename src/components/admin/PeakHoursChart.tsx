import { cn } from '@/lib/cn';

interface PeakHour {
  hour: number;
  order_count: number;
  revenue: number;
}

interface PeakHoursChartProps {
  data: PeakHour[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

/* ─── Loading skeleton ─── */

function PeakHoursSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-5">
      <div className="h-4 w-32 bg-[var(--aura-noir-bright)] rounded animate-shimmer mb-4" />
      <div className="h-36 bg-[var(--aura-noir-bright)] rounded animate-shimmer" />
    </div>
  );
}

/* ─── Error state ─── */

function PeakHoursError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--aura-chrome-light)] mb-4">
        Gio cao diem
      </h3>
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <svg className="w-8 h-8 text-[var(--aura-danger)] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="text-xs text-[var(--aura-text-body)] mb-3">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider rounded-full
              border border-[var(--aura-chrome-light)] text-[var(--aura-chrome-light)]
              hover:bg-[rgba(201,214,223,0.08)] transition-all duration-300"
          >
            Thu lai
          </button>
        )}
      </div>
    </div>
  );
}

/* ─── Empty state ─── */

function PeakHoursEmpty() {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--aura-chrome-light)] mb-4">
        Gio cao diem
      </h3>
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <svg className="w-8 h-8 text-[var(--aura-text-muted)] mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-[var(--aura-text-muted)]">Chua co du lieu gio cao diem</p>
      </div>
    </div>
  );
}

/* ─── Main component ─── */

export function PeakHoursChart({ data, loading, error, onRetry, className }: PeakHoursChartProps) {
  if (loading && data.length === 0) return <PeakHoursSkeleton />;
  if (error) return <PeakHoursError message={error} onRetry={onRetry} />;
  if (data.length === 0) return <PeakHoursEmpty />;

  const maxCount = Math.max(...data.map((d) => d.order_count), 1);

  return (
    <div className={cn(
      'rounded-xl border border-[var(--glass-border)]',
      'bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]',
      'p-5',
      className,
    )}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--aura-chrome-light)] mb-4">
        Gio cao diem
      </h3>

      {/* 24-hour bar chart */}
      <div className="flex items-end gap-[2px] h-36">
        {data.map((h) => {
          const height = (h.order_count / maxCount) * 100;
          const intensity = 0.3 + (h.order_count / maxCount) * 0.7;
          const isLabeled = h.hour % 3 === 0;

          return (
            <div key={h.hour} className="flex-1 flex flex-col items-center justify-end h-full">
              <div
                className="w-full rounded-t-sm transition-all duration-300 hover:opacity-80 min-h-[2px]"
                style={{
                  height: `${Math.max(height, 2)}%`,
                  background: `linear-gradient(180deg, var(--aura-chrome-bright) 0%, rgba(201,214,223,${intensity}) 100%)`,
                  boxShadow: h.order_count > 0
                    ? `0 0 4px rgba(201,214,223,${intensity * 0.3})`
                    : 'none',
                }}
                title={`${h.hour}:00 - ${h.order_count} don, ${h.revenue.toLocaleString('vi-VN')}₫`}
              />
              {isLabeled && (
                <span className="text-[8px] text-[var(--aura-text-muted)] mt-1 font-mono">
                  {h.hour}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-center">
        <span className="text-[11px] text-[var(--aura-text-muted)]">
          {data.filter((h) => h.order_count > 0).length} khung gio co don hang
        </span>
      </div>
    </div>
  );
}
