/**
 * StitchKDSNew — Kitchen Display System for AURA CAFE
 *
 * Pixel-perfect match to original Stitch HTML:
 * /tmp/stitch_original/stitch_aura_cafe/aura_cafe_kitchen_display_system/code.html
 *
 * Dark navy glassmorphism KDS with Chrome/bronze accents.
 * Uses exact hex colors and font stacks from the Stitch source.
 *
 * - Order ticket grid (responsive 1-4 columns)
 * - Status labels: PREPARING | PENDING | READY | OVERDUE
 * - Live elapsed countdown timers with overdue pulse animation
 * - Glass-panel cards with chrome-style action buttons
 * - Full i18n support (bilingual EN + VI)
 * - Loading / error / empty states
 */
'use client';

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

/* ─── Re-export types for backward compatibility ─────────────────────────────── */

export type { Ticket, TicketStatus, StitchKDSNewProps } from './stitch-kds-types';

/* ─── Imports from extracted modules ──────────────────────────────────────────── */

import type { StitchKDSNewProps } from './stitch-kds-types';
import { DEFAULT_TICKETS } from './stitch-kds-default';
import { StatusBadge } from './stitch-kds-status-badge';
import { TicketCard } from './stitch-kds-order-card';
import { EmptyState } from './stitch-kds-empty-state';
import { LoadingState } from './stitch-kds-loading-state';
import { ErrorState } from './stitch-kds-error-state';
import { Sidebar } from './stitch-kds-sidebar';
import { Header } from './stitch-kds-header';

/* ─── Custom CSS — matches original <style> block exactly ────────────────────── */

function KdsStyles() {
  return (
    <style>{`
      @keyframes pulse-glow {
        0%, 100% { text-shadow: 0 0 10px rgba(255, 180, 171, 0.2); opacity: 1; }
        50% { text-shadow: 0 0 25px rgba(255, 180, 171, 0.8); opacity: 0.8; }
      }
      .btn-chrome {
        transition: all 0.1s ease;
      }
      .btn-chrome:active {
        transform: scale(0.98) translateY(2px);
        box-shadow: 0 1px 0 rgba(0,0,0,0.5), inset 0 2px 4px rgba(0,0,0,0.2) !important;
      }
      .timer-pulse-red {
        animation: pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
      ::-webkit-scrollbar { width: 4px; height: 4px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: var(--aura-chrome-dim); border-radius: 10px; }
    `}</style>
  );
}

/* ─── Main Component ──────────────────────────────────────────────────────── */

export function StitchKDSNew({
  tickets = DEFAULT_TICKETS,
  stationName = 'GRILL & SAUTE',
  stationLabel = 'STATION 01',
  stationLocation = 'REVENUE CENTER: BAR',
  stationLoad = 75,
  avgPrepTime = '12M',
  isLoading = false,
  error = null,
  onCompleteTicket,
  onStartPrep,
  onPickupOrder,
  onRefresh,
  activeFilter = 'all',
  onFilterChange,
}: Readonly<StitchKDSNewProps>) {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const filteredTickets = useCallback(() => {
    if (!tickets) return [];
    if (activeFilter === 'all') return tickets;
    if (activeFilter === 'priority')
      return tickets.filter((tk) => tk.status === 'overdue' || tk.status === 'preparing');
    return tickets.filter((tk) => tk.status === activeFilter);
  }, [tickets, activeFilter]);

  const filtered = filteredTickets();
  const countPreparing = tickets.filter((tk) => tk.status === 'preparing').length;
  const countPending = tickets.filter((tk) => tk.status === 'pending').length;
  const countReady = tickets.filter((tk) => tk.status === 'ready').length;
  const activeCount = countPreparing + countPending;

  return (
    <div
      className="min-h-screen overflow-hidden bg-[#051424] text-[#d4e4fa]"
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      <Header
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
        stationLabel={stationLabel}
        avgPrepTime={avgPrepTime}
        activeCount={activeCount}
      />

      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
        stationLabel={stationLabel}
        stationName={stationName}
        stationLoad={stationLoad}
      />

      <main
        className="ml-64 h-screen overflow-y-auto px-8 pb-8 pt-24"
        aria-label={t('kds.mainContent', 'Main order grid')}
      >
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--aura-chrome-dim)]/10 pb-4">
          <div className="flex flex-wrap gap-4">
            <StatusBadge status="preparing" count={countPreparing} />
            <StatusBadge status="pending" count={countPending} />
            <StatusBadge status="ready" count={countReady} />
          </div>
          <span
            className="text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-soft)]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            AURA CAFE &bull; {stationLocation}
          </span>
        </div>

        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={onRefresh} />
        ) : filtered.length === 0 ? (
          <EmptyState onRefresh={onRefresh} />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                onComplete={onCompleteTicket}
                onStart={onStartPrep}
                onPickup={onPickupOrder}
              />
            ))}
          </div>
        )}
      </main>

      <KdsStyles />
    </div>
  );
}
