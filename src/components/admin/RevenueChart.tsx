import { cn } from '@/lib/cn';

interface DataPoint {
  label: string;
  value: number;
}

interface RevenueChartProps {
  data: DataPoint[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  period?: 'daily' | 'weekly' | 'monthly';
  onPeriodChange?: (p: 'daily' | 'weekly' | 'monthly') => void;
  className?: string;
  /** Optional total amount to display below the chart */
  total?: number;
}

/* ─── Loading skeleton ─── */

function RevenueChartSkeleton() {
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

/* ─── Error state ─── */

function RevenueChartError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-6">
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <svg className="w-10 h-10 text-[var(--aura-danger)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
        <p className="text-sm text-[var(--aura-text-body)] mb-3">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-full
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

function RevenueChartEmpty() {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-6">
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <svg className="w-10 h-10 text-[var(--aura-text-muted)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
        <p className="text-sm text-[var(--aura-text-muted)]">Chua co du lieu doanh thu</p>
      </div>
    </div>
  );
}

/* ─── Main component ─── */

export function RevenueChart({
  data,
  loading,
  error,
  onRetry,
  period = 'daily',
  onPeriodChange,
  className,
  total,
}: RevenueChartProps) {
  if (loading && data.length === 0) return <RevenueChartSkeleton />;
  if (error) return <RevenueChartError message={error} onRetry={onRetry} />;
  if (data.length === 0) return <RevenueChartEmpty />;

  const periods = [
    { key: 'daily' as const, label: 'Ngay' },
    { key: 'weekly' as const, label: 'Tuan' },
    { key: 'monthly' as const, label: 'Thang' },
  ];

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const chartHeight = 160;
  const chartWidth = 100;
  const padding = { top: 8, right: 4, bottom: 20, left: 4 };
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  // Build SVG polyline points
  const points = data
    .map((d, i) => {
      const x = padding.left + (i / Math.max(data.length - 1, 1)) * innerW;
      const y = padding.top + innerH - (d.value / maxValue) * innerH;
      return `${x},${y}`;
    })
    .join(' ');

  // Build area fill path (polyline + bottom corners)
  const firstX = padding.left;
  const lastX = padding.left + innerW;
  const bottomY = padding.top + innerH;
  const areaPoints = `${points} ${lastX},${bottomY} ${firstX},${bottomY}`;

  // Axis labels
  const labelCount = Math.min(data.length, 7);

  return (
    <div className={cn(
      'rounded-xl border border-[var(--glass-border)]',
      'bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]',
      'p-6',
      className,
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--aura-chrome-light)]">
          Doanh thu
        </h3>
        {onPeriodChange && (
          <div className="flex gap-1">
            {periods.map((p) => (
              <button
                key={p.key}
                onClick={() => onPeriodChange(p.key)}
                className={cn(
                  'px-3 py-1 text-xs rounded-full transition-all duration-300',
                  period === p.key
                    ? 'bg-[var(--aura-chrome-light)] text-[var(--aura-noir-deep)] font-semibold'
                    : 'text-[var(--aura-text-muted)] hover:text-[var(--aura-chrome-light)] hover:bg-[rgba(201,214,223,0.06)]',
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* SVG Chart */}
      <div className="w-full" style={{ height: chartHeight }}>
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
        >
          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
            const y = padding.top + innerH - frac * innerH;
            return (
              <line
                key={frac}
                x1={padding.left}
                y1={y}
                x2={padding.left + innerW}
                y2={y}
                stroke="rgba(201,214,223,0.08)"
                strokeWidth="0.3"
              />
            );
          })}

          {/* Area fill */}
          <polygon
            points={areaPoints}
            fill="url(#revenue-gradient)"
            opacity={0.25}
          />

          {/* Line */}
          <polyline
            points={points}
            fill="none"
            stroke="var(--aura-chrome-light)"
            strokeWidth="0.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data dots */}
          {data.map((d, i) => {
            const x = padding.left + (i / Math.max(data.length - 1, 1)) * innerW;
            const y = padding.top + innerH - (d.value / maxValue) * innerH;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="0.6"
                fill="var(--aura-chrome-bright)"
                stroke="var(--aura-noir-deep)"
                strokeWidth="0.3"
              >
                <title>{`${d.label}: ${d.value.toLocaleString('vi-VN')}₫`}</title>
              </circle>
            );
          })}

          {/* Bottom axis labels */}
          {data
            .filter((_, i) => {
              if (data.length <= labelCount) return true;
              const step = Math.floor(data.length / labelCount);
              return i % step === 0 || i === data.length - 1;
            })
            .map((d, _, arr) => {
              const i = data.indexOf(d);
              const x = padding.left + (i / Math.max(data.length - 1, 1)) * innerW;
              return (
                <text
                  key={i}
                  x={x}
                  y={chartHeight - 2}
                  textAnchor="middle"
                  fill="var(--aura-text-muted)"
                  fontSize="2.5"
                  fontFamily="var(--aura-font-mono)"
                >
                  {d.label.length > 5 ? d.label.slice(0, 4) + '..' : d.label}
                </text>
              );
            })}

          <defs>
            <linearGradient id="revenue-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--aura-chrome-light)" stopOpacity="0.8" />
              <stop offset="100%" stopColor="var(--aura-chrome-light)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Total */}
      <div className="mt-3 text-right">
        <span className="text-xs text-[var(--aura-text-muted)]">
          Tong:{' '}
          <span className="font-semibold text-[var(--aura-text-primary)]">
            {(total ?? data.reduce((s, d) => s + d.value, 0)).toLocaleString('vi-VN')}₫
          </span>
        </span>
      </div>
    </div>
  );
}
