'use client';

import { cn } from '@/lib/cn';
import type { PeriodComparisonChartProps } from './PeriodComparisonChart-types';
import {
  computeChartMetrics,
  buildPolylinePoints,
  buildAreaPoints,
} from './PeriodComparisonChart-constants';
import {
  PeriodComparisonSkeleton,
  PeriodComparisonError,
  PeriodComparisonEmpty,
} from './PeriodComparisonChart-status';
import { ChangeBadge } from './PeriodComparisonChart-badge';
import { ChartSvg } from './PeriodComparisonChart-svg';

// Re-exports for backward compatibility
export type { PeriodDataPoint, PeriodComparisonChartProps } from './PeriodComparisonChart-types';
export { PeriodComparisonSkeleton, PeriodComparisonError, PeriodComparisonEmpty } from './PeriodComparisonChart-status';
export { ChangeBadge } from './PeriodComparisonChart-badge';

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
  const { changePercent, maxValue } = computeChartMetrics(current, previous);

  const currentPoints = buildPolylinePoints(current, maxValue);
  const previousPoints = buildPolylinePoints(previous, maxValue);
  const currentAreaPoints = buildAreaPoints(currentPoints);

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
      <ChartSvg
        current={current}
        previous={previous}
        currentPoints={currentPoints}
        previousPoints={previousPoints}
        currentAreaPoints={currentAreaPoints}
        maxValue={maxValue}
      />
    </div>
  );
}
