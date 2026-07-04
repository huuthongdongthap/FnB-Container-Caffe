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
    bg: 'bg-[#b8c7e2]/10',
    text: 'text-[#b8c7e2]',
    border: 'border-[#b8c7e2]/20',
    tKey: 'orderMgmt.ready',
  },
  served: {
    bg: 'bg-white/5',
    text: 'text-[#c5c6cd]',
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
  ready: 'bg-[#b8c7e2] shadow-[0_0_10px_rgba(184,199,226,0.5)]',
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
          'cursor-not-allowed bg-[#343536] text-[#c5c6cd]/50',
        !disabled && primary
          ? 'bg-[#b8c7e2] text-[#0c1c30] hover:brightness-110 active:scale-[0.97]'
          : '',
        !disabled &&
          !primary &&
          'border border-white/10 bg-white/5 text-[#d4e3ff] hover:bg-white/10 active:scale-[0.97]',
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
            <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[#c5c6cd]">
              {order.id}
            </span>
            <h3 className="mt-1 font-sans text-xl font-medium text-[#d4e3ff]">
              {order.customer}
            </h3>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* Location / time */}
        <div className="mb-4 space-y-2">
          {order.table && (
            <div className="flex items-center gap-2 text-sm text-[#c5c6cd]">
              <UtensilsCrossed size={16} className="shrink-0" />
              <span>{order.table}</span>
            </div>
          )}
          {order.timeAgo && (
            <div className="flex items-center gap-2 text-sm text-[#c5c6cd]">
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
          <p className="mb-2 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[#c5c6cd]">
            {tTerminal('items')}
          </p>
          {order.items.length > 0 ? (
            <p className="line-clamp-2 text-sm text-[#d4e3ff]">
              {order.items
                .map((item) => `${item.name} x${item.quantity}`)
                .join(', ')}
            </p>
          ) : (
            <p className="line-clamp-2 text-sm italic text-[#c5c6cd]">
              {tTerminal('orderVoided')}
            </p>
          )}
        </div>

        {/* Total */}
        <div className="mb-4 flex items-center justify-between">
          <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[#c5c6cd]">
            {tTerminal('total')}
          </span>
          <span
            className={cn(
              'font-sans text-xl font-medium text-[#b8c7e2]',
              isCancelled && 'text-[#c5c6cd] line-through',
            )}
          >
            {order.total}
          </span>
        </div>

        {/* Actions */}
        {isCancelled ? (
          <button
            className="w-full rounded-lg border border-white/5 bg-white/5 py-3 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[#c5c6cd] transition-all hover:bg-white/10 active:scale-95"
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
      <div className="flex min-h-screen items-center justify-center bg-[#0A1A2E]">
        <div className="flex flex-col items-center gap-4" role="status" aria-label={tTerminal('loading')}>
          <Loader2 size={40} className="animate-spin text-[#b8c7e2]" />
          <p className="font-sans text-sm text-[#c5c6cd]">{tTerminal('loading')}</p>
        </div>
      </div>
    );
  }

  /* ─── Error State ──────────────────────────────────────────────── */

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0A1A2E]">
        <div
          className={cn(GLASS_CLASSES, 'flex max-w-md flex-col items-center gap-4 rounded-xl p-8 text-center')}
          role="alert"
          aria-label={tTerminal('error')}
        >
          <AlertCircle size={48} className="text-[#ffb4ab]" />
          <h2 className="font-sans text-xl font-semibold text-[#ffb4ab]">
            {tTerminal('errorTitle')}
          </h2>
          <p className="text-sm text-[#c5c6cd]">{error}</p>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="mt-2 flex items-center gap-2 rounded-lg bg-[#b8c7e2] px-6 py-3 font-sans text-sm font-bold text-[#0c1c30] transition-all hover:brightness-110 active:scale-95"
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
    <div className="relative min-h-screen bg-[#0A1A2E] font-sans text-[#d4e3ff]">
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
          <h1 className="font-['Cormorant_Garamond',serif] text-[32px] font-semibold leading-tight tracking-[0.02em] text-[#d4e3ff]">
            {t('hero.title') || brandName}
          </h1>
          <p className="mt-1 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[#c5c6cd]">
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
                    ? 'border-l-2 border-[#b8c7e2] bg-white/5 text-[#b8c7e2]'
                    : 'text-[#c5c6cd] hover:bg-white/5 hover:text-[#d4e3ff]',
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
            className="mb-6 w-full rounded-lg bg-gradient-to-br from-[#b8c7e2] to-[#8e9097] py-3 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[#0c1c30] transition-all hover:brightness-110 active:scale-[0.97]"
            aria-label={tTerminal('newOrder')}
          >
            {tTerminal('newOrder')}
          </button>

          <div className="space-y-1 border-t border-white/5 pt-6">
            <a
              href="#"
              className="flex items-center gap-4 px-6 py-3 text-sm text-[#c5c6cd] transition-colors hover:text-[#d4e3ff]"
              aria-label={tTerminal('settings')}
            >
              <Settings size={20} />
              <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em]">
                {tTerminal('settings')}
              </span>
            </a>
            <a
              href="#"
              className="flex items-center gap-4 px-6 py-3 text-sm text-[#c5c6cd] transition-colors hover:text-[#ffb4ab]"
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
          'fixed right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-white/10 bg-[#00142c]/60 px-4 backdrop-blur-md md:px-6',
          'left-0 md:left-[280px]',
        )}
        aria-label={tTerminal('topBar')}
      >
        <div className="flex items-center gap-4">
          {/* Mobile hamburger */}
          <button
            className="text-[#c5c6cd] transition-colors hover:text-[#b8c7e2] md:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label={tTerminal('openSidebar')}
          >
            <Menu size={24} />
          </button>

          <span className="font-sans text-xl font-semibold text-[#b8c7e2]">
            {headerTitle}
          </span>

          <span className="hidden h-4 w-px bg-white/10 md:block" aria-hidden="true" />

          <span className="hidden font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[#c5c6cd] md:block">
            {headerSubtitle}
          </span>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-4 md:gap-6">
          <button
            className="text-[#c5c6cd] transition-all hover:text-[#b8c7e2]"
            aria-label={tTerminal('notifications')}
          >
            <Bell size={20} />
          </button>
          <button
            className="text-[#c5c6cd] transition-all hover:text-[#b8c7e2]"
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
              <span className="text-xs font-bold text-[#c5c6cd]">
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
                <span className="mb-1 font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[#c5c6cd]">
                  {stat.label}
                </span>
                <span className="font-sans text-[32px] font-semibold leading-tight tracking-tight text-[#d4e3ff]">
                  {stat.value}
                </span>
              </div>
            ))}
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
                className="absolute left-4 top-1/2 -translate-y-1/2 text-[#c5c6cd] transition-colors group-focus-within:text-[#b8c7e2]"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder={tTerminal('searchPlaceholder')}
                className="w-full border-b border-white/10 bg-[#050D17] py-3 pl-12 pr-4 font-sans text-sm text-[#d4e3ff] outline-none transition-all placeholder:text-[#c5c6cd]/60 focus:border-[#b8c7e2]"
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
                        ? 'border border-[#b8c7e2]/50 bg-[#b8c7e2]/10 text-[#b8c7e2]'
                        : cn(GLASS_CLASSES, 'text-[#c5c6cd] hover:bg-white/10'),
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
              <Package size={48} className="mb-4 text-[#c5c6cd]/40" />
              <p className="font-sans text-sm text-[#c5c6cd]">
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
            <span className="font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[#c5c6cd]">
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
                      ? 'border border-[#b8c7e2]/50 bg-[#b8c7e2]/20 text-[#b8c7e2]'
                      : cn(GLASS_CLASSES, 'text-[#c5c6cd] hover:bg-white/10'),
                  )}
                  aria-label={tTerminal('page').replace('{n}', String(page))}
                  aria-current={page === 1 ? 'true' : undefined}
                >
                  {page}
                </button>
              ))}
              <span className="px-1 text-[#c5c6cd]" aria-hidden="true">
                ...
              </span>
              <button
                className={cn(GLASS_CLASSES, 'flex h-10 w-10 items-center justify-center rounded-lg font-sans text-[12px] font-bold uppercase tracking-[0.1em] text-[#c5c6cd] transition-all hover:bg-white/10 active:scale-95')}
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
