/**
 * StitchKDSNew — Kitchen Display System for AURA CAFE
 *
 * Dark navy glassmorphism KDS with Chrome/bronze accents.
 * Source: Stitch AI aura_cafe_kitchen_display_system export.
 *
 * Features:
 * - Order ticket grid (responsive 1-4 columns)
 * - Status badges: PREPARING | PENDING | READY | OVERDUE
 * - Elapsed countdown timers with overdue pulse
 * - Glass panel cards with chrome borders
 * - Mobile-first with collapsible sidebar
 * - Loading / error / empty states
 * - Full i18n support (bilingual EN + VI)
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import {
  Bell,
  Settings,
  LayoutDashboard,
  History,
  Package,
  Users,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChefHat,
  CheckCircle2,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────────────── */

export type TicketStatus = 'preparing' | 'pending' | 'ready' | 'overdue';

export interface TicketItem {
  name: string;
  quantity: number;
  modifier?: string;
}

export interface Ticket {
  id: string;
  table: string;
  type: 'DINE IN' | 'TOGO' | 'DELIVERY';
  status: TicketStatus;
  items: TicketItem[];
  elapsedSeconds: number;
  totalTimeSeconds?: number;
}

export interface StitchKDSNewProps {
  tickets?: Ticket[];
  stationName?: string;
  stationLabel?: string;
  stationLocation?: string;
  stationLoad?: number;
  avgPrepTime?: string;
  isLoading?: boolean;
  error?: string | null;
  onCompleteTicket?: (id: string) => void;
  onStartPrep?: (id: string) => void;
  onPickupOrder?: (id: string) => void;
  onRefresh?: () => void;
  activeFilter?: 'all' | 'priority' | 'preparing' | 'ready';
  onFilterChange?: (filter: StitchKDSNewProps['activeFilter']) => void;
}

/* ─── Filter tabs ──────────────────────────────────────────────────────────── */

const FILTERS: { key: StitchKDSNewProps['activeFilter']; tKey: string }[] = [
  { key: 'all', tKey: 'kds.all' },
  { key: 'priority', tKey: 'kds.priority' },
  { key: 'preparing', tKey: 'kds.preparing' },
  { key: 'ready', tKey: 'kds.ready' },
];

/* ─── Default Data ────────────────────────────────────────────────────────── */

const DEFAULT_TICKETS: Ticket[] = [
  {
    id: '#9842', table: 'TABLE B01', type: 'DINE IN', status: 'preparing',
    items: [
      { name: 'Midnight Espresso', quantity: 2, modifier: 'Oat Milk' },
      { name: 'Smoked Truffle Croissant', quantity: 1 },
    ],
    elapsedSeconds: 525,
  },
  {
    id: '#9843', table: 'TABLE B05', type: 'TOGO', status: 'pending',
    items: [
      { name: 'Nitro Tonic', quantity: 1 },
      { name: 'Ceremonial Matcha', quantity: 1, modifier: 'Extra Oat Milk' },
    ],
    elapsedSeconds: 130,
  },
  {
    id: '#9841', table: 'TABLE B12', type: 'DINE IN', status: 'ready',
    items: [
      { name: 'Chrome Velvet Latte', quantity: 3 },
      { name: 'Bronze Chai', quantity: 2 },
    ],
    elapsedSeconds: 750,
    totalTimeSeconds: 750,
  },
  {
    id: '#9844', table: 'TABLE B02', type: 'TOGO', status: 'pending',
    items: [
      { name: 'Industrial Cold Brew', quantity: 1 },
    ],
    elapsedSeconds: 45,
  },
  {
    id: '#9838', table: 'TABLE B09', type: 'DELIVERY', status: 'overdue',
    items: [
      { name: 'Double Smoked Cortado', quantity: 4 },
    ],
    elapsedSeconds: 1092,
  },
];

/* ─── Helper: format mm:ss ────────────────────────────────────────────────── */

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ─── Status Badge ────────────────────────────────────────────────────────── */

