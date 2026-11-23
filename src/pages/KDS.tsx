import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { useKDS } from '@/hooks/use-kds';
import {
  StitchKDSNew,
  type Ticket,
  type TicketStatus,
} from '@/components/stitch/StitchKDSNew';
import { OVERDUE_THRESHOLD_MIN, calcElapsedSeconds } from './kds-types';
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

const DEFAULT_STATION_OPTION = { id: 'all', label: 'Tất cả trạm' } as const;

export default function KDSPage() {
  const user = useAuthStore((s) => s.user);
  const sessionVersion = useAuthStore((s) => s.sessionVersion);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedStation, setSelectedStation] = useState<string>('all');
  const [viewFilter, setViewFilter] = useState<
    'all' | 'priority' | 'preparing' | 'ready'
  >('all');

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

  const stations = useMemo(
    () => [
      DEFAULT_STATION_OPTION,
      ...stationList.map((s) => ({ id: s.id, label: s.name })),
    ],
    [stationList],
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
    for (const o of orders) {
      const shortId = `#${o.id.slice(-4)}`;
      const displayId = seenShort.has(shortId) ? `#${o.id}` : shortId;
      seenShort.add(shortId);
      map.set(displayId, o.id);
      if (!map.has(shortId)) {
        map.set(shortId, o.id);
      }
      map.set(o.id, o.id);
    }
    return map;
  }, [orders]);

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

  const avgTime = useMemo(() => {
    if (activeOrders.length === 0) return 0;
    return Math.round(
      activeOrders.reduce((sum, o) => sum + calcElapsedSeconds(o.createdAt), 0) /
        activeOrders.length /
        60,
    );
  }, [activeOrders]);

  const stationLoadPct = useMemo(() => {
    return Math.min(Math.round((activeOrders.length / 20) * 100), 100);
  }, [activeOrders]);

  const cancelledOrders = useMemo(
    () => orders.filter((o) => o.status === 'cancelled'),
    [orders],
  );

  const tickets = useMemo((): Ticket[] => {
    const seenShort = new Set<string>();
    return activeOrders
      .map((o): Ticket => {
        const shortId = `#${o.id.slice(-4)}`;
        const ticketId = seenShort.has(shortId) ? `#${o.id}` : shortId;
        seenShort.add(shortId);
        const normalizedRawStatus =
          (o.status as string) === 'confirmed' ? 'pending' : o.status;
        const elapsedSeconds = calcElapsedSeconds(o.createdAt);
        const isOverdue =
          (normalizedRawStatus === 'pending' || normalizedRawStatus === 'preparing') &&
          elapsedSeconds >= OVERDUE_THRESHOLD_MIN * 60;
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
          ? 'GIAO HÀNG'
          : o.table
            ? `Bàn ${o.table}`
            : 'MANG ĐI';
        return {
          id: ticketId,
          table: tableLabel,
          type: ticketType,
          status,
          rawStatus: normalizedRawStatus,
          isOverdue,
          items: o.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            ...splitKdsItemModifierAndNotes(item),
          })),
          ...(o.notes ? { notes: o.notes } : {}),
          elapsedSeconds,
          ...(o.status === 'ready'
            ? { totalTimeSeconds: elapsedSeconds }
            : {}),
        };
      });
  }, [activeOrders]);

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

  const errorMessage = error?.message ?? 'Failed to load orders';

  return (
    <>
      <HelmetHead
        title="Kitchen Display System — AURA CAFE"
        description="Kitchen order display for AURA CAFE staff. He thong hien thi don hang cho nhan vien."
      />
      <div className="relative">
        {cancelledOrders.length > 0 && (
          <div
            role="alert"
            aria-live="assertive"
            className="mx-4 my-2 rounded-[var(--md-sys-shape-corner-medium)] border-2 border-[var(--md-sys-color-error)] bg-[var(--md-sys-color-error-container)] px-4 py-3 text-[var(--md-sys-color-on-error-container)]"
          >
            <p className="text-sm font-bold uppercase tracking-wide">
              ĐÃ HỦY — DỪNG PHA CHẾ ({cancelledOrders.length})
            </p>
            <div className="mt-1 flex flex-wrap gap-3 text-xs font-mono">
              {cancelledOrders.map((c) => (
                <span key={c.id} className="line-through">
                  #{c.id.slice(-4)} {c.table ? `(Bàn ${c.table})` : '(Mang đi)'}: {c.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                </span>
              ))}
            </div>
          </div>
        )}
        <StitchKDSNew
          tickets={tickets}
          pendingOrders={Object.fromEntries([...orderIdMap].map(([displayId, id]) => [displayId, pendingOrders[id] ?? false]))}
          mutationErrors={Object.fromEntries([...orderIdMap].filter(([, id]) => mutationErrors[id]).map(([displayId, id]) => [displayId, mutationErrors[id]!]))}
          stationName={stations.find((s) => s.id === selectedStation)?.label ?? 'QUẦY PHA CHẾ'}
          stationLabel={stations.find((s) => s.id === selectedStation)?.label ?? 'TẤT CẢ TRẠM'}
          stationLocation="BẾP CHÍNH"
          selectedStation={selectedStation}
          stations={stations}
          onStationChange={setSelectedStation}
          stationLoad={stationLoadPct}
          avgPrepTime={`${avgTime}M`}
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
