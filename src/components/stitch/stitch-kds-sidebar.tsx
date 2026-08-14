/**
 * StitchKDSNew — Sidebar navigation component
 *
 * Glass-panel sidebar with chef profile, navigation links, and station load bar.
 * Supports mobile overlay with focus trap.
 */

'use client';

import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import {
  LayoutDashboard,
  History,
  Package,
  Users,
  ChefHat,
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  stationLabel: string;
  stationName: string;
  stationLoad: number;
}

export function Sidebar({ isOpen, onToggle, stationLabel, stationName, stationLoad }: SidebarProps) {
  const { t } = useTranslation();
  const sidebarRef = useRef<HTMLElement>(null);

  useFocusTrap(isOpen, onToggle, sidebarRef);

  const navItems = [
    { icon: LayoutDashboard, label: t('kds.dashboard', 'DASHBOARD'), tKey: 'kds.dashboard', active: true },
    { icon: History, label: t('kds.history', 'HISTORY'), tKey: 'kds.history', active: false },
    { icon: Package, label: t('kds.inventory', 'INVENTORY'), tKey: 'kds.inventory', active: false },
    { icon: Users, label: t('kds.staff', 'STAFF'), tKey: 'kds.staff', active: false },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <aside
        ref={sidebarRef}
        className={cn(
          'fixed left-0 top-0 z-40 flex h-full flex-col px-4 pt-24 pb-8',
          'bg-[#010f1f]/80 backdrop-blur-2xl',
          'border-r border-[var(--aura-chrome-dim)]/10',
          'w-64 transition-transform duration-200',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',
        )}
        aria-label={t('kds.sidebar', 'Sidebar navigation')}
      >
        {/* Profile */}
        <div className="mb-10 flex items-center gap-4 px-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--aura-chrome-dim)]/30 bg-[#273647]">
            <ChefHat className="h-5 w-5 text-[var(--aura-chrome-bright)]" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span
              className="text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-bright)]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {stationLabel}
            </span>
            <span
              className="text-[16px] leading-[1.5] font-bold text-[#d4e4fa]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {stationName}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-grow flex-col gap-2" aria-label={t('kds.navigation', 'Navigation')}>
          {navItems.map((item) => (
            <a
              key={item.tKey}
              href="#"
              className={cn(
                'flex items-center gap-4 px-4 py-3',
                'text-[12px] leading-none tracking-[0.1em] font-bold uppercase',
                'transition-all',
                item.active
                  ? 'border-r-2 border-[var(--aura-chrome-bright)] bg-[#273647]/20 text-[var(--aura-chrome-bright)]'
                  : 'border-r-2 border-transparent text-[var(--aura-chrome-soft)] opacity-60 hover:text-[#d4e4fa] hover:bg-[#273647]/20',
              )}
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              aria-label={item.label}
              aria-current={item.active ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </a>
          ))}
        </nav>

        {/* Station load */}
        <div className="mt-auto px-4 pb-8">
          <div className="rounded-lg border border-[var(--aura-chrome-dim)]/20 bg-[var(--aura-surface-container)] p-4">
            <span
              className="mb-2 block text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-noir-void)] opacity-60"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('kds.stationLoad', 'STATION LOAD')}
            </span>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#273647]">
              <div
                className="h-full w-3/4 rounded-full bg-[var(--aura-chrome-bright)] transition-all duration-500"
                style={{ width: `${Math.min(stationLoad, 100)}%` }}
              />
            </div>
            <span
              className="mt-2 block text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-soft)]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {stationLoad}{t('kds.percent', '%')} {t('kds.capacity', 'CAPACITY')}
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