function StatusBadge({ status, count }: { status: TicketStatus; count: number }) {
  const { t } = useTranslation();

  const config: Record<TicketStatus, { tKey: string; bg: string; text: string; border: string; pulse?: boolean }> = {
    preparing: {
      tKey: 'kds.preparing',
      bg: 'bg-[#efbd8a]/15',
      text: 'text-[#efbd8a]',
      border: 'border-[#efbd8a]/30',
      pulse: true,
    },
    pending: {
      tKey: 'kds.pending',
      bg: 'bg-[#c5c6cd]/10',
      text: 'text-[#c5c6cd]',
      border: 'border-[#c5c6cd]/20',
    },
    ready: {
      tKey: 'kds.ready',
      bg: 'bg-[#adc8f5]/15',
      text: 'text-[#adc8f5]',
      border: 'border-[#adc8f5]/30',
    },
    overdue: {
      tKey: 'kds.overdue',
      bg: 'bg-[#ffb4ab]/15',
      text: 'text-[#ffb4ab]',
      border: 'border-[#ffb4ab]/50',
      pulse: true,
    },
  };

  const c = config[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded px-3 py-1 text-[10px] font-bold uppercase tracking-[0.1em] border',
        c.bg,
        c.text,
        c.border,
      )}
      aria-label={`${t(c.tKey)}: ${count}`}
    >
      {c.pulse && <span className={cn('h-2 w-2 rounded-full animate-pulse', c.text.replace('text-', 'bg-'))} />}
      {t(c.tKey)} ({count})
    </span>
  );
}

/* ─── Ticket Card ─────────────────────────────────────────────────────────── */

