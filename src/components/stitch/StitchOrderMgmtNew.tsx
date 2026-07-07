/**
 * StitchOrderMgmtNew — AURA CAFE Order Management Terminal (Stitch v2 design)
 *
 * Dark navy glassmorphism order management terminal with Chrome/bronze accents.
 * Source: Stitch AI aura_cafe_order_management_terminal export.
 *
 * Features:
 * - Collapsible sidebar nav with active state
 * - Top app bar with search, notifications, and admin profile
 * - 4 stat overview cards (Active Orders, In Preparation, Ready for Pickup, Avg. Lead Time)
 * - Search input with filter tabs (All, Pending, Preparing, Ready, Served)
 * - Order card grid with status-coded badges and actions
 * - Pagination footer
 * - Loading / error / empty states
 * - Mobile-first responsive layout
 * - Full i18n support (bilingual EN + VI)
 * - Accessible ARIA labels
 */
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import {
  LayoutDashboard,
  Receipt,
  Package,
  Users,
  Settings,
  LogOut,
  Bell,
  HelpCircle,
  Search,
  ChevronLeft,
  ChevronRight,
  Menu,
  Clock,
  UtensilsCrossed,
  Ban,
  Loader2,
  AlertCircle,
  RefreshCw,
 ChartBar,
 Timer,
 UserPlus,
 Tag,
} from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────────────── */

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';

export interface OrderItem {
  name: string;
  quantity: number;
}

export interface OrderData {
  id: string;
  customer: string;
  table: string;
  timeAgo: string;
  status: OrderStatus;
  items: OrderItem[];
  total: string;
  cancelledReason?: string;
}

export interface StatCardData {
  label: string;
  value: string;
  icon: 'activeOrders' | 'inPreparation' | 'readyPickup' | 'avgLeadTime';
}

export interface NavItem {
  label: string;
  key: string;
  icon: React.ReactNode;
  active?: boolean;
}

export interface StitchOrderMgmtNewProps {
  brandName?: string;
  brandSubtitle?: string;
  headerTitle?: string;
  headerSubtitle?: string;
  adminName?: string;
  adminAvatarUrl?: string;
  stats?: StatCardData[];
  orders?: OrderData[];
  activeNav?: string;
  activeFilter?: OrderStatus | 'all';
  isLoading?: boolean;
  error?: string | null;
  onFilterChange?: (filter: OrderStatus | 'all') => void;
  onSearch?: (query: string) => void;
  onOrderAction?: (orderId: string, action: string) => void;
  onRefresh?: () => void;
}

/* ─── Shared Glass Panel Class ───────────────────────────────────────────────── */

const GLASS_CLASSES =
  'bg-white/5 backdrop-blur-xl border-[0.5px] border-white/10';

/* ─── Default Data ──────────────────────────────────────────────────────────── */

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', key: 'dashboard', icon: <LayoutDashboard size={20} /> },
  { label: 'Orders', key: 'orders', icon: <Receipt size={20} />, active: true },
  { label: 'Inventory', key: 'inventory', icon: <Package size={20} /> },
  { label: 'Staffing', key: 'staffing', icon: <Users size={20} /> },
];

const DEFAULT_STATS: StatCardData[] = [
  { label: 'Active Orders', value: '24', icon: 'activeOrders' },
  { label: 'In Preparation', value: '12', icon: 'inPreparation' },
  { label: 'Ready for Pickup', value: '06', icon: 'readyPickup' },
  { label: 'Avg. Lead Time', value: '8.5m', icon: 'avgLeadTime' },
];

