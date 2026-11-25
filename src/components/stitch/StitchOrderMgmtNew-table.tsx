/**
 * StitchOrderMgmtNew Table Section
 * Search input with field selector, channel & status filter tabs, card/table view, and pagination.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { Search, Package, X, LayoutGrid, Table as TableIcon, Loader2, RefreshCw } from 'lucide-react';
import type {
  OrderChannel,
  OrderData,
  OrderSearchFieldType,
  OrderStatus,
} from './StitchOrderMgmtNew-types';
import { GLASS_CLASSES, FILTER_TABS, getActionForStatus } from './stitch-order-mgmt-default';
import { OrderCard } from './StitchOrderMgmtNew-order-card';
import { StatusBadge } from './StitchOrderMgmtNew-status-badge';
import { PaginationFooter } from './StitchOrderMgmtNew-pagination';

/* ─── Constants ──────────────────────────────────────────────────────── */

const SEARCH_FIELDS: OrderSearchFieldType[] = [
  'all',
  'id',
  'customer_name',
  'customer_phone',
  'table',
  'item',
  'address',
  'notes',
];

const CHANNEL_TABS: Array<{ key: OrderChannel | 'all'; tKey: string }> = [
  { key: 'all', tKey: 'orderMgmt.channel.all' },
  { key: 'dine_in', tKey: 'orderMgmt.channel.dine_in' },
  { key: 'takeaway', tKey: 'orderMgmt.channel.takeaway' },
  { key: 'delivery', tKey: 'orderMgmt.channel.delivery' },
];

/* ─── Props ──────────────────────────────────────────────────────────── */

interface OrderTableProps {
  orders: OrderData[];
  activeFilter: OrderStatus | 'all';
  activeChannel?: OrderChannel | 'all';
  searchQuery?: string;
  searchField?: OrderSearchFieldType;
  statusCounts?: Record<string, number>;
  isLoading?: boolean;
  onFilterChange?: (filter: OrderStatus | 'all') => void;
  onChannelChange?: (channel: OrderChannel | 'all') => void;
  onSearch?: (query: string) => void;
  onSearchFieldChange?: (field: OrderSearchFieldType) => void;
  onOrderAction?: (orderId: string, action: string) => void;
  onViewDetails?: (order: OrderData) => void;
  onCancelOrder?: (order: OrderData) => void;
  onEditOrder?: (order: OrderData) => void;
  onPrintOrder?: (order: OrderData) => void;
  onRefresh?: () => void;
  currentPage?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
}

/* ─── Search & Filter Tabs ───────────────────────────────────────────── */

