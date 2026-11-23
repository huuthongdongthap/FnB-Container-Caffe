import { useState, useEffect, useCallback } from 'react';
import { StitchOrderMgmtNew } from '@/components/stitch';
import type {
  OrderData,
  OrderStatus,
  StatCardData,
} from '@/components/stitch/StitchOrderMgmtNew-types';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import type { AdminOrder } from '@/hooks/use-admin';
import { ManualOrderRefund } from '@/components/admin/manual-order-refund';
import { apiFetch } from '@/lib/api-client';

/* ─── Status mapping ───────────────────────────────────────────────────────
   StitchOrderMgmtNew supports: pending, preparing, ready, served, cancelled
   The store/API supports:      pending, confirmed, preparing, ready, delivering, delivered, cancelled
   ──────────────────────────────────────────────────────────────────────── */

const STORE_TO_STITCH: Record<string, OrderStatus> = {
  pending: 'pending',
  confirmed: 'preparing',
  preparing: 'preparing',
  ready: 'ready',
  delivering: 'ready',
  served: 'served',
  delivered: 'served',
  completed: 'served',
  cancelled: 'cancelled',
};

/** Maps the Stitch action label (lowercase) to the store status value. */
const ACTION_TO_STORE: Record<string, string> = {
  preparing: 'preparing',
  ready: 'ready',
  serve: 'delivered',
  served: 'delivered',
  delivered: 'delivered',
  cancel: 'cancelled',
  cancelled: 'cancelled',
};

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

function isCodMethod(order: AdminOrder): boolean {
  const raw = order as unknown as Record<string, unknown>;
  const method = String(raw.payment_method ?? raw.paymentMethod ?? '').toLowerCase();
  return method === 'cod' || method === 'cash' || raw.is_cod === 1;
}

function getPaymentStatus(order: AdminOrder): string {
  const raw = order as unknown as Record<string, unknown>;
  return String(raw.payment_status ?? raw.paymentStatus ?? 'unpaid').toLowerCase();
}

function mapAdminOrder(ao: AdminOrder): OrderData {
  const rawRecord = ao as unknown as Record<string, unknown>;
  const tableVal = rawRecord.table ?? rawRecord.table_id ?? rawRecord.table_number ?? '';
  const paymentMethod = isCodMethod(ao) ? 'Tiền mặt' : String(rawRecord.payment_method ?? rawRecord.paymentMethod ?? 'Online');
  const paymentStatus = getPaymentStatus(ao);
  const paymentBadge = paymentStatus === 'paid' || paymentStatus === 'completed'
    ? `${paymentMethod} • Đã thu`
    : `${paymentMethod} • Chưa thu`;
  const lineItems =
    Array.isArray(ao.itemsList) && ao.itemsList.length > 0
      ? ao.itemsList
      : [{ name: `${ao.items} items`, quantity: 1 }];
  return {
    id: ao.id,
    customer: ao.customer || 'Guest',
    table: tableVal ? `${String(tableVal)} • ${paymentBadge}` : paymentBadge,
    timeAgo: formatTimeAgo(ao.createdAt),
    status: STORE_TO_STITCH[ao.status] ?? 'pending',
    items: lineItems,
    total: formatCurrency(ao.total),
  };
}

function computeStats(orders: AdminOrder[]): StatCardData[] {
  const activeOrders = orders.filter(
    (o) => o.status === 'pending' || o.status === 'confirmed',
  ).length;
  const inPrep = orders.filter((o) => o.status === 'preparing').length;
  const readyPickup = orders.filter(
    (o) => o.status === 'ready' || o.status === 'delivering',
  ).length;

  return [
    { label: 'Active Orders', value: String(activeOrders), icon: 'activeOrders' },
    { label: 'In Preparation', value: String(inPrep), icon: 'inPreparation' },
    { label: 'Ready for Pickup', value: String(readyPickup), icon: 'readyPickup' },
    { label: 'Avg. Lead Time', value: '--', icon: 'avgLeadTime' },
  ];
}

/* ─── Page component ───────────────────────────────────────────────────── */

const ADMIN_ORDERS_PAGE_SIZE = 12;

