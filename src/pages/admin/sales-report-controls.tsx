import { cn } from '@/lib/cn';
import { DateRangePicker } from '@/components/admin/DateRangePicker';
import { previousPeriodDates } from './date-helpers';
import { Calendar, Filter, BarChart3 } from 'lucide-react';
import type { Period, GroupBy } from './sales-report-types';

interface SalesReportControlsProps {
  period: Period;
  customStart: string;
  customEnd: string;
  compareMode: boolean;
  groupBy: GroupBy | null;
  from: string;
  to: string;
  onPeriodChange: (p: Period) => void;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
  onCompareModeToggle: () => void;
  onGroupByToggle: (g: GroupBy) => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function SalesReportControls({
  period,
  customStart,
  customEnd,
  compareMode,
  groupBy,
  from,
  to,
  onPeriodChange,
  onCustomStartChange,
  onCustomEndChange,
  onCompareModeToggle,
  onGroupByToggle,
  t,
}: SalesReportControlsProps) {
  const isCustom = period === 'custom';

  const periodBtn = (p: Period) =>
    cn(
      'px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-full transition-all duration-300',
      period === p
        ? 'bg-[var(--aura-chrome-light)] text-[var(--aura-noir-deep)]'
        : 'border border-[var(--aura-chrome-light)] text-[var(--aura-chrome-light)] hover:bg-[rgba(201,214,223,0.08)]',
    );

  const groupBtn = (g: GroupBy) =>
    cn(
      'px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-full transition-all duration-300',
      groupBy === g
        ? 'bg-[var(--aura-chrome-light)] text-[var(--aura-noir-deep)]'
        : 'border border-[var(--aura-chrome-light)]/40 text-[var(--aura-chrome-light)]/60 hover:bg-[rgba(201,214,223,0.08)]',
    );

  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-[var(--glass-blur)] p-4 mb-6">
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-[var(--aura-chrome-light)]" />
          {(['24h', '7d', '30d', 'custom'] as const).map((p) => (
            <button key={p} onClick={() => onPeriodChange(p)} className={periodBtn(p)}>
              {p === '24h' ? '24h' : p === '7d' ? t('salesReports.period.7d') : p === '30d' ? t('salesReports.period.30d') : t('salesReports.period.custom')}
            </button>
          ))}
        </div>

        <span className="hidden md:inline w-px h-6 bg-[var(--glass-border)]" />

        <button
          onClick={onCompareModeToggle}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-full transition-all duration-300',
            compareMode
              ? 'bg-[var(--aura-chrome-light)] text-[var(--aura-noir-deep)]'
              : 'border border-[var(--aura-chrome-light)]/40 text-[var(--aura-chrome-light)]/60 hover:bg-[rgba(201,214,223,0.08)]',
          )}
        >
          <BarChart3 className="w-3 h-3" />
          {t('salesReports.compareMode')}
        </button>

        <span className="hidden md:inline w-px h-6 bg-[var(--glass-border)]" />

        <div className="flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5 text-[var(--aura-chrome-light)]" />
          {(['hour', 'day', 'category', 'payment'] as const).map((g) => (
            <button key={g} onClick={() => onGroupByToggle(g)} className={groupBtn(g)}>
              {g === 'hour' ? t('salesReports.groupBy.hour') : g === 'day' ? t('salesReports.groupBy.day') : g === 'category' ? t('salesReports.groupBy.category') : t('salesReports.groupBy.payment')}
            </button>
          ))}
        </div>
      </div>

      {isCustom && (
        <div className="mt-3 pt-3 border-t border-[var(--glass-border)]">
          <DateRangePicker
            startDate={customStart}
            endDate={customEnd}
            onStartDateChange={onCustomStartChange}
            onEndDateChange={onCustomEndChange}
          />
        </div>
      )}

      <div className="mt-3 text-[11px] text-[var(--aura-text-muted)] font-mono">
        {from === to
          ? t('salesReports.periodSummary.today', { from })
          : t('salesReports.periodSummary.range', {
              from,
              to,
              days: Math.round(
                (new Date(to).getTime() - new Date(from).getTime()) / 86400000 + 1,
              ),
            })}
        {compareMode && (
          <span className="ml-2 opacity-60">
            {t('salesReports.periodSummary.compare', {
              prevFrom: previousPeriodDates(from, to).from,
              prevTo: previousPeriodDates(from, to).to,
            })}
          </span>
        )}
      </div>
    </div>
  );
}
