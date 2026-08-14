/**
 * StitchKDSNew — Top app bar header component
 *
 * Fixed header with title, station info, filter navigation, prep stats,
 * and notification/settings buttons. Includes mobile sidebar toggle.
 */

'use client';

import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import {
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { StitchKDSNewProps } from './stitch-kds-types';
import { FILTERS } from './stitch-kds-default';

interface HeaderProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeFilter: StitchKDSNewProps['activeFilter'];
  onFilterChange?: StitchKDSNewProps['onFilterChange'];
  stationLabel: string;
  avgPrepTime: string;
  activeCount: number;
}

export function Header({
  sidebarOpen,
  onToggleSidebar,
  activeFilter,
  onFilterChange,
  stationLabel,
  avgPrepTime,
  activeCount,
}: HeaderProps) {
  const { t } = useTranslation();

  return (
    <header
      className="fixed left-0 top-0 z-50 flex w-full items-center justify-between border-b border-[var(--aura-chrome-dim)]/20 bg-[#051424]/60 px-8 py-4 backdrop-blur-xl"
      aria-label={t('kds.header', 'KDS Header')}
    >
      <div className="flex items-center gap-6">
        <button
          className="rounded p-1 text-[#d4e4fa] transition-colors hover:bg-[#273647]/30 md:hidden"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? t('kds.closeSidebar', 'Close sidebar') : t('kds.openSidebar', 'Open sidebar')}
        >
          {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
        </button>
        <h1
          className="text-[48px] leading-[1.1] font-black tracking-tighter text-[#d4e4fa]"
          style={{ fontFamily: "'Syne', sans-serif" }}
        >
          {t('kds.title', 'HEARTH & STEEL KDS')}
        </h1>
        <div className="h-8 w-px bg-[var(--aura-chrome-dim)]/30" />
        <div className="flex flex-col">
          <span
            className="text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-soft)] opacity-60"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t('kds.station', 'STATION')}
          </span>
          <span
            className="text-[20px] leading-[1.2] font-semibold text-[var(--aura-chrome-soft)]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {stationLabel}
          </span>
        </div>
      </div>

      {/* Filter navigation */}
      <nav className="hidden items-center gap-8 md:flex" aria-label={t('kds.filterNav', 'Filter tickets')}>
        {FILTERS.map((f) => (
          <a
            key={f.key}
            href="#"
            onClick={(e: React.MouseEvent) => { e.preventDefault(); onFilterChange?.(f.key); }}
            className={cn(
              'pb-1 transition-all',
              'font-[family-name:--font-body]',
              activeFilter === f.key
                ? 'border-b-2 border-[var(--aura-chrome-bright)] font-bold text-[var(--aura-chrome-bright)]'
                : 'rounded px-2 py-1 font-medium text-[var(--aura-chrome-soft)] hover:bg-[#273647]/30 transition-colors',
            )}
            aria-current={activeFilter === f.key ? 'page' : undefined}
            aria-label={t(f.tKey, f.label)}
          >
            {f.label}
          </a>
        ))}
      </nav>

      <div className="flex items-center gap-6">
        <div className="flex flex-col items-end">
          <span
            className="text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-bright)]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t('kds.avgPrep', 'AVG PREP')}: {avgPrepTime}
          </span>
          <span
            className="text-[16px] leading-[1.5] font-normal text-[var(--aura-chrome-soft)]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            {t('kds.activeOrders', 'ACTIVE ORDERS')}: {activeCount}
          </span>
        </div>
        <div className="flex gap-4">
          <button
            className="rounded p-2 text-[var(--aura-noir-void)] transition-colors hover:bg-[#273647]/30"
            aria-label={t('kds.notifications', 'Notifications')}
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            className="rounded p-2 text-[var(--aura-noir-void)] transition-colors hover:bg-[#273647]/30"
            aria-label={t('kds.settings', 'Settings')}
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  );
}
