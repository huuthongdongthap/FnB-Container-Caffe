import { cn } from '@/lib/cn';
import { formatVnd } from '@/lib/format';

/* ─── Types ─── */

export interface GroupedSalesData {
  groups: {
    label: string;
    value: number;
    count: number;
  }[];
}

interface GroupedSalesChartProps {
  data: GroupedSalesData | null;
  groupBy: 'hour' | 'day' | 'category' | 'payment';
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

/* ─── Title mapping ─── */

const TITLE_MAP: Record<GroupedSalesChartProps['groupBy'], string> = {
  hour: 'Theo gio',
  day: 'Theo ngay',
  category: 'Theo danh muc',
  payment: 'Theo phuong thuc thanh toan',
};

const EMPTY_MSG: Record<GroupedSalesChartProps['groupBy'], string> = {
  hour: 'Chua co du lieu theo gio',
  day: 'Chua co du lieu theo ngay',
  category: 'Chua co du lieu theo danh muc',
  payment: 'Chua co du lieu theo phuong thuc thanh toan',
};

/* ─── Loading skeleton ─── */

function GroupedSalesSkeleton({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-5">
      <div className="h-4 w-32 bg-[var(--aura-noir-bright)] rounded animate-shimmer mb-4" />

      {/* Mobile: horizontal bar skeleton */}
      <div className="space-y-3 md:hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="h-3 w-20 bg-[var(--aura-noir-bright)] rounded animate-shimmer shrink-0" />
            <div className="flex-1 h-5 bg-[var(--aura-noir-bright)] rounded animate-shimmer" />
            <div className="h-3 w-16 bg-[var(--aura-noir-bright)] rounded animate-shimmer shrink-0" />
          </div>
        ))}
      </div>

      {/* Desktop: vertical bar skeleton */}
      <div className="hidden md:flex items-end gap-2 h-40">
        {[40, 70, 90, 55, 30].map((h, i) => (
          <div key={i} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-[var(--aura-noir-bright)] rounded-t animate-shimmer"
              style={{ height: `${h}%` }}
            />
            <div className="h-3 w-full bg-[var(--aura-noir-bright)] rounded animate-shimmer mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Error state ─── */

function GroupedSalesError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-5">
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <svg
          className="w-8 h-8 text-[var(--aura-danger)] mb-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
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

function GroupedSalesEmpty({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-5">
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <svg
          className="w-8 h-8 text-[var(--aura-text-muted)] mb-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
          />
        </svg>
        <p className="text-sm text-[var(--aura-text-muted)]">{message}</p>
      </div>
    </div>
  );
}

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
