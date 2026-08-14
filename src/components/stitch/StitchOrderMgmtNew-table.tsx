/**
 * StitchOrderMgmtNew Table Section
 * Search input, filter tabs, order card grid, and pagination.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Search, Package } from 'lucide-react';
import type { OrderData, OrderStatus } from './StitchOrderMgmtNew-types';
import { GLASS_CLASSES, FILTER_TABS, getActionForStatus } from './stitch-order-mgmt-default';
import { OrderCard } from './StitchOrderMgmtNew-order-card';
import { PaginationFooter } from './StitchOrderMgmtNew-pagination';

/* ─── Props ──────────────────────────────────────────────────────────── */

interface OrderTableProps {
  orders: OrderData[];
  activeFilter: OrderStatus | 'all';
  onFilterChange?: (filter: OrderStatus | 'all') => void;
  onSearch?: (query: string) => void;
  onOrderAction?: (orderId: string, action: string) => void;
}

/* ─── Search & Filter Tabs ───────────────────────────────────────────── */

function SearchAndFilters({
  activeFilter,
  onFilterChange,
  onSearch,
}: {
  activeFilter: OrderStatus | 'all';
  onFilterChange?: (filter: OrderStatus | 'all') => void;
  onSearch?: (query: string) => void;
}) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const tTerminal = (key: string) => t(`terminal.${key}`);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    onSearch?.(value);
  };

  return (
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
  );
}

/* ─── Order Grid ─────────────────────────────────────────────────────── */

function OrderGrid({
  orders,
  onOrderAction,
}: {
  orders: OrderData[];
  onOrderAction?: (orderId: string, action: string) => void;
}) {
  const { t } = useTranslation();
  const tTerminal = (key: string) => t(`terminal.${key}`);

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Package size={48} className="mb-4 text-[var(--aura-text-secondary, #a0a8b0)]/40" />
        <p className="font-sans text-sm text-[var(--aura-text-secondary, #a0a8b0)]">
          {tTerminal('noOrders')}
        </p>
      </div>
    );
  }

  return (
    <section
      className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
      aria-label={tTerminal('orderList')}
    >
      {orders.map((order) => (
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
  );
}

/* ─── Table Section Export ───────────────────────────────────────────── */

export function StitchOrderMgmtTable({
  orders,
  activeFilter,
  onFilterChange,
  onSearch,
  onOrderAction,
}: Readonly<OrderTableProps>) {
  const filteredOrders =
    activeFilter === 'all'
      ? orders
      : orders.filter((o) => o.status === activeFilter);

  return (
    <>
      <SearchAndFilters
        activeFilter={activeFilter}
        onFilterChange={onFilterChange}
        onSearch={onSearch}
      />
      <OrderGrid orders={filteredOrders} onOrderAction={onOrderAction} />
      <PaginationFooter />
    </>
  );
}
