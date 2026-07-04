import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Bell,
  BellOff,
  LayoutDashboard,
  History,
  Package,
  Users,
  RefreshCw,
  Maximize2,
  Minimize2,
  AlertTriangle,
} from 'lucide-react';
import { useKDS, type KDSOrder } from '@/hooks/use-kds';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

/* ─── Types ──────────────────────────────────────────────────── */

type ViewFilter = 'all' | 'priority' | 'preparing' | 'ready';

const OVERDUE_THRESHOLD_MIN = 15;

/* ─── Helpers ────────────────────────────────────────────────── */

function calcElapsedSeconds(createdAt: string): number {
  const created = new Date(createdAt).getTime();
  return Math.floor((Date.now() - created) / 1000);
}

function formatElapsed(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function calcAvgMinutes(orders: KDSOrder[]): number {
  if (orders.length === 0) return 0;
  return Math.round(
    orders.reduce((sum, o) => sum + calcElapsedSeconds(o.createdAt), 0) /
      orders.length /
      60,
  );
}

/* ─── Inline Styles (keyframes & scrollbars) ─────────────────── */

const KDS_STYLES = `
  @keyframes pulse-glow {
    0%, 100% { text-shadow: 0 0 10px rgba(255, 180, 171, 0.2); opacity: 1; }
    50% { text-shadow: 0 0 25px rgba(255, 180, 171, 0.8); opacity: 0.8; }
  }
  .kds-timer-error {
    animation: pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  .kds-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
  .kds-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .kds-scrollbar::-webkit-scrollbar-thumb { background: #44474d; border-radius: 10px; }
`;

/* ─── Glass Card Base ────────────────────────────────────────── */

const GLASS_CLASS =
  'bg-[rgba(10,26,46,0.6)] backdrop-blur-[20px] border border-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)] rounded-lg';

/* ─── Sub-Components ─────────────────────────────────────────── */

function SkeletonTicket() {
  return (
    <article
      className={`${GLASS_CLASS} flex flex-col h-[400px] overflow-hidden animate-pulse`}
    >
      <div className="h-1 w-full bg-[#273647]/50 shrink-0" />
      <div className="p-6 flex-grow space-y-4">
        <div className="flex justify-between">
          <div className="space-y-2">
            <div className="h-8 w-24 rounded bg-[#273647]/50" />
            <div className="h-4 w-36 rounded bg-[#273647]/30" />
          </div>
          <div className="text-right space-y-2">
            <div className="h-10 w-20 rounded bg-[#273647]/50" />
            <div className="h-4 w-16 rounded bg-[#273647]/30" />
          </div>
        </div>
        <div className="space-y-3 mt-6">
          <div className="h-6 w-3/4 rounded bg-[#273647]/40" />
          <div className="h-6 w-1/2 rounded bg-[#273647]/40" />
        </div>
      </div>
      <div className="p-6 border-t border-white/10">
        <div className="h-14 w-full rounded-lg bg-[#273647]/40" />
      </div>
    </article>
  );
}

/* ─── OrderTicketCard (inline, respecting KDS design) ────────── */

interface OrderTicketCardProps {
  order: KDSOrder;
  elapsedSeconds: number;
  onStartPrep?: (orderId: string) => void;
  onComplete?: (orderId: string) => void;
  onPickup?: (orderId: string) => void;
}

function OrderTicketCard({
  order,
  elapsedSeconds,
  onStartPrep,
  onComplete,
  onPickup,
}: OrderTicketCardProps) {
  const { t } = useTranslation('kds');
  const isOverdue =
    order.status === 'pending' &&
    elapsedSeconds >= OVERDUE_THRESHOLD_MIN * 60;

  /* ── Derive visual treatment from status ── */
  const isReady = order.status === 'ready';
  const isPreparing = order.status === 'preparing';
  const isPending = order.status === 'pending';

  let barColor: string;
  let timerLabel: string;
  let buttonLabel: string;
  let buttonAction: (() => void) | undefined;
  let isDimmed = false;

  if (isOverdue) {
    barColor = 'bg-[#ffb4ab]';
    timerLabel = t('kds.overdue');
    buttonLabel = t('kds.priority_complete');
    buttonAction = onComplete ? () => onComplete(order.id) : undefined;
  } else if (isPreparing) {
    barColor = 'bg-[#efbd8a]';
    timerLabel = t('kds.elapsed');
    buttonLabel = t('kds.complete_ticket');
    buttonAction = onComplete ? () => onComplete(order.id) : undefined;
  } else if (isReady) {
    barColor = 'bg-[#adc8f5]';
    timerLabel = t('kds.total_time');
    buttonLabel = t('kds.order_picked_up');
    buttonAction = onPickup ? () => onPickup(order.id) : undefined;
    isDimmed = true;
  } else {
    // pending (normal)
    barColor = 'bg-[#dfaf7e]';
    timerLabel = t('kds.elapsed');
    buttonLabel = t('kds.start_prep');
    buttonAction = onStartPrep ? () => onStartPrep(order.id) : undefined;
  }

  return (
    <article
      className={cn(
        `${GLASS_CLASS} flex flex-col h-[400px] relative overflow-hidden group`,
        isDimmed && 'opacity-80',
        isOverdue && 'ring-1 ring-[#ffb4ab]/50',
      )}
    >
      {/* Top status bar */}
      <div className={cn('h-1 w-full shrink-0', barColor)} />

      {/* Ready overlay */}
      {isReady && (
        <div className="absolute inset-0 bg-[#adc8f5]/5 pointer-events-none z-0" />
      )}

      <div className="p-6 flex-grow flex flex-col z-10 relative">
        {/* Header: ticket number + table info + timer */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2
              className={cn(
                "font-['Cormorant_Garamond'] text-[32px] leading-[1.2] font-bold",
                isOverdue
                  ? 'text-[#ffb4ab]'
                  : isPreparing
                    ? 'text-[#efbd8a]'
                    : isReady
                      ? 'text-[#adc8f5]'
                      : 'text-[#d4e4fa]',
              )}
            >
              #{order.id.slice(-4)}
            </h2>
            <p className="text-[12px] leading-[1] tracking-[0.1em] font-bold text-[#c5c6cd] uppercase">
              {order.table ? t('kds.table_number', { number: order.table }) : t('kds.takeaway')} &bull;{' '}
              {order.station?.toUpperCase() ?? t('kds.dine_in')}
            </p>
          </div>
          <div className="text-right">
            <span
              className={cn(
                "font-['Space_Grotesk'] text-[40px] leading-[1] tracking-[-0.05em] font-bold",
                isOverdue
                  ? 'text-[#ffb4ab] kds-timer-error'
                  : isPreparing
                    ? 'text-[#efbd8a]'
                    : isReady
                      ? 'text-[#adc8f5]'
                      : 'text-[#d4e4fa]',
              )}
            >
              {formatElapsed(elapsedSeconds)}
            </span>
            <p
              className={cn(
                'text-[12px] leading-[1] tracking-[0.1em] font-bold uppercase mt-1',
                isOverdue ? 'text-[#ffb4ab]' : 'text-[#c5c6cd]',
              )}
            >
              {timerLabel}
            </p>
          </div>
        </div>

        {/* Items */}
        <div className="space-y-4 mt-6 flex-grow overflow-y-auto kds-scrollbar">
          {order.items.map((item, idx) => (
            <div
              key={idx}
              className={cn(
                'flex items-start gap-4',
                isReady && 'line-through opacity-50',
              )}
            >
              <span className="font-['Cormorant_Garamond'] text-[24px] leading-[1.2] font-bold text-[#d4e4fa] min-w-[32px] shrink-0">
                {item.quantity}x
              </span>
              <div className="flex-grow min-w-0">
                <p className="text-[18px] leading-[1.5] font-medium text-[#d4e4fa] truncate">
                  {item.name}
                </p>
                {item.modifiers && item.modifiers.length > 0 && (
                  <div className="flex gap-2 mt-1 flex-wrap">
                    {item.modifiers.map((m, mi) => (
                      <span
                        key={mi}
                        className="px-2 py-0.5 text-[10px] border border-[#efbd8a] text-[#efbd8a] rounded font-bold uppercase"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                )}
                {item.notes && (
                  <p className="text-[12px] text-[#efbd8a] mt-1 italic">
                    {t('kds.note')}: {item.notes}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action button */}
      <div className="p-6 border-t border-white/10 z-10 relative">
        <button
          onClick={buttonAction}
          disabled={!buttonAction}
          type="button"
          className={cn(
            'w-full py-4 rounded-lg font-[\'Space_Grotesk\'] text-[12px] leading-[1] tracking-[0.1em] font-black',
            'bg-gradient-to-br from-[#E2E8F0] via-[#94A3B8] to-[#475569]',
            'text-[#2c1700]',
            'shadow-[0_4px_0_rgba(0,0,0,0.3)]',
            'active:translate-y-[2px] active:shadow-[0_1px_0_rgba(0,0,0,0.5),inset_0_2px_4px_rgba(0,0,0,0.2)]',
            'transition-all duration-100 ease-in-out',
            'disabled:cursor-not-allowed disabled:opacity-50',
            isDimmed && 'opacity-50',
          )}
        >
          {buttonLabel}
        </button>
      </div>
    </article>
  );
}

/* ─── Main Page Component ────────────────────────────────────── */

export default function KDSPage() {
  const { t } = useTranslation('kds');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const prevOrderCountRef = useRef(0);

  const { orders, isLoading, isError, error, updateStatus } = useKDS('all');

  /* ── Per-ticket elapsed timers ── */
  const [elapsedMap, setElapsedMap] = useState<Record<string, number>>({});

  useEffect(() => {
    setElapsedMap((prev) => {
      const next = { ...prev };
      for (const o of orders) {
        if (!(o.id in next)) {
          next[o.id] = calcElapsedSeconds(o.createdAt);
        }
      }
      return next;
    });
  }, [orders]);

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedMap((prev) => {
        const next: Record<string, number> = {};
        for (const id of Object.keys(prev)) {
          const order = orders.find((o) => o.id === id);
          if (order) {
            next[id] = calcElapsedSeconds(order.createdAt);
          }
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
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
  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'pending'),
    [orders],
  );
  const preparingOrders = useMemo(
    () => orders.filter((o) => o.status === 'preparing'),
    [orders],
  );
  const readyOrders = useMemo(
    () => orders.filter((o) => o.status === 'ready'),
    [orders],
  );

  const avgTime = useMemo(() => calcAvgMinutes(orders), [orders]);

  const filteredOrders = useMemo(() => {
    let filtered = [...orders];
    switch (viewFilter) {
      case 'priority':
        filtered = filtered.filter(
          (o) =>
            o.status === 'pending' &&
            calcElapsedSeconds(o.createdAt) >= OVERDUE_THRESHOLD_MIN * 60,
        );
        break;
      case 'preparing':
        filtered = filtered.filter((o) => o.status === 'preparing');
        break;
      case 'ready':
        filtered = filtered.filter((o) => o.status === 'ready');
        break;
    }
    return filtered.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [orders, viewFilter]);

  const stationLoadPct = useMemo(() => {
    const active = orders.filter((o) => o.status !== 'served').length;
    return Math.min(Math.round((active / 20) * 100), 100);
  }, [orders]);

  /* ── Handlers ── */
  const handleStartPrep = useCallback(
    (orderId: string) => updateStatus(orderId, 'preparing'),
    [updateStatus],
  );
  const handleComplete = useCallback(
    (orderId: string) => updateStatus(orderId, 'ready'),
    [updateStatus],
  );
  const handlePickup = useCallback(
    (orderId: string) => updateStatus(orderId, 'served'),
    [updateStatus],
  );

  /* ── Render ── */
  return (
    <div className="min-h-screen bg-[#051424] text-[#d4e4fa] font-['Space_Grotesk'] overflow-hidden selection:bg-[#efbd8a] selection:text-[#472a03]">
      <style dangerouslySetInnerHTML={{ __html: KDS_STYLES }} />

      {/* ── Audio (hidden) ── */}
      <audio ref={audioRef} preload="auto" className="hidden">
        <source src="/sounds/new-order.mp3" type="audio/mpeg" />
      </audio>

      {/* ── Fixed Header ── */}
      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 py-4 bg-[#051424]/60 backdrop-blur-xl border-b border-[#44474d]/20">
        {/* Left: Logo + Station */}
        <div className="flex items-center gap-6">
          <h1 className="font-['Cormorant_Garamond'] text-[48px] leading-[1.1] tracking-[-0.02em] font-black text-[#d4e4fa] whitespace-nowrap">
            {t('kds.title')}
          </h1>
          <div className="h-8 w-px bg-[#44474d]/30 shrink-0" />
          <div className="flex flex-col shrink-0">
            <span className="text-[12px] leading-[1] tracking-[0.1em] font-bold text-[#c5c6cd] opacity-60">
              {t('kds.station')}
            </span>
            <span className="font-['Cormorant_Garamond'] text-[24px] leading-[1.2] font-bold text-[#efbd8a]">
              {t('kds.terminal')}
            </span>
          </div>
        </div>

        {/* Center: Nav tabs */}
        <nav className="hidden md:flex items-center gap-8">
          {(['all', 'priority', 'preparing', 'ready'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setViewFilter(tab)}
              type="button"
              className={
                viewFilter === tab
                  ? 'text-[#efbd8a] font-bold border-b-2 border-[#efbd8a] pb-1 transition-all cursor-pointer'
                  : 'text-[#c5c6cd] font-medium hover:bg-[#273647]/30 px-2 py-1 rounded transition-colors cursor-pointer'
              }
            >
              {tab === 'all'
                ? t('kds.tab_all')
                : tab === 'priority'
                  ? t('kds.tab_priority')
                  : tab === 'preparing'
                    ? t('kds.tab_preparing')
                    : t('kds.tab_ready')}
            </button>
          ))}
        </nav>

        {/* Right: Metrics + Toolbar */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="flex flex-col items-end">
            <span className="text-[12px] leading-[1] tracking-[0.1em] font-bold text-[#efbd8a]">
              {t('kds.avg_prep', { minutes: avgTime })}
            </span>
            <span className="text-[16px] leading-[1.5] font-normal text-[#c5c6cd]">
              {t('kds.active_orders', { count: orders.length })}
            </span>
          </div>
          <div className="flex gap-4 items-center">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              type="button"
              className="text-[#b8c7e2] hover:bg-[#273647]/30 p-2 rounded transition-colors cursor-pointer"
              title={soundEnabled ? t('kds.mute_alerts') : t('kds.enable_alerts')}
            >
              {soundEnabled ? <Bell size={24} /> : <BellOff size={24} />}
            </button>
            <button
              onClick={toggleFullscreen}
              type="button"
              className="text-[#b8c7e2] hover:bg-[#273647]/30 p-2 rounded transition-colors cursor-pointer"
              title={t('kds.toggle_fullscreen')}
            >
              {isFullscreen ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
            </button>
            <button
              onClick={handleRetry}
              type="button"
              className="text-[#b8c7e2] hover:bg-[#273647]/30 p-2 rounded transition-colors cursor-pointer"
              title={t('kds.refresh')}
            >
              <RefreshCw size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Fixed Sidebar ── */}
      <aside className="fixed left-0 top-0 h-full w-64 z-40 flex flex-col pt-24 pb-8 px-4 bg-[#010f1f]/80 backdrop-blur-2xl border-r border-[#44474d]/10">
        {/* Station avatar */}
        <div className="flex items-center gap-4 px-4 mb-10">
          <div className="w-12 h-12 rounded-full overflow-hidden bg-[#273647] border border-[#44474d]/30 shrink-0">
            <div className="w-full h-full bg-gradient-to-br from-[#efbd8a]/40 to-[#475569] flex items-center justify-center text-[#efbd8a] font-bold text-lg">
              S1
            </div>
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-[12px] leading-[1] tracking-[0.1em] font-bold text-[#efbd8a]">
              {t('kds.station_id')}
            </span>
            <span className="text-[16px] leading-[1.5] font-bold text-[#d4e4fa] truncate">
              {t('kds.station_description')}
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-2 flex-grow">
          <div className="flex items-center gap-4 px-4 py-3 text-[#efbd8a] border-r-2 border-[#efbd8a] bg-[#273647]/20 cursor-pointer">
            <LayoutDashboard size={20} />
            <span className="text-[12px] leading-[1] tracking-[0.1em] font-bold">
              {t('kds.dashboard')}
            </span>
          </div>
          <div className="flex items-center gap-4 px-4 py-3 text-[#c5c6cd] opacity-60 hover:text-[#d4e4fa] hover:bg-[#273647]/20 transition-all cursor-pointer">
            <History size={20} />
            <span className="text-[12px] leading-[1] tracking-[0.1em] font-bold">
              {t('kds.history')}
            </span>
          </div>
          <div className="flex items-center gap-4 px-4 py-3 text-[#c5c6cd] opacity-60 hover:text-[#d4e4fa] hover:bg-[#273647]/20 transition-all cursor-pointer">
            <Package size={20} />
            <span className="text-[12px] leading-[1] tracking-[0.1em] font-bold">
              {t('kds.inventory')}
            </span>
          </div>
          <div className="flex items-center gap-4 px-4 py-3 text-[#c5c6cd] opacity-60 hover:text-[#d4e4fa] hover:bg-[#273647]/20 transition-all cursor-pointer">
            <Users size={20} />
            <span className="text-[12px] leading-[1] tracking-[0.1em] font-bold">
              {t('kds.staff')}
            </span>
          </div>
        </nav>

        {/* Station load widget */}
        <div className="px-4 mt-auto">
          <div className="p-4 rounded-lg bg-[#0a1a2e] border border-[#44474d]/20">
            <span className="text-[12px] leading-[1] tracking-[0.1em] font-bold text-[#b8c7e2] opacity-60 block mb-2">
              {t('kds.station_load')}
            </span>
            <div className="h-2 w-full bg-[#273647] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#efbd8a] transition-all duration-500"
                style={{ width: `${stationLoadPct}%` }}
              />
            </div>
            <span className="text-[12px] leading-[1] tracking-[0.1em] font-bold text-[#c5c6cd] mt-2 block">
              {t('kds.capacity', { pct: stationLoadPct })}
            </span>
          </div>
        </div>
      </aside>

      {/* ── Main Canvas ── */}
      <main className="ml-64 pt-24 px-8 pb-8 h-screen overflow-y-auto kds-scrollbar">
        {/* ── Status Bar ── */}
        <div className="mb-8 flex items-center justify-between border-b border-[#44474d]/10 pb-4">
          <div className="flex gap-4 flex-wrap">
            <span className="px-3 py-1 rounded bg-[#64421a] text-[#dfaf7e] font-['Space_Grotesk'] text-[12px] leading-[1] tracking-[0.1em] font-bold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#efbd8a] animate-pulse" />
              {t('kds.preparing_count', { count: preparingOrders.length })}
            </span>
            <span className="px-3 py-1 rounded bg-[#273647] text-[#c5c6cd] font-['Space_Grotesk'] text-[12px] leading-[1] tracking-[0.1em] font-bold">
              {t('kds.pending_count', { count: pendingOrders.length })}
            </span>
            <span className="px-3 py-1 rounded bg-[#001a38] text-[#6984ad] font-['Space_Grotesk'] text-[12px] leading-[1] tracking-[0.1em] font-bold">
              {t('kds.ready_count', { count: readyOrders.length })}
            </span>
          </div>
          <div className="text-[#c5c6cd] font-['Space_Grotesk'] text-[12px] leading-[1] tracking-[0.1em] font-bold shrink-0">
            {t('kds.location_info')}
          </div>
        </div>

        {/* ── Error State ── */}
        {isError && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className={`${GLASS_CLASS} p-10 max-w-md text-center`}>
              <AlertTriangle
                size={48}
                className="mx-auto mb-4 text-[#ffb4ab]"
              />
              <h2 className="font-['Cormorant_Garamond'] text-[24px] leading-[1.2] font-bold mb-2 text-[#ffb4ab]">
                {t('kds.connection_error')}
              </h2>
              <p className="text-[#c5c6cd] text-[16px] leading-[1.5] mb-6">
                {error?.message ?? t('kds.failed_load_orders')}
              </p>
              <button
                onClick={handleRetry}
                type="button"
                className="px-8 py-3 rounded-lg font-['Space_Grotesk'] text-[12px] leading-[1] tracking-[0.1em] font-black bg-gradient-to-br from-[#E2E8F0] via-[#94A3B8] to-[#475569] text-[#2c1700] shadow-[0_4px_0_rgba(0,0,0,0.3)] active:translate-y-[2px] transition-all duration-100 cursor-pointer"
              >
                {t('kds.retry')}
              </button>
            </div>
          </div>
        )}

        {/* ── Loading State ── */}
        {isLoading && !isError && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonTicket key={i} />
            ))}
          </div>
        )}

        {/* ── Empty State ── */}
        {!isLoading && !isError && filteredOrders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className={`${GLASS_CLASS} p-10 max-w-md text-center`}>
              <div className="w-16 h-16 rounded-full bg-[#273647]/50 mx-auto mb-4 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-[#efbd8a]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="font-['Cormorant_Garamond'] text-[24px] leading-[1.2] font-bold mb-2 text-[#d4e4fa]">
                {t('kds.all_orders_complete')}
              </h2>
              <p className="text-[#c5c6cd] text-[16px] leading-[1.5]">
                {t('kds.no_pending_orders')}
              </p>
            </div>
          </div>
        )}

        {/* ── Tickets Grid ── */}
        {!isLoading && !isError && filteredOrders.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredOrders.map((order) => (
              <OrderTicketCard
                key={order.id}
                order={order}
                elapsedSeconds={
                  elapsedMap[order.id] ?? calcElapsedSeconds(order.createdAt)
                }
                onStartPrep={handleStartPrep}
                onComplete={handleComplete}
                onPickup={handlePickup}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
