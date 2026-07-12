import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout'

/* ── Types ─────────────────────────────────────────────────────────────── */

interface Order {
  id: string;
  customer: string;
  table: string;
  timeAgo: string;
  items: string;
  total: string;
  status: OrderStatus;
}

type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';

const STATUS_ACTIONS: Record<OrderStatus, { primary: string; disabled?: boolean }> = {
  pending: { primary: 'Preparing' },
  preparing: { primary: 'Ready' },
  ready: { primary: 'Serve' },
  served: { primary: 'Completed', disabled: true },
  cancelled: { primary: 'View Log' },
};

const ORDERS: readonly Order[] = [
  { id: '#AC-9821', customer: 'Julian Vane', table: 'Table B01', timeAgo: '2 mins ago', items: 'Midnight Espresso x2, Smoked Truffle Croissant, Hibiscus Cold Brew', total: '$34.50', status: 'pending' },
  { id: '#AC-9819', customer: 'Elena Thorne', table: 'Table A04', timeAgo: '8 mins ago', items: 'Golden Matcha Latte, Lavender Scone, Avocado Sourdough', total: '$28.20', status: 'preparing' },
  { id: '#AC-9818', customer: 'Marcus Chen', table: 'Bar Counter 02', timeAgo: '12 mins ago', items: 'Iced Nitro Cold Brew, Dark Chocolate Ganache Tart', total: '$18.00', status: 'ready' },
  { id: '#AC-9817', customer: 'Sara Loft', table: 'Table C09', timeAgo: '15 mins ago', items: 'Double Espresso, Sparkling Water, Pistachio Macaron x3', total: '$22.50', status: 'served' },
  { id: '#AC-9816', customer: 'David Miller', table: 'Table B05', timeAgo: '1 min ago', items: 'Smoked Salmon Toast, Earl Grey Tea, Mineral Water', total: '$31.00', status: 'pending' },
  { id: '#AC-9815', customer: 'Guest User', table: '—', timeAgo: '—', items: 'Order voided by system', total: '$45.00', status: 'cancelled' },
] as const;

const FILTERS = ['All', 'Pending', 'Preparing', 'Ready', 'Served'] as const;

const SIDEBAR_LINKS = [
  { label: 'Dashboard', icon: '', active: false },
  { label: 'Orders', icon: '⭐', active: true },
  { label: 'Inventory', icon: '🛒', active: false },
  { label: 'Staffing', icon: '✅', active: false },
] as const;

/* ── Helpers ───────────────────────────────────────────────────────────── */

function StatusColor({ status }: { status: OrderStatus }) {
  switch (status) {
    case 'pending':
      return { bar: 'bg-[var(--aura-tertiary)]', glow: 'rgba(229,192,153,0.5)', badge: 'bg-[var(--aura-tertiary-container)] text-[var(--aura-tertiary)] border-[var(--aura-tertiary)]/20' };
    case 'preparing':
      return { bar: 'bg-[var(--aura-tertiary-fixed)]', glow: 'rgba(255,221,186,0.5)', badge: 'bg-[var(--aura-tertiary)]/10 text-[var(--aura-tertiary-fixed)] border-[var(--aura-tertiary-fixed)]/20' };
    case 'ready':
      return { bar: 'bg-[var(--aura-primary)]', glow: 'rgba(184,199,226,0.5)', badge: 'bg-[var(--aura-primary)]/10 text-[var(--aura-primary)] border-[var(--aura-primary)]/20' };
    case 'served':
      return { bar: 'bg-[var(--aura-chrome-dark)]', glow: 'rgba(142,144,151,0.5)', badge: 'bg-white/5 text-[var(--aura-chrome-mid)] border-white/10' };
    case 'cancelled':
      return { bar: 'bg-[var(--aura-error)]', glow: 'rgba(255,180,171,0.5)', badge: 'bg-[var(--aura-error)]/10 text-[var(--aura-error)] border-[var(--aura-error)]/20' };
  }
}

/* ── Sub-components ─────────────────────────────────────────────────────── */

