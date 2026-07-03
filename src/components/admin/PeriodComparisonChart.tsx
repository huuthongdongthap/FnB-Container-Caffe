'use client';

import { cn } from '@/lib/cn';

interface PeriodDataPoint {
  date: string;
  revenue: number;
}

interface PeriodComparisonChartProps {
  data: {
    current: PeriodDataPoint[];
    previous: PeriodDataPoint[];
  } | null;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

/* ─── Loading skeleton ─── */

function PeriodComparisonSkeleton() {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-36 bg-[var(--aura-noir-bright)] rounded animate-shimmer" />
        <div className="h-5 w-16 bg-[var(--aura-noir-bright)] rounded animate-shimmer" />
      </div>
      <div className="h-44 flex items-end gap-1">
        {Array.from({ length: 14 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 bg-[var(--aura-noir-bright)] rounded-t animate-shimmer"
            style={{
              height: `${Math.max(15, Math.random() * 80 + 15)}%`,
              animationDelay: `${i * 0.05}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Error state ─── */

function PeriodComparisonError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
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

function PeriodComparisonEmpty() {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-6">
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <svg className="w-10 h-10 text-[var(--aura-text-muted)] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
        <p className="text-sm text-[var(--aura-text-muted)]">Chua co du lieu so sanh</p>
      </div>
    </div>
  );
}

/* ─── Percentage change badge ─── */

function ChangeBadge({ value }: { value: number }) {
  const isUp = value >= 0;
  const absValue = Math.abs(value);
  const label = `${isUp ? '+' : '-'}${absValue.toFixed(1)}%`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full',
        isUp
          ? 'text-green-400 bg-green-400/10'
          : 'text-red-400 bg-red-400/10',
      )}
    >
      {isUp ? (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      ) : (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      )}
      {label}
    </span>
  );
}

/* ─── Main component ─── */

export function PeriodComparisonChart({
  data,
  loading,
  error,
  onRetry,
  className,
}: PeriodComparisonChartProps) {
  if (loading && !data) return <PeriodComparisonSkeleton />;
  if (error) return <PeriodComparisonError message={error} onRetry={onRetry} />;
  if (!data || data.current.length === 0 || data.previous.length === 0) {
    return <PeriodComparisonEmpty />;
  }

  const { current, previous } = data;

  // Compute total revenue for each period
  const currentTotal = current.reduce((s, d) => s + d.revenue, 0);
  const previousTotal = previous.reduce((s, d) => s + d.revenue, 0);
  const changePercent =
    previousTotal > 0
      ? ((currentTotal - previousTotal) / previousTotal) * 100
      : 0;

  // Determine the global max for scaling both lines
  const allValues = [...current.map((d) => d.revenue), ...previous.map((d) => d.revenue)];
  const maxValue = Math.max(...allValues, 1);

  const chartHeight = 176;
  const chartWidth = 100;
  const padding = { top: 8, right: 4, bottom: 20, left: 4 };
  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;

  // Build polyline points for both series
  const buildPoints = (series: PeriodDataPoint[]) =>
    series
      .map((d, i) => {
        const x = padding.left + (i / Math.max(series.length - 1, 1)) * innerW;
        const y = padding.top + innerH - (d.revenue / maxValue) * innerH;
        return `${x},${y}`;
      })
      .join(' ');

  const currentPoints = buildPoints(current);
  const previousPoints = buildPoints(previous);

  // Area fill path for current (the bottom closure)
  const firstX = padding.left;
  const lastX = padding.left + innerW;
  const bottomY = padding.top + innerH;
  const currentAreaPoints = `${currentPoints} ${lastX},${bottomY} ${firstX},${bottomY}`;

  // Label count for x-axis
  const labelCount = Math.min(current.length, 7);

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--glass-border)]',
        'bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]',
        'p-6',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--aura-chrome-light)]">
          So sanh doanh thu
        </h3>
        <ChangeBadge value={changePercent} />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-[2px] rounded-full bg-[var(--aura-chrome-silver)]" />
          <span className="text-[10px] text-[var(--aura-text-muted)]">
            Ky nay <span className="font-mono">/ This period</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-[2px] rounded-full bg-[var(--aura-text-muted)]" />
          <span className="text-[10px] text-[var(--aura-text-muted)]">
            Ky truoc <span className="font-mono">/ Previous period</span>
          </span>
        </div>
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

          {/* Previous period area fill (muted) */}
          <polygon
            points={`${previousPoints} ${lastX},${bottomY} ${firstX},${bottomY}`}
            fill="rgba(128,128,128,0.08)"
          />

          {/* Previous period line (muted gray) */}
          <polyline
            points={previousPoints}
            fill="none"
            stroke="var(--aura-text-muted)"
            strokeWidth="0.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="1.5,1"
          />

          {/* Previous period dots */}
          {previous.map((d, i) => {
            const x = padding.left + (i / Math.max(previous.length - 1, 1)) * innerW;
            const y = padding.top + innerH - (d.revenue / maxValue) * innerH;
            return (
              <circle
                key={`prev-${i}`}
                cx={x}
                cy={y}
                r="0.5"
                fill="var(--aura-text-muted)"
              >
                <title>{`${d.date}: ${d.revenue.toLocaleString('vi-VN')}₫`}</title>
              </circle>
            );
          })}

          {/* Current period area fill (chrome/silver) */}
          <polygon
            points={currentAreaPoints}
            fill="url(#period-current-gradient)"
            opacity={0.2}
          />

          {/* Current period line (chrome/silver) */}
          <polyline
            points={currentPoints}
            fill="none"
            stroke="var(--aura-chrome-silver)"
            strokeWidth="0.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Current period dots */}
          {current.map((d, i) => {
            const x = padding.left + (i / Math.max(current.length - 1, 1)) * innerW;
            const y = padding.top + innerH - (d.revenue / maxValue) * innerH;
            return (
              <circle
                key={`cur-${i}`}
                cx={x}
                cy={y}
                r="0.7"
                fill="var(--aura-chrome-silver)"
                stroke="var(--aura-noir-deep)"
                strokeWidth="0.3"
              >
                <title>{`${d.date}: ${d.revenue.toLocaleString('vi-VN')}₫`}</title>
              </circle>
            );
          })}

          {/* Bottom axis labels */}
          {current
            .filter((_, i) => {
              if (current.length <= labelCount) return true;
              const step = Math.floor(current.length / labelCount);
              return i % step === 0 || i === current.length - 1;
            })
            .map((d, _, arr) => {
              const i = current.indexOf(d);
              const x = padding.left + (i / Math.max(current.length - 1, 1)) * innerW;
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
                  {d.date.length > 5 ? d.date.slice(0, 4) + '..' : d.date}
                </text>
              );
            })}

          <defs>
            <linearGradient id="period-current-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--aura-chrome-silver)" stopOpacity="0.7" />
              <stop offset="100%" stopColor="var(--aura-chrome-silver)" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}
