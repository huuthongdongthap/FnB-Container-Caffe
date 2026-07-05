import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useKDS } from '@/hooks/use-kds';
import {
  StitchKDSNew,
  type Ticket,
  type TicketStatus,
} from '@/components/stitch/StitchKDSNew';
import { Bell, BellOff, Maximize2, Minimize2 } from 'lucide-react';

/* ─── Constants ────────────────────────────────────────────────── */

const OVERDUE_THRESHOLD_MIN = 15;

/* ─── Helpers ──────────────────────────────────────────────────── */

function calcElapsedSeconds(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  return Math.floor((Date.now() - created) / 1000);
}

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

  /* ── Reverse lookup: short display ID -> full order ID ── */
  const orderIdMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orders) {
      map.set(`#${o.id.slice(-4)}`, o.id);
    }
    return map;
  }, [orders]);

  /* ── Sound on new order ── */
  useEffect(() => {
    if (
      orders.length > prevOrderCountRef.current &&
      soundEnabled &&
      audioRef.current
    ) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        /* autoplay may be blocked */
      });
    }
    prevOrderCountRef.current = orders.length;
  }, [orders.length, soundEnabled]);

  /* ── Fullscreen ── */
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

  /* ── Derived data ── */
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

  /* ── Map KDSOrder[] -> Ticket[] ── */
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

  /* ── Handlers (resolve short ID -> full ID) ── */
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

  /* ── Render ── */
  return (
    <>
      <HelmetHead
        title="Kitchen Display System — AURA CAFE"
        description="Kitchen order display for AURA CAFE staff. He thong hien thi don hang cho nhan vien."
      />
      <div className="relative">
        {/* Hidden audio for new-order sound notification */}
      <audio ref={audioRef} preload="auto" className="hidden">
        <source src="/sounds/new-order.mp3" type="audio/mpeg" />
      </audio>

      {/* Floating toolbar: sound toggle + fullscreen toggle */}
      <div className="fixed top-3 right-4 z-[100] flex items-center gap-1">
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          type="button"
          className="rounded p-1.5 text-[var(--aura-text-primary,#e8e8e8)] transition-colors hover:bg-white/5"
          title={soundEnabled ? 'Mute alerts' : 'Enable alerts'}
        >
          {soundEnabled ? <Bell size={16} /> : <BellOff size={16} />}
        </button>
        <button
          onClick={toggleFullscreen}
          type="button"
          className="rounded p-1.5 text-[var(--aura-text-primary,#e8e8e8)] transition-colors hover:bg-white/5"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>

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