function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-[280px] bg-[var(--aura-noir-deep)]/5 backdrop-blur-24 border-r border-white/10 shadow-2xl shadow-black/50 flex flex-col py-[var(--spacing-xl,40px)] z-50">
      <div className="px-[var(--spacing-lg,24px)] mb-2xl">
        <h1 className="font-display text-display-logo text-[var(--aura-chrome-bright)]">Terminal v1.0</h1>
        <p className="font-body text-label-caps text-[var(--aura-chrome-mid)] tracking-widest mt-xs uppercase">Industrial Luxury</p>
      </div>

      <nav className="flex-1 space-y-1">
        {SIDEBAR_LINKS.map((link) => (
          <a
            key={link.label}
            href={link.active ? undefined : '#'}
            className={`flex items-center gap-md py-md px-lg transition-all duration-300 active:scale-[0.98] ${
              link.active
                ? 'bg-white/5 border-l-2 border-[var(--aura-primary)] text-[var(--aura-primary)]'
                : 'text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] hover:bg-white/5'
            }`}
            aria-current={link.active ? 'page' : undefined}
          >
            {link.icon && <span className="text-lg">{link.icon}</span>}
            <span className="font-body text-label-caps uppercase tracking-wider">{link.label}</span>
          </a>
        ))}
      </nav>

      <div className="px-[var(--spacing-lg,24px)] mt-auto space-y-md">
        <button className="w-full bg-gradient-to-br from-[var(--aura-primary)] to-[var(--aura-chrome-dark)] text-[var(--aura-noir-deep)] py-md px-lg font-body text-label-caps uppercase tracking-widest hover:brightness-110 transition-all rounded-lg">
          New Order
        </button>
        <div className="pt-xl space-y-1 border-t border-white/5">
          <a href="#" className="flex items-center gap-md text-[var(--aura-chrome-mid)] hover:text-[var(--aura-chrome-bright)] py-md px-lg hover:bg-white/5 transition-all duration-300">
            <span className="material-symbols-outlined text-sm">⚙</span>
            <span className="font-body text-label-caps uppercase tracking-wider">Settings</span>
          </a>
          <a href="#" className="flex items-center gap-md text-[var(--aura-error)] hover:text-[var(--aura-error)] py-md px-lg hover:bg-white/5 transition-all duration-300">
            <span className="text-sm">❌</span>
            <span className="font-body text-label-caps uppercase tracking-wider">Logout</span>
          </a>
        </div>
      </div>
    </aside>
  );
}