export default function AdminOrdersPage() {
  const { orders, totalCount, loading, error, fetchOrders, updateOrderStatus } =
    useAdminOrdersStore();

  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [codCollectingId, setCodCollectingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const resolveBackendStatus = useCallback((filter: OrderStatus | 'all') => {
    if (filter === 'all') return undefined;
    if (filter === 'served') return 'delivered';
    return filter;
  }, []);

  const refreshCurrentOrders = useCallback(() => {
    void fetchOrders(
      currentPage,
      {
        status: resolveBackendStatus(activeFilter),
        search: searchQuery || undefined,
      },
      ADMIN_ORDERS_PAGE_SIZE,
    );
  }, [fetchOrders, currentPage, activeFilter, searchQuery, resolveBackendStatus]);

  const handleMarkCodPaid = useCallback(async (orderId: string) => {
    setCodCollectingId(orderId);
    setActionError(null);
    try {
      const res = await apiFetch<{ success?: boolean; error?: string }>(
        `/api/orders/${encodeURIComponent(orderId)}/mark-cod-paid`,
        { method: 'PATCH' },
      );
      if (res && res.success === false) {
        throw new Error(res.error || 'Không thể xác nhận đã thu tiền mặt');
      }
      refreshCurrentOrders();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể xác nhận đã thu tiền mặt');
    } finally {
      setCodCollectingId(null);
    }
  }, [refreshCurrentOrders]);

  /* Fetch orders from the store whenever page, filter, or search changes */
  useEffect(() => {
    const backendStatus = resolveBackendStatus(activeFilter);
    fetchOrders(
      currentPage,
      {
        status: backendStatus,
        search: searchQuery || undefined,
      },
      ADMIN_ORDERS_PAGE_SIZE,
    );
  }, [activeFilter, searchQuery, currentPage, fetchOrders, resolveBackendStatus]);

  /* ─── Derived data ──────────────────────────────────────────────────── */
  const stitchOrders: OrderData[] = orders.map(order => {
    const unpaidCod =
      isCodMethod(order) &&
      getPaymentStatus(order) !== 'paid' &&
      getPaymentStatus(order) !== 'completed' &&
      order.status !== 'cancelled' &&
      order.status !== 'completed';
    return {
      ...mapAdminOrder(order),
      additionalActions: (
        <div className="inline-flex items-center gap-2">
          {unpaidCod && (
            <button
              type="button"
              data-testid={`mark-cod-paid-${order.id}`}
              disabled={codCollectingId === order.id}
              onClick={() => void handleMarkCodPaid(order.id)}
              className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {codCollectingId === order.id ? 'Đang thu...' : 'Thu tiền COD'}
            </button>
          )}
          <ManualOrderRefund order={order} onRecorded={refreshCurrentOrders} />
        </div>
      ),
    };
  });
  const stats: StatCardData[] = computeStats(orders);

  /* ─── Callbacks ──────────────────────────────────────────────────────── */
  const handleFilterChange = useCallback((filter: OrderStatus | 'all') => {
    setCurrentPage(1);
    setActiveFilter(filter);
  }, []);

  const handleSearch = useCallback((query: string) => {
    setCurrentPage(1);
    setSearchQuery(query);
  }, []);

  const handlePageChange = useCallback((nextPage: number) => {
    setCurrentPage(Math.max(1, nextPage));
  }, []);

  const handleOrderAction = useCallback(
    (orderId: string, action: string) => {
      const storeStatus = ACTION_TO_STORE[action.toLowerCase()];
      if (!storeStatus) return;
      if (storeStatus === 'delivered' || storeStatus === 'completed') {
        const targetOrder = orders.find((o) => o.id === orderId);
        if (targetOrder && isCodMethod(targetOrder) && getPaymentStatus(targetOrder) !== 'paid' && getPaymentStatus(targetOrder) !== 'completed') {
          setActionError('Đơn tiền mặt/COD chưa thu tiền. Vui lòng bấm "Thu tiền COD" trước khi hoàn tất đơn.');
          return;
        }
      }
      setActionError(null);
      updateOrderStatus(orderId, storeStatus);
    },
    [orders, updateOrderStatus],
  );

  const handleRefresh = useCallback(() => {
    setActionError(null);
    const backendStatus = resolveBackendStatus(activeFilter);
    fetchOrders(
      currentPage,
      {
        status: backendStatus,
        search: searchQuery || undefined,
      },
      ADMIN_ORDERS_PAGE_SIZE,
    );
  }, [fetchOrders, activeFilter, searchQuery, currentPage, resolveBackendStatus]);

  /* ─── Render ────────────────────────────────────────────────────────── */
  return (
    <div>
      {actionError && (
        <div
          role="alert"
          data-testid="orders-action-error"
          className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200"
        >
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="rounded px-2 py-0.5 text-xs font-semibold hover:bg-amber-500/20 cursor-pointer"
          >
            Đóng / Dismiss
          </button>
        </div>
      )}
      <StitchOrderMgmtNew
        headerTitle="Orders"
        headerSubtitle="Order Management"
        stats={stats}
        orders={stitchOrders}
        activeFilter={activeFilter}
        isLoading={loading}
        error={error}
        onFilterChange={handleFilterChange}
        onSearch={handleSearch}
        onOrderAction={handleOrderAction}
        onRefresh={handleRefresh}
        currentPage={currentPage}
        pageSize={ADMIN_ORDERS_PAGE_SIZE}
        totalCount={totalCount || stitchOrders.length}
        onPageChange={handlePageChange}
        showDashboardPanels={false}
      />
    </div>
  );
}
