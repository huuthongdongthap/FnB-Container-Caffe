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

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { useFocusTrap } from '@/hooks/use-focus-trap';
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

const FILTERS: { key: StitchKDSNewProps['activeFilter']; tKey: string; label: string }[] = [
  { key: 'all', tKey: 'kds.all', label: 'ALL' },
  { key: 'priority', tKey: 'kds.priority', label: 'PRIORITY' },
  { key: 'preparing', tKey: 'kds.preparing', label: 'PREPARING' },
  { key: 'ready', tKey: 'kds.ready', label: 'READY' },
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

/* ─── Status Label ────────────────────────────────────────────────────────── */

/** Matches original HTML status badges:
 *  PREPARING: bg-[#64421a] text-[#dfaf7e] with pulse dot
 *  PENDING:   bg-[#273647] text-[var(--aura-chrome-soft)]
 *  READY:     bg-[#001a38] text-[#6984ad]
 */
function StatusBadge({ status, count }: { status: TicketStatus; count: number }) {
  const { t } = useTranslation();

  const config: Record<TicketStatus, { tKey: string; bg: string; text: string; pulse?: boolean }> = {
    preparing: {
      tKey: 'kds.preparing',
      bg: 'bg-[#64421a]',
      text: 'text-[#dfaf7e]',
      pulse: true,
    },
    pending: {
      tKey: 'kds.pending',
      bg: 'bg-[#273647]',
      text: 'text-[var(--aura-chrome-soft)]',
    },
    ready: {
      tKey: 'kds.ready',
      bg: 'bg-[#001a38]',
      text: 'text-[#6984ad]',
    },
    overdue: {
      tKey: 'kds.overdue',
      bg: 'bg-[var(--aura-surface-dim)]',
      text: 'text-[var(--aura-error)]',
      pulse: true,
    },
  };

  const c = config[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded px-3 py-1',
        'text-[12px] leading-none tracking-[0.1em] font-bold uppercase',
        c.bg,
        c.text,
      )}
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      aria-label={`${t(c.tKey)}: ${count}`}
    >
      {c.pulse && <span className="h-2 w-2 rounded-full bg-secondary animate-pulse" />}
      {t(c.tKey, c.tKey === 'kds.preparing' ? 'PREPARING' : c.tKey === 'kds.pending' ? 'PENDING' : c.tKey === 'kds.ready' ? 'READY' : 'OVERDUE')} ({count})
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

  /** Accent bar color — matches original:
   *  preparing: bg-secondary (#efbd8a)
   *  pending:   bg-on-secondary-container (#dfaf7e)
   *  ready:     bg-tertiary (#adc8f5)
   *  overdue:   bg-error (#ffb4ab)
   */
  const accentColorClass = isOverdue
    ? 'bg-[var(--aura-error)]'
    : isReady
      ? 'bg-[#adc8f5]'
      : isPreparing
        ? 'bg-[var(--aura-chrome-bright)]'
        : 'bg-[#dfaf7e]';

  /** Timer color — matches original:
   *  preparing: text-secondary (#efbd8a)
   *  pending:   text-on-surface (#d4e4fa)
   *  ready:     text-tertiary (#adc8f5)
   *  overdue:   text-error (#ffb4ab)
   */
  const timerColorClass = isOverdue
    ? 'text-[var(--aura-error)]'
    : isReady
      ? 'text-[#adc8f5]'
      : isPreparing
        ? 'text-[var(--aura-chrome-bright)]'
        : 'text-[#d4e4fa]';

  /** Ticket ID color — matches timer color exactly in original HTML */
  const ticketIdColorClass = isOverdue
    ? 'text-[var(--aura-error)]'
    : isReady
      ? 'text-[#adc8f5]'
      : isPreparing
        ? 'text-[var(--aura-chrome-bright)]'
        : 'text-[#d4e4fa]';

  return (
    <article
      className={cn(
        'relative flex min-h-[400px] flex-col overflow-hidden rounded-lg',
        'bg-[rgba(10,26,46,0.6)] backdrop-blur-[20px]',
        'border border-[rgba(255,255,255,0.1)]',
        'shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]',
        'transition-all duration-200',
        isOverdue && 'ring-1 ring-[var(--aura-error)]/50',
        isReady && 'opacity-80',
      )}
      aria-label={t('kds.ticketLabel', { id: ticket.id })}
    >
      {/* Accent bar */}
      <div className={cn('h-1 w-full shrink-0', accentColorClass)} />

      <div className="flex flex-grow flex-col p-6">
        {/* Header row */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2
              className={cn('text-[32px] leading-[1.2] font-bold tracking-tighter', ticketIdColorClass)}
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              {ticket.id}
            </h2>
            <p
              className="text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-soft)]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {ticket.table} &bull; {t(`kds.${ticket.type.toLowerCase().replace(' ', '')}`, ticket.type)}
            </p>
          </div>
          <div className="text-right">
            <span
              className={cn(
                'block text-[40px] leading-none tracking-[-0.05em] font-bold',
                timerColorClass,
                isOverdue && 'timer-pulse-red',
              )}
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              aria-live="polite"
              aria-label={`${isOverdue ? t('kds.overdue') : isReady ? t('kds.totalTime') : t('kds.elapsed')}: ${formatTime(elapsed)}`}
            >
              {formatTime(elapsed)}
            </span>
            <p
              className="mt-1 text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-soft)]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {isReady ? t('kds.totalTime', 'TOTAL TIME') : isOverdue ? t('kds.overdue', 'OVERDUE') : t('kds.elapsed', 'ELAPSED')}
            </p>
          </div>
        </div>

        {/* Items list */}
        <div className="flex-grow space-y-4">
          {ticket.items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-4">
              <span
                className={cn(
                  'min-w-[32px] shrink-0 text-[24px] leading-[1.2] font-bold text-[#d4e4fa]',
                  isReady && 'line-through opacity-50',
                )}
              >
                {item.quantity}x
              </span>
              <div className={cn(isReady && 'line-through opacity-50')}>
                <p
                  className="text-[18px] leading-[1.5] font-medium text-[#d4e4fa]"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {item.name}
                </p>
                {item.modifier && (
                  <span className="mt-1 inline-block rounded border border-[var(--aura-chrome-bright)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[var(--aura-chrome-bright)]">
                    {item.modifier}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action footer */}
      <div className="border-t border-[var(--aura-chrome-dim)]/10 p-6">
        {isPreparing && onComplete && (
          <ActionButton onClick={() => onComplete(ticket.id)}>
            {t('kds.completeTicket', 'COMPLETE TICKET')}
          </ActionButton>
        )}
        {isPending && onStart && (
          <ActionButton onClick={() => onStart(ticket.id)}>
            {t('kds.startPrep', 'START PREP')}
          </ActionButton>
        )}
        {isReady && onPickup && (
          <ActionButton onClick={() => onPickup(ticket.id)} disabled>
            {t('kds.orderPickedUp', 'ORDER PICKED UP')}
          </ActionButton>
        )}
        {isOverdue && onStart && (
          <ActionButton
            onClick={() => onStart(ticket.id)}
            className="bg-error"
          >
            {t('kds.priorityComplete', 'PRIORITY COMPLETE')}
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

/* ─── Action Button (chrome style) ────────────────────────────────────────── */
/** Matches original .btn-chrome class:
 *  - Background: linear-gradient(135deg, #E2E8F0 0%, #94A3B8 50%, #475569 100%)
 *  - Color: #2c1700
 *  - Box shadow: 0 4px 0 rgba(0,0,0,0.3)
 *  - Active: translateY(2px), scale(0.98), box-shadow change
 *  - Font: 12px bold uppercase with widest tracking
 */
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
        'w-full rounded-lg py-4',
        'text-[12px] leading-none tracking-[0.1em] font-black uppercase',
        'btn-chrome',
        'transition-all duration-100',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'text-[var(--aura-noir-deep)]',
        'bg-gradient-to-br from-[#E2E8F0] via-[#94A3B8] to-[#475569]',
        className,
      )}
      style={{ boxShadow: '0 4px 0 rgba(0,0,0,0.3)' }}
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
  const sidebarRef = useRef<HTMLElement>(null);

  useFocusTrap(isOpen, onToggle, sidebarRef);

  const navItems = [
    { icon: LayoutDashboard, label: t('kds.dashboard', 'DASHBOARD'), tKey: 'kds.dashboard', active: true },
    { icon: History, label: t('kds.history', 'HISTORY'), tKey: 'kds.history', active: false },
    { icon: Package, label: t('kds.inventory', 'INVENTORY'), tKey: 'kds.inventory', active: false },
    { icon: Users, label: t('kds.staff', 'STAFF'), tKey: 'kds.staff', active: false },
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
        ref={sidebarRef}
        className={cn(
          'fixed left-0 top-0 z-40 flex h-full flex-col px-4 pt-24 pb-8',
          'bg-[#010f1f]/80 backdrop-blur-2xl',
          'border-r border-[var(--aura-chrome-dim)]/10',
          'w-64 transition-transform duration-200',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',
        )}
        aria-label={t('kds.sidebar', 'Sidebar navigation')}
      >
        {/* Profile — matches original: image circle + label + name */}
        <div className="mb-10 flex items-center gap-4 px-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--aura-chrome-dim)]/30 bg-[#273647]">
            <ChefHat className="h-5 w-5 text-[var(--aura-chrome-bright)]" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span
              className="text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-bright)]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {stationLabel}
            </span>
            <span
              className="text-[16px] leading-[1.5] font-bold text-[#d4e4fa]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {stationName}
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-grow flex-col gap-2" aria-label={t('kds.navigation', 'Navigation')}>
          {navItems.map((item) => (
            <a
              key={item.tKey}
              href="#"
              className={cn(
                'flex items-center gap-4 px-4 py-3',
                'text-[12px] leading-none tracking-[0.1em] font-bold uppercase',
                'transition-all',
                item.active
                  ? 'border-r-2 border-[var(--aura-chrome-bright)] bg-[#273647]/20 text-[var(--aura-chrome-bright)]'
                  : 'border-r-2 border-transparent text-[var(--aura-chrome-soft)] opacity-60 hover:text-[#d4e4fa] hover:bg-[#273647]/20',
              )}
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              aria-label={item.label}
              aria-current={item.active ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5" aria-hidden="true" />
              {item.label}
            </a>
          ))}
        </nav>

        {/* Station load */}
        <div className="mt-auto px-4 pb-8">
          <div className="rounded-lg border border-[var(--aura-chrome-dim)]/20 bg-[var(--aura-surface-container)] p-4">
            <span
              className="mb-2 block text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-noir-void)] opacity-60"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('kds.stationLoad', 'STATION LOAD')}
            </span>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#273647]">
              <div
                className="h-full w-3/4 rounded-full bg-[var(--aura-chrome-bright)] transition-all duration-500"
                style={{ width: `${Math.min(stationLoad, 100)}%` }}
              />
            </div>
            <span
              className="mt-2 block text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-soft)]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {stationLoad}% {t('kds.capacity', 'CAPACITY')}
            </span>
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
      <CheckCircle2 className="mb-4 h-16 w-16 text-[var(--aura-chrome-soft)] opacity-30" aria-hidden="true" />
      <h3
        className="mb-2 text-[32px] leading-[1.2] font-bold text-[#d4e4fa]"
        style={{ fontFamily: "'Syne', sans-serif" }}
      >
        {t('kds.allClear', 'All Clear!')}
      </h3>
      <p className="mb-6 max-w-xs text-[16px] leading-[1.5] text-[var(--aura-chrome-soft)]">
        {t('kds.emptyDescription', 'No tickets to display. New orders will appear here.')}
      </p>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 rounded-lg bg-[#273647] px-4 py-2 text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[#d4e4fa] transition-colors hover:bg-[#39475e]"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          aria-label={t('common.refresh', 'Refresh')}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('common.refresh', 'Refresh')}
        </button>
      )}
    </div>
  );
}

/* ─── Loading State ───────────────────────────────────────────────────────── */

function LoadingState() {
  return (
    <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="min-h-[400px] animate-pulse rounded-lg bg-[var(--aura-surface-container)]/40"
          aria-label="Loading ticket"
        >
          <div className="h-1 w-full rounded-t-lg bg-[var(--aura-chrome-soft)]/20" />
          <div className="space-y-4 p-6">
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
              <div key={j} className="flex gap-4">
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
      <AlertTriangle className="mb-4 h-16 w-16 text-[var(--aura-error)]" aria-hidden="true" />
      <h3
        className="mb-2 text-[32px] leading-[1.2] font-bold text-[#d4e4fa]"
        style={{ fontFamily: "'Syne', sans-serif" }}
      >
        {t('common.error', 'Error')}
      </h3>
      <p className="mb-6 max-w-md text-[16px] leading-[1.5] text-[var(--aura-chrome-soft)]">
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 rounded-lg bg-[var(--aura-chrome-bright)] px-5 py-2.5 text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-noir-deep)] transition-all hover:opacity-90"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          aria-label={t('common.retry', 'Retry')}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          {t('common.retry', 'Retry')}
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

  /* Status counts */
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
      {/*
        Original: fixed top-0 left-0 w-full z-50 flex justify-between items-center
                  px-margin py-4 bg-background/60 backdrop-blur-xl
                  border-b border-outline-variant/20
      */}
      <header
        className="fixed left-0 top-0 z-50 flex w-full items-center justify-between border-b border-[var(--aura-chrome-dim)]/20 bg-[#051424]/60 px-8 py-4 backdrop-blur-xl"
        aria-label={t('kds.header', 'KDS Header')}
      >
        <div className="flex items-center gap-6">
          {/* Mobile menu toggle */}
          <button
            className="rounded p-1 text-[#d4e4fa] transition-colors hover:bg-[#273647]/30 md:hidden"
            onClick={() => setSidebarOpen((prev) => !prev)}
            aria-label={sidebarOpen ? t('kds.closeSidebar', 'Close sidebar') : t('kds.openSidebar', 'Open sidebar')}
          >
            {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>

          {/* Title: original h1 with font-display-lg text-display-lg font-black text-on-surface tracking-tighter */}
          <h1
            className="text-[48px] leading-[1.1] font-black tracking-tighter text-[#d4e4fa]"
            style={{ fontFamily: "'Syne', sans-serif" }}
          >
            {t('kds.title', 'HEARTH & STEEL KDS')}
          </h1>
          {/* Vertical divider */}
          <div className="h-8 w-px bg-[var(--aura-chrome-dim)]/30" />
          {/* Station info */}
          <div className="flex flex-col">
            <span
              className="text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-soft)] opacity-60"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('kds.station', 'STATION')}
            </span>
            <span
              className="text-[24px] leading-[1.2] font-bold text-[var(--aura-chrome-bright)]"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              {stationLabel}
            </span>
          </div>
        </div>

        {/* Desktop nav — original: <a> links matching exact colors */}
        <nav className="hidden items-center gap-8 md:flex" aria-label={t('kds.filterNav', 'Filter tickets')}>
          {FILTERS.map((f, idx) => (
            <a
              key={f.key}
              href="#"
              onClick={(e: React.MouseEvent) => { e.preventDefault(); onFilterChange?.(f.key); }}
              className={cn(
                'pb-1 transition-all',
                'font-[family-name:--font-body]',
                activeFilter === f.key
                  ? 'border-b-2 border-[var(--aura-chrome-bright)] font-bold text-[var(--aura-chrome-bright)]'
                  : 'rounded px-2 py-1 font-medium text-[var(--aura-chrome-soft)] hover:bg-[#273647]/30 transition-colors',
              )}
              aria-current={activeFilter === f.key ? 'page' : undefined}
              aria-label={t(f.tKey, f.label)}
            >
              {f.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            {/* AVG PREP: original font-label-caps text-label-caps text-secondary */}
            <span
              className="text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-bright)]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('kds.avgPrep', 'AVG PREP')}: {avgPrepTime}
            </span>
            {/* ACTIVE ORDERS: original font-body-md text-body-md text-on-surface-variant */}
            <span
              className="text-[16px] leading-[1.5] font-normal text-[var(--aura-chrome-soft)]"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              {t('kds.activeOrders', 'ACTIVE ORDERS')}: {activeCount}
            </span>
          </div>
          <div className="flex gap-4">
            <button
              className="rounded p-2 text-[var(--aura-noir-void)] transition-colors hover:bg-[#273647]/30"
              aria-label={t('kds.notifications', 'Notifications')}
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              className="rounded p-2 text-[var(--aura-noir-void)] transition-colors hover:bg-[#273647]/30"
              aria-label={t('kds.settings', 'Settings')}
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
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
      {/*
        Original: ml-64 pt-24 px-margin pb-margin h-screen overflow-y-auto
      */}
      <main
        className="ml-64 h-screen overflow-y-auto px-8 pb-8 pt-24"
        aria-label={t('kds.mainContent', 'Main order grid')}
      >
        {/* Status bar — original: border-b border-outline-variant/10 pb-4 mb-8 */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--aura-chrome-dim)]/10 pb-4">
          <div className="flex flex-wrap gap-4">
            <StatusBadge status="preparing" count={countPreparing} />
            <StatusBadge status="pending" count={countPending} />
            <StatusBadge status="ready" count={countReady} />
          </div>
          {/* Location — original: font-label-caps text-label-caps text-on-surface-variant */}
          <span
            className="text-[12px] leading-none tracking-[0.1em] font-bold uppercase text-[var(--aura-chrome-soft)]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
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
          /* Tickets grid — original: gap-gutter */
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

      {/* Custom CSS — matches original <style> block exactly */}
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
    </div>
  );
}
