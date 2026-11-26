import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { brandConfig } from '@/config/brand-types';
import { apiFetch } from '@/lib/api-client';
import { formatTableWithPrefix } from '@/hooks/kds-order';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { useKDS } from '@/hooks/use-kds';
import {
  StitchKDSNew,
  type Ticket,
  type TicketStatus,
} from '@/components/stitch/StitchKDSNew';
import type { KdsFilterKey, KdsRecentTicket } from '@/components/stitch/stitch-kds-types';
import {
  OVERDUE_THRESHOLD_MIN,
  WARNING_THRESHOLD_MIN,
  MAX_METRIC_AGE_SECONDS,
  calcElapsedSeconds,
  calcDurationSeconds,
} from './kds-types';
import { useKdsAudio } from '@/hooks/use-kds-audio';

/* ─── Re-export types for backward compatibility ─────────────── */
export type { Ticket, TicketStatus } from './kds-types';

function splitKdsItemModifierAndNotes(item: { modifiers?: string[]; notes?: string }): {
  modifier?: string;
  notes?: string;
} {
  let extractedOptions = '';
  let cleanNotes = (item.notes ?? '').trim();

  const optionMatch = cleanNotes.match(/(?:^|\s*\|\s*)Tùy chọn:\s*(.+)$/i);
  if (optionMatch) {
    extractedOptions = (optionMatch[1] ?? '').trim();
    cleanNotes = cleanNotes.slice(0, optionMatch.index).trim();
  }

  const modList = item.modifiers?.length
    ? item.modifiers
    : extractedOptions
      ? extractedOptions.split(/\s*,\s*/).filter(Boolean)
      : [];

  return {
    ...(modList.length > 0 ? { modifier: modList.join(' · ') } : {}),
    ...(cleanNotes ? { notes: cleanNotes } : {}),
  };
}

/* ─── Main Page Component ──────────────────────────────────────── */

const DEFAULT_STATION_CAPACITY = 8;
const MAX_SINGLE_PREP_SAMPLE_SECONDS = 2 * 60 * 60;

interface KitchenStationDto {
  id: string;
  name: string;
  active?: number | boolean;
  capacity?: number;
  max_concurrent?: number;
}

