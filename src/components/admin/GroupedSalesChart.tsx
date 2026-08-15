import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';
import type { GroupedSalesData, GroupedSalesChartProps } from './GroupedSalesChart-types';
import { TITLE_MAP, EMPTY_MSG } from './GroupedSalesChart-constants';
import {
  GroupedSalesSkeleton,
  GroupedSalesError,
  GroupedSalesEmpty,
} from './GroupedSalesChart-sub-components';

/* ─── Re-exports for backward compatibility ─── */

export type { GroupedSalesData, GroupedSalesChartProps } from './GroupedSalesChart-types';

/* ─── Main component ─── */

export function GroupedSalesChart({
  data,
  groupBy,
  loading,
  error,
  onRetry,
  className,
}: GroupedSalesChartProps) {
  const title = TITLE_MAP[groupBy];
  const emptyMsg = EMPTY_MSG[groupBy];

  if (loading && (!data || data.groups.length === 0))
    return <GroupedSalesSkeleton title={title} />;
  if (error) return <GroupedSalesError message={error} onRetry={onRetry} />;
  if (!data || data.groups.length === 0)
    return <GroupedSalesEmpty message={emptyMsg} />;

  const totalValue = data.groups.reduce((s, g) => s + g.value, 0);
  const totalCount = data.groups.reduce((s, g) => s + g.count, 0);
  const maxValue = Math.max(...data.groups.map((g) => g.value), 1);

  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--glass-border)]',
        'bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)]',
        'p-5',
        className,
      )}
    >
      {/* Header */}
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--aura-chrome-light)] mb-4">
        {title}
      </h3>

      {/* ─── Mobile: horizontal bars ─── */}
      <div className="space-y-3 md:hidden">
        {data.groups.map((group, idx) => {
          const barWidth = (group.value / maxValue) * 100;
          return (
            <div key={idx} className="flex items-center gap-2">
              {/* Label */}
              <span className="text-[11px] text-[var(--aura-text-primary)] w-20 shrink-0 truncate font-medium leading-tight">
                {group.label}
              </span>

              {/* Bar */}
              <div className="flex-1 h-6 bg-[rgba(201,214,223,0.06)] rounded-sm overflow-hidden">
                <div
                  className="h-full rounded-sm transition-all duration-500 ease-out"
                  style={{
                    width: `${barWidth}%`,
                    background:
                      'linear-gradient(90deg, var(--aura-chrome-dark), var(--aura-chrome-light))',
                    boxShadow:
                      barWidth > 0
                        ? '0 0 6px rgba(201,214,223,0.25)'
                        : 'none',
                  }}
                  title={`${group.label}: ${formatVnd(group.value)} - ${group.count} don`}
                />
              </div>

              {/* Value + count */}
              <span className="text-[11px] text-[var(--aura-text-muted)] w-24 text-right shrink-0 leading-tight font-mono">
                {formatVnd(group.value)}
                <br />
                <span className="text-[10px]">{group.count} don</span>
              </span>
            </div>
          );
        })}
      </div>

      {/* ─── Desktop: vertical bars ─── */}
      <div className="hidden md:flex items-end gap-3 h-44">
        {data.groups.map((group, idx) => {
          const barHeight = (group.value / maxValue) * 100;
          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center justify-end h-full min-w-0"
            >
              {/* Value label */}
              <span className="text-[9px] text-[var(--aura-text-muted)] font-mono mb-1 leading-tight text-center">
                {formatVnd(group.value)}
              </span>

              {/* Bar */}
              <div
                className="w-full rounded-t-sm transition-all duration-500 ease-out hover:opacity-80 min-h-[2px]"
                style={{
                  height: `${Math.max(barHeight, 2)}%`,
                  background: `linear-gradient(180deg, var(--aura-chrome-bright) 0%, var(--aura-chrome-light) 50%, var(--aura-chrome-dark) 100%)`,
                  boxShadow:
                    barHeight > 0
                      ? '0 0 6px rgba(201,214,223,0.2)'
                      : 'none',
                }}
                title={`${group.label}: ${formatVnd(group.value)} - ${group.count} don`}
              />

              {/* Label + count */}
              <span className="text-[10px] text-[var(--aura-text-muted)] mt-1.5 text-center leading-tight">
                <span className="block truncate max-w-[6rem]">{group.label}</span>
                <span className="block text-[9px] text-[var(--aura-text-muted)] opacity-70">
                  {group.count} don
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-3 pt-3 border-t border-[var(--glass-border)] flex justify-between text-[11px] text-[var(--aura-text-muted)]">
        <span>
          Tong: <span className="font-semibold text-[var(--aura-text-primary)]">{formatVnd(totalValue)}</span>
        </span>
        <span>
          {totalCount} don hang
        </span>
      </div>
    </div>
  );
}
