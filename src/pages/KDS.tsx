import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { useKDS } from '@/hooks/use-kds';
import {
  StitchKDSNew,
  type Ticket,
  type TicketStatus,
} from '@/components/stitch/StitchKDSNew';
import type { KdsFilterKey } from '@/components/stitch/stitch-kds-types';
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

interface KitchenStationDto {
  id: string;
  name: string;
  active?: number | boolean;
}

export default function KDSPage() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const sessionVersion = useAuthStore((s) => s.sessionVersion);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [viewFilter, setViewFilter] = useState<KdsFilterKey>('all');
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

  const { orders, isLoading, isError, error, refetch, updateStatus, pendingOrders = {}, mutationErrors = {} } = useKDS(selectedStation);

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
    () => activeOrders.filter((o) => o.status !== 'ready'),
    [activeOrders],
  );

  const avgTime = useMemo(() => {
    const samples: number[] = [];
    for (const o of activeOrders) {
      if (o.status === 'ready') {
        const frozen = calcDurationSeconds(o.startedAt ?? o.createdAt, o.readyAt ?? o.updatedAt);
        if (frozen !== null && frozen <= MAX_METRIC_AGE_SECONDS) {
          samples.push(frozen);
        }
      } else if (o.status === 'preparing') {
        const elapsed = calcElapsedSeconds(o.startedAt ?? o.createdAt);
        if (elapsed <= MAX_METRIC_AGE_SECONDS) {
          samples.push(elapsed);
        }
      }
    }
    if (samples.length === 0) return 0;
    return Math.round(samples.reduce((sum, sec) => sum + sec, 0) / samples.length / 60);
  }, [activeOrders]);

  const stationLoadPct = useMemo(() => {
    return Math.min(Math.round((inProgressOrders.length / 20) * 100), 100);
  }, [inProgressOrders]);

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
        const normalizedRawStatus =
          (o.status as string) === 'confirmed' ? 'pending' : o.status;
        const elapsedSeconds = calcElapsedSeconds(o.createdAt);
        const frozenReadySeconds =
          o.status === 'ready'
            ? (calcDurationSeconds(o.createdAt, o.readyAt ?? o.updatedAt) ?? elapsedSeconds)
            : undefined;
        const isOverdue =
          (normalizedRawStatus === 'pending' || normalizedRawStatus === 'preparing') &&
          elapsedSeconds >= OVERDUE_THRESHOLD_MIN * 60;
        const isWarning =
          !isOverdue &&
          (normalizedRawStatus === 'pending' || normalizedRawStatus === 'preparing') &&
          elapsedSeconds >= WARNING_THRESHOLD_MIN * 60;
        const status: TicketStatus = isOverdue
          ? 'overdue'
          : (normalizedRawStatus as TicketStatus);
        const isDelivery = o.orderType === 'delivery';
        const ticketType: Ticket['type'] = isDelivery
          ? 'DELIVERY'
          : o.table
            ? 'DINE IN'
            : 'TOGO';
        const tableLabel = isDelivery
          ? (o.customerName || '')
          : o.table
            ? t('kds.tablePrefix', { table: o.table, defaultValue: `Bàn ${o.table}` })
            : (o.customerName || '');
        return {
          id: ticketId,
          table: tableLabel,
          type: ticketType,
          status,
          rawStatus: normalizedRawStatus,
          isOverdue,
          isWarning,
          items: o.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            ...splitKdsItemModifierAndNotes(item),
          })),
          ...(o.notes ? { notes: o.notes } : {}),
          elapsedSeconds: frozenReadySeconds ?? elapsedSeconds,
          ...(frozenReadySeconds !== undefined
            ? { totalTimeSeconds: frozenReadySeconds }
            : {}),
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
                    ? t('kds.tablePrefix', { table: c.table, defaultValue: `Table ${c.table}` })
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
      </div>
    </>
  );
}