export default function KDSPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const sessionVersion = useAuthStore((s) => s.sessionVersion);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [viewFilter, setViewFilter] = useState<KdsFilterKey>('all');
  const [recentTickets, setRecentTickets] = useState<KdsRecentTicket[]>([]);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftBusy, setShiftBusy] = useState(false);
  const [shiftMsg, setShiftMsg] = useState<string | null>(null);
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  const [dismissedCancelledIds, setDismissedCancelledIds] = useState<Set<string>>(() => new Set());

  const { data: stationList = [] } = useQuery<KitchenStationDto[]>({
    queryKey: ['kds-kitchen-stations', sessionVersion, user?.tenantId ?? 'default'],
    enabled: Boolean(user),
    queryFn: async () => {
      try {
        const res = await apiFetch<{
          stations?: KitchenStationDto[];
          data?: KitchenStationDto[];
        }>('/api/kitchen-stations');
        const list = Array.isArray(res?.stations)
          ? res.stations
          : Array.isArray(res?.data)
            ? res.data
            : Array.isArray(res)
              ? (res as unknown as KitchenStationDto[])
              : [];
        return list.filter(
          (s) => Boolean(s?.id && s?.name) && s.active !== 0 && s.active !== false,
        );
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60_000,
    retry: 0,
  });

  const defaultStationLabel = t('kds.allStations', 'All Stations');
  const stations = useMemo(
    () => [
      { id: 'all', label: defaultStationLabel },
      ...stationList.map((s) => ({ id: s.id, label: s.name })),
    ],
    [stationList, defaultStationLabel],
  );

  const {
    orders,
    shiftAvgPrepMinutes = null,
    isLoading,
    isError,
    error,
    refetch,
    updateStatus,
    markItemReady,
    recallOrder,
    pendingOrders = {},
    mutationErrors = {},
  } = useKDS(selectedStation);

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== 'served' && o.status !== 'cancelled'),
    [orders],
  );

  const activeOrderIds = useMemo(
    () => activeOrders.map((o) => o.id),
    [activeOrders],
  );

  // A new order beeps through WebAudio: no static asset to 404, and no
  // <audio> element whose failed load looks like a silent feature.
  useKdsAudio(activeOrderIds, soundEnabled, isLoading, selectedStation);

  const orderIdMap = useMemo(() => {
    const map = new Map<string, string>();
    const seenShort = new Set<string>();
    for (const o of activeOrders) {
      const shortId = o.orderNumber ? `#${o.orderNumber.replace(/^#/, '')}` : `#${o.id.slice(-4)}`;
      const displayId = seenShort.has(shortId) ? `#${o.id}` : shortId;
      seenShort.add(shortId);
      map.set(displayId, o.id);
      if (!map.has(shortId)) {
        map.set(shortId, o.id);
      }
      map.set(o.id, o.id);
    }
    return map;
  }, [activeOrders]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(
        () => setIsFullscreen(true),
        () => {},
      );
    } else {
      document.exitFullscreen().then(
        () => setIsFullscreen(false),
        () => {},
      );
    }
  }, []);

  const handleRetry = useCallback(() => {
    refetch();
  }, [refetch]);

  const inProgressOrders = useMemo(
    () =>
      activeOrders.filter(
        (o) => o.status !== 'ready' && calcElapsedSeconds(o.createdAt) <= MAX_METRIC_AGE_SECONDS,
      ),
    [activeOrders],
  );

  const avgTime = useMemo(() => {
    if (shiftAvgPrepMinutes !== null && Number.isFinite(shiftAvgPrepMinutes)) {
      return Math.max(0, Math.round(shiftAvgPrepMinutes));
    }
    const samples: number[] = [];
    for (const o of activeOrders) {
      if (o.status === 'ready' && o.readyAt) {
        const frozen = calcDurationSeconds(o.startedAt ?? o.createdAt, o.readyAt);
        if (frozen !== null && frozen <= MAX_SINGLE_PREP_SAMPLE_SECONDS) {
          samples.push(frozen);
        }
      } else if (o.status === 'preparing') {
        const elapsed = calcElapsedSeconds(o.startedAt ?? o.createdAt);
        if (elapsed <= MAX_SINGLE_PREP_SAMPLE_SECONDS) {
          samples.push(elapsed);
        }
      }
    }
    if (samples.length === 0) return 0;
    return Math.round(samples.reduce((sum, sec) => sum + sec, 0) / samples.length / 60);
  }, [activeOrders, shiftAvgPrepMinutes]);

  const stationCapacity = useMemo(() => {
    if (selectedStation !== 'all') {
      const matched = stationList.find((s) => s.id === selectedStation);
      const cap = Number(matched?.capacity ?? matched?.max_concurrent ?? DEFAULT_STATION_CAPACITY);
      return Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_STATION_CAPACITY;
    }
    if (stationList.length > 0) {
      const totalCap = stationList.reduce((sum, s) => {
        const cap = Number(s.capacity ?? s.max_concurrent ?? DEFAULT_STATION_CAPACITY);
        return sum + (Number.isFinite(cap) && cap > 0 ? cap : DEFAULT_STATION_CAPACITY);
      }, 0);
      return Math.max(DEFAULT_STATION_CAPACITY, totalCap);
    }
    return 12;
  }, [selectedStation, stationList]);

  const stationLoadPct = useMemo(() => {
    return Math.min(Math.round((inProgressOrders.length / stationCapacity) * 100), 100);
  }, [inProgressOrders, stationCapacity]);

  const cancelledOrders = useMemo(
    () => orders.filter((o) => o.status === 'cancelled' && !dismissedCancelledIds.has(o.id)),
    [orders, dismissedCancelledIds],
  );

  const tickets = useMemo((): Ticket[] => {
    const seenShort = new Set<string>();
    return activeOrders
      .map((o): Ticket => {
        const shortId = o.orderNumber ? `#${o.orderNumber.replace(/^#/, '')}` : `#${o.id.slice(-4)}`;
        const ticketId = seenShort.has(shortId) ? `#${o.id}` : shortId;
        seenShort.add(shortId);
        const rawWorkflowStatus = o.status;
        const isStale = calcElapsedSeconds(o.createdAt) > MAX_METRIC_AGE_SECONDS;
        const elapsedSeconds = calcElapsedSeconds(o.createdAt);
        // Never inflate ready total time with multi-day updated_at when ready_at is NULL
        const frozenReadySeconds =
          o.status === 'ready'
            ? (o.readyAt
                ? (calcDurationSeconds(o.startedAt ?? o.createdAt, o.readyAt) ?? 0)
                : Math.min(elapsedSeconds, MAX_SINGLE_PREP_SAMPLE_SECONDS))
            : undefined;
        const readyWaitSeconds =
          o.status === 'ready'
            ? (o.readyAt ? calcElapsedSeconds(o.readyAt) : elapsedSeconds)
            : undefined;
        const isOverdue =
          !isStale &&
          (rawWorkflowStatus === 'pending' || rawWorkflowStatus === 'confirmed' || rawWorkflowStatus === 'preparing') &&
          elapsedSeconds >= OVERDUE_THRESHOLD_MIN * 60;
        const isWarning =
          !isStale &&
          !isOverdue &&
          (rawWorkflowStatus === 'pending' || rawWorkflowStatus === 'confirmed' || rawWorkflowStatus === 'preparing') &&
          elapsedSeconds >= WARNING_THRESHOLD_MIN * 60;
        const status: TicketStatus = isOverdue
          ? 'overdue'
          : rawWorkflowStatus === 'confirmed'
            ? 'pending'
            : (rawWorkflowStatus as TicketStatus);
        const normalizedOrderType = (o.orderType ?? '').trim().toLowerCase();
        const isDelivery = normalizedOrderType === 'delivery';
        const isTakeaway = normalizedOrderType === 'takeaway';
        const ticketType: Ticket['type'] = isDelivery
          ? 'DELIVERY'
          : isTakeaway
            ? 'TOGO'
            : normalizedOrderType === 'dine_in' || Boolean(o.table)
              ? 'DINE IN'
              : 'TOGO';
        const formattedTable = o.table
          ? formatTableWithPrefix(o.table, (clean) =>
              t('kds.tablePrefix', { table: clean, defaultValue: `Bàn ${clean}` }),
            )
          : '';
        const tableLabel = isDelivery || isTakeaway
          ? (o.customerName || formattedTable)
          : (formattedTable || o.customerName || '');
        const payMethod = (o.paymentMethod ?? '').trim().toLowerCase();
        const payStatus = (o.paymentStatus ?? '').trim().toLowerCase();
        const isUnpaidCod =
          (payMethod === 'cod' || payMethod === 'cash') &&
          payStatus !== '' &&
          payStatus !== 'paid' &&
          payStatus !== 'completed' &&
          payStatus !== 'partially_refunded';
        return {
          id: ticketId,
          orderId: o.id,
          table: tableLabel,
          type: ticketType,
          status,
          rawStatus: rawWorkflowStatus,
          isOverdue,
          isWarning,
          isStale,
          items: o.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            ready: item.ready,
            ...splitKdsItemModifierAndNotes(item),
          })),
          ...(o.notes ? { notes: o.notes } : {}),
          elapsedSeconds: frozenReadySeconds ?? elapsedSeconds,
          ...(frozenReadySeconds !== undefined
            ? { totalTimeSeconds: frozenReadySeconds }
            : {}),
          ...(readyWaitSeconds !== undefined ? { readyWaitSeconds } : {}),
          ...(isUnpaidCod ? { blockPickupReason: t('orderMgmt.codUnpaidServeError', 'Đơn COD/tiền mặt chưa thu tiền') } : {}),
        };
      });
  }, [activeOrders, t]);

  const handleStartPrep = useCallback(
    (ticketId: string) => {
      const fullId = orderIdMap.get(ticketId);
      if (fullId) updateStatus(fullId, 'preparing');
    },
    [orderIdMap, updateStatus],
  );

  const handleCompleteTicket = useCallback(
    (ticketId: string) => {
      const fullId = orderIdMap.get(ticketId);
      if (fullId) updateStatus(fullId, 'ready');
    },
    [orderIdMap, updateStatus],
  );

  const handlePickupOrder = useCallback(
    (ticketId: string) => {
      const fullId = orderIdMap.get(ticketId);
      if (fullId) updateStatus(fullId, 'served');
    },
    [orderIdMap, updateStatus],
  );

  const handleToggleItemReady = useCallback(
    (ticketId: string, itemIndex: number) => {
      const fullId = orderIdMap.get(ticketId);
      if (fullId && markItemReady) {
        markItemReady(fullId, itemIndex);
      }
    },
    [orderIdMap, markItemReady],
  );

  const loadRecentBumpedTickets = useCallback(async () => {
    try {
      const res = await apiFetch<{
        data?: Array<{
          id: string;
          order_number?: string;
          table_name?: string;
          table_id?: string | null;
          status: string;
          items?: Array<{ name?: string; product_name?: string; quantity?: number; qty?: number }>;
        }>;
      }>('/api/kds/orders/recent');
      const list = Array.isArray(res?.data) ? res.data : [];
      setRecentTickets(
        list.map((r) => ({
          id: r.id,
          displayId: r.order_number ? `#${r.order_number.replace(/^#/, '')}` : `#${r.id.slice(-4)}`,
          table: formatTableWithPrefix(r.table_name || r.table_id || '', (clean) =>
            t('kds.tablePrefix', { table: clean, defaultValue: `Bàn ${clean}` }),
          ),
          status: r.status,
          itemsSummary: (r.items || [])
            .map((it) => `${it.quantity ?? it.qty ?? 1}x ${it.name ?? it.product_name ?? ''}`)
            .join(', '),
        })),
      );
    } catch {
      setRecentTickets([]);
    }
  }, [t]);

  const handleRecallTicket = useCallback(
    async (orderId: string, targetStatus?: 'preparing' | 'ready') => {
      if (!recallOrder) return;
      const ok = await recallOrder(orderId, targetStatus);
      if (ok) {
        void loadRecentBumpedTickets();
        refetch();
      }
    },
    [recallOrder, loadRecentBumpedTickets, refetch],
  );

  const handleOpenShiftModal = useCallback(async () => {
    setShowShiftModal(true);
    setShiftMsg(null);
    try {
      const res = await apiFetch<{ shifts?: Array<{ id: string; staff_id?: string; status?: string; clock_out?: string | null }> }>('/api/shifts/today');
      const list = Array.isArray(res?.shifts) ? res.shifts : [];
      const mine = list.find(
        (s) => (!user?.id || s.staff_id === user.id) && s.status !== 'closed' && !s.clock_out,
      );
      setActiveShiftId(mine?.id ?? null);
    } catch {
      setActiveShiftId(null);
    }
  }, [user?.id]);

  const handleClockShift = useCallback(
    async (mode: 'in' | 'out') => {
      setShiftBusy(true);
      setShiftMsg(null);
      try {
        if (mode === 'in') {
          const res = await apiFetch<{ shift?: { id?: string } }>('/api/shifts/clock-in', {
            method: 'POST',
            body: JSON.stringify({ ...(user?.id ? { staff_id: user.id } : {}) }),
          });
          setActiveShiftId(res?.shift?.id ?? 'open');
          setShiftMsg(t('kds.clockInSuccess', 'Đã chấm công vào ca'));
        } else {
          await apiFetch('/api/shifts/clock-out', {
            method: 'POST',
            body: JSON.stringify({ ...(user?.id ? { staff_id: user.id } : {}) }),
          });
          setActiveShiftId(null);
          setShiftMsg(t('kds.clockOutSuccess', 'Đã kết ca'));
        }
      } catch (err) {
        setShiftMsg(err instanceof Error ? err.message : t('kds.updateFailed', 'Không thể cập nhật'));
      } finally {
        setShiftBusy(false);
      }
    },
    [user?.id, t],
  );

  const dynamicStoreName = useMemo(() => {
    const u = user as (typeof user & { storeName?: string; tenantName?: string }) | null;
    if (u?.storeName && u.storeName.trim()) return u.storeName.trim();
    if (u?.tenantName && u.tenantName.trim()) return u.tenantName.trim();
    if (user?.tenantId && user.tenantId !== 'default' && user.tenantId !== '*') {
      return user.tenantId.toUpperCase();
    }
    return brandConfig.brand.name;
  }, [user]);

  const errorMessage = error?.message ?? t('kds.loadError', 'Failed to load orders');
  const selectedStationName =
    stations.find((s) => s.id === selectedStation)?.label ?? t('kds.barStation', 'Bar Station');
  const sidebarStationLabel =
    selectedStation === 'all'
      ? t('kds.mainKitchen', 'Main Kitchen')
      : t('kds.station', 'STATION');

  const cancelledBanner =
    cancelledOrders.length > 0 ? (
      <div
        role="alert"
        aria-live="assertive"
        className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--md-sys-shape-corner-medium)] border-2 border-[var(--md-sys-color-error)] bg-[var(--md-sys-color-error-container)] px-4 py-3 text-[var(--md-sys-color-on-error-container)]"
      >
        <div>
          <p className="text-sm font-bold uppercase tracking-wide">
            {t('kds.cancelledBanner', {
              count: cancelledOrders.length,
              defaultValue: `CANCELLED — STOP PREP (${cancelledOrders.length})`,
            })}
          </p>
          <div className="mt-1 flex flex-wrap gap-3 text-xs font-mono">
            {cancelledOrders.map((c) => {
              const channelText =
                c.orderType === 'delivery'
                  ? t('kds.delivery', 'Delivery')
                  : c.table
                    ? formatTableWithPrefix(c.table, (clean) =>
                        t('kds.tablePrefix', { table: clean, defaultValue: `Table ${clean}` }),
                      )
                    : t('kds.togo', 'To Go');
              return (
                <span key={c.id} className="line-through">
                  #{c.orderNumber ? c.orderNumber.replace(/^#/, '') : c.id.slice(-4)} ({channelText}):{' '}
                  {c.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                </span>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            setDismissedCancelledIds((prev) => {
              const next = new Set(prev);
              for (const c of cancelledOrders) next.add(c.id);
              return next;
            })
          }
          className="shrink-0 rounded border border-current/40 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors hover:bg-white/10"
        >
          {t('kds.dismiss', 'Dismiss')}
        </button>
      </div>
    ) : null;

  return (
    <>
      <HelmetHead
        title={t('kds.pageTitle', 'Kitchen Display System — AURA CAFE')}
        description={t('kds.pageDescription', 'Kitchen order display for AURA CAFE staff.')}
      />
      <div className="relative">
        <StitchKDSNew
          tickets={tickets}
          storeName={dynamicStoreName}
          cancelledBanner={cancelledBanner}
          pendingOrders={Object.fromEntries([...orderIdMap].map(([displayId, id]) => [displayId, pendingOrders[id] ?? false]))}
          mutationErrors={Object.fromEntries([...orderIdMap].filter(([, id]) => mutationErrors[id]).map(([displayId, id]) => [displayId, mutationErrors[id]!]))}
          stationName={selectedStationName}
          stationLabel={sidebarStationLabel}
          stationLocation={t('kds.mainKitchen', 'Main Kitchen')}
          selectedStation={selectedStation}
          stations={stations}
          onStationChange={setSelectedStation}
          stationLoad={stationLoadPct}
          avgPrepTime={`${avgTime}${t('kds.minutesShort', 'm')}`}
          isLoading={isLoading}
          error={isError ? errorMessage : null}
          onCompleteTicket={handleCompleteTicket}
          onStartPrep={handleStartPrep}
          onPickupOrder={handlePickupOrder}
          onToggleItemReady={handleToggleItemReady}
          recentTickets={recentTickets}
          onRecallTicket={handleRecallTicket}
          onOpenRecallDrawer={loadRecentBumpedTickets}
          onOpenShiftModal={handleOpenShiftModal}
          onRefresh={handleRetry}
          activeFilter={viewFilter}
          onFilterChange={(filter) => {
            if (filter) setViewFilter(filter);
          }}
          soundEnabled={soundEnabled}
          isFullscreen={isFullscreen}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
          onToggleFullscreen={toggleFullscreen}
        />
        {showShiftModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('kds.shiftAttendance', 'Ca trực')}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
          >
            <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0A1A2E] p-6 text-white shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-bold uppercase tracking-wider">
                  {t('kds.shiftAttendance', 'Ca trực & Chấm công')}
                </h2>
                <button
                  type="button"
                  onClick={() => setShowShiftModal(false)}
                  className="rounded px-2 py-1 text-sm text-white/70 hover:bg-white/10"
                >
                  ✕
                </button>
              </div>
              {shiftMsg && (
                <p className="mb-3 rounded bg-white/5 px-3 py-2 text-xs text-sky-200">{shiftMsg}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={shiftBusy || Boolean(activeShiftId)}
                  onClick={() => { void handleClockShift('in'); }}
                  className="rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-bold uppercase text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
                >
                  {t('kds.clockIn', 'Vào ca')}
                </button>
                <button
                  type="button"
                  disabled={shiftBusy || !activeShiftId}
                  onClick={() => { void handleClockShift('out'); }}
                  className="rounded-lg border border-red-400/50 bg-red-500/20 px-4 py-2.5 text-xs font-bold uppercase text-red-200 hover:bg-red-500/30 disabled:opacity-40"
                >
                  {t('kds.clockOut', 'Kết ca')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
