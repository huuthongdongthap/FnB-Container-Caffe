import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';
import type { CustomerMetricsData } from '@/hooks/use-analytics-data';

interface CustomerMetricsCardProps {
  data: CustomerMetricsData | null;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

/* ─── Loading skeleton ─── */

function CustomerMetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-4"
        >
          <div className="h-3 w-20 bg-[var(--aura-noir-bright)] rounded animate-shimmer mb-2" />
          <div className="h-7 w-24 bg-[var(--aura-noir-bright)] rounded animate-shimmer mb-1" />
          <div className="h-3 w-12 bg-[var(--aura-noir-bright)] rounded animate-shimmer" />
        </div>
      ))}
    </div>
  );
}

/* ─── Error state ─── */

function CustomerMetricsError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-5">
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--aura-chrome-light)] mb-2">
        Khach hang
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

/* ─── Stat card ─── */

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: 'chrome' | 'green' | 'amber' | 'blue';
}) {
  const accentMap = {
    chrome: 'text-[var(--aura-chrome-bright)]',
    green: 'text-[var(--aura-success)]',
    amber: 'text-[var(--aura-chrome-mid)]',
    blue: 'text-[var(--aura-chrome-light)]',
  };

  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-4 transition-all duration-300 hover:border-[var(--aura-border-strong)] hover:shadow-[var(--aura-glow-chrome)]">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--aura-text-muted)] mb-1">
            {label}
          </p>
          <p className={cn(
            'text-xl font-bold font-[var(--aura-font-display)]',
            accentMap[accent],
          )}>
            {value}
          </p>
        </div>
        <div className="shrink-0 ml-3 opacity-60">
          {icon}
        </div>
      </div>
    </div>
  );
}

/* ─── Main component ─── */

export function CustomerMetrics({ data, loading, error, onRetry, className }: CustomerMetricsCardProps) {
  if (loading && !data) return <CustomerMetricsSkeleton />;
  if (error) return <CustomerMetricsError message={error} onRetry={onRetry} />;
  if (!data) return null;

  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-3', className)}>
      {/* Total customers */}
      <StatCard
        label="Tong khach"
        value={data.total_customers.toLocaleString('vi-VN')}
        accent="chrome"
        icon={
          <svg className="w-6 h-6 text-[var(--aura-chrome-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        }
      />

      {/* New customers (30d) */}
      <StatCard
        label="Khach moi (30d)"
        value={`+${data.new_30d.toLocaleString('vi-VN')}`}
        accent="green"
        icon={
          <svg className="w-6 h-6 text-[var(--aura-success)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
          </svg>
        }
      />

      {/* Repeat rate */}
      <StatCard
        label="Ty le quay lai"
        value={`${(data.repeat_rate * 100).toFixed(1)}%`}
        accent="amber"
        icon={
          <svg className="w-6 h-6 text-[var(--aura-chrome-mid)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
          </svg>
        }
      />

      {/* Avg order value */}
      <StatCard
        label="Gia tri TB don"
        value={formatVnd(data.avg_order_value)}
        accent="blue"
        icon={
          <svg className="w-6 h-6 text-[var(--aura-chrome-light)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
      />
    </div>
  );
}