function TicketCard({
  ticket,
  onComplete,
  onStart,
  onPickup,
}: {
  ticket: Ticket;
  onComplete?: (id: string) => void;
  onStart?: (id: string) => void;
  onPickup?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [elapsed, setElapsed] = useState(ticket.elapsedSeconds);

  useEffect(() => {
    if (ticket.status === 'ready') {
      setElapsed(ticket.totalTimeSeconds ?? ticket.elapsedSeconds);
      return;
    }
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [ticket.status, ticket.elapsedSeconds, ticket.totalTimeSeconds]);

  const isReady = ticket.status === 'ready';
  const isOverdue = ticket.status === 'overdue';
  const isPreparing = ticket.status === 'preparing';
  const isPending = ticket.status === 'pending';

  const accentColorClass = isOverdue
    ? 'bg-[#ffb4ab]'
    : isReady
      ? 'bg-[#adc8f5]'
      : isPreparing
        ? 'bg-[#efbd8a]'
        : 'bg-[#c5c6cd]';

  const timerColorClass = isOverdue
    ? 'text-[#ffb4ab]'
    : isReady
      ? 'text-[#adc8f5]'
      : isPreparing
        ? 'text-[#efbd8a]'
        : 'text-[#d4e4fa]';

  const ticketIdColorClass = isOverdue
    ? 'text-[#ffb4ab]'
    : isReady
      ? 'text-[#adc8f5]'
      : isPreparing
        ? 'text-[#efbd8a]'
        : 'text-[#d4e4fa]';

  return (
    <article
      className={cn(
        'relative flex min-h-[360px] flex-col overflow-hidden rounded-lg',
        'bg-[#0a1a2e]/60 backdrop-blur-[20px]',
        'border border-white/10',
        'shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]',
        'transition-all duration-200',
        'hover:border-white/20',
        isOverdue && 'ring-1 ring-[#ffb4ab]/50',
        isReady && 'opacity-80',
      )}
      aria-label={t('kds.ticketLabel', { id: ticket.id })}
    >
      {/* Accent bar */}
      <div className={cn('h-1 w-full shrink-0', accentColorClass)} />

      <div className="flex flex-grow flex-col gap-4 p-5">
        {/* Header row */}
        <div className="flex items-start justify-between">
          <div>
            <h2
              className={cn('text-xl font-black tracking-tighter', ticketIdColorClass)}
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              {ticket.id}
            </h2>
            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#c5c6cd]">
              {ticket.table} &bull; {t(`kds.${ticket.type.toLowerCase().replace(' ', '')}`, ticket.type)}
            </p>
          </div>
          <div className="text-right">
            <span
              className={cn(
                'block text-[32px] font-bold leading-none tracking-tighter',
                timerColorClass,
                isOverdue && 'animate-[pulse-glow_2s_ease-in-out_infinite]',
              )}
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              aria-live="polite"
              aria-label={`${isOverdue ? t('kds.overdue') : isReady ? t('kds.totalTime') : t('kds.elapsed')}: ${formatTime(elapsed)}`}
            >
              {formatTime(elapsed)}
            </span>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#c5c6cd]">
              {isReady ? t('kds.totalTime') : isOverdue ? t('kds.overdue') : t('kds.elapsed')}
            </p>
          </div>
        </div>

        {/* Items list */}
        <div className="flex-grow space-y-3">
          {ticket.items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <span
                className={cn(
                  'min-w-[32px] shrink-0 text-lg font-bold text-[#d4e4fa]',
                  isReady && 'line-through opacity-50',
                )}
              >
                {item.quantity}x
              </span>
              <div className={cn(isReady && 'line-through opacity-50')}>
                <p className="text-base font-medium text-[#d4e4fa]">
                  {item.name}
                </p>
                {item.modifier && (
                  <span className="mt-1 inline-block rounded border border-[#efbd8a] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#efbd8a]">
                    {t('kds.modifier')}: {item.modifier}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action footer */}
      <div className="p-5 pt-0">
        {isPreparing && onComplete && (
          <ActionButton onClick={() => onComplete(ticket.id)}>
            {t('kds.completeTicket')}
          </ActionButton>
        )}
        {isPending && onStart && (
          <ActionButton onClick={() => onStart(ticket.id)}>
            {t('kds.startPrep')}
          </ActionButton>
        )}
        {isReady && onPickup && (
          <ActionButton onClick={() => onPickup(ticket.id)} disabled>
            {t('kds.orderPickedUp')}
          </ActionButton>
        )}
        {isOverdue && onStart && (
          <ActionButton
            onClick={() => onStart(ticket.id)}
            className="bg-gradient-to-b from-[#ffb4ab] via-[#e57373] to-[#c62828]"
          >
            {t('kds.priorityStart')}
          </ActionButton>
        )}
      </div>

      {/* Ready overlay */}
      {isReady && (
        <div className="pointer-events-none absolute inset-0 bg-[#adc8f5]/5" />
      )}
    </article>
  );
}

/* ─── Action Button ───────────────────────────────────────────────────────── */

function ActionButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full rounded-lg py-3.5 text-[10px] font-black uppercase tracking-[0.15em]',
        'shadow-[0_4px_0_rgba(0,0,0,0.3)]',
        'active:translate-y-0.5 active:shadow-[0_1px_0_rgba(0,0,0,0.5)]',
        'transition-all duration-75',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'bg-gradient-to-b from-[#E2E8F0] via-[#94A3B8] to-[#475569]',
        'text-[#2c1700]',
        className,
      )}
      aria-label={typeof children === 'string' ? children : undefined}
    >
      {children}
    </button>
  );
}

/* ─── Sidebar ──────────────────────────────────────────────────────────────── */

