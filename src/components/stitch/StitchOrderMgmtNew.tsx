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
import { AlertCircle, RefreshCw, X } from 'lucide-react';

import type { StitchOrderMgmtNewProps } from './StitchOrderMgmtNew-types';
import {
  DEFAULT_STATS,
  DEFAULT_ORDERS,
  GLASS_CLASSES,
} from './stitch-order-mgmt-default';
import { StitchOrderMgmtHeader as _StitchOrderMgmtHeader } from './StitchOrderMgmtNew-header';
import { StitchOrderMgmtDashboard } from './StitchOrderMgmtNew-dashboard';
import { StitchOrderMgmtTable } from './StitchOrderMgmtNew-table';

/* ─── Main Component ────────────────────────────────────────────────── */

export function StitchOrderMgmtNew({
  brandName: _brandName = 'Aura Cafe',
  brandSubtitle: _brandSubtitle = 'Terminal v1.0',
  headerTitle: _headerTitle = 'Aether Cafe Terminal',
  headerSubtitle: _headerSubtitle = 'Order Management',
  adminName: _adminName = 'Aura Admin',
  adminAvatarUrl: _adminAvatarUrl = '',
  stats = DEFAULT_STATS,
  orders = DEFAULT_ORDERS,
  activeNav: _activeNav = 'orders',
  activeFilter = 'all',
  activeChannel = 'all',
  searchQuery,
  searchField = 'all',
  statusCounts,
  isLoading = false,
  error = null,
  mutationError = null,
  onDismissMutationError,
  onFilterChange,
  onChannelChange,
  onSearch,
  onSearchFieldChange,
  onOrderAction,
  onViewDetails,
  onCancelOrder,
  onEditOrder,
  onPrintOrder,
  onRefresh,
  currentPage = 1,
  pageSize = 12,
  totalCount,
  onPageChange,
  showDashboardPanels = true,
}: Readonly<StitchOrderMgmtNewProps>) {
  const { t } = useTranslation();
  const [_sidebarOpen, _setSidebarOpen] = useState(false);

  const tTerminal = (key: string) => t(`terminal.${key}`);

  /* ─── Fatal Initial Fetch Error State (only when no orders loaded) ─── */

  if (error && orders.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--aura-bg-page, var(--aura-bg-surface))]">
        <div
          className={cn(GLASS_CLASSES, 'flex max-w-md flex-col items-center gap-4 rounded-xl p-8 text-center')}
          role="alert"
          aria-label={tTerminal('error')}
        >
          <AlertCircle size={48} className="text-[var(--aura-error, #FFB4AB)]" />
          <h2 className="font-sans text-xl font-semibold text-[var(--aura-error, #FFB4AB)]">
            {tTerminal('errorTitle')}
          </h2>
          <p className="text-sm text-[var(--aura-text-secondary, #a0a8b0)]">{error}</p>
          {onRefresh && (
            <button type="button"
              onClick={onRefresh}
              className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--aura-primary, #c6c6c7)] px-6 py-3 font-sans text-sm font-bold text-[var(--aura-noir-deep, #0c1c30)] transition-all hover:brightness-110 active:scale-95"
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
    <div className="relative min-h-screen font-sans text-[var(--aura-text-primary,#e8e8e8)]">
      <main
        className={cn('min-h-screen px-4 pb-8 pt-4 md:px-6')}
        aria-label={tTerminal('mainContent')}
      >
        <div className="mx-auto w-full max-w-[1440px]">
          {/* Non-blocking mutation or background refresh error banner */}
          {(mutationError || error) && (
            <div
              role="alert"
              className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-400/40 bg-red-500/15 px-4 py-3 text-sm text-red-200"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{mutationError || error}</span>
              </div>
              {onDismissMutationError && mutationError && (
                <button
                  type="button"
                  onClick={onDismissMutationError}
                  aria-label={t('orderMgmt.close', { defaultValue: 'Close' })}
                  className="rounded p-1 hover:bg-white/10"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

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
                <span className="mb-1 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary,#a0a8b0)]">
                  {stat.label}
                </span>
                <span className="font-sans text-[32px] font-semibold leading-tight tracking-tight bg-gradient-to-r from-[var(--aura-chrome-light,#C9D6DF)] via-[var(--aura-chrome-light,#efbd8a)] to-[var(--aura-chrome-light,#d4a574)] bg-clip-text text-transparent">
                  {stat.value}
                </span>
              </div>
            ))}
          </section>

          {/* Revenue, Staff, Promotions */}
          {showDashboardPanels && <StitchOrderMgmtDashboard />}

          {/* Search, Filters, Order Grid/Table, Pagination */}
          <StitchOrderMgmtTable
            orders={orders}
            activeFilter={activeFilter}
            activeChannel={activeChannel}
            searchQuery={searchQuery}
            searchField={searchField}
            statusCounts={statusCounts}
            isLoading={isLoading}
            onFilterChange={onFilterChange}
            onChannelChange={onChannelChange}
            onSearch={onSearch}
            onSearchFieldChange={onSearchFieldChange}
            onOrderAction={onOrderAction}
            onViewDetails={onViewDetails}
            onCancelOrder={onCancelOrder}
            onEditOrder={onEditOrder}
            onPrintOrder={onPrintOrder}
            onRefresh={onRefresh}
            currentPage={currentPage}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={onPageChange}
          />
        </div>
      </main>
    </div>
  );
}
