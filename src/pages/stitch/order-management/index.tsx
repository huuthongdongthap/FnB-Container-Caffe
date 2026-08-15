import { useState } from 'react';
import { StitchShell } from '../StitchBase';
import { PageHeader, PageFooter } from '@/components/stitch/StitchLayout';
import { ORDERS, FILTERS } from './order-management-constants';
import { Sidebar, StatCard, OrderCard } from './order-management-sub-components';

export type { Order, OrderStatus } from './order-management-types';
export { STATUS_ACTIONS, ORDERS as ORDERS_DATA, FILTERS as FILTER_LIST, SIDEBAR_LINKS } from './order-management-constants';
export { StatusColor, Sidebar as OrderSidebar, StatCard as OrderStatCard, OrderCard as SingleOrderCard } from './order-management-sub-components';

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
        <PageHeader brand="AURA CAFE" scrollEffect />

        <div className="mt-16 p-xl flex-1 max-w-[1440px] mx-auto w-full">
          <section className="mb-xl grid grid-cols-1 md:grid-cols-4 gap-gutter">
            <StatCard label="Active Orders" value="24" />
            <StatCard label="In Preparation" value="12" accent="tertiary-fixed" />
            <StatCard label="Ready for Pickup" value="06" accent="primary" />
            <StatCard label="Avg. Lead Time" value="8.5m" />
          </section>

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

          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter">
            {filteredOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </section>

          <PageFooter brand="AURA CAFE" socialSize="sm" />
        </div>
      </main>
    </StitchShell>
  );
}