function TopNav() {
  return (
<PageHeader brand="AURA CAFE" scrollEffect />
  );
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-lg flex flex-col justify-center">
      <span className="font-body text-label-caps text-[var(--aura-chrome-mid)] uppercase tracking-widest mb-xs">{label}</span>
      <span className={`font-body text-headline-lg ${accent ? `text-[var(--aura-${accent})]` : 'text-[var(--aura-chrome-bright)]'}`}>
        {value}
      </span>
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const [isHovered, setIsHovered] = useState(false);
  const colors = StatusColor({ status: order.status });
  const action = STATUS_ACTIONS[order.status];

  if (order.status === 'cancelled') {
    return (
      <div className="bg-white/5 backdrop-blur-xl border border-[var(--aura-error)]/20 rounded-[40px] overflow-hidden relative opacity-60">
        <div className={`status-bar ${colors.bar}`} style={{ boxShadow: `0 0 10px ${colors.glow}` }} />
        <div className="p-lg">
          <div className="flex justify-between items-start mb-md">
            <div>
              <span className="font-body text-label-caps text-[var(--aura-chrome-mid)] uppercase">{order.id}</span>
              <h3 className="font-body text-headline-md text-[var(--aura-chrome-bright)] mt-xs">{order.customer}</h3>
            </div>
            <span className={`font-body text-[10px] uppercase tracking-widest border px-sm py-1 rounded ${colors.badge}`}>Cancelled</span>
          </div>
          <div className={`space-y-sm mb-lg ${order.status === 'cancelled' ? 'text-[var(--aura-error)]/60' : ''}`}>
            <div className="flex items-center gap-sm text-body-sm">
              <span className="text-[18px]">❌</span>
              <span>Payment Failed</span>
            </div>
          </div>
          <div className="border-t border-white/5 pt-md mb-lg">
            <p className="font-body text-label-caps text-[var(--aura-chrome-mid)] uppercase tracking-widest mb-sm">Items</p>
            <p className="text-body-sm text-[var(--aura-chrome-mid)] line-clamp-2 italic">{order.items}</p>
          </div>
          <div className="flex justify-between items-center mb-lg">
            <span className="font-body text-label-caps text-[var(--aura-chrome-mid)] uppercase tracking-widest">Total</span>
            <span className="font-body text-headline-md text-[var(--aura-chrome-mid)] line-through">{order.total}</span>
          </div>
          <div className="w-full">
            <button className="w-full bg-white/5 text-[var(--aura-chrome-mid)] font-body text-label-caps uppercase py-md rounded-lg border border-white/5 hover:bg-white/10 transition-all">
              View Log
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] overflow-hidden relative transition-all duration-500 ${isHovered ? 'border-white/20' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={`status-bar ${colors.bar}`} style={{ boxShadow: `0 0 10px ${colors.glow}` }} />
      <div className="p-lg">
        <div className="flex justify-between items-start mb-md">
          <div>
            <span className="font-body text-label-caps text-[var(--aura-chrome-mid)] uppercase">{order.id}</span>
            <h3 className="font-body text-headline-md text-[var(--aura-chrome-bright)] mt-xs">{order.customer}</h3>
          </div>
          <span className={`font-body text-[10px] uppercase tracking-widest border px-sm py-1 rounded ${colors.badge}`}>
            {order.status}
          </span>
        </div>

        <div className="space-y-sm mb-lg">
          <div className="flex items-center gap-sm text-body-sm text-[var(--aura-chrome-mid)]">
            <span className="text-[18px]">📍</span>
            <span>{order.table}</span>
          </div>
          <div className="flex items-center gap-sm text-body-sm text-[var(--aura-chrome-mid)]">
            <span className="text-[18px]">🕐</span>
            <span>{order.timeAgo}</span>
          </div>
        </div>

        <div className="border-t border-white/5 pt-md mb-lg">
          <p className="font-body text-label-caps text-[var(--aura-chrome-mid)] uppercase tracking-widest mb-sm">Items</p>
          <p className="text-body-sm text-[var(--aura-chrome-bright)] line-clamp-2">{order.items}</p>
        </div>

        <div className="flex justify-between items-center mb-lg">
          <span className="font-body text-label-caps text-[var(--aura-chrome-mid)] uppercase tracking-widest">Total</span>
          <span className="font-body text-headline-md text-[var(--aura-primary)]">{order.total}</span>
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <button className="bg-white/5 hover:bg-white/10 text-[var(--aura-chrome-bright)] font-body text-label-caps uppercase py-md transition-all rounded-lg border border-white/10">
            Details
          </button>
          <button
            className={`font-body text-label-caps uppercase py-md hover:brightness-110 transition-all rounded-lg ${
              action.disabled
                ? 'bg-white/5 text-[var(--aura-chrome-mid)] border border-white/10 cursor-not-allowed'
                : 'bg-[var(--aura-primary)] text-[var(--aura-noir-deep)]'
            }`}
            disabled={action.disabled}
          >
            {action.primary}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────────────────── */

export default function OrderManagementTerminal() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');

  const filteredOrders = ORDERS.filter((order) => {
    const matchesSearch =
      !searchQuery ||
      order.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.items.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'All' || order.status === activeFilter.toLowerCase();
    return matchesSearch && matchesFilter;
  });

  return (
    <StitchShell>
      <Sidebar />

      <main className="ml-[280px] min-h-screen flex flex-col relative">
        <TopNav />

        <div className="mt-16 p-xl flex-1 max-w-[1440px] mx-auto w-full">
          {/* Stats */}
          <section className="mb-xl grid grid-cols-1 md:grid-cols-4 gap-gutter">
            <StatCard label="Active Orders" value="24" />
            <StatCard label="In Preparation" value="12" accent="tertiary-fixed" />
            <StatCard label="Ready for Pickup" value="06" accent="primary" />
            <StatCard label="Avg. Lead Time" value="8.5m" />
          </section>

          {/* Search & Filters */}
          <section className="mb-xl flex flex-col md:flex-row items-center gap-lg">
            <div className="relative w-full md:w-96 group">
              <span className="absolute left-md top-1/2 -translate-y-1/2 text-[var(--aura-chrome-mid)] group-focus-within:text-[var(--aura-primary)] transition-colors text-lg">
                🔍
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search orders, tables, or customers..."
                className="w-full bg-[var(--aura-noir-void)] border-0 border-b border-white/10 py-md pl-12 pr-md focus:ring-0 focus:border-[var(--aura-primary)] transition-all font-body text-body-sm text-[var(--aura-chrome-bright)] placeholder:text-[var(--aura-chrome-mid)]"
              />
            </div>

            <div className="flex items-center gap-sm overflow-x-auto pb-xs w-full md:w-auto">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  className={`px-lg py-sm rounded-lg border font-body text-label-caps uppercase tracking-wider transition-all active:scale-95 whitespace-nowrap ${
                    activeFilter === filter
                      ? 'bg-white/5 border-[var(--aura-primary)]/50 text-[var(--aura-primary)]'
                      : 'bg-white/5 border-white/10 text-[var(--aura-chrome-mid)] hover:bg-white/10'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </section>

          {/* Order Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
            {filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </section>

          {/* Pagination */}
<PageFooter
  brand="AURA CAFE"
  socialSize="sm"
  />
        </div>
      </main>
    </StitchShell>
  );
}
