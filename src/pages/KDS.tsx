import { useState, useCallback, useMemo } from 'react';
import { HelmetHead } from '@/components/seo/HelmetHead';
import { useKDS } from '@/hooks/use-kds';
import {
  StitchKDSNew,
  type Ticket,
  type TicketStatus,
} from '@/components/stitch/StitchKDSNew';
import { OVERDUE_THRESHOLD_MIN, calcElapsedSeconds } from './kds-types';
import { KdsToolbar } from './kds-toolbar';
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

export default function KDSPage() {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [viewFilter, setViewFilter] = useState<
    'all' | 'priority' | 'preparing' | 'ready'
  >('all');

  const { orders, isLoading, isError, error, updateStatus } = useKDS('all');

  // A new order beeps through WebAudio: no static asset to 404, and no
  // <audio> element whose failed load looks like a silent feature.
  useKdsAudio(orders.length, soundEnabled);

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
    const active = orders.filter((o) => o.status !== 'served' && o.status !== 'cancelled').length;
    return Math.min(Math.round((active / 20) * 100), 100);
  }, [orders]);

  const cancelledOrders = useMemo(
    () => orders.filter((o) => o.status === 'cancelled'),
    [orders],
  );

  const tickets = useMemo((): Ticket[] => {
    const seenShort = new Set<string>();
    return orders
      .filter((o) => o.status !== 'served' && o.status !== 'cancelled')
      .map((o): Ticket => {
        const shortId = `#${o.id.slice(-4)}`;
        const ticketId = seenShort.has(shortId) ? `#${o.id}` : shortId;
        seenShort.add(shortId);
        const normalizedRawStatus =
          (o.status as string) === 'confirmed' ? 'pending' : o.status;
        const elapsedSeconds = calcElapsedSeconds(o.createdAt);
        const status: TicketStatus =
          (normalizedRawStatus === 'pending' || normalizedRawStatus === 'preparing') &&
          elapsedSeconds >= OVERDUE_THRESHOLD_MIN * 60
            ? 'overdue'
            : (normalizedRawStatus as TicketStatus);
        return {
          id: ticketId,
          table: o.table ? `TABLE ${o.table}` : 'TAKEAWAY',
          type: o.table ? ('DINE IN' as const) : ('TOGO' as const),
          status,
          rawStatus: normalizedRawStatus,
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
        <KdsToolbar
          soundEnabled={soundEnabled}
          isFullscreen={isFullscreen}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
          onToggleFullscreen={toggleFullscreen}
        />

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