const DEFAULT_ORDERS: OrderData[] = [
  {
    id: '#AC-9821', customer: 'Julian Vane', table: 'Table B01',
    timeAgo: '2 mins ago', status: 'pending',
    items: [{ name: 'Midnight Espresso', quantity: 2 }, { name: 'Smoked Truffle Croissant', quantity: 1 }, { name: 'Hibiscus Cold Brew', quantity: 1 }],
    total: '$34.50',
  },
  {
    id: '#AC-9819', customer: 'Elena Thorne', table: 'Table A04',
    timeAgo: '8 mins ago', status: 'preparing',
    items: [{ name: 'Golden Matcha Latte', quantity: 1 }, { name: 'Lavender Scone', quantity: 1 }, { name: 'Avocado Sourdough', quantity: 1 }],
    total: '$28.20',
  },
  {
    id: '#AC-9818', customer: 'Marcus Chen', table: 'Bar Counter 02',
    timeAgo: '12 mins ago', status: 'ready',
    items: [{ name: 'Iced Nitro Cold Brew', quantity: 1 }, { name: 'Dark Chocolate Ganache Tart', quantity: 1 }],
    total: '$18.00',
  },
  {
    id: '#AC-9817', customer: 'Sara Loft', table: 'Table C09',
    timeAgo: '15 mins ago', status: 'served',
    items: [{ name: 'Double Espresso', quantity: 1 }, { name: 'Sparkling Water', quantity: 1 }, { name: 'Pistachio Macaron', quantity: 3 }],
    total: '$22.50',
  },
  {
    id: '#AC-9816', customer: 'David Miller', table: 'Table B05',
    timeAgo: '1 min ago', status: 'pending',
    items: [{ name: 'Smoked Salmon Toast', quantity: 1 }, { name: 'Earl Grey Tea', quantity: 1 }, { name: 'Mineral Water', quantity: 1 }],
    total: '$31.00',
  },
  {
    id: '#AC-9815', customer: 'Guest User', table: '',
    timeAgo: '', status: 'cancelled',
    items: [],
    total: '$45.00',
    cancelledReason: 'Payment Failed',
  },
];

const FILTER_TABS: { key: OrderStatus | 'all'; tKey: string }[] = [
  { key: 'all', tKey: 'orderMgmt.all' },
  { key: 'pending', tKey: 'orderMgmt.pending' },
  { key: 'preparing', tKey: 'orderMgmt.preparing' },
  { key: 'ready', tKey: 'orderMgmt.ready' },
  { key: 'served', tKey: 'orderMgmt.served' },
];

/* ─── Status Helpers ─────────────────────────────────────────────────────────── */

interface StatusBadgeConfig {
  bg: string;
  text: string;
  border: string;
  tKey: string;
}

const STATUS_BADGE_CONFIG: Record<OrderStatus, StatusBadgeConfig> = {
  pending: {
    bg: 'bg-[#2b1701]/40',
    text: 'text-[#e5c099]',
    border: 'border-[#e5c099]/20',
    tKey: 'orderMgmt.pending',
  },
  preparing: {
    bg: 'bg-[#e5c099]/10',
    text: 'text-[#ffddba]',
    border: 'border-[#ffddba]/20',
    tKey: 'orderMgmt.preparing',
  },
  ready: {
    bg: 'bg-[var(--aura-primary, #c6c6c7)]/10',
    text: 'text-[var(--aura-primary, #c6c6c7)]',
    border: 'border-[var(--aura-primary, #c6c6c7)]/20',
    tKey: 'orderMgmt.ready',
  },
  served: {
    bg: 'bg-white/5',
    text: 'text-[var(--aura-text-secondary, #a0a8b0)]',
    border: 'border-white/10',
    tKey: 'orderMgmt.served',
  },
  cancelled: {
    bg: 'bg-[#ffb4ab]/10',
    text: 'text-[#ffb4ab]',
    border: 'border-[#ffb4ab]/20',
    tKey: 'orderMgmt.cancelled',
  },
};

const STATUS_BAR_CLASSES: Record<OrderStatus, string> = {
  pending: 'bg-[#e5c099] shadow-[0_0_10px_rgba(229,192,153,0.5)]',
  preparing: 'bg-[#ffddba] shadow-[0_0_10px_rgba(255,221,186,0.5)]',
  ready: 'bg-[var(--aura-primary, #c6c6c7)] shadow-[0_0_10px_rgba(184,199,226,0.5)]',
  served: 'bg-[#8e9097] shadow-[0_0_10px_rgba(142,144,151,0.5)]',
  cancelled: 'bg-[#ffb4ab] shadow-[0_0_10px_rgba(255,180,171,0.5)]',
};

function getActionForStatus(status: OrderStatus): string {
  switch (status) {
    case 'pending': return 'Preparing';
    case 'preparing': return 'Ready';
    case 'ready': return 'Serve';
    default: return 'Completed';
  }
}