function Sidebar({
  isOpen,
  onToggle,
  stationLabel,
  stationName,
  stationLoad,
}: {
  isOpen: boolean;
  onToggle: () => void;
  stationLabel: string;
  stationName: string;
  stationLoad: number;
}) {
  const { t } = useTranslation();

  const navItems = [
    { icon: LayoutDashboard, label: t('kds.dashboard'), tKey: 'kds.dashboard', active: true },
    { icon: History, label: t('kds.history'), tKey: 'kds.history', active: false },
    { icon: Package, label: t('kds.inventory'), tKey: 'kds.inventory', active: false },
    { icon: Users, label: t('kds.staff'), tKey: 'kds.staff', active: false },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-full flex-col',
          'bg-[#010f1f]/80 backdrop-blur-2xl',
          'border-r border-white/[0.06]',
          'w-56 transition-transform duration-200',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',
        )}
        aria-label={t('kds.sidebar')}
      >
        {/* Profile */}
        <div className="flex items-center gap-3 px-4 pb-8 pt-20">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-[#273647]">
            <ChefHat className="h-5 w-5 text-[#efbd8a]" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#efbd8a]">
              {stationLabel}
            </p>
            <p className="text-sm font-bold text-[#d4e4fa]">
              {stationName}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-grow flex-col gap-1 px-3" aria-label={t('kds.navigation')}>
          {navItems.map((item) => (
            <a
              key={item.tKey}
              href="#"
              className={cn(
                'flex items-center gap-3 rounded px-3 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] transition-all',
                item.active
                  ? 'border-l-2 border-[#efbd8a] bg-[#273647]/20 text-[#efbd8a]'
                  : 'border-l-2 border-transparent text-[#c5c6cd] opacity-60 hover:opacity-100 hover:text-[#d4e4fa] hover:bg-[#273647]/20',
              )}
              aria-label={item.label}
              aria-current={item.active ? 'page' : undefined}
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </a>
          ))}
        </nav>

        {/* Station load */}
        <div className="px-4 pb-6">
          <div className="rounded-lg border border-white/[0.06] bg-[#0a1a2e] p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#d4e3ff] opacity-60">
              {t('kds.stationLoad')}
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#273647]">
              <div
                className="h-full rounded-full bg-[#efbd8a] transition-all duration-500"
                style={{ width: `${Math.min(stationLoad, 100)}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#c5c6cd]">
              {stationLoad}% {t('kds.capacity')}
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ─── Empty State ─────────────────────────────────────────────────────────── */

function EmptyState({ onRefresh }: { onRefresh?: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <CheckCircle2 className="mb-4 h-16 w-16 text-[#c5c6cd] opacity-30" aria-hidden="true" />
      <h3
        className="mb-2 text-xl font-bold text-[#d4e4fa]"
        style={{ fontFamily: "'Syne', sans-serif" }}
      >
        {t('kds.allClear')}
      </h3>
      <p className="mb-6 max-w-xs text-sm text-[#c5c6cd]">
        {t('kds.emptyDescription')}
      </p>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 rounded-lg bg-[#273647] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#d4e4fa] transition-colors hover:bg-[#39475e]"
          aria-label={t('common.refresh')}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('common.refresh')}
        </button>
      )}
    </div>
  );
}

/* ─── Loading State ───────────────────────────────────────────────────────── */

function LoadingState() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="min-h-[360px] animate-pulse rounded-lg bg-[#0a1a2e]/40"
          aria-label="Loading ticket"
        >
          <div className="h-1 w-full rounded-t-lg bg-[#c5c6cd]/20" />
          <div className="space-y-4 p-5">
            <div className="flex justify-between">
              <div className="space-y-2">
                <div className="h-5 w-16 rounded bg-[#273647]" />
                <div className="h-3 w-24 rounded bg-[#273647]" />
              </div>
              <div className="space-y-2">
                <div className="h-8 w-16 rounded bg-[#273647]" />
                <div className="h-3 w-12 rounded bg-[#273647]" />
              </div>
            </div>
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="flex gap-3">
                <div className="h-5 w-8 shrink-0 rounded bg-[#273647]" />
                <div className="h-5 w-32 rounded bg-[#273647]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Error State ─────────────────────────────────────────────────────────── */

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <AlertTriangle className="mb-4 h-16 w-16 text-[#ffb4ab]" aria-hidden="true" />
      <h3
        className="mb-2 text-xl font-bold text-[#d4e4fa]"
        style={{ fontFamily: "'Syne', sans-serif" }}
      >
        {t('common.error')}
      </h3>
      <p className="mb-6 max-w-md text-sm text-[#c5c6cd]">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 rounded-lg bg-[#efbd8a] px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[#472a03] transition-all hover:opacity-90"
          aria-label={t('common.retry')}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('common.retry')}
        </button>
      )}
    </div>
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

  /* ─── Status counts ──────────────────────────────────────────────── */
  const countPreparing = tickets.filter((tk) => tk.status === 'preparing').length;
  const countPending = tickets.filter((tk) => tk.status === 'pending').length;
  const countReady = tickets.filter((tk) => tk.status === 'ready').length;
  const activeCount = countPreparing + countPending;

  return (
    <div
      className="min-h-screen overflow-hidden bg-[#051424] text-[#d4e4fa]"
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      {/* ── Top App Bar ─────────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 z-50 flex w-full items-center justify-between border-b border-white/[0.06] bg-[#051424]/60 px-6 py-3.5 backdrop-blur-xl"
        aria-label={t('kds.header')}
      >
        <div className="flex items-center gap-4">
          {/* Mobile menu toggle */}
          <button
            className="rounded p-1 text-[#d4e4fa] transition-colors hover:bg-white/5 md:hidden"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={sidebarOpen ? t('kds.closeSidebar') : t('kds.openSidebar')}
          >
            {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>

          <h1
            className="hidden text-2xl font-black tracking-tighter text-[#d4e4fa] sm:block"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            {t('kds.title')}
          </h1>
          <div className="hidden h-6 w-px bg-white/[0.08] sm:block" />
          <div className="hidden flex-col sm:flex">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#c5c6cd] opacity-60">
              {t('kds.station')}
            </span>
            <span className="text-lg font-bold text-[#efbd8a]">
              {stationLabel}
            </span>
          </div>

          {/* Mobile title */}
          <span className="text-sm font-bold text-[#efbd8a] sm:hidden">
            KDS
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 md:flex" aria-label={t('kds.filterNav')}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => onFilterChange?.(f.key)}
              className={cn(
                'pb-1 text-[10px] font-bold uppercase tracking-[0.1em] transition-all',
                activeFilter === f.key
                  ? 'border-b-2 border-[#efbd8a] text-[#efbd8a]'
                  : 'text-[#c5c6cd] hover:text-[#d4e4fa]',
              )}
              aria-current={activeFilter === f.key ? 'page' : undefined}
              aria-label={t(f.tKey)}
            >
              {t(f.tKey)}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#efbd8a]">
              {t('kds.avgPrep')}: {avgPrepTime}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#c5c6cd]">
              {t('kds.activeOrders')}: {activeCount}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded p-1.5 text-[#d4e3ff] transition-colors hover:bg-white/5"
              aria-label={t('kds.notifications')}
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              className="rounded p-1.5 text-[#d4e3ff] transition-colors hover:bg-white/5"
              aria-label={t('kds.settings')}
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
        stationLabel={stationLabel}
        stationName={stationName}
        stationLoad={stationLoad}
      />

      {/* ── Main Canvas ─────────────────────────────────────────────── */}
      <main
        className="h-screen overflow-y-auto md:ml-56 pt-16 px-5 pb-6"
        aria-label={t('kds.mainContent')}
      >
        {/* Status bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div className="flex flex-wrap gap-3">
            <StatusBadge status="preparing" count={countPreparing} />
            <StatusBadge status="pending" count={countPending} />
            <StatusBadge status="ready" count={countReady} />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#c5c6cd]">
            AURA CAFE &bull; {stationLocation}
          </span>
        </div>

        {/* Content */}
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={onRefresh} />
        ) : filtered.length === 0 ? (
          <EmptyState onRefresh={onRefresh} />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

      {/* Pulse-glow animation keyframes */}
      <style>{`
        @keyframes pulse-glow {
          0%, 100% { text-shadow: 0 0 10px rgba(255, 180, 171, 0.2); opacity: 1; }
          50% { text-shadow: 0 0 25px rgba(255, 180, 171, 0.8); opacity: 0.8; }
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #44474d; border-radius: 10px; }
      `}</style>
    </div>
  );
}
