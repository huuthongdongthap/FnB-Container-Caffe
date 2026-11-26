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

import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { brandConfig } from '@/config/brand-types';

/* ─── Re-export types for backward compatibility ─────────────────────────────── */

export type { Ticket, TicketStatus, StitchKDSNewProps } from './stitch-kds-types';

/* ─── Imports from extracted modules ──────────────────────────────────────────── */

import type { KdsFilterKey, StitchKDSNewProps, Ticket } from './stitch-kds-types';
import { DEFAULT_TICKETS } from './stitch-kds-default';
import { sortKdsTickets } from './stitch-kds-utils';
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
        0%, 100% { text-shadow: 0 0 10px color-mix(in srgb, var(--aura-error, #ffb4ab) 20%, transparent); opacity: 1; }
        50% { text-shadow: 0 0 25px color-mix(in srgb, var(--aura-error, #ffb4ab) 80%, transparent); opacity: 0.8; }
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

const STALE_TICKET_THRESHOLD_SECONDS = 24 * 60 * 60;

export function StitchKDSNew({
  tickets = DEFAULT_TICKETS,
  storeName,
  stationName = 'QUẦY PHA CHẾ',
  stationLabel = 'TRẠM 01',
  stationLocation = 'BẾP CHÍNH',
  stationLoad = 75,
  avgPrepTime = '12M',
  selectedStation,
  stations,
  onStationChange,
  isLoading = false,
  error = null,
  pendingOrders = {},
  mutationErrors = {},
  onCompleteTicket,
  onStartPrep,
  onPickupOrder,
  onToggleItemReady,
  recentTickets = [],
  onRecallTicket,
  onOpenRecallDrawer,
  onOpenShiftModal,
  onRefresh,
  activeFilter = 'all',
  onFilterChange,
  soundEnabled = true,
  isFullscreen = false,
  onToggleSound,
  onToggleFullscreen,
  cancelledBanner,
}: Readonly<StitchKDSNewProps>) {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAllDayPanel, setShowAllDayPanel] = useState(false);
  const [showRecallDrawer, setShowRecallDrawer] = useState(false);
  const [showStaleSection, setShowStaleSection] = useState(false);

  const resolvedStoreName = (storeName && storeName.trim()) || brandConfig.brand.name || t('kds.storeBrandFallback', 'Kitchen');

  const { inShiftTickets, staleTickets } = useMemo(() => {
    const shift: Ticket[] = [];
    const stale: Ticket[] = [];
    for (const tk of tickets || []) {
      const isTicketStale = Boolean(tk.isStale || tk.elapsedSeconds > STALE_TICKET_THRESHOLD_SECONDS);
      if (isTicketStale) {
        stale.push({ ...tk, isStale: true });
      } else {
        shift.push(tk);
      }
    }
    return { inShiftTickets: shift, staleTickets: sortKdsTickets(stale) };
  }, [tickets]);

  const filteredTickets = useCallback(() => {
    if (!inShiftTickets) return [];
    let list = inShiftTickets;
    if (activeFilter === 'overdue') {
      list = inShiftTickets.filter((tk) => Boolean(tk.isOverdue || tk.status === 'overdue'));
    } else if (activeFilter === 'priority') {
      list = inShiftTickets.filter(
        (tk) => Boolean(tk.isOverdue || tk.status === 'overdue' || tk.isWarning),
      );
    } else if (activeFilter === 'pending') {
      list = inShiftTickets.filter((tk) => ['pending', 'confirmed'].includes(tk.rawStatus ?? (tk.status === 'overdue' ? 'pending' : tk.status)));
    } else if (activeFilter !== 'all') {
      list = inShiftTickets.filter((tk) => (tk.rawStatus ?? tk.status) === activeFilter);
    }
    return sortKdsTickets(list);
  }, [inShiftTickets, activeFilter]);

  const filtered = filteredTickets();
  const getOpStatus = (tk: Ticket) => tk.rawStatus ?? (tk.status === 'overdue' ? 'pending' : tk.status);

  const pendingLaneTickets = useMemo(() => {
    const sortedPending = sortKdsTickets(
      inShiftTickets.filter((tk) => ['pending', 'confirmed'].includes(getOpStatus(tk))),
    );
    return sortedPending.map((tk, idx) => ({ ...tk, queueRank: idx + 1 }));
  }, [inShiftTickets]);

  const preparingLaneTickets = useMemo(
    () => sortKdsTickets(inShiftTickets.filter((tk) => getOpStatus(tk) === 'preparing')),
    [inShiftTickets],
  );

  const readyLaneTickets = useMemo(
    () => sortKdsTickets(inShiftTickets.filter((tk) => getOpStatus(tk) === 'ready')),
    [inShiftTickets],
  );

  const rankedFiltered = useMemo(() => {
    let pendingIdx = 0;
    return filtered.map((tk) => {
      if (['pending', 'confirmed'].includes(getOpStatus(tk))) {
        pendingIdx += 1;
        return { ...tk, queueRank: pendingIdx };
      }
      return tk;
    });
  }, [filtered]);

  const allDayBatches = useMemo(() => {
    const batchMap = new Map<string, { name: string; quantity: number }>();
    for (const tk of inShiftTickets) {
      if (getOpStatus(tk) === 'ready') continue;
      for (const item of tk.items) {
        if (item.ready) continue;
        const key = item.name.trim().toLowerCase();
        if (!key) continue;
        const existing = batchMap.get(key);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          batchMap.set(key, { name: item.name, quantity: item.quantity });
        }
      }
    }
    return Array.from(batchMap.values()).sort((a, b) => b.quantity - a.quantity);
  }, [inShiftTickets]);

  const countOverdue = inShiftTickets.filter((tk) => Boolean(tk.isOverdue || tk.status === 'overdue')).length;
  const countPreparing = preparingLaneTickets.length;
  const countPending = pendingLaneTickets.length;
  const countReady = readyLaneTickets.length;
  const activeCount = countPreparing + countPending;
  const filterCounts: Partial<Record<KdsFilterKey, number>> = {
    all: inShiftTickets.length,
    overdue: countOverdue,
    pending: countPending,
    preparing: countPreparing,
    ready: countReady,
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-[var(--aura-noir-void,#051424)] text-[var(--aura-chrome-bright,#d4e4fa)]"
      style={{ fontFamily: "var(--aura-font-body)" }}
    >
      <Header
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
        filterCounts={filterCounts}
        stationLabel={stationLabel}
        selectedStation={selectedStation}
        stations={stations}
        onStationChange={onStationChange}
        avgPrepTime={avgPrepTime}
        activeCount={activeCount}
        soundEnabled={soundEnabled}
        isFullscreen={isFullscreen}
        onToggleSound={onToggleSound}
        onToggleFullscreen={onToggleFullscreen}
        onOpenShiftModal={onOpenShiftModal}
      />

      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
        stationLabel={stationLabel}
        stationName={stationName}
        stationLoad={stationLoad}
      />

      <main
        className="ml-0 md:ml-64 flex-1 overflow-y-auto px-4 md:px-8 pb-8 pt-4"
        aria-label={t('kds.mainContent', 'Main order grid')}
      >
        {cancelledBanner && <div className="mb-4">{cancelledBanner}</div>}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--aura-chrome-dim)]/10 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAllDayPanel((prev) => !prev)}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--aura-chrome-bright)] transition-colors hover:bg-white/10"
            >
              {t('kds.allDaySummary', 'Tổng hợp món')} ({allDayBatches.reduce((s, b) => s + b.quantity, 0)})
            </button>
            {onRecallTicket && (
              <button
                type="button"
                onClick={() => {
                  const next = !showRecallDrawer;
                  setShowRecallDrawer(next);
                  if (next) onOpenRecallDrawer?.();
                }}
                className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-sky-200 transition-colors hover:bg-sky-500/20"
              >
                {t('kds.recallTicket', 'Gọi lại phiếu')}
              </button>
            )}
          </div>
          <span
            className="text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-soft)]"
            style={{ fontFamily: "var(--aura-font-body)" }}
          >
            {resolvedStoreName} &bull; {stationLocation}
          </span>
        </div>

        {showAllDayPanel && (
          <section
            aria-label={t('kds.allDaySummary', 'All-day item batch summary')}
            className="mb-5 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4"
          >
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-amber-200">
              {t('kds.allDaySummary', 'Tổng hợp món đang chờ pha')}
            </h3>
            {allDayBatches.length === 0 ? (
              <p className="text-xs text-[var(--aura-chrome-soft)]">
                {t('kds.mobileNoOrders', 'Không có món nào đang chờ')}
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allDayBatches.map((batch) => (
                  <span
                    key={batch.name}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-[#0A1A2E]/80 px-3 py-1 text-xs font-semibold text-white"
                  >
                    <strong className="font-mono text-amber-300">{batch.quantity}×</strong>
                    <span>{batch.name}</span>
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {showRecallDrawer && onRecallTicket && (
          <section
            aria-label={t('kds.recallTicket', 'Recall recent tickets')}
            className="mb-5 rounded-xl border border-sky-400/30 bg-sky-500/10 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-sky-200">
                {t('kds.recallDrawerTitle', 'Phiếu vừa hoàn tất — Hoàn tác / Gọi lại')}
              </h3>
              <button
                type="button"
                onClick={() => setShowRecallDrawer(false)}
                className="text-xs text-sky-200 hover:underline"
              >
                {t('orderMgmt.close', 'Đóng')}
              </button>
            </div>
            {recentTickets.length === 0 ? (
              <p className="text-xs text-[var(--aura-chrome-soft)]">
                {t('kds.noRecentTickets', 'Chưa có phiếu vừa hoàn tất gần đây')}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {recentTickets.map((rt) => (
                  <div
                    key={rt.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#0A1A2E]/80 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-sky-200">
                        {rt.displayId} {rt.table ? `· ${rt.table}` : ''} ({rt.status})
                      </div>
                      <div className="truncate text-[var(--aura-chrome-soft)]">{rt.itemsSummary}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRecallTicket(rt.id, rt.status === 'served' ? 'ready' : 'preparing')}
                      className="shrink-0 rounded border border-sky-400/40 bg-sky-500/20 px-2.5 py-1 font-bold uppercase text-sky-100 hover:bg-sky-500/30"
                    >
                      {t('kds.undoBump', 'Hoàn tác')}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={onRefresh} />
        ) : filtered.length === 0 && staleTickets.length === 0 ? (
          <EmptyState onRefresh={onRefresh} />
        ) : activeFilter === 'all' ? (
          <div className="space-y-8">
            {/* Lane 1: Pending Queue (#1, #2, #3) */}
            {pendingLaneTickets.length > 0 && (
              <section aria-label={t('kds.lanePending', 'Pending queue')}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-amber-200">
                    {t('kds.lanePending', 'Làn 1 — Chờ làm')} ({pendingLaneTickets.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {pendingLaneTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      pending={pendingOrders[ticket.id]}
                      mutationError={mutationErrors[ticket.id]}
                      onComplete={onCompleteTicket}
                      onStart={onStartPrep}
                      onPickup={onPickupOrder}
                      onToggleItemReady={onToggleItemReady}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Lane 2: In Preparation */}
            {preparingLaneTickets.length > 0 && (
              <section aria-label={t('kds.lanePreparing', 'In preparation')}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-sky-200">
                    {t('kds.lanePreparing', 'Làn 2 — Đang chế biến')} ({preparingLaneTickets.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {preparingLaneTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      pending={pendingOrders[ticket.id]}
                      mutationError={mutationErrors[ticket.id]}
                      onComplete={onCompleteTicket}
                      onStart={onStartPrep}
                      onPickup={onPickupOrder}
                      onToggleItemReady={onToggleItemReady}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Lane 3: Compact Expo Ready Pickup */}
            {readyLaneTickets.length > 0 && (
              <section aria-label={t('kds.laneExpoReady', 'Expo ready for pickup')}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-300">
                    {t('kds.laneExpoReady', 'Khu Expo — Sẵn sàng chờ lấy')} ({readyLaneTickets.length})
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {readyLaneTickets.map((ticket) => (
                    <TicketCard
                      key={ticket.id}
                      ticket={ticket}
                      compact
                      pending={pendingOrders[ticket.id]}
                      mutationError={mutationErrors[ticket.id]}
                      onComplete={onCompleteTicket}
                      onStart={onStartPrep}
                      onPickup={onPickupOrder}
                    />
                  ))}
                </div>
              </section>
            )}

            {filtered.length === 0 && <EmptyState onRefresh={onRefresh} />}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {rankedFiltered.map((ticket) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                compact={activeFilter === 'ready'}
                pending={pendingOrders[ticket.id]}
                mutationError={mutationErrors[ticket.id]}
                onComplete={onCompleteTicket}
                onStart={onStartPrep}
                onPickup={onPickupOrder}
                onToggleItemReady={onToggleItemReady}
              />
            ))}
          </div>
        )}

        {staleTickets.length > 0 && (
          <section className="mt-8 border-t border-white/10 pt-4" aria-label={t('kds.staleSection', 'Stale tickets')}>
            <button
              type="button"
              onClick={() => setShowStaleSection((prev) => !prev)}
              className="flex w-full items-center justify-between rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-amber-200 hover:bg-amber-500/15"
            >
              <span>
                {t('kds.staleSectionTitle', {
                  count: staleTickets.length,
                  defaultValue: `Đơn tồn ca trước (> 24h) (${staleTickets.length})`,
                })}
              </span>
              <span>{showStaleSection ? '▲' : '▼'}</span>
            </button>
            {showStaleSection && (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {staleTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    compact
                    pending={pendingOrders[ticket.id]}
                    mutationError={mutationErrors[ticket.id]}
                    onComplete={onCompleteTicket}
                    onStart={onStartPrep}
                    onPickup={onPickupOrder}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </main>

      <KdsStyles />
    </div>
  );
}
