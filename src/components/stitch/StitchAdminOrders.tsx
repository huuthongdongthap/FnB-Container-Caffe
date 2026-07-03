/**
 * StitchAdminOrders — AURA CAFE Order Management Terminal
 *
 * Sidebar nav, stats summary (glass panels), search + filter chips,
 * order card grid with status badges, pagination.
 * Mobile-first with responsive grid.
 * Source: Stitch AI admin-orders export.
 *
 * States: loading, error, empty, populated
 */
'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import {
  Search,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Clock,
  Table2,
  ListOrdered,
  Package,
  Users,
  LayoutDashboard,
  AlertCircle,
  Loader2,
  ClipboardList,
} from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────── */
export type AdminOrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';

export interface Order {
  id: string;
  customer: string;
  table: string;
  items: string;
  total: number;
  status: AdminOrderStatus;
  timeAgo: string;
  note?: string;
}

export interface OrdersStats {
  active: number;
  preparing: number;
  ready: number;
  avgLeadTime: string;
}

export interface StitchAdminOrdersProps {
  orders?: Order[];
  stats?: OrdersStats;
  title?: string;
  loading?: boolean;
  error?: string | null;
}

/* ─── Constants ─────────────────────────────────────────────────────── */
const STATUS_CHIPS = ['All', 'Pending', 'Preparing', 'Ready', 'Served'] as const;

const ORDER_STATUS_CONFIG: Record<AdminOrderStatus, { label: string; chipClass: string; dotClass: string }> = {
  pending: {
    label: 'Pending',
    chipClass: 'bg-[rgba(212,165,116,0.1)] text-[#d4a574] border-[rgba(212,165,116,0.2)]',
    dotClass: 'bg-[#d4a574] shadow-[0_0_8px_rgba(212,165,116,0.5)]',
  },
  preparing: {
    label: 'Preparing',
    chipClass: 'bg-[rgba(255,221,186,0.1)] text-[#ffddba] border-[rgba(255,221,186,0.2)]',
    dotClass: 'bg-[#ffddba] shadow-[0_0_8px_rgba(255,221,186,0.5)]',
  },
  ready: {
    label: 'Ready',
    chipClass: 'bg-[rgba(198,198,199,0.1)] text-[#c6c6c7] border-[rgba(198,198,199,0.2)]',
    dotClass: 'bg-[#c6c6c7] shadow-[0_0_8px_rgba(198,198,199,0.5)]',
  },
  served: {
    label: 'Served',
    chipClass: 'bg-[rgba(255,255,255,0.04)] text-[#a0a8b0] border-[rgba(255,255,255,0.1)]',
    dotClass: 'bg-[#8e9097]',
  },
  cancelled: {
    label: 'Cancelled',
    chipClass: 'bg-[rgba(255,180,171,0.1)] text-[#ffb4ab] border-[rgba(255,180,171,0.2)]',
    dotClass: 'bg-[#ffb4ab] shadow-[0_0_8px_rgba(255,180,171,0.5)]',
  },
};

const DEFAULT_STATS: OrdersStats = {
  active: 24,
  preparing: 12,
  ready: 6,
  avgLeadTime: '8.5m',
};

const DEFAULT_ORDERS: Order[] = [
  { id: 'AC-9821', customer: 'Julian Vane', table: 'B01', items: 'Midnight Espresso x2, Smoked Truffle Croissant, Hibiscus Cold Brew', total: 34.50, status: 'pending', timeAgo: '2 mins ago' },
  { id: 'AC-9819', customer: 'Elena Thorne', table: 'A04', items: 'Golden Matcha Latte, Lavender Scone, Avocado Sourdough', total: 28.20, status: 'preparing', timeAgo: '8 mins ago' },
  { id: 'AC-9818', customer: 'Marcus Chen', table: 'Bar 02', items: 'Iced Nitro Cold Brew, Dark Chocolate Ganache Tart', total: 18.00, status: 'ready', timeAgo: '12 mins ago' },
  { id: 'AC-9817', customer: 'Sara Loft', table: 'C09', items: 'Double Espresso, Sparkling Water, Pistachio Macaron x3', total: 22.50, status: 'served', timeAgo: '15 mins ago' },
  { id: 'AC-9816', customer: 'David Miller', table: 'B05', items: 'Smoked Salmon Toast, Earl Grey Tea, Mineral Water', total: 31.00, status: 'pending', timeAgo: '1 min ago' },
  { id: 'AC-9815', customer: 'Guest User', table: '-', items: 'Order voided by system', total: 45.00, status: 'cancelled', timeAgo: '20 mins ago', note: 'Payment Failed' },
];