function SearchAndFilters({
  activeFilter,
  activeChannel = 'all',
  controlledSearchQuery,
  searchField = 'all',
  statusCounts,
  viewMode,
  isLoading,
  onViewModeChange,
  onFilterChange,
  onChannelChange,
  onSearch,
  onSearchFieldChange,
  onRefresh,
}: {
  activeFilter: OrderStatus | 'all';
  activeChannel?: OrderChannel | 'all';
  controlledSearchQuery?: string;
  searchField?: OrderSearchFieldType;
  statusCounts?: Record<string, number>;
  viewMode: 'cards' | 'table';
  isLoading?: boolean;
  onViewModeChange: (mode: 'cards' | 'table') => void;
  onFilterChange?: (filter: OrderStatus | 'all') => void;
  onChannelChange?: (channel: OrderChannel | 'all') => void;
  onSearch?: (query: string) => void;
  onSearchFieldChange?: (field: OrderSearchFieldType) => void;
  onRefresh?: () => void;
}) {
  const { t } = useTranslation();
  const [localSearch, setLocalSearch] = useState('');
  const searchValue = controlledSearchQuery !== undefined ? controlledSearchQuery : localSearch;
  const tTerminal = (key: string) => t(`terminal.${key}`);

  const handleSearchChange = (value: string) => {
    if (controlledSearchQuery === undefined) {
      setLocalSearch(value);
    }
    onSearch?.(value);
  };

  return (
    <section
      className="mb-6 space-y-3"
      aria-label={tTerminal('searchFilters')}
    >
      {/* Row 1: Search field + Search input + View toggle + Refresh */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={searchField}
            onChange={(e) => onSearchFieldChange?.(e.target.value as OrderSearchFieldType)}
            aria-label={t('orderMgmt.searchField.label', { defaultValue: 'Trường tìm kiếm' })}
            className="rounded-lg border border-white/10 bg-[var(--aura-bg-page, var(--aura-bg-surface))] px-3 py-2.5 text-sm text-[var(--aura-text-primary, #e8e8e8)] outline-none focus:border-[var(--aura-primary, #c6c6c7)] sm:w-40"
          >
            {SEARCH_FIELDS.map((field) => (
              <option key={field} value={field} className="bg-[#0A1A2E] text-white">
                {t(`orderMgmt.searchField.${field}`, { defaultValue: field })}
              </option>
            ))}
          </select>

          <div className="group relative flex-1 max-w-md">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--aura-text-secondary, #a0a8b0)] transition-colors group-focus-within:text-[var(--aura-primary, #c6c6c7)]"
            />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={tTerminal('searchPlaceholder')}
              className="w-full rounded-lg border border-white/10 bg-[var(--aura-bg-page, var(--aura-bg-surface))] py-2.5 pl-10 pr-9 font-sans text-sm text-[var(--aura-text-primary, #e8e8e8)] outline-none transition-all placeholder:text-[var(--aura-text-secondary, #a0a8b0)]/60 focus:border-[var(--aura-primary, #c6c6c7)]"
              aria-label={tTerminal('search')}
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                aria-label={tTerminal('clearSearch')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--aura-text-secondary, #a0a8b0)] hover:text-white"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Channel filter + View toggle + Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {onChannelChange && (
            <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1" role="group" aria-label={t('orderMgmt.channelFilter')}>
              {CHANNEL_TABS.map((ch) => {
                const isActive = ch.key === activeChannel;
                return (
                  <button
                    key={ch.key}
                    type="button"
                    onClick={() => onChannelChange(ch.key)}
                    aria-pressed={isActive}
                    className={cn(
                      'rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors',
                      isActive
                        ? 'bg-amber-400/20 text-amber-200'
                        : 'text-[var(--aura-text-secondary, #a0a8b0)] hover:bg-white/10 hover:text-white',
                    )}
                  >
                    {t(ch.tKey)}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
            <button
              type="button"
              onClick={() => onViewModeChange('cards')}
              aria-pressed={viewMode === 'cards'}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold',
                viewMode === 'cards' ? 'bg-white/15 text-white' : 'text-[var(--aura-text-secondary, #a0a8b0)] hover:text-white',
              )}
            >
              <LayoutGrid size={14} />
              {tTerminal('viewCards')}
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              aria-pressed={viewMode === 'table'}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold',
                viewMode === 'table' ? 'bg-white/15 text-white' : 'text-[var(--aura-text-secondary, #a0a8b0)] hover:text-white',
              )}
            >
              <TableIcon size={14} />
              {tTerminal('viewTable')}
            </button>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-[var(--aura-text-primary, #e8e8e8)] hover:bg-white/10"
              aria-label={tTerminal('refresh')}
            >
              <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
              {tTerminal('refresh')}
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Status filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {FILTER_TABS.map((tab) => {
          const isActive = tab.key === activeFilter;
          const count = statusCounts?.[tab.key];
          return (
            <button
              type="button"
              key={tab.key}
              onClick={() => onFilterChange?.(tab.key)}
              className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3.5 py-2 font-sans text-[12px] font-bold uppercase tracking-[0.08em] transition-all active:scale-95',
                isActive
                  ? 'border border-[var(--aura-primary, #c6c6c7)]/60 bg-[var(--aura-primary, #c6c6c7)]/15 text-[var(--aura-primary, #c6c6c7)]'
                  : cn(GLASS_CLASSES, 'text-[var(--aura-text-secondary, #a0a8b0)] hover:bg-white/10'),
              )}
              aria-label={t(tab.tKey)}
              aria-current={isActive ? 'true' : undefined}
            >
              <span>{t(tab.tKey)}</span>
              {typeof count === 'number' && (
                <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Order Grid / Table ─────────────────────────────────────────────── */

function OrderListSection({
  orders,
  viewMode,
  isLoading,
  onOrderAction,
  onViewDetails,
  onCancelOrder,
  onEditOrder,
  onPrintOrder,
}: {
  orders: OrderData[];
  viewMode: 'cards' | 'table';
  isLoading?: boolean;
  onOrderAction?: (orderId: string, action: string) => void;
  onViewDetails?: (order: OrderData) => void;
  onCancelOrder?: (order: OrderData) => void;
  onEditOrder?: (order: OrderData) => void;
  onPrintOrder?: (order: OrderData) => void;
}) {
  const { t } = useTranslation();
  const tTerminal = (key: string) => t(`terminal.${key}`);

  if (orders.length === 0 && !isLoading) {
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
    <div className="relative">
      {isLoading && (
        <div
          role="status"
          aria-label={tTerminal('loading')}
          className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-[var(--aura-text-secondary, #a0a8b0)]"
        >
          <Loader2 size={14} className="animate-spin" />
          <span>{tTerminal('loading')}</span>
        </div>
      )}

      {viewMode === 'table' ? (
        <div className={cn(GLASS_CLASSES, 'overflow-x-auto rounded-xl')}>
          <table className="w-full text-left text-sm" aria-label={tTerminal('orderList')}>
            <thead className="border-b border-white/10 text-xs uppercase text-[var(--aura-text-secondary, #a0a8b0)]">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">{t('orderMgmt.channelFilter')}</th>
                <th className="px-4 py-3">{t('orderMgmt.searchField.customer_name')}</th>
                <th className="px-4 py-3">{tTerminal('items')}</th>
                <th className="px-4 py-3">{tTerminal('total')}</th>
                <th className="px-4 py-3">{t('orderMgmt.statusColumn', { defaultValue: 'Trạng thái' })}</th>
                <th className="px-4 py-3 text-right">{tTerminal('details')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orders.map((order) => {
                const channelKey = order.orderType || (order.table ? 'dine_in' : 'takeaway');
                const fallbackActionKey = getActionForStatus(order.status, order.orderType);
                const actionLabel = order.nextActionLabel || t(`terminal.${fallbackActionKey.toLowerCase()}`, { defaultValue: fallbackActionKey });
                const isTerminal =
                  order.status === 'cancelled' ||
                  order.status === 'completed' ||
                  order.status === 'failed' ||
                  order.status === 'expired';
                const paymentMethodLabel = order.paymentMethod
                  ? t(`orderMgmt.paymentMethod.${order.paymentMethod}`, { defaultValue: order.paymentMethod.toUpperCase() })
                  : '';
                const paymentStatusLabel = order.paymentStatus
                  ? t(`orderMgmt.paymentStatus.${order.paymentStatus}`, { defaultValue: order.paymentStatus })
                  : '';
                const isPaid =
                  order.paymentStatus === 'paid' ||
                  order.paymentStatus === 'completed' ||
                  order.paymentStatus === 'partially_refunded';
                return (
                  <tr key={order.id} className="hover:bg-white/5">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">
                      <div>{order.displayId || order.id}</div>
                      {(order.timeAgo || order.createdTimeLabel) && (
                        <div className="mt-0.5 font-sans text-[11px] font-normal text-[var(--aura-text-secondary, #a0a8b0)]">
                          {order.timeAgo}{order.createdTimeLabel ? ` · ${order.createdTimeLabel}` : ''}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>{t(`orderMgmt.channel.${channelKey}`, { defaultValue: channelKey })}</div>
                      {(order.tableName || order.table) && (
                        <div className="text-[var(--aura-text-secondary, #a0a8b0)]">{order.tableName || order.table}</div>
                      )}
                      {order.deliveryTime && order.deliveryTime !== 'now' && (
                        <div className="text-amber-200/90">{order.deliveryTime}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{order.customer}</div>
                      {order.customerPhone && (
                        <div className="text-xs text-[var(--aura-text-secondary, #a0a8b0)]">{order.customerPhone}</div>
                      )}
                      {order.customerAddress && channelKey === 'delivery' && (
                        <div className="max-w-[200px] truncate text-xs text-[var(--aura-text-secondary, #a0a8b0)]">
                          {order.customerAddress}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {order.items.map((it, idx) => (
                        <div key={`${it.name}-${idx}`} className="mb-0.5">
                          <div>x{it.quantity} {it.name}</div>
                          {it.modifiers && it.modifiers.length > 0 && (
                            <div className="pl-3 text-[11px] text-[var(--aura-text-secondary, #a0a8b0)]">
                              + {it.modifiers.join(', ')}
                            </div>
                          )}
                          {it.notes && (
                            <div className="pl-3 text-[11px] italic text-amber-200/80">{it.notes}</div>
                          )}
                        </div>
                      ))}
                      {order.notes && (
                        <div className="mt-1 rounded bg-white/5 px-1.5 py-0.5 text-[11px] italic text-amber-200/90">
                          {order.notes}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{order.total}</div>
                      {(paymentMethodLabel || paymentStatusLabel) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
                          {paymentMethodLabel && (
                            <span className="text-[var(--aura-text-secondary, #a0a8b0)]">{paymentMethodLabel}</span>
                          )}
                          {paymentStatusLabel && (
                            <span
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[10px] font-semibold',
                                isPaid
                                  ? 'bg-emerald-500/15 text-emerald-300'
                                  : order.paymentStatus === 'refunded'
                                    ? 'bg-slate-500/20 text-slate-300'
                                    : 'bg-amber-500/15 text-amber-300',
                              )}
                            >
                              {paymentStatusLabel}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <StatusBadge status={order.status} />
                        {order.isHeldOutOfKds && (
                          <span className="rounded border border-amber-400/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">
                            {t('orderMgmt.heldOutOfKdsShort', { defaultValue: 'Giữ khỏi KDS' })}
                          </span>
                        )}
                        {!order.isHeldOutOfKds && order.unpaidWarning && (
                          <span className="text-[10px] text-amber-200">{order.unpaidWarning}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        {order.additionalActions}
                        {order.canConfirm && onOrderAction && (
                          <button
                            type="button"
                            onClick={() => onOrderAction(order.id, 'confirmed')}
                            className="rounded border border-sky-400/40 bg-sky-500/15 px-2 py-1 text-xs font-semibold text-sky-200 hover:bg-sky-500/25"
                          >
                            {tTerminal('confirm')}
                          </button>
                        )}
                        {onEditOrder && !isTerminal && (
                          <button
                            type="button"
                            onClick={() => onEditOrder(order)}
                            className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                          >
                            {t('orderMgmt.editNotes')}
                          </button>
                        )}
                        {onPrintOrder && (
                          <button
                            type="button"
                            onClick={() => onPrintOrder(order)}
                            className="rounded border border-white/10 bg-white/5 px-2 py-1 text-xs hover:bg-white/10"
                          >
                            {t('orderMgmt.printTicket')}
                          </button>
                        )}
                        {order.canCancel && onCancelOrder && !isTerminal && (
                          <button
                            type="button"
                            onClick={() => onCancelOrder(order)}
                            className="rounded border border-red-400/30 bg-red-500/10 px-2 py-1 text-xs text-red-300 hover:bg-red-500/20"
                          >
                            {tTerminal('cancel')}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onViewDetails?.(order)}
                          className="rounded border border-white/10 bg-white/5 px-2.5 py-1 text-xs hover:bg-white/10"
                        >
                          {tTerminal('details')}
                        </button>
                        {!isTerminal && onOrderAction && (
                          <button
                            type="button"
                            disabled={order.nextActionDisabled}
                            title={order.nextActionTooltip}
                            onClick={() => onOrderAction(order.id, order.nextActionStatus || fallbackActionKey)}
                            className="rounded bg-[var(--aura-primary, #c6c6c7)] px-2.5 py-1 text-xs font-bold text-[#0c1c30] disabled:opacity-40"
                          >
                            {actionLabel}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
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
                  ? (targetStatus) =>
                      onOrderAction(
                        order.id,
                        targetStatus || order.nextActionStatus || getActionForStatus(order.status, order.orderType),
                      )
                  : undefined
              }
              onViewDetails={onViewDetails ? () => onViewDetails(order) : undefined}
              onCancel={onCancelOrder ? () => onCancelOrder(order) : undefined}
              onEdit={onEditOrder ? () => onEditOrder(order) : undefined}
              onPrint={onPrintOrder ? () => onPrintOrder(order) : undefined}
            />
          ))}
        </section>
      )}
    </div>
  );
}

/* ─── Table Section Export ───────────────────────────────────────────── */

export function StitchOrderMgmtTable({
  orders,
  activeFilter,
  activeChannel = 'all',
  searchQuery,
  searchField = 'all',
  statusCounts,
  isLoading,
  onFilterChange,
  onChannelChange,
  onSearch,
  onSearchFieldChange,
  onOrderAction,
  onViewDetails,
  onCancelOrder,
  onEditOrder,
  onPrintOrder,
  onRefresh,
  currentPage,
  pageSize,
  totalCount,
  onPageChange,
}: Readonly<OrderTableProps>) {
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  return (
    <>
      <SearchAndFilters
        activeFilter={activeFilter}
        activeChannel={activeChannel}
        controlledSearchQuery={searchQuery}
        searchField={searchField}
        statusCounts={statusCounts}
        viewMode={viewMode}
        isLoading={isLoading}
        onViewModeChange={setViewMode}
        onFilterChange={onFilterChange}
        onChannelChange={onChannelChange}
        onSearch={onSearch}
        onSearchFieldChange={onSearchFieldChange}
        onRefresh={onRefresh}
      />
      <OrderListSection
        orders={orders}
        viewMode={viewMode}
        isLoading={isLoading}
        onOrderAction={onOrderAction}
        onViewDetails={onViewDetails}
        onCancelOrder={onCancelOrder}
        onEditOrder={onEditOrder}
        onPrintOrder={onPrintOrder}
      />
      <PaginationFooter
        currentPage={currentPage}
        pageSize={pageSize}
        totalCount={totalCount ?? orders.length}
        currentCount={orders.length}
        onPageChange={onPageChange}
      />
    </>
  );
}
