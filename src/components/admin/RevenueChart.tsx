import { cn } from '@/lib/cn';
import type { DataPoint, RevenueChartProps, ChartPadding } from './RevenueChart-types';
import { RevenueChartSkeleton } from './RevenueChart-skeleton';
import { RevenueChartError } from './RevenueChart-error';
import { RevenueChartEmpty } from './RevenueChart-empty';

// Re-exports for backward compatibility
export type { DataPoint, RevenueChartProps, ChartPadding } from './RevenueChart-types';
export { RevenueChartSkeleton } from './RevenueChart-skeleton';
export { RevenueChartError } from './RevenueChart-error';
export { RevenueChartEmpty } from './RevenueChart-empty';

const PERIODS = [
  { key: 'daily' as const, label: 'Ngay' },
  { key: 'weekly' as const, label: 'Tuan' },
  { key: 'monthly' as const, label: 'Thang' },
] as const;

const CHART_CONFIG = {
  height: 160,
  width: 100,
  padding: { top: 8, right: 4, bottom: 20, left: 4 } as ChartPadding,
  gridFractions: [0, 0.25, 0.5, 0.75, 1] as const,
} as const;

function getX(i: number, total: number, padding: ChartPadding, innerW: number) {
  return padding.left + (i / Math.max(total - 1, 1)) * innerW;
}

function getY(value: number, maxValue: number, padding: ChartPadding, innerH: number) {
  return padding.top + innerH - (value / maxValue) * innerH;
}

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

  const { height, width, padding } = CHART_CONFIG;
  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const points = data
    .map((d, i) => `${getX(i, data.length, padding, innerW)},${getY(d.value, maxValue, padding, innerH)}`)
    .join(' ');

  const bottomY = padding.top + innerH;
  const areaPoints = `${points} ${padding.left + innerW},${bottomY} ${padding.left},${bottomY}`;

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
            {PERIODS.map((p) => (
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
      <div className="w-full" style={{ height }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="w-full h-full overflow-visible"
        >
          {/* Grid lines */}
          {CHART_CONFIG.gridFractions.map((frac) => {
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
          {data.map((d, i) => (
            <circle
              key={i}
              cx={getX(i, data.length, padding, innerW)}
              cy={getY(d.value, maxValue, padding, innerH)}
              r="0.6"
              fill="var(--aura-chrome-bright)"
              stroke="var(--aura-noir-deep)"
              strokeWidth="0.3"
            >
              <title>{`${d.label}: ${d.value.toLocaleString('vi-VN')}₫`}</title>
            </circle>
          ))}

          {/* Bottom axis labels */}
          {data
            .filter((_, i) => {
              if (data.length <= labelCount) return true;
              const step = Math.floor(data.length / labelCount);
              return i % step === 0 || i === data.length - 1;
            })
            .map((d) => {
              const i = data.indexOf(d);
              return (
                <text
                  key={i}
                  x={getX(i, data.length, padding, innerW)}
                  y={height - 2}
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
