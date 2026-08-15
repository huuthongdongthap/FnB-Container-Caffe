import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useKDS } from '@/hooks/use-kds';
import {
  StitchKDSNew,
  type Ticket,
  type TicketStatus,
} from '@/components/stitch/StitchKDSNew';
import { OVERDUE_THRESHOLD_MIN, calcElapsedSeconds } from './kds-types';
import { KdsToolbar } from './kds-toolbar';

/* ─── Re-export types for backward compatibility ─────────────── */
export type { Ticket, TicketStatus } from './kds-types';

/* ─── Main Page Component ──────────────────────────────────────── */

export default function KDSPage() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewFilter, setViewFilter] = useState<
    'all' | 'priority' | 'preparing' | 'ready'
  >('all');
  const audioRef = useRef<HTMLAudioElement>(null);
  const prevOrderCountRef = useRef(0);

  const { orders, isLoading, isError, error, updateStatus } = useKDS('all');

  const orderIdMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orders) {
      map.set(`#${o.id.slice(-4)}`, o.id);
    }
    return map;
  }, [orders]);

  useEffect(() => {
    if (
      orders.length > prevOrderCountRef.current &&
      soundEnabled &&
      audioRef.current
    ) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
    prevOrderCountRef.current = orders.length;
  }, [orders.length, soundEnabled]);

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
    window.location.reload();
  }, []);

  const avgTime = useMemo(() => {
    if (orders.length === 0) return 0;
    return Math.round(
      orders.reduce((sum, o) => sum + calcElapsedSeconds(o.createdAt), 0) /
        orders.length /
        60,
    );
  }, [orders]);

  const stationLoadPct = useMemo(() => {
    const active = orders.filter((o) => o.status !== 'served').length;
    return Math.min(Math.round((active / 20) * 100), 100);
  }, [orders]);

  const tickets = useMemo((): Ticket[] => {
    return orders
      .filter((o) => o.status !== 'served')
      .map((o): Ticket => {
        const elapsedSeconds = calcElapsedSeconds(o.createdAt);
        const status: TicketStatus =
          o.status === 'pending' &&
          elapsedSeconds >= OVERDUE_THRESHOLD_MIN * 60
            ? 'overdue'
            : (o.status as TicketStatus);
        return {
          id: `#${o.id.slice(-4)}`,
          table: o.table ? `TABLE ${o.table}` : 'TAKEAWAY',
          type: o.table ? ('DINE IN' as const) : ('TOGO' as const),
          status,
          items: o.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            ...(item.modifiers?.[0]
              ? { modifier: item.modifiers[0] }
              : {}),
          })),
          elapsedSeconds,
          ...(o.status === 'ready'
            ? { totalTimeSeconds: elapsedSeconds }
            : {}),
        };
      });
  }, [orders]);

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
        <audio ref={audioRef} preload="auto" className="hidden">
          <source src="/sounds/new-order.mp3" type="audio/mpeg" />
        </audio>

        <KdsToolbar
          soundEnabled={soundEnabled}
          isFullscreen={isFullscreen}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
          onToggleFullscreen={toggleFullscreen}
        />

        <StitchKDSNew
          tickets={tickets}
          stationName="KITCHEN STATION"
          stationLabel="STATION 01"
          stationLocation="MAIN KITCHEN"
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
        />
      </div>
    </>
  );
}