/* ─── Sub-components ────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: AdminOrderStatus }) {
  const c = ORDER_STATUS_CONFIG[status];
  return (
    <span className={clsx(
      'inline-block px-2.5 py-1 rounded text-[10px] font-[\'Space_Grotesk\',sans-serif] font-semibold uppercase tracking-widest border',
      c.chipClass
    )}>
      {c.label}
    </span>
  );
}

function StatusDot({ status }: { status: AdminOrderStatus }) {
  const c = ORDER_STATUS_CONFIG[status];
  return <div className={clsx('w-[2px] h-full absolute left-0 top-0', c.dotClass)} />;
}

function OrderCard({ order }: { order: Order }) {
  const isCancelled = order.status === 'cancelled';
  return (
    <div className={clsx(
      'glass-panel-orders rounded-xl overflow-hidden relative group hover:border-[rgba(255,255,255,0.12)] transition-all duration-500',
      isCancelled && 'border-[rgba(255,180,171,0.15)] bg-[rgba(255,180,171,0.03)] opacity-70'
    )}>
      <StatusDot status={order.status} />
      <div className="p-5">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] uppercase tracking-wider">
              #{order.id}
            </span>
            <h3 className="font-['Space_Grotesk',sans-serif] text-[18px] text-[#e8e8e8] font-medium mt-1">
              {order.customer}
            </h3>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 mb-4">
          {order.table && (
            <div className="flex items-center gap-1.5 text-[13px] text-[#a0a8b0] font-['Space_Grotesk',sans-serif]">
              <Table2 className="w-3.5 h-3.5" />
              <span>{order.table}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[13px] text-[#a0a8b0] font-['Space_Grotesk',sans-serif]">
            <Clock className="w-3.5 h-3.5" />
            <span>{order.timeAgo}</span>
          </div>
          {order.note && (
            <div className="flex items-center gap-1.5 text-[13px] text-[#ffb4ab] font-['Space_Grotesk',sans-serif]">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{order.note}</span>
            </div>
          )}
        </div>

        {/* Items */}
        <div className="border-t border-[rgba(255,255,255,0.05)] pt-4 mb-4">
          <p className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] uppercase tracking-wider mb-2">
            Items
          </p>
          <p className={clsx(
            'font-[\'Space_Grotesk\',sans-serif] text-[13px] leading-relaxed line-clamp-2',
            isCancelled ? 'text-[#a0a8b0] italic' : 'text-[#e8e8e8]'
          )}>
            {order.items}
          </p>
        </div>

        {/* Total */}
        <div className="flex justify-between items-center mb-4">
          <span className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] uppercase tracking-wider">
            Total
          </span>
          <span className={clsx(
            'font-[\'Cormorant_Garamond\',serif] text-[20px] font-semibold',
            isCancelled ? 'text-[#a0a8b0] line-through' : 'text-[#c6c6c7]'
          )}>
            ${order.total.toFixed(2)}
          </span>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            className="bg-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.08)] text-[#e8e8e8] font-['Space_Grotesk',sans-serif] text-[11px] font-semibold uppercase tracking-wider py-3 transition-all rounded-lg border border-[rgba(255,255,255,0.08)] active:scale-[0.98]"
          >
            Details
          </button>
          {!isCancelled ? (
            <button
              type="button"
              className="bg-[#c6c6c7] text-[#0d1b2a] font-['Space_Grotesk',sans-serif] text-[11px] font-semibold uppercase tracking-wider py-3 hover:brightness-110 transition-all rounded-lg active:scale-[0.98]"
            >
              {order.status === 'pending' ? 'Preparing' : order.status === 'preparing' ? 'Ready' : order.status === 'ready' ? 'Serve' : 'Complete'}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="bg-[rgba(255,255,255,0.03)] text-[#a0a8b0] font-['Space_Grotesk',sans-serif] text-[11px] font-semibold uppercase tracking-wider py-3 rounded-lg border border-[rgba(255,255,255,0.04)] cursor-not-allowed"
            >
              View Log
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Sidebar ───────────────────────────────────────────────────────── */
const SIDEBAR_ITEMS = [
  { label: 'Dashboard', icon: LayoutDashboard, active: false },
  { label: 'Orders', icon: Receipt, active: true },
  { label: 'Inventory', icon: Package, active: false },
  { label: 'Staffing', icon: Users, active: false },
];

const SIDEBAR_BOTTOM = [
  { label: 'Settings', icon: Settings },
  { label: 'Logout', icon: LogOut, danger: true },
];

/* ─── Main Component ─────────────────────────────────────────────────── */
export default function StitchAdminOrders({
  orders = DEFAULT_ORDERS,
  stats = DEFAULT_STATS,
  title = 'Terminal v1.0',
  loading = false,
  error = null,
}: Readonly<StitchAdminOrdersProps>) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChip, setActiveChip] = useState<string>('All');

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.table.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.items.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesChip = activeChip === 'All' || o.status.toLowerCase() === activeChip.toLowerCase();
    return matchesSearch && matchesChip;
  });

  /* ─── Loading State ─────────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A1A2E' }}>
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-[#c6c6c7]" />
          <p className="font-['Space_Grotesk',sans-serif] text-[13px] text-[#a0a8b0] tracking-widest uppercase">
            Loading Orders...
          </p>
        </div>
      </div>
    );
  }

  /* ─── Error State ───────────────────────────────────────────────── */
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A1A2E' }}>
        <div className="glass-panel-orders p-10 flex flex-col items-center gap-4 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-[#ffb4ab]" />
          <p className="font-['Space_Grotesk',sans-serif] text-[14px] text-[#ffb4ab]">
            {error}
          </p>
          <button
            type="button"
            className="px-6 py-3 bg-[#c6c6c7] text-[#0d1b2a] font-['Space_Grotesk',sans-serif] text-[11px] font-semibold uppercase tracking-wider rounded-lg hover:brightness-110 transition-all"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#0A1A2E' }}>
      {/* Sidebar */}
      <aside className={clsx(
        'fixed left-0 top-0 h-full w-[280px] z-50 flex flex-col py-8 border-r transition-transform duration-300',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        'lg:translate-x-0',
        'bg-[rgba(11,32,58,0.4)] backdrop-blur-2xl border-[rgba(255,255,255,0.08)]'
      )}>
        {/* Brand */}
        <div className="px-6 mb-10">
          <h2 className="font-['Cormorant_Garamond',serif] text-[22px] text-[#e8e8e8]">{title}</h2>
          <p className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] tracking-[0.15em] mt-1 uppercase">
            Industrial Luxury
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1 px-3">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.label}
              type="button"
              className={clsx(
                'flex items-center gap-3 py-3 px-4 font-[\'Space_Grotesk\',sans-serif] text-[12px] uppercase tracking-wider transition-all duration-300 active:scale-[0.98] rounded-lg',
                item.active
                  ? 'bg-[rgba(255,255,255,0.04)] border-l-2 border-[#c6c6c7] text-[#c6c6c7]'
                  : 'text-[#a0a8b0] hover:text-[#e8e8e8] hover:bg-[rgba(255,255,255,0.03)]'
              )}
            >
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="px-6 mt-auto">
          <button
            type="button"
            className="w-full bg-gradient-to-br from-[#c6c6c7] to-[#8e9097] text-[#0d1b2a] py-3 px-4 font-['Space_Grotesk',sans-serif] text-[11px] font-semibold uppercase tracking-widest hover:brightness-110 transition-all rounded-lg active:scale-[0.98] mb-6"
          >
            <ListOrdered className="w-4 h-4 inline mr-2" />
            New Order
          </button>
          <div className="border-t border-[rgba(255,255,255,0.05)] pt-6 flex flex-col gap-1">
            {SIDEBAR_BOTTOM.map((item) => (
              <button
                key={item.label}
                type="button"
                className={clsx(
                  'flex items-center gap-3 py-3 px-4 font-[\'Space_Grotesk\',sans-serif] text-[12px] uppercase tracking-wider transition-all duration-300 rounded-lg active:scale-[0.98]',
                  item.danger ? 'text-[#ffb4ab] hover:bg-[rgba(255,180,171,0.06)]' : 'text-[#a0a8b0] hover:text-[#e8e8e8] hover:bg-[rgba(255,255,255,0.03)]'
                )}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <div className="flex-1 lg:pl-[280px] min-h-screen">
        {/* Top Bar */}
        <header className="h-16 flex items-center justify-between px-6 w-full sticky top-0 z-30 bg-[rgba(11,32,58,0.6)] backdrop-blur-2xl border-b border-[rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="lg:hidden text-[#c6c6c7] hover:text-[#e8e8e8]"
              onClick={() => setSidebarOpen(true)}
            >
              <ClipboardList className="w-5 h-5" />
            </button>
            <span className="font-['Space_Grotesk',sans-serif] text-[18px] text-[#c6c6c7] font-medium hidden sm:inline">
              Aether Cafe Terminal
            </span>
            <span className="h-4 w-px bg-[rgba(255,255,255,0.1)] hidden sm:block" />
            <span className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] uppercase tracking-widest hidden sm:block">
              Order Management
            </span>
          </div>
          <div className="flex items-center gap-5">
            <button type="button" className="text-[#a0a8b0] hover:text-[#c6c6c7] transition-colors">
              <Bell className="w-5 h-5" />
            </button>
            <button type="button" className="text-[#a0a8b0] hover:text-[#c6c6c7] transition-colors">
              <Settings className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-full bg-[rgba(198,198,199,0.15)] flex items-center justify-center text-[12px] font-semibold text-[#c6c6c7] font-['Space_Grotesk',sans-serif]">
              A
            </div>
          </div>
        </header>

        {/* Body */}
        <div className="p-5 lg:p-8 max-w-[1440px] mx-auto w-full">
          {/* Stats Grid */}
          <section className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-panel-orders p-4 flex flex-col justify-center">
              <span className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] uppercase tracking-wider mb-1">Active Orders</span>
              <span className="font-['Cormorant_Garamond',serif] text-[28px] text-[#e8e8e8] font-semibold">{stats.active}</span>
            </div>
            <div className="glass-panel-orders p-4 flex flex-col justify-center">
              <span className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] uppercase tracking-wider mb-1">In Preparation</span>
              <span className="font-['Cormorant_Garamond',serif] text-[28px] text-[#d4a574] font-semibold">{stats.preparing}</span>
            </div>
            <div className="glass-panel-orders p-4 flex flex-col justify-center">
              <span className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] uppercase tracking-wider mb-1">Ready for Pickup</span>
              <span className="font-['Cormorant_Garamond',serif] text-[28px] text-[#c6c6c7] font-semibold">{stats.ready}</span>
            </div>
            <div className="glass-panel-orders p-4 flex flex-col justify-center">
              <span className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] uppercase tracking-wider mb-1">Avg. Lead Time</span>
              <span className="font-['Cormorant_Garamond',serif] text-[28px] text-[#e8e8e8] font-semibold">{stats.avgLeadTime}</span>
            </div>
          </section>

          {/* Search & Filters */}
          <section className="mb-8 flex flex-col md:flex-row items-start md:items-center gap-4">
            <div className="relative w-full md:w-96 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a0a8b0] group-focus-within:text-[#c6c6c7] transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders, tables, or customers..."
                className="w-full bg-[rgba(255,255,255,0.03)] border-0 border-b border-[rgba(255,255,255,0.1)] py-3 pl-12 pr-4 focus:ring-0 focus:border-[#c6c6c7] transition-all font-['Space_Grotesk',sans-serif] text-[13px] text-[#e8e8e8] placeholder:text-[#a0a8b0] focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full md:w-auto">
              {STATUS_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setActiveChip(chip)}
                  className={clsx(
                    'px-4 py-2 font-[\'Space_Grotesk\',sans-serif] text-[11px] font-semibold uppercase tracking-wider transition-all whitespace-nowrap active:scale-95 rounded-lg border',
                    activeChip === chip
                      ? 'glass-panel-orders border-[rgba(198,198,199,0.4)] text-[#c6c6c7]'
                      : 'text-[#a0a8b0] hover:bg-[rgba(255,255,255,0.05)] border-transparent'
                  )}
                >
                  {chip}
                </button>
              ))}
            </div>
          </section>

          {/* Order Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredOrders.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                <ClipboardList className="w-12 h-12 text-[rgba(198,198,199,0.15)] mb-4" />
                <p className="font-['Space_Grotesk',sans-serif] text-[14px] text-[#a0a8b0]">
                  {searchQuery || activeChip !== 'All'
                    ? 'No orders match your search or filter.'
                    : 'No orders yet. They will appear here once placed.'}
                </p>
              </div>
            ) : (
              filteredOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))
            )}
          </section>

          {/* Pagination */}
          <footer className="mt-10 flex items-center justify-between pb-8">
            <span className="font-['Space_Grotesk',sans-serif] text-[11px] text-[#a0a8b0] uppercase tracking-wider">
              Showing {filteredOrders.length} of {orders.length} orders
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="w-10 h-10 flex items-center justify-center glass-panel-orders hover:bg-[rgba(255,255,255,0.06)] transition-all rounded-lg active:scale-90"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="w-10 h-10 flex items-center justify-center glass-panel-orders bg-[rgba(198,198,199,0.12)] border-[rgba(198,198,199,0.4)] text-[#c6c6c7] font-['Space_Grotesk',sans-serif] text-[11px] font-semibold rounded-lg">
                1
              </button>
              <button className="w-10 h-10 flex items-center justify-center glass-panel-orders hover:bg-[rgba(255,255,255,0.06)] text-[#a0a8b0] font-['Space_Grotesk',sans-serif] text-[11px] rounded-lg">
                2
              </button>
              <button className="w-10 h-10 flex items-center justify-center glass-panel-orders hover:bg-[rgba(255,255,255,0.06)] text-[#a0a8b0] font-['Space_Grotesk',sans-serif] text-[11px] rounded-lg">
                3
              </button>
              <span className="text-[#a0a8b0] px-1">...</span>
              <button className="w-10 h-10 flex items-center justify-center glass-panel-orders hover:bg-[rgba(255,255,255,0.06)] text-[#a0a8b0] font-['Space_Grotesk',sans-serif] text-[11px] rounded-lg">
                12
              </button>
              <button
                type="button"
                className="w-10 h-10 flex items-center justify-center glass-panel-orders hover:bg-[rgba(255,255,255,0.06)] transition-all rounded-lg active:scale-90"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </footer>
        </div>
      </div>

      <style>{ORDERS_STYLES}</style>
    </div>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────── */
const ORDERS_STYLES = `
  .glass-panel-orders {
    background: rgba(11, 32, 58, 0.4);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border: 0.5px solid rgba(255, 255, 255, 0.08);
    border-radius: 12px;
  }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #343536; border-radius: 2px; }
`;
