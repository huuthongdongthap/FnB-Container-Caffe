import { useState, useEffect, useCallback } from 'react';
import { StitchOrderMgmtNew } from '@/components/stitch';
import type {
  OrderData,
  OrderStatus,
  StatCardData,
} from '@/components/stitch/StitchOrderMgmtNew-types';
import { useAdminOrdersStore } from '@/hooks/stores/admin/use-admin-orders-store';
import type { AdminOrder } from '@/hooks/use-admin';

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

function mapAdminOrder(ao: AdminOrder): OrderData {
  const rawRecord = ao as unknown as Record<string, unknown>;
  const tableVal = rawRecord.table ?? rawRecord.table_id ?? rawRecord.table_number ?? '';
  const lineItems =
    Array.isArray(ao.itemsList) && ao.itemsList.length > 0
      ? ao.itemsList
      : [{ name: `${ao.items} items`, quantity: 1 }];
  return {
    id: ao.id,
    customer: ao.customer || 'Guest',
    table: String(tableVal || ''),
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

export default function AdminOrdersPage() {
  const { orders, loading, error, fetchOrders, updateOrderStatus } =
    useAdminOrdersStore();

  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  /* Fetch orders from the store whenever filter or search changes */
  useEffect(() => {
    const backendStatus = activeFilter === 'all'
      ? undefined
      : activeFilter === 'served'
        ? 'delivered'
        : activeFilter;
    fetchOrders(1, {
      status: backendStatus,
      search: searchQuery || undefined,
    });
  }, [activeFilter, searchQuery, fetchOrders]);

  /* ─── Derived data ──────────────────────────────────────────────────── */
  const stitchOrders: OrderData[] = orders.map(mapAdminOrder);
  const stats: StatCardData[] = computeStats(orders);

  /* ─── Callbacks ──────────────────────────────────────────────────────── */
  const handleFilterChange = useCallback((filter: OrderStatus | 'all') => {
    setActiveFilter(filter);
  }, []);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const handleOrderAction = useCallback(
    (orderId: string, action: string) => {
      const storeStatus = ACTION_TO_STORE[action.toLowerCase()];
      if (storeStatus) {
        updateOrderStatus(orderId, storeStatus);
      }
    },
    [updateOrderStatus],
  );

  const handleRefresh = useCallback(() => {
    const backendStatus = activeFilter === 'all'
      ? undefined
      : activeFilter === 'served'
        ? 'delivered'
        : activeFilter;
    fetchOrders(1, {
      status: backendStatus,
      search: searchQuery || undefined,
    });
  }, [fetchOrders, activeFilter, searchQuery]);

  /* ─── Render ────────────────────────────────────────────────────────── */
  return (
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
    />
  );
}