/* ─── Sub-components ───────────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  const c = STATUS_BADGE_CONFIG[status];

  return (
    <span
      className={cn(
        'rounded px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.1em] border',
        c.bg,
        c.text,
        c.border,
      )}
      aria-label={t(c.tKey)}
    >
      {t(c.tKey)}
    </span>
  );
}

function OrderActionButton({
  label,
  disabled,
  primary,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  primary?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'font-sans text-[12px] font-bold uppercase tracking-[0.1em] py-3 transition-all rounded-lg',
        disabled &&
          'cursor-not-allowed bg-[#343536] text-[var(--aura-text-secondary, #a0a8b0)]/50',
        !disabled && primary
          ? 'bg-[var(--aura-primary, #c6c6c7)] text-[#0c1c30] hover:brightness-110 active:scale-[0.97]'
          : '',
        !disabled &&
          !primary &&
          'border border-white/10 bg-white/5 text-[var(--aura-text-primary, #e8e8e8)] hover:bg-white/10 active:scale-[0.97]',
      )}
      aria-label={label}
    >
      {label}
    </button>
  );
}

function OrderCard({
  order,
  onAction,
}: {
  order: OrderData;
  onAction?: () => void;
}) {
  const { t } = useTranslation();

  const isCancelled = order.status === 'cancelled';
  const isServed = order.status === 'served';
  const actionLabel = getActionForStatus(order.status);

  const tTerminal = (key: string) => t(`terminal.${key}`);

  return (
    <div
      className={cn(
        GLASS_CLASSES,
        'group relative overflow-hidden rounded-xl transition-all duration-500',
        isCancelled && 'opacity-60',
        isServed && 'opacity-80',
      )}
      aria-label={tTerminal('orderCard').replace('{id}', order.id)}
    >
      {/* Status bar */}
      <div
        className={cn(
          'absolute left-0 top-0 h-full w-0.5',
          STATUS_BAR_CLASSES[order.status],
        )}
        aria-hidden="true"
      />

      <div className="p-6">
        {/* Header: ID + customer + status badge */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)]">
              {order.id}
            </span>
            <h3 className="mt-1 font-sans text-xl font-medium text-[var(--aura-text-primary, #e8e8e8)]">
              {order.customer}
            </h3>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* Location / time */}
        <div className="mb-4 space-y-2">
          {order.table && (
            <div className="flex items-center gap-2 text-sm text-[var(--aura-text-secondary, #a0a8b0)]">
              <UtensilsCrossed size={16} className="shrink-0" />
              <span>{order.table}</span>
            </div>
          )}
          {order.timeAgo && (
            <div className="flex items-center gap-2 text-sm text-[var(--aura-text-secondary, #a0a8b0)]">
              <Clock size={16} className="shrink-0" />
              <span>{order.timeAgo}</span>
            </div>
          )}
          {isCancelled && order.cancelledReason && (
            <div className="flex items-center gap-2 text-sm text-[#ffb4ab]/60">
              <Ban size={16} className="shrink-0" />
              <span>{order.cancelledReason}</span>
            </div>
          )}
        </div>

        {/* Items section */}
        <div className="mb-4 border-t border-white/5 pt-4">
          <p className="mb-2 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)]">
            {tTerminal('items')}
          </p>
          {order.items.length > 0 ? (
            <p className="line-clamp-2 text-sm text-[var(--aura-text-primary, #e8e8e8)]">
              {order.items
                .map((item) => `${item.name} x${item.quantity}`)
                .join(', ')}
            </p>
          ) : (
            <p className="line-clamp-2 text-sm italic text-[var(--aura-text-secondary, #a0a8b0)]">
              {tTerminal('orderVoided')}
            </p>
          )}
        </div>

        {/* Total */}
        <div className="mb-4 flex items-center justify-between">
          <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)]">
            {tTerminal('total')}
          </span>
          <span
            className={cn(
              'font-sans text-xl font-medium text-[var(--aura-primary, #c6c6c7)]',
              isCancelled && 'text-[var(--aura-text-secondary, #a0a8b0)] line-through',
            )}
          >
            {order.total}
          </span>
        </div>

        {/* Actions */}
        {isCancelled ? (
          <button
            className="w-full rounded-lg border border-white/5 bg-white/5 py-3 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)] transition-all hover:bg-white/10 active:scale-95"
            aria-label={tTerminal('viewLog')}
          >
            {tTerminal('viewLog')}
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <OrderActionButton
              label={tTerminal('details')}
              onClick={onAction}
            />
            <OrderActionButton
              label={tTerminal(actionLabel.toLowerCase()) || actionLabel}
              primary
              disabled={isServed}
              onClick={isServed ? undefined : onAction}
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────────── */

export function StitchOrderMgmtNew({
  brandName = 'Aura Cafe',
  brandSubtitle = 'Terminal v1.0',
  headerTitle = 'Aether Cafe Terminal',
  headerSubtitle = 'Order Management',
  adminName = 'Aura Admin',
  adminAvatarUrl = '',
  stats = DEFAULT_STATS,
  orders = DEFAULT_ORDERS,
  activeNav = 'orders',
  activeFilter = 'all',
  isLoading = false,
  error = null,
  onFilterChange,
  onSearch,
  onOrderAction,
  onRefresh,
}: Readonly<StitchOrderMgmtNewProps>) {
  const { t } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const tNav = (key: string) => t(`nav.${key}`);
  const tTerminal = (key: string) => t(`terminal.${key}`);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  /* ─── Loading State ────────────────────────────────────────────── */

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--aura-bg-page, #0A1A2E)]">
        <div className="flex flex-col items-center gap-4" role="status" aria-label={tTerminal('loading')}>
          <Loader2 size={40} className="animate-spin text-[var(--aura-primary, #c6c6c7)]" />
          <p className="font-sans text-sm text-[var(--aura-text-secondary, #a0a8b0)]">{tTerminal('loading')}</p>
        </div>
      </div>
    );
  }

  /* ─── Error State ──────────────────────────────────────────────── */

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--aura-bg-page, #0A1A2E)]">
        <div
          className={cn(GLASS_CLASSES, 'flex max-w-md flex-col items-center gap-4 rounded-xl p-8 text-center')}
          role="alert"
          aria-label={tTerminal('error')}
        >
          <AlertCircle size={48} className="text-[#ffb4ab]" />
          <h2 className="font-sans text-xl font-semibold text-[#ffb4ab]">
            {tTerminal('errorTitle')}
          </h2>
          <p className="text-sm text-[var(--aura-text-secondary, #a0a8b0)]">{error}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-2 flex items-center gap-2 rounded-lg bg-[var(--aura-primary, #c6c6c7)] px-6 py-3 font-sans text-sm font-bold text-[#0c1c30] transition-all hover:brightness-110 active:scale-95"
              aria-label={tTerminal('retry')}
            >
              <RefreshCw size={16} />
              {tTerminal('retry')}
            </button>
          )}
        </div>
      </div>
    );
  }

  /* ─── Empty State Derivation ───────────────────────────────────── */

  const filteredOrders =
    activeFilter === 'all'
      ? orders
      : orders.filter((o) => o.status === activeFilter);

  /* ─── Render ──────────────────────────────────────────────────── */

  return (
    <div className="relative min-h-screen bg-[var(--aura-bg-page, #0A1A2E)] font-sans text-[var(--aura-text-primary, #e8e8e8)]">
      {/* ─── Mobile Sidebar Overlay ─── */}
      {sidebarOpen && (
        <button
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-label={tTerminal('closeSidebar')}
        />
      )}

      {/* ─── Sidebar ─── */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-full w-[280px] flex-col border-r border-white/10 bg-[#0b203a]/40 py-6 backdrop-blur-xl shadow-2xl shadow-black/50 transition-transform duration-300 md:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        aria-label={tTerminal('sidebar')}
      >
        {/* Brand header */}
        <div className="mb-10 px-6" aria-label={brandName}>
          <h1 className="font-display text-[32px] font-semibold leading-tight tracking-[0.02em] text-[var(--aura-text-primary, #e8e8e8)]">
            {t('hero.title') || brandName}
          </h1>
          <p className="mt-1 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)]">
            {brandSubtitle}
          </p>
        </div>

        {/* Main navigation */}
        <nav className="flex-1 space-y-1" aria-label={tTerminal('mainNavigation')}>
          {DEFAULT_NAV_ITEMS.map((item) => {
            const isActive = item.key === activeNav;
            return (
              <a
                key={item.key}
                href="#"
                className={cn(
                  'flex items-center gap-4 px-6 py-4 text-sm transition-all duration-300 active:scale-[0.98]',
                  isActive
                    ? 'border-l-2 border-[var(--aura-primary, #c6c6c7)] bg-white/5 text-[var(--aura-primary, #c6c6c7)]'
                    : 'text-[var(--aura-text-secondary, #a0a8b0)] hover:bg-white/5 hover:text-[var(--aura-text-primary, #e8e8e8)]',
                )}
                aria-current={isActive ? 'page' : undefined}
                aria-label={tNav(item.key)}
              >
                {item.icon}
                <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em]">
                  {tNav(item.key)}
                </span>
              </a>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="mt-auto px-6">
          <button
            className="mb-6 w-full rounded-lg bg-gradient-to-br from-[var(--aura-primary, #c6c6c7)] to-[#8e9097] py-3 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[#0c1c30] transition-all hover:brightness-110 active:scale-[0.97]"
            aria-label={tTerminal('newOrder')}
          >
            {tTerminal('newOrder')}
          </button>

          <div className="space-y-1 border-t border-white/5 pt-6">
            <a
              href="#"
              className="flex items-center gap-4 px-6 py-3 text-sm text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[var(--aura-text-primary, #e8e8e8)]"
              aria-label={tTerminal('settings')}
            >
              <Settings size={20} />
              <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em]">
                {tTerminal('settings')}
              </span>
            </a>
            <a
              href="#"
              className="flex items-center gap-4 px-6 py-3 text-sm text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[#ffb4ab]"
              aria-label={tTerminal('logout')}
            >
              <LogOut size={20} />
              <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em]">
                {tTerminal('logout')}
              </span>
            </a>
          </div>
        </div>
      </aside>

      {/* ─── Top App Bar ─── */}
      <header
        className={cn(
          'fixed right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[var(--aura-bg-page, #0A1A2E)]/60 px-4 backdrop-blur-md md:px-6',
          'left-0 md:left-[280px]',
        )}
        aria-label={tTerminal('topBar')}
      >
        <div className="flex items-center gap-4">
          {/* Mobile hamburger */}
          <button
            className="text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:text-[var(--aura-primary, #c6c6c7)] md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label={tTerminal('openSidebar')}
          >
            <Menu size={24} />
          </button>

          <span className="font-sans text-xl font-semibold text-[var(--aura-primary, #c6c6c7)]">
            {headerTitle}
          </span>

          <span className="hidden h-4 w-px bg-white/10 md:block" aria-hidden="true" />

          <span className="hidden font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)] md:block">
            {headerSubtitle}
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-4 md:gap-6">
          <button
            className="text-[var(--aura-text-secondary, #a0a8b0)] transition-all hover:text-[var(--aura-primary, #c6c6c7)]"
            aria-label={tTerminal('notifications')}
          >
            <Bell size={20} />
          </button>
          <button
            className="text-[var(--aura-text-secondary, #a0a8b0)] transition-all hover:text-[var(--aura-primary, #c6c6c7)]"
            aria-label={tTerminal('help')}
          >
            <HelpCircle size={20} />
          </button>
          {/* Admin avatar */}
          <div
            className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[#292a2c]"
            aria-label={tTerminal('adminAvatar')}
          >
            {adminAvatarUrl ? (
              <img
                className="h-full w-full object-cover"
                src={adminAvatarUrl}
                alt={tTerminal('adminAvatar')}
              />
            ) : (
              <span className="text-xs font-bold text-[var(--aura-text-secondary, #a0a8b0)]">
                {adminName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ─── Main Content Area ─── */}
      <main
        className={cn('min-h-screen px-4 pb-8 pt-20 md:px-6', 'md:ml-[280px]')}
        aria-label={tTerminal('mainContent')}
      >
        <div className="mx-auto w-full max-w-[1440px]">
          {/* ─── Stat Overview Cards ─── */}
          <section
            className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            aria-label={tTerminal('statOverview')}
          >
            {stats.map((stat) => (
              <div
                key={stat.icon}
                className={cn(GLASS_CLASSES, 'flex flex-col justify-center rounded-xl p-6')}
                aria-label={tTerminal(`stat.${stat.icon}`)}
              >
                <span className="mb-1 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)]">
                  {stat.label}
                </span>
                <span className="font-sans text-[32px] font-semibold leading-tight tracking-tight bg-gradient-to-r from-[#f2c08d] via-[#efbd8a] to-[#d4a574] bg-clip-text text-transparent">
                  {stat.value}
                </span>
              </div>
            ))}
          </section>

 {/* Revenue + Staff + Promotions */}
 <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
 <div className={cn(GLASS_CLASSES, "lg:col-span-2 flex flex-col rounded-xl p-6")}>
 <div className="mb-6 flex items-center justify-between">
 <div>
 <h2 className="font-display text-xl font-semibold bg-gradient-to-r from-[#f2c08d] via-[#efbd8a] to-[#d4a574] bg-clip-text text-transparent">Revenue Analytics</h2>
 <p className="text-[13px] text-[var(--aura-text-secondary, #a0a8b0)]">Weekly growth and peak hours</p>
 </div>
 <div className="flex gap-2">
 <button className="rounded-full bg-white/10 px-3 py-1 text-[12px] text-[var(--aura-text-primary, #e8e8e8)]">Weekly</button>
 <button className="rounded-full px-3 py-1 text-[12px] text-[var(--aura-text-secondary, #a0a8b0)] hover:bg-white/5">Monthly</button>
 </div>
 </div>
 <div className="flex-1 relative flex items-end justify-between gap-3 h-[180px]">
 <div className="w-full flex-1 rounded-t-lg bg-white/5" style={{height:"40%"}}><div className="h-full rounded-t-lg bg-[rgba(212,165,116,0.2)]" /></div>
 <div className="w-full flex-1 rounded-t-lg bg-white/5" style={{height:"65%"}}><div className="h-full rounded-t-lg bg-[rgba(212,165,116,0.3)]" /></div>
 <div className="w-full flex-1 rounded-t-lg bg-white/5" style={{height:"55%"}}><div className="h-full rounded-t-lg bg-[rgba(212,165,116,0.2)]" /></div>
 <div className="w-full flex-1 rounded-t-lg bg-white/5" style={{height:"85%"}}><div className="h-full rounded-t-lg bg-[rgba(212,165,116,0.5)] shadow-[0_0_12px_rgba(212,165,116,0.35)]" /></div>
 <div className="w-full flex-1 rounded-t-lg bg-white/5" style={{height:"70%"}}><div className="h-full rounded-t-lg bg-[rgba(212,165,116,0.2)]" /></div>
 <div className="w-full flex-1 rounded-t-lg bg-white/5" style={{height:"95%"}}><div className="h-full rounded-t-lg bg-[rgba(212,165,116,0.65)] shadow-[0_0_12px_rgba(212,165,116,0.35)]" /></div>
 <div className="w-full flex-1 rounded-t-lg bg-white/5" style={{height:"45%"}}><div className="h-full rounded-t-lg bg-[rgba(212,165,116,0.15)]" /></div>
 </div>
 <div className="mt-3 flex justify-between px-1 text-[11px] text-[var(--aura-text-secondary, #a0a8b0)] opacity-50">
 <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span className="font-bold text-[#d4a574]">Sat</span><span>Sun</span>
 </div>
 </div>

 <div className={cn(GLASS_CLASSES, "flex flex-col rounded-xl p-6")}>
 <div className="mb-4 text-center">
 <p className="mb-1 text-[12px] uppercase tracking-widest text-[var(--aura-text-secondary, #a0a8b0)] opacity-60">Monday, Oct 24</p>
 <h2 className="text-5xl font-mono font-extrabold bg-gradient-to-r from-[#f2c08d] via-[#efbd8a] to-[#d4a574] bg-clip-text text-transparent tabular-nums">{new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false})}</h2>
 </div>
 <div className="mb-4 flex-1 space-y-3 overflow-y-auto pr-1">
 <p className="border-b border-white/10 pb-2 text-[11px] font-bold uppercase tracking-wider text-[var(--aura-text-primary, #e8e8e8)] opacity-60">CURRENT SHIFT</p>
 <div className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-white/5">
 <div className="flex items-center gap-3">
 <div className="h-2 w-2 rounded-full bg-[#d4a574] animate-pulse" />
 <span className="text-[13px] font-medium text-[var(--aura-text-primary, #e8e8e8)]">Sarah J.</span>
 </div>
 <span className="text-[12px] text-[var(--aura-text-secondary, #a0a8b0)] opacity-50">Active since 06:00 AM</span>
 </div>
 <div className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-white/5">
 <div className="flex items-center gap-3">
 <div className="h-2 w-2 rounded-full bg-[#d4a574] animate-pulse" />
 <span className="text-[13px] font-medium text-[var(--aura-text-primary, #e8e8e8)]">Marcus T.</span>
 </div>
 <span className="text-[12px] text-[var(--aura-text-secondary, #a0a8b0)] opacity-50">Active since 07:30 AM</span>
 </div>
 <div className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-white/5">
 <div className="flex items-center gap-3">
 <div className="h-2 w-2 rounded-full bg-white/20" />
 <span className="text-[13px] font-medium text-[var(--aura-text-primary, #e8e8e8)] opacity-50">Elena W.</span>
 </div>
 <span className="text-[12px] text-[var(--aura-text-secondary, #a0a8b0)] opacity-50">Starts 10:00 AM</span>
 </div>
 </div>
 <button className="w-full rounded-xl bg-gradient-to-r from-[#f2c08d] to-[#d4a574] py-4 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[#16130f] shadow-lg shadow-[rgba(212,165,116,0.3)] transition-all hover:brightness-110 active:scale-[0.97]">
 CLOCK IN
 </button>
 </div>

 <div className={cn(GLASS_CLASSES, "flex flex-col rounded-xl p-6")}>
 <h2 className="font-display mb-5 text-xl font-semibold bg-gradient-to-r from-[#f2c08d] via-[#efbd8a] to-[#d4a574] bg-clip-text text-transparent">Active Promotions</h2>
 <div className="flex flex-1 flex-col gap-3">
 <div className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-[#d4a574] group">
 <div className="mb-2 flex items-start justify-between">
 <h4 className="font-bold text-[var(--aura-text-primary, #e8e8e8)]">Buy 1 Get 1 Mocha</h4>
 <span className="text-[#d4a574] opacity-0 transition-opacity group-hover:opacity-100">&rsaquo;</span>
 </div>
 <p className="mb-3 text-[12px] text-[var(--aura-text-secondary, #a0a8b0)]">Ends in 4h &bull; Afternoon Rush</p>
 <div className="h-1.5 w-full rounded-full bg-white/5"><div className="h-full rounded-full transition-all" style={{width:"65%",backgroundColor:"#d4a574"}} /></div>
 </div>
 <div className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:border-[#f2c08d] group">
 <div className="mb-2 flex items-start justify-between">
 <h4 className="font-bold text-[var(--aura-text-primary, #e8e8e8)]">Morning Happy Hour</h4>
 <span className="text-[#f2c08d] opacity-0 transition-opacity group-hover:opacity-100">&rsaquo;</span>
 </div>
 <p className="mb-3 text-[12px] text-[var(--aura-text-secondary, #a0a8b0)]">6 AM &ndash; 9 AM &bull; 20% Off Pastries</p>
 <div className="h-1.5 w-full rounded-full bg-white/5"><div className="h-full rounded-full transition-all" style={{width:"100%",backgroundColor:"#f2c08d"}} /></div>
 </div>
 <button className="w-full rounded-lg border border-dashed border-white/20 py-3 text-[13px] text-[var(--aura-text-secondary, #a0a8b0)] transition-colors hover:bg-white/5 hover:text-[var(--aura-text-primary, #e8e8e8)]">+ Create New Promotion</button>
 </div>
 </div>
 </section>

{/* ─── Search & Filters ─── */}
          <section
            className="mb-6 flex flex-col gap-4 md:flex-row md:items-center"
            aria-label={tTerminal('searchFilters')}
          >
            {/* Search input */}
            <div className="group relative w-full md:w-96">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--aura-text-secondary, #a0a8b0)] transition-colors group-focus-within:text-[var(--aura-primary, #c6c6c7)]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={tTerminal('searchPlaceholder')}
                className="w-full border-b border-white/10 bg-[var(--aura-bg-page, #0A1A2E)] py-3 pl-12 pr-4 font-sans text-sm text-[var(--aura-text-primary, #e8e8e8)] outline-none transition-all placeholder:text-[var(--aura-text-secondary, #a0a8b0)]/60 focus:border-[var(--aura-primary, #c6c6c7)]"
                aria-label={tTerminal('search')}
              />
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 md:w-auto">
              {FILTER_TABS.map((tab) => {
                const isActive = tab.key === activeFilter;
                return (
                  <button
                    key={tab.key}
                    onClick={() => onFilterChange?.(tab.key)}
                    className={cn(
                      'whitespace-nowrap rounded-lg px-4 py-2 font-sans text-[12px] font-bold uppercase tracking-[0.1em] transition-all active:scale-95',
                      isActive
                        ? 'border border-[var(--aura-primary, #c6c6c7)]/50 bg-[var(--aura-primary, #c6c6c7)]/10 text-[var(--aura-primary, #c6c6c7)]'
                        : cn(GLASS_CLASSES, 'text-[var(--aura-text-secondary, #a0a8b0)] hover:bg-white/10'),
                    )}
                    aria-label={t(tab.tKey)}
                    aria-current={isActive ? 'true' : undefined}
                  >
                    {t(tab.tKey)}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ─── Order Cards Grid ─── */}
          {filteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Package size={48} className="mb-4 text-[var(--aura-text-secondary, #a0a8b0)]/40" />
              <p className="font-sans text-sm text-[var(--aura-text-secondary, #a0a8b0)]">
                {tTerminal('noOrders')}
              </p>
            </div>
          ) : (
            <section
              className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
              aria-label={tTerminal('orderList')}
            >
              {filteredOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onAction={
                    onOrderAction
                      ? () => onOrderAction(order.id, getActionForStatus(order.status))
                      : undefined
                  }
                />
              ))}
            </section>
          )}

          {/* ─── Pagination ─── */}
          <footer
            className="mt-8 flex flex-col items-center justify-between gap-4 pb-6 sm:flex-row"
            aria-label={tTerminal('pagination')}
          >
            <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)]">
              {tTerminal('showingOrders').replace('{current}', '6').replace('{total}', '124')}
            </span>
            <div className="flex items-center gap-2">
              <button
                className={cn(GLASS_CLASSES, 'flex h-10 w-10 items-center justify-center rounded-lg transition-all hover:bg-white/10 active:scale-95')}
                aria-label={tTerminal('prevPage')}
              >
                <ChevronLeft size={20} />
              </button>
              {[1, 2, 3].map((page) => (
                <button
                  key={page}
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg font-sans text-[12px] font-bold uppercase tracking-[0.1em] transition-all',
                    page === 1
                      ? 'border border-[var(--aura-primary, #c6c6c7)]/50 bg-[var(--aura-primary, #c6c6c7)]/20 text-[var(--aura-primary, #c6c6c7)]'
                      : cn(GLASS_CLASSES, 'text-[var(--aura-text-secondary, #a0a8b0)] hover:bg-white/10'),
                  )}
                  aria-label={tTerminal('page').replace('{n}', String(page))}
                  aria-current={page === 1 ? 'true' : undefined}
                >
                  {page}
                </button>
              ))}
              <span className="px-1 text-[var(--aura-text-secondary, #a0a8b0)]" aria-hidden="true">
                ...
              </span>
              <button
                className={cn(GLASS_CLASSES, 'flex h-10 w-10 items-center justify-center rounded-lg font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[var(--aura-text-secondary, #a0a8b0)] transition-all hover:bg-white/10 active:scale-95')}
                aria-label={tTerminal('page').replace('{n}', '12')}
              >
                12
              </button>
              <button
                className={cn(GLASS_CLASSES, 'flex h-10 w-10 items-center justify-center rounded-lg transition-all hover:bg-white/10 active:scale-95')}
                aria-label={tTerminal('nextPage')}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
