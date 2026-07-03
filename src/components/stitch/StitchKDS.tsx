/**
 * StitchKDS — Kitchen Display System for AURA CAFE
 *
 * Dark navy glassmorphism KDS with Chrome/bronze accents.
 * Source: Stitch AI KDS export.
 *
 * Features:
 * - Order ticket grid (responsive 1-4 columns)
 * - Status badges: PREPARING | PENDING | READY | OVERDUE
 * - Elapsed countdown timers with overdue pulse
 * - Glass panel cards with chrome borders
 * - Mobile-first with collapsible sidebar
 * - Loading / error / empty states
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { clsx } from 'clsx';
import {
  Bell,
  Settings,
  LayoutDashboard,
  History,
  Package,
  Users,
  Clock,
  AlertTriangle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChefHat,
  CheckCircle2,
  Timer,
  ListOrdered,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────── */

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

export interface StitchKDSProps {
  tickets?: Ticket[];
  stationName?: string;
  stationLabel?: string;
  stationLoad?: number;
  avgPrepTime?: string;
  isLoading?: boolean;
  error?: string | null;
  onCompleteTicket?: (id: string) => void;
  onStartPrep?: (id: string) => void;
  onPickupOrder?: (id: string) => void;
  onRefresh?: () => void;
  activeFilter?: 'all' | 'priority' | 'preparing' | 'ready';
  onFilterChange?: (filter: StitchKDSProps['activeFilter']) => void;
}

/* ─── Filter tabs ───────────────────────────────────────────────── */

const FILTERS: { key: StitchKDSProps['activeFilter']; label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'priority', label: 'PRIORITY' },
  { key: 'preparing', label: 'PREPARING' },
  { key: 'ready', label: 'READY' },
];

/* ─── Default Data ───────────────────────────────────────────────── */

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

/* ─── Helper: format mm:ss ──────────────────────────────────────── */

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/* ─── Sub-components ────────────────────────────────────────────── */

