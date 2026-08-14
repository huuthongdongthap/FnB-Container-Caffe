/**
 * StitchOrderMgmtNew — AURA CAFE Order Management Terminal (Stitch v2 design)
 *
 * Dark navy glassmorphism order management terminal with Chrome/bronze accents.
 * Source: Stitch AI aura_cafe_order_management_terminal export.
 *
 * Features:
 * - Collapsible sidebar nav with active state
 * - Top app bar with search, notifications, and admin profile
 * - 4 stat overview cards (Active Orders, In Preparation, Ready for Pickup, Avg. Lead Time)
 * - Search input with filter tabs (All, Pending, Preparing, Ready, Served)
 * - Order card grid with status-coded badges and actions
 * - Revenue analytics, staff clock-in, and promotions panels
 * - Pagination footer
 * - Loading / error / empty states
 * - Mobile-first responsive layout
 * - Full i18n support (bilingual EN + VI)
 * - Accessible ARIA labels
 */
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

import type { StitchOrderMgmtNewProps } from './StitchOrderMgmtNew-types';
import {
  DEFAULT_STATS,
  DEFAULT_ORDERS,
  GLASS_CLASSES,
} from './stitch-order-mgmt-default';
import { StitchOrderMgmtHeader } from './StitchOrderMgmtNew-header';
import { StitchOrderMgmtDashboard } from './StitchOrderMgmtNew-dashboard';
import { StitchOrderMgmtTable } from './StitchOrderMgmtNew-table';

/* ─── Main Component ────────────────────────────────────────────────── */

export function StitchOrderMgmtNew({
  brandName = 'Aura Cafe',
  brandSubtitle = 'Terminal v1.0',
  headerTitle = 'Aether Cafe Terminal',
  headerSubtitle = 'Order Management',
  adminName = 'Aura Admin',
  adminAvatarUrl = '',
  stats = DEFAULT_STATS,
  orders = DEFAULT_ORDERS,
  activeNav = 'orders',
  activeFilter = 'all',
  isLoading = false,
  error = null,
  onFilterChange,
  onSearch,
  onOrderAction,
  onRefresh,
}: Readonly<StitchOrderMgmtNewProps>) {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const tTerminal = (key: string) => t(`terminal.${key}`);

  /* ─── Loading State ────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--aura-bg-page, #0A1A2E)]">
        <div className="flex flex-col items-center gap-4" role="status" aria-label={tTerminal('loading')}>
          <Loader2 size={40} className="animate-spin text-[var(--aura-primary, #c6c6c7)]" />
          <p className="font-sans text-sm text-[var(--aura-text-secondary, #a0a8b0)]">{tTerminal('loading')}</p>
        </div>
      </div>
    );
  }

  /* ─── Error State ──────────────────────────────────────────────── */

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--aura-bg-page, #0A1A2E)]">
        <div
          className={cn(GLASS_CLASSES, 'flex max-w-md flex-col items-center gap-4 rounded-xl p-8 text-center')}
          role="alert"
          aria-label={tTerminal('error')}
        >
          <AlertCircle size={48} className="text-[#ffb4ab]" />
          <h2 className="font-sans text-xl font-semibold text-[#ffb4ab]">
            {tTerminal('errorTitle')}
          </h2>
          <p className="text-sm text-[var(--aura-text-secondary, #a0a8b0)]">{error}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--aura-primary, #c6c6c7)] px-6 py-3 font-sans text-sm font-bold text-[#0c1c30] transition-all hover:brightness-110 active:scale-95"
              aria-label={tTerminal('retry')}
            >
              <RefreshCw size={16} />
              {tTerminal('retry')}
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ─── Render ──────────────────────────────────────────────────── */

  return (
    <div className="relative min-h-screen bg-[var(--aura-bg-page, #0A1A2E)] font-sans text-[var(--aura-text-primary, #e8e8e8)]">
      <StitchOrderMgmtHeader
        brandName={brandName}
        brandSubtitle={brandSubtitle}
        headerTitle={headerTitle}
        headerSubtitle={headerSubtitle}
        adminName={adminName}
        adminAvatarUrl={adminAvatarUrl}
        activeNav={activeNav}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />

      <main
        className={cn('min-h-screen px-4 pb-8 pt-20 md:px-6', 'md:ml-[280px]')}
        aria-label={tTerminal('mainContent')}
      >
        <div className="mx-auto w-full max-w-[1440px]">
          {/* Stat overview cards */}
          <section
            className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            aria-label={tTerminal('statOverview')}
          >
            {stats.map((stat) => (
              <div
                key={stat.icon}
                className={cn(GLASS_CLASSES, 'flex flex-col justify-center rounded-xl p-6')}
                aria-label={tTerminal(`stat.${stat.icon}`)}
              >
                <span className="mb-1 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)]">
                  {stat.label}
                </span>
                <span className="font-sans text-[32px] font-semibold leading-tight tracking-tight bg-gradient-to-r from-[#f2c08d] via-[#efbd8a] to-[#d4a574] bg-clip-text text-transparent">
                  {stat.value}
                </span>
              </div>
            ))}
          </section>

          {/* Revenue, Staff, Promotions */}
          <StitchOrderMgmtDashboard />

          {/* Search, Filters, Order Grid, Pagination */}
          <StitchOrderMgmtTable
            orders={orders}
            activeFilter={activeFilter}
            onFilterChange={onFilterChange}
            onSearch={onSearch}
            onOrderAction={onOrderAction}
          />
        </div>
      </main>
    </div>
  );
}
