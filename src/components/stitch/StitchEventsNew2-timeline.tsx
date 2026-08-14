/**
 * Filter tabs (timeline) component for StitchEventsNew2.
 * Extracted from StitchEventsNew2.tsx to keep individual files under 200 LOC.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import type { FilterMonth } from './StitchEventsNew2-types';
import { TuneIcon } from './stitch-events-icons';

/* ─── Filter Tabs ─────────────────────────────────────────────── */

export function FilterTabs({
  months,
  activeMonth,
  onMonthChange,
  onFilterByType,
}: {
  months: FilterMonth[];
  activeMonth: string;
  onMonthChange?: (month: string) => void;
  onFilterByType?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <section style={{ backgroundColor: 'var(--aura-bg-surface, #071c33)' }}>
      <div className="mx-auto max-w-[1280px] px-5 md:px-12">
        <div
          className="flex items-center justify-between overflow-x-auto border-b pb-4"
          style={{ borderColor: 'rgba(68,71,77,0.2)' }}
        >
          {/* Month buttons */}
          <div className="flex min-w-max gap-12">
            {months.map((month) => (
              <button
                key={month.key}
                type="button"
                onClick={() => onMonthChange?.(month.key)}
                className={clsx(
                  'relative pb-4 font-label-caps text-xs uppercase tracking-wider transition-all',
                  activeMonth === month.key ? '' : 'hover:text-[var(--aura-text-primary, #e8e8e8)]',
                )}
                style={{
                  color: activeMonth === month.key ? '#efbd8a' : 'var(--aura-text-secondary, #a0a8b0)',
                }}
                aria-pressed={activeMonth === month.key}
                aria-label={month.label}
              >
                {month.label}
                {activeMonth === month.key && (
                  <span
                    className="absolute bottom-0 left-0 h-0.5 w-full"
                    style={{ backgroundColor: '#efbd8a' }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Filter by type — desktop only */}
          <button
            type="button"
            onClick={onFilterByType}
            className="hidden items-center gap-1 font-label-caps text-[10px] uppercase tracking-wider md:flex"
            style={{ color: 'var(--aura-text-secondary, #a0a8b0)' }}
            aria-label={t('events.filterByType')}
          >
            <TuneIcon className="h-4 w-4" />
            {t('events.filterByType')}
          </button>
        </div>
      </div>
    </section>
  );
}