function StatusBadge({ status }: { status: TicketStatus }) {
  const config: Record<TicketStatus, { label: string; className: string }> = {
    preparing: {
      label: 'PREPARING',
      className:
        'bg-[var(--aura-bg-elevated)] text-[var(--aura-tertiary)] border border-[var(--aura-tertiary)]/30',
    },
    pending: {
      label: 'PENDING',
      className:
        'bg-[var(--aura-bg-elevated)] text-[var(--aura-text-secondary)] border border-[var(--aura-border-subtle)]',
    },
    ready: {
      label: 'READY',
      className:
        'bg-[var(--aura-bg-elevated)] text-[var(--aura-success)] border border-[var(--aura-success)]/30',
    },
    overdue: {
      label: 'OVERDUE',
      className:
        'bg-[var(--aura-bg-elevated)] text-[var(--aura-error)] border border-[var(--aura-error)]/50',
    },
  };
  const c = config[status];
  return (
    <span
      className={clsx(
        'px-3 py-1 rounded text-xs font-bold uppercase tracking-[0.1em] inline-flex items-center gap-2',
        c.className,
      )}
    >
      {status === 'preparing' && (
        <span className="w-2 h-2 rounded-full bg-[var(--aura-tertiary)] animate-pulse" />
      )}
      {c.label}
    </span>
  );
}

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

  const accentColor = isOverdue
    ? 'var(--aura-error)'
    : isReady
      ? 'var(--aura-success)'
      : isPreparing
        ? 'var(--aura-tertiary)'
        : 'var(--aura-text-secondary)';

  return (
    <article
      className={clsx(
        'flex flex-col min-h-[360px] relative overflow-hidden rounded-lg',
        'bg-[var(--aura-bg-glass)] backdrop-blur-[12px]',
        'border border-[var(--aura-border-card)]',
        'shadow-[var(--aura-shadow-md)]',
        'transition-all duration-[var(--aura-duration-normal)]',
        'hover:border-[var(--aura-border-hover)]',
        isOverdue && 'ring-1 ring-[var(--aura-error)]/50',
        isReady && 'opacity-80',
      )}
    >
      {/* Accent bar */}
      <div className="h-1 w-full shrink-0" style={{ backgroundColor: accentColor }} />

      <div className="p-5 flex flex-col flex-grow gap-4">
        {/* Header row */}
        <div className="flex justify-between items-start">
          <div>
            <h2
              className="text-[var(--aura-text-primary)] text-xl font-bold tracking-tighter"
              style={{ fontFamily: 'var(--aura-font-display)' }}
            >
              {ticket.id}
            </h2>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary)] mt-0.5">
              {ticket.table} &bull; {ticket.type}
            </p>
          </div>
          <div className="text-right">
            <span
              className={clsx(
                'text-[32px] font-bold leading-none tracking-tighter',
                isOverdue && 'animate-pulse',
              )}
              style={{
                fontFamily: 'var(--aura-font-body)',
                color: isOverdue ? 'var(--aura-error)' : accentColor,
              }}
            >
              {formatTime(elapsed)}
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary)] mt-1">
              {isReady ? 'TOTAL TIME' : isOverdue ? 'OVERDUE' : 'ELAPSED'}
            </p>
          </div>
        </div>

        {/* Items list */}
        <div className="space-y-3 flex-grow">
          {ticket.items.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <span
                className={clsx(
                  'font-bold text-lg min-w-[32px] shrink-0',
                  isReady && 'line-through opacity-50',
                )}
                style={{ color: 'var(--aura-text-primary)' }}
              >
                {item.quantity}x
              </span>
              <div className={clsx(isReady && 'line-through opacity-50')}>
                <p className="text-base font-medium" style={{ color: 'var(--aura-text-primary)' }}>
                  {item.name}
                </p>
                {item.modifier && (
                  <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded border"
                    style={{
                      color: 'var(--aura-tertiary)',
                      borderColor: 'var(--aura-tertiary)',
                    }}
                  >
                    {item.modifier}
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
            COMPLETE TICKET
          </ActionButton>
        )}
        {isPending && onStart && (
          <ActionButton onClick={() => onStart(ticket.id)}>
            START PREP
          </ActionButton>
        )}
        {isReady && onPickup && (
          <ActionButton onClick={() => onPickup(ticket.id)} disabled>
            ORDER PICKED UP
          </ActionButton>
        )}
        {isOverdue && onStart && (
          <ActionButton
            onClick={() => onStart(ticket.id)}
            className="bg-[var(--aura-error)]"
          >
            PRIORITY START
          </ActionButton>
        )}
      </div>

      {/* Ready overlay */}
      {isReady && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ backgroundColor: 'rgba(76, 175, 80, 0.05)' }}
        />
      )}
    </article>
  );
}

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
      className={clsx(
        'w-full py-3.5 text-xs font-bold uppercase tracking-[0.15em] rounded-lg',
        'transition-all duration-75 active:translate-y-0.5',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'bg-gradient-to-b from-[#E2E8F0] via-[#94A3B8] to-[#475569]',
        'text-[#2c1700]',
        'shadow-[0_4px_0_rgba(0,0,0,0.3)]',
        'active:shadow-[0_1px_0_rgba(0,0,0,0.5)]',
        className,
      )}
    >
      {children}
    </button>
  );
}

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
  const navItems = [
    { icon: LayoutDashboard, label: 'DASHBOARD', active: true },
    { icon: History, label: 'HISTORY', active: false },
    { icon: Package, label: 'INVENTORY', active: false },
    { icon: Users, label: 'STAFF', active: false },
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={clsx(
          'fixed left-0 top-0 h-full z-40 flex flex-col',
          'bg-[var(--aura-bg-void)]/80 backdrop-blur-2xl',
          'border-r border-[var(--aura-border-subtle)]',
          'transition-transform duration-[var(--aura-duration-normal)]',
          'w-56',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          'md:translate-x-0',
        )}
      >
        {/* Profile */}
        <div className="flex items-center gap-3 px-4 pt-20 pb-8">
          <div
            className="w-10 h-10 rounded-full overflow-hidden shrink-0"
            style={{
              backgroundColor: 'var(--aura-bg-elevated)',
              border: '1px solid var(--aura-border-subtle)',
            }}
          >
            <ChefHat className="w-5 h-5 m-auto mt-2.5" style={{ color: 'var(--aura-tertiary)' }} />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--aura-tertiary)' }}>
              {stationLabel}
            </p>
            <p className="text-sm font-bold" style={{ color: 'var(--aura-text-primary)' }}>
              {stationName}
            </p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 px-3 flex-grow">
          {navItems.map((item) => (
            <a
              key={item.label}
              href="#"
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded text-xs font-bold uppercase tracking-[0.1em] transition-all',
                item.active
                  ? 'border-l-2 border-[var(--aura-tertiary)]'
                  : 'opacity-60 hover:opacity-100',
              )}
              style={{
                color: item.active ? 'var(--aura-tertiary)' : 'var(--aura-text-secondary)',
                backgroundColor: item.active ? 'var(--aura-bg-elevated)/30' : 'transparent',
              }}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </a>
          ))}
        </nav>

        {/* Station load */}
        <div className="px-4 pb-6">
          <div className="p-3 rounded-lg" style={{
            backgroundColor: 'var(--aura-bg-elevated)',
            border: '1px solid var(--aura-border-subtle)',
          }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] mb-2 opacity-60" style={{ color: 'var(--aura-text-primary)' }}>
              STATION LOAD
            </p>
            <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--aura-bg-glass)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${stationLoad}%`,
                  backgroundColor: 'var(--aura-tertiary)',
                }}
              />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.1em] mt-2" style={{ color: 'var(--aura-text-secondary)' }}>
              {stationLoad}% CAPACITY
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ─── Empty State ────────────────────────────────────────────────── */

function EmptyState({ onRefresh }: { onRefresh?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <CheckCircle2 className="w-16 h-16 mb-4 opacity-30" style={{ color: 'var(--aura-text-secondary)' }} />
      <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--aura-font-display)', color: 'var(--aura-text-primary)' }}>
        All Clear
      </h3>
      <p className="text-sm mb-6 max-w-xs" style={{ color: 'var(--aura-text-secondary)' }}>
        No active tickets at this station. New orders will appear here automatically.
      </p>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-[0.1em] transition-colors"
          style={{
            backgroundColor: 'var(--aura-bg-elevated)',
            color: 'var(--aura-text-primary)',
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      )}
    </div>
  );
}

/* ─── Loading State ──────────────────────────────────────────────── */

function LoadingState() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="min-h-[360px] rounded-lg animate-pulse"
          style={{ backgroundColor: 'var(--aura-bg-glass)' }}
        >
          <div className="h-1 w-full rounded-t-lg" style={{ backgroundColor: 'var(--aura-border-subtle)' }} />
          <div className="p-5 space-y-4">
            <div className="flex justify-between">
              <div className="space-y-2">
                <div className="h-5 w-16 rounded" style={{ backgroundColor: 'var(--aura-bg-elevated)' }} />
                <div className="h-3 w-24 rounded" style={{ backgroundColor: 'var(--aura-bg-elevated)' }} />
              </div>
              <div className="space-y-2">
                <div className="h-8 w-16 rounded" style={{ backgroundColor: 'var(--aura-bg-elevated)' }} />
                <div className="h-3 w-12 rounded" style={{ backgroundColor: 'var(--aura-bg-elevated)' }} />
              </div>
            </div>
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="flex gap-3">
                <div className="h-5 w-8 rounded shrink-0" style={{ backgroundColor: 'var(--aura-bg-elevated)' }} />
                <div className="h-5 w-32 rounded" style={{ backgroundColor: 'var(--aura-bg-elevated)' }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Error State ────────────────────────────────────────────────── */

function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <AlertTriangle className="w-16 h-16 mb-4" style={{ color: 'var(--aura-error)' }} />
      <h3 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--aura-font-display)', color: 'var(--aura-text-primary)' }}>
        Connection Error
      </h3>
      <p className="text-sm mb-6 max-w-md" style={{ color: 'var(--aura-text-secondary)' }}>
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-[0.1em] transition-all hover:opacity-90"
          style={{
            backgroundColor: 'var(--aura-tertiary)',
            color: 'var(--aura-on-tertiary)',
          }}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────── */

export default function StitchKDS({
  tickets = DEFAULT_TICKETS,
  stationName = 'GRILL & SAUTE',
  stationLabel = 'STATION 01',
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
}: StitchKDSProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const now = new Date();
    setCurrentTime(
      now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    );
  }, []);

  const filteredTickets = useCallback(() => {
    if (!tickets) return [];
    if (activeFilter === 'all') return tickets;
    if (activeFilter === 'priority')
      return tickets.filter((t) => t.status === 'overdue' || t.status === 'preparing');
    return tickets.filter((t) => t.status === activeFilter);
  }, [tickets, activeFilter]);

  const filtered = filteredTickets();

  /* ─── Status counts ──────────────────────────────────────────────── */
  const countPreparing = tickets.filter((t) => t.status === 'preparing').length;
  const countPending = tickets.filter((t) => t.status === 'pending').length;
  const countReady = tickets.filter((t) => t.status === 'ready').length;
  const activeCount = countPreparing + countPending;

  return (
    <div className="min-h-screen overflow-hidden" style={{ backgroundColor: 'var(--aura-bg-page)', color: 'var(--aura-text-primary)' }}>
      {/* ── Top App Bar ──────────────────────────────────────────── */}
      <header
        className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-3.5"
        style={{
          backgroundColor: 'var(--aura-bg-page)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--aura-border-subtle)',
        }}
      >
        <div className="flex items-center gap-4">
          {/* Mobile menu toggle */}
          <button
            className="md:hidden p-1 rounded transition-colors"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{ color: 'var(--aura-text-primary)' }}
            aria-label="Toggle sidebar"
          >
            {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>

          <h1
            className="text-2xl font-black tracking-tighter hidden sm:block"
            style={{ fontFamily: 'var(--aura-font-display)', color: 'var(--aura-text-primary)' }}
          >
            HEARTH &amp; STEEL KDS
          </h1>
          <div className="h-6 w-px hidden sm:block" style={{ backgroundColor: 'var(--aura-border-subtle)' }} />
          <div className="hidden sm:flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em] opacity-60" style={{ color: 'var(--aura-text-secondary)' }}>
              STATION
            </span>
            <span className="text-lg font-bold" style={{ color: 'var(--aura-tertiary)' }}>
              {stationLabel}
            </span>
          </div>

          {/* Mobile title */}
          <span className="sm:hidden text-sm font-bold" style={{ color: 'var(--aura-tertiary)' }}>
            KDS
          </span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => onFilterChange?.(f.key)}
              className={clsx(
                'text-xs font-bold pb-1 transition-all',
                activeFilter === f.key
                  ? 'border-b-2'
                  : 'hover:opacity-80',
              )}
              style={{
                color: activeFilter === f.key ? 'var(--aura-tertiary)' : 'var(--aura-text-secondary)',
                borderColor: activeFilter === f.key ? 'var(--aura-tertiary)' : 'transparent',
              }}
            >
              {f.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--aura-tertiary)' }}>
              AVG PREP: {avgPrepTime}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--aura-text-secondary)' }}>
              ACTIVE: {activeCount}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              className="p-1.5 rounded transition-colors hover:bg-[var(--aura-bg-elevated)]/30"
              style={{ color: 'var(--aura-text-primary)' }}
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
            </button>
            <button
              className="p-1.5 rounded transition-colors hover:bg-[var(--aura-bg-elevated)]/30"
              style={{ color: 'var(--aura-text-primary)' }}
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <Sidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(false)}
        stationLabel={stationLabel}
        stationName={stationName}
        stationLoad={stationLoad}
      />

      {/* ── Main Canvas ──────────────────────────────────────────── */}
      <main className="md:ml-56 pt-16 px-5 pb-6 h-screen overflow-y-auto">
        {/* Status bar */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: 'var(--aura-border-subtle)' }}>
          <div className="flex flex-wrap gap-3">
            <span
              className="px-3 py-1 rounded text-xs font-bold uppercase tracking-[0.1em] inline-flex items-center gap-2"
              style={{
                backgroundColor: 'var(--aura-bg-elevated)',
                color: 'var(--aura-tertiary)',
              }}
            >
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--aura-tertiary)' }} />
              PREPARING ({countPreparing})
            </span>
            <span
              className="px-3 py-1 rounded text-xs font-bold uppercase tracking-[0.1em]"
              style={{
                backgroundColor: 'var(--aura-bg-elevated)',
                color: 'var(--aura-text-secondary)',
              }}
            >
              PENDING ({countPending})
            </span>
            <span
              className="px-3 py-1 rounded text-xs font-bold uppercase tracking-[0.1em]"
              style={{
                backgroundColor: 'var(--aura-bg-elevated)',
                color: 'var(--aura-success)',
                border: '1px solid var(--aura-success)/30',
              }}
            >
              READY ({countReady})
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--aura-text-secondary)' }}>
            AURA CAFE &bull; {stationName}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
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
    </div>
  );
}
