/**
 * StitchKDSNew — Top app bar header component
 *
 * Fixed header with title, station info, filter navigation, prep stats,
 * sound alert toggle, and fullscreen toggle. Includes mobile sidebar toggle.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import {
  Bell,
  BellOff,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { KdsFilterKey, StitchKDSNewProps } from './stitch-kds-types';
import { FILTERS } from './stitch-kds-default';

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeFilter: StitchKDSNewProps['activeFilter'];
  onFilterChange?: StitchKDSNewProps['onFilterChange'];
  filterCounts?: Partial<Record<KdsFilterKey, number>>;
  stationLabel: string;
  selectedStation?: string;
  stations?: StitchKDSNewProps['stations'];
  onStationChange?: (stationId: string) => void;
  avgPrepTime: string;
  activeCount: number;
  soundEnabled?: boolean;
  isFullscreen?: boolean;
  onToggleSound?: () => void;
  onToggleFullscreen?: () => void;
  onOpenShiftModal?: () => void;
}

export function Header({
  sidebarOpen,
  onToggleSidebar,
  activeFilter,
  onFilterChange,
  filterCounts,
  stationLabel,
  selectedStation,
  stations,
  onStationChange,
  avgPrepTime,
  activeCount,
  soundEnabled = true,
  isFullscreen = false,
  onToggleSound,
  onToggleFullscreen,
  onOpenShiftModal,
}: HeaderProps) {
  const { t } = useTranslation();

  return (
    <header
      className="sticky left-0 top-0 z-50 flex w-full flex-wrap items-center justify-between gap-3 border-b border-[var(--aura-chrome-dim)]/20 bg-[var(--aura-noir-void,#051424)]/92 px-4 py-3 backdrop-blur-md md:px-8 md:py-3.5"
      aria-label={t('kds.header', 'KDS Header')}
    >
      <div className="flex min-w-0 items-center gap-3 md:gap-5">
        <button
          type="button"
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-lg p-1 text-[var(--aura-chrome-bright,#d4e4fa)] transition-colors hover:bg-[var(--st-surface-container-highest,#273647)]/40 md:hidden"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? t('kds.closeSidebar', 'Close sidebar') : t('kds.openSidebar', 'Open sidebar')}
        >
          {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
        <h1
          className="truncate text-xl font-black tracking-tight text-[var(--aura-chrome-bright,#d4e4fa)] sm:text-2xl lg:text-3xl"
          style={{ fontFamily: 'var(--aura-font-display)' }}
        >
          {t('kds.title', 'AURA CAFE KDS')}
        </h1>
        <div className="hidden h-7 w-px bg-[var(--aura-chrome-dim)]/30 sm:block" />
        <div className="hidden flex-col sm:flex">
          <span
            className="text-[11px] leading-none font-bold tracking-[0.1em] text-[var(--aura-chrome-soft)] uppercase opacity-75"
            style={{ fontFamily: 'var(--aura-font-body)' }}
          >
            {t('kds.station', 'TRẠM')}
          </span>
          {stations && stations.length > 0 && onStationChange ? (
            <select
              aria-label={t('kds.selectStation', 'Chọn trạm bếp')}
              value={selectedStation ?? 'all'}
              onChange={(e) => onStationChange(e.target.value)}
              className="mt-0.5 rounded bg-[var(--st-surface-container-highest,#273647)]/60 px-2 py-0.5 text-sm font-semibold text-[var(--aura-chrome-bright)] outline-none focus:ring-1 focus:ring-[#efbd8a]"
              style={{ fontFamily: 'var(--aura-font-body)' }}
            >
              {stations.map((st) => (
                <option key={st.id} value={st.id} className="bg-[#051424] text-[#d4e4fa]">
                  {st.label}
                </option>
              ))}
            </select>
          ) : (
            <span
              className="text-base leading-tight font-semibold text-[var(--aura-chrome-bright)]"
              style={{ fontFamily: 'var(--aura-font-body)' }}
            >
              {stationLabel}
            </span>
          )}
        </div>
      </div>

      {/* Filter navigation */}
      <nav
        className="order-last flex w-full items-center gap-2 overflow-x-auto lg:order-none lg:w-auto"
        aria-label={t('kds.filterNav', 'Filter tickets')}
        style={{ fontFamily: 'var(--aura-font-body)' }}
      >
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.key;
          const count = filterCounts?.[f.key];
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onFilterChange?.(f.key)}
              className={cn(
                'inline-flex min-h-[40px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold tracking-wider uppercase transition-colors',
                isActive
                  ? 'border border-[#efbd8a]/50 bg-[#efbd8a]/20 text-[#f8d7b2]'
                  : f.key === 'overdue' && (count ?? 0) > 0
                    ? 'border border-[var(--aura-error,#ffb4ab)]/40 bg-[var(--aura-error,#ffb4ab)]/10 text-[var(--aura-error,#ffb4ab)] hover:bg-[var(--aura-error,#ffb4ab)]/20'
                    : 'text-[var(--aura-chrome-soft)] hover:bg-[var(--st-surface-container-highest,#273647)]/40 hover:text-[var(--aura-chrome-bright)]',
              )}
              aria-current={isActive ? 'page' : undefined}
              aria-label={t(f.tKey, f.label)}
            >
              <span>{t(f.tKey, f.label)}</span>
              {typeof count === 'number' && (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] font-bold leading-none tabular-nums">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-3 md:gap-5">
        <div className="hidden flex-col items-end sm:flex">
          <span
            className="text-xs leading-none font-bold tracking-[0.08em] text-[var(--aura-chrome-bright)] uppercase"
            style={{ fontFamily: 'var(--aura-font-body)' }}
          >
            {t('kds.avgPrep', 'AVG PREP')}: {avgPrepTime}
          </span>
          <span
            className="mt-1 text-xs leading-none font-medium text-[var(--aura-chrome-soft)]"
            style={{ fontFamily: 'var(--aura-font-body)' }}
          >
            {t('kds.activeOrders', 'ACTIVE ORDERS')}: {activeCount}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {onOpenShiftModal && (
            <button
              type="button"
              onClick={onOpenShiftModal}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--aura-chrome-light,#C9D6DF)] transition-colors hover:bg-white/10"
              aria-label={t('kds.shiftAttendance', 'Shift & Attendance')}
            >
              {t('kds.shiftAttendance', 'Ca trực')}
            </button>
          )}
          <button
            type="button"
            onClick={onToggleSound}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-[var(--aura-chrome-light,#C9D6DF)] transition-colors hover:bg-white/10"
            title={soundEnabled ? t('kds.muteAlerts', 'Mute alerts') : t('kds.enableAlerts', 'Enable alerts')}
            aria-label={soundEnabled ? t('kds.muteAlerts', 'Mute alerts') : t('kds.enableAlerts', 'Enable alerts')}
          >
            {soundEnabled ? <Bell className="h-5 w-5" aria-hidden="true" /> : <BellOff className="h-5 w-5 text-amber-300" aria-hidden="true" />}
          </button>
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-[var(--aura-chrome-light,#C9D6DF)] transition-colors hover:bg-white/10"
            title={isFullscreen ? t('kds.exitFullscreen', 'Exit fullscreen') : t('kds.fullscreen', 'Fullscreen')}
            aria-label={isFullscreen ? t('kds.exitFullscreen', 'Exit fullscreen') : t('kds.fullscreen', 'Fullscreen')}
          >
            {isFullscreen ? <Minimize2 className="h-5 w-5" aria-hidden="true" /> : <Maximize2 className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>
    </header>
  );
}
