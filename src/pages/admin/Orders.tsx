import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { StitchOrderMgmtNew } from '@/components/stitch';
import type {
  OrderChannel,
  OrderData,
  OrderSearchFieldType,
  OrderStatus,
  StatCardData,
} from '@/components/stitch/StitchOrderMgmtNew-types';
import {
  useAdminOrdersStore,
  type OrderSummaryData,
} from '@/hooks/stores/admin/use-admin-orders-store';
import type { AdminOrder } from '@/hooks/use-admin';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { ManualOrderRefund } from '@/components/admin/manual-order-refund';
import { apiFetch } from '@/lib/api-client';

/* ─── Status & Transition Logic ──────────────────────────────────────── */

const VALID_STATUSES: ReadonlySet<string> = new Set<OrderStatus>([
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'delivering',
  'served',
  'delivered',
  'completed',
  'cancelled',
  'failed',
  'expired',
]);

type CanonicalRole = 'admin' | 'manager' | 'staff' | 'kitchen' | 'rider' | 'unknown';

function normalizeActorRole(raw: string): CanonicalRole {
  const r = raw.trim().toLowerCase();
  if (r === 'owner' || r === 'admin' || r === 'super_admin') return 'admin';
  if (r === 'manager' || r === 'supervisor') return 'manager';
  if (r === 'staff' || r === 'cashier' || r === 'waiter') return 'staff';
  if (r === 'kitchen' || r === 'barista' || r === 'chef') return 'kitchen';
  if (r === 'rider' || r === 'driver' || r === 'delivery' || r === 'shipper') return 'rider';
  return 'unknown';
}

const TRANSITION_ALLOWED_ROLES: Record<string, ReadonlySet<CanonicalRole>> = {
  'pending->confirmed': new Set(['admin', 'manager', 'staff']),
  'pending->preparing': new Set(['admin', 'manager']),
  'confirmed->preparing': new Set(['admin', 'manager', 'staff', 'kitchen']),
  'preparing->ready': new Set(['admin', 'manager', 'staff', 'kitchen']),
  'ready->served': new Set(['admin', 'manager', 'staff', 'kitchen']),
  'ready->delivering': new Set(['admin', 'manager']),
  'ready->delivered': new Set(['admin', 'manager', 'rider']),
  'delivering->delivered': new Set(['admin', 'manager']),
  'served->completed': new Set(['admin', 'manager', 'staff']),
  'delivered->completed': new Set(['admin', 'manager', 'rider']),
};

function canRoleTransition(role: CanonicalRole, from: string, to: string): boolean {
  const allowed = TRANSITION_ALLOWED_ROLES[`${from}->${to}`];
  return allowed ? allowed.has(role) : false;
}

function normalizeOrderStatus(raw: string): OrderStatus {
  return VALID_STATUSES.has(raw) ? (raw as OrderStatus) : 'pending';
}

/**
 * Normalize SQLite `YYYY-MM-DD HH:MM:SS` UTC timestamps to valid ISO-8601 UTC
 * so relative time and local `HH:mm` display accurately in Asia/Saigon.
 */
function parseUtcTimestamp(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(dateStr)) {
    return new Date(`${dateStr.replace(' ', 'T')}Z`);
  }
  return new Date(dateStr);
}

function formatTimeAgo(dateStr: string, t: (k: string, opts?: Record<string, unknown>) => string): string {
  const parsed = parseUtcTimestamp(dateStr);
  if (Number.isNaN(parsed.getTime())) return '';
  const diff = Math.max(0, Date.now() - parsed.getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t('orderMgmt.time.justNow', { defaultValue: 'Vừa xong' });
  if (minutes < 60) return t('orderMgmt.time.minutesAgo', { count: minutes, defaultValue: `${minutes} phút trước` });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('orderMgmt.time.hoursAgo', { count: hours, defaultValue: `${hours} giờ trước` });
  return t('orderMgmt.time.daysAgo', { count: Math.floor(hours / 24), defaultValue: `${Math.floor(hours / 24)} ngày trước` });
}

function formatCreatedTime(dateStr: string): string {
  const parsed = parseUtcTimestamp(dateStr);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
}

interface NextActionInfo {
  nextStatus?: string;
  label?: string;
  disabled: boolean;
  tooltip?: string;
  canConfirm: boolean;
  canCancel: boolean;
  unpaidWarning?: string;
}

function computeNextAction(
  ao: AdminOrder,
  actorRole: string,
  t: (k: string, opts?: Record<string, unknown>) => string,
): NextActionInfo {
  const status = normalizeOrderStatus(ao.status);
  const role = normalizeActorRole(actorRole);
  const orderType: OrderChannel =
    ao.orderType === 'delivery' || ao.orderType === 'takeaway' || ao.orderType === 'dine_in'
      ? ao.orderType
      : ao.tableNumber || ao.tableId
        ? 'dine_in'
        : 'takeaway';

  const method = (ao.paymentMethod ?? '').toLowerCase();
  const isCod = method === 'cod' || method === 'cash';
  const isPrepaidOnline = method === 'payos' || method === 'bank_transfer' || method === 'qr';
  const requiresPrepayment = isPrepaidOnline || (orderType === 'delivery' && !isCod);
  const isUnpaid = ao.paymentStatus !== 'paid' && ao.paymentStatus !== 'completed';
  const unpaidWarning =
    requiresPrepayment && isUnpaid && (status === 'pending' || status === 'confirmed')
      ? t('orderMgmt.unpaidOnlineWarning')
      : undefined;

  const canCancel =
    (role === 'admin' || role === 'manager') &&
    status !== 'cancelled' &&
    status !== 'completed' &&
    status !== 'failed' &&
    status !== 'expired';

  if (status === 'pending') {
    const canConfirm = canRoleTransition(role, 'pending', 'confirmed');
    const canPrepare = canRoleTransition(role, 'pending', 'preparing');
    return {
      nextStatus: 'preparing',
      label: t('terminal.preparing'),
      disabled: !canPrepare || Boolean(unpaidWarning),
      tooltip: unpaidWarning || (!canPrepare ? t('orderMgmt.roleRestricted') : undefined),
      canConfirm,
      canCancel,
      unpaidWarning,
    };
  }
  if (status === 'confirmed') {
    const canPrepare = canRoleTransition(role, 'confirmed', 'preparing');
    return {
      nextStatus: 'preparing',
      label: t('terminal.preparing'),
      disabled: !canPrepare || Boolean(unpaidWarning),
      tooltip: unpaidWarning || (!canPrepare ? t('orderMgmt.roleRestricted') : undefined),
      canConfirm: false,
      canCancel,
      unpaidWarning,
    };
  }
  if (status === 'preparing') {
    const canReady = canRoleTransition(role, 'preparing', 'ready');
    return {
      nextStatus: 'ready',
      label: t('terminal.ready'),
      disabled: !canReady,
      tooltip: !canReady ? t('orderMgmt.roleRestricted') : undefined,
      canConfirm: false,
      canCancel,
    };
  }
  if (status === 'ready') {
    const nextStatus = orderType === 'delivery' ? 'delivered' : 'served';
    const allowed = canRoleTransition(role, 'ready', nextStatus);
    return {
      nextStatus,
      label: orderType === 'delivery' ? t('terminal.deliver') : t('terminal.serve'),
      disabled: !allowed,
      tooltip: !allowed ? t('orderMgmt.roleRestricted') : undefined,
      canConfirm: false,
      canCancel,
    };
  }
  if (status === 'delivering') {
    const allowed = canRoleTransition(role, 'delivering', 'delivered');
    return {
      nextStatus: 'delivered',
      label: t('terminal.deliver'),
      disabled: !allowed,
      tooltip: !allowed ? t('orderMgmt.roleRestricted') : undefined,
      canConfirm: false,
      canCancel,
    };
  }
  if (status === 'served' || status === 'delivered') {
    const allowed = canRoleTransition(role, status, 'completed');
    return {
      nextStatus: 'completed',
      label: t('terminal.complete'),
      disabled: !allowed,
      tooltip: !allowed ? t('orderMgmt.roleRestricted') : undefined,
      canConfirm: false,
      canCancel,
    };
  }
  return {
    disabled: true,
    canConfirm: false,
    canCancel: false,
  };
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

function mapAdminOrder(
  ao: AdminOrder,
  actorRole: string,
  t: (k: string, opts?: Record<string, unknown>) => string,
): OrderData {
  const tableDisplay = ao.tableNumber
    ? `${t('orderMgmt.tablePrefix', { defaultValue: 'Bàn' })} ${ao.tableNumber}${ao.tableZone ? ` (${ao.tableZone})` : ''}`
    : ao.tableId || '';
  const lineItems =
    Array.isArray(ao.itemsList) && ao.itemsList.length > 0
      ? ao.itemsList
      : [{ name: `${ao.items} ${t('terminal.items').toLowerCase()}`, quantity: 1 }];
  const nextInfo = computeNextAction(ao, actorRole, t);
  const orderType: OrderChannel =
    ao.orderType === 'delivery' || ao.orderType === 'takeaway' || ao.orderType === 'dine_in'
      ? ao.orderType
      : ao.tableNumber || ao.tableId
        ? 'dine_in'
        : 'takeaway';

  return {
    id: ao.id,
    customer: ao.customer || t('terminal.guest', { defaultValue: 'Guest' }),
    customerPhone: ao.customerPhone,
    customerAddress: ao.customerAddress,
    table: tableDisplay,
    tableName: tableDisplay || undefined,
    orderType,
    paymentMethod: ao.paymentMethod,
    paymentStatus: ao.paymentStatus,
    notes: ao.notes,
    deliveryTime: ao.deliveryTime,
    createdAt: ao.createdAt,
    createdTimeLabel: formatCreatedTime(ao.createdAt),
    timeAgo: formatTimeAgo(ao.createdAt, t),
    status: normalizeOrderStatus(ao.status),
    items: lineItems,
    total: formatCurrency(ao.total),
    nextActionLabel: nextInfo.label,
    nextActionStatus: nextInfo.nextStatus,
    nextActionDisabled: nextInfo.disabled,
    nextActionTooltip: nextInfo.tooltip,
    canConfirm: nextInfo.canConfirm,
    canCancel: nextInfo.canCancel,
    unpaidWarning: nextInfo.unpaidWarning,
  };
}

function computeStats(
  orders: AdminOrder[],
  summary: OrderSummaryData | null,
  t: (k: string, opts?: Record<string, unknown>) => string,
): StatCardData[] {
  const counts = summary?.byStatus;
  const activeOrders = counts
    ? (counts.pending ?? 0) + (counts.confirmed ?? 0)
    : orders.filter((o) => o.status === 'pending' || o.status === 'confirmed').length;
  const inPrep = counts
    ? (counts.preparing ?? 0)
    : orders.filter((o) => o.status === 'preparing').length;
  const readyPickup = counts
    ? (counts.ready ?? 0) + (counts.delivering ?? 0)
    : orders.filter((o) => o.status === 'ready' || o.status === 'delivering').length;

  const avgLeadValue =
    summary?.avgLeadTimeMinutes != null && Number.isFinite(summary.avgLeadTimeMinutes)
      ? `${summary.avgLeadTimeMinutes}m`
      : '--';

  return [
    { label: t('terminal.stat.activeOrders'), value: String(activeOrders), icon: 'activeOrders' },
    { label: t('terminal.stat.inPreparation'), value: String(inPrep), icon: 'inPreparation' },
    { label: t('terminal.stat.readyPickup'), value: String(readyPickup), icon: 'readyPickup' },
    { label: t('terminal.stat.avgLeadTime'), value: avgLeadValue, icon: 'avgLeadTime' },
  ];
}

/* ─── Page component ───────────────────────────────────────────────────── */

const ADMIN_ORDERS_PAGE_SIZE = 12;
const POLL_INTERVAL_MS = 30_000;

export default function AdminOrdersPage() {
  const { t } = useTranslation();
  const actorRole = useAuthStore((s) => s.user?.role ?? 'staff');
  const {
    orders,
    totalCount,
    summary,
    loading,
    error,
    mutationError,
    fetchOrders,
    fetchSummary,
    updateOrderStatus,
    cancelOrder,
    updateOrderDetails,
    clearMutationError,
  } = useAdminOrdersStore();

  const [activeFilter, setActiveFilter] = useState<OrderStatus | 'all'>('all');
  const [activeChannel, setActiveChannel] = useState<OrderChannel | 'all'>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [searchField, setSearchField] = useState<OrderSearchFieldType>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [codCollectingId, setCodCollectingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Modals state
  const [detailsOrder, setDetailsOrder] = useState<AdminOrder | null>(null);
  const [pendingPrintOrderId, setPendingPrintOrderId] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AdminOrder | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [editTarget, setEditTarget] = useState<AdminOrder | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editDeliveryTime, setEditDeliveryTime] = useState('');

  // Debounce search input (~300ms) so typing never drops focus or fires per-keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const currentFilters = useMemo(
    () => ({
      status: activeFilter === 'all' ? undefined : activeFilter,
      orderType: activeChannel === 'all' ? undefined : activeChannel,
      search: debouncedSearch || undefined,
      searchField: debouncedSearch ? searchField : undefined,
    }),
    [activeFilter, activeChannel, debouncedSearch, searchField],
  );

  const loadOrdersAndSummary = useCallback(() => {
    void fetchOrders(currentPage, currentFilters, ADMIN_ORDERS_PAGE_SIZE);
    void fetchSummary?.();
  }, [fetchOrders, fetchSummary, currentPage, currentFilters]);

  useEffect(() => {
    loadOrdersAndSummary();
  }, [loadOrdersAndSummary]);

  // Background polling every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchOrders(currentPage, currentFilters, ADMIN_ORDERS_PAGE_SIZE);
      void fetchSummary?.();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchOrders, fetchSummary, currentPage, currentFilters]);

  // Trigger window.print() only after detailsOrder has committed to the DOM
  useEffect(() => {
    if (!pendingPrintOrderId || detailsOrder?.id !== pendingPrintOrderId) return;
    const frame = requestAnimationFrame(() => {
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print();
      }
      setPendingPrintOrderId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingPrintOrderId, detailsOrder]);

  const orderMap = useMemo(() => {
    const map = new Map<string, AdminOrder>();
    for (const o of orders) {
      map.set(o.id, o);
    }
    return map;
  }, [orders]);

  /* ─── Derived data ──────────────────────────────────────────────────── */
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
      loadOrdersAndSummary();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể xác nhận đã thu tiền mặt');
    } finally {
      setCodCollectingId(null);
    }
  }, [loadOrdersAndSummary]);

  const stitchOrders: OrderData[] = useMemo(
    () =>
      orders.map((order) => {
        const unpaidCod =
          isCodMethod(order) &&
          getPaymentStatus(order) !== 'paid' &&
          getPaymentStatus(order) !== 'completed' &&
          order.status !== 'cancelled' &&
          order.status !== 'completed';
        return {
          ...mapAdminOrder(order, actorRole, t),
          additionalActions: (
            <div className="inline-flex items-center gap-2">
              {unpaidCod && (
                <button
                  type="button"
                  data-testid={`mark-cod-paid-${order.id}`}
                  disabled={codCollectingId === order.id}
                  onClick={() => { void handleMarkCodPaid(order.id); }}
                  className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {codCollectingId === order.id ? 'Đang thu...' : 'Thu tiền COD'}
                </button>
              )}
              <ManualOrderRefund
                order={order}
                onRecorded={() => {
                  loadOrdersAndSummary();
                }}
              />
            </div>
          ),
        };
      }),
    [orders, actorRole, t, loadOrdersAndSummary, codCollectingId, handleMarkCodPaid],
  );

  const stats: StatCardData[] = useMemo(
    () => computeStats(orders, summary, t),
    [orders, summary, t],
  );

  const statusCounts = useMemo(() => {
    if (!summary) return undefined;
    return {
      all: summary.total,
      ...summary.byStatus,
    };
  }, [summary]);

  /* ─── Callbacks ──────────────────────────────────────────────────────── */
  const handleFilterChange = useCallback((filter: OrderStatus | 'all') => {
    setCurrentPage(1);
    setActiveFilter(filter);
  }, []);

  const handleChannelChange = useCallback((channel: OrderChannel | 'all') => {
    setCurrentPage(1);
    setActiveChannel(channel);
  }, []);

  const handleSearch = useCallback((query: string) => {
    setCurrentPage(1);
    setSearchInput(query);
  }, []);

  const handleSearchFieldChange = useCallback((field: OrderSearchFieldType) => {
    setCurrentPage(1);
    setSearchField(field);
  }, []);

  const handlePageChange = useCallback((nextPage: number) => {
    setCurrentPage(Math.max(1, nextPage));
  }, []);

  const handleOrderAction = useCallback(
    async (orderId: string, action: string) => {
      const normalized = action.toLowerCase();
      const targetStatus =
        normalized === 'serve'
          ? 'served'
          : normalized === 'deliver'
            ? 'delivered'
            : normalized === 'complete'
              ? 'completed'
              : normalized === 'cancel'
                ? 'cancelled'
                : normalized;
      if (!VALID_STATUSES.has(targetStatus)) return;
      if (targetStatus === 'delivered' || targetStatus === 'completed') {
        const targetOrder = orders.find((o) => o.id === orderId);
        if (
          targetOrder &&
          isCodMethod(targetOrder) &&
          getPaymentStatus(targetOrder) !== 'paid' &&
          getPaymentStatus(targetOrder) !== 'completed'
        ) {
          setActionError('Đơn tiền mặt/COD chưa thu tiền. Vui lòng bấm "Thu tiền COD" trước khi hoàn tất đơn.');
          return;
        }
      }
      setActionError(null);
      await updateOrderStatus(orderId, targetStatus);
    },
    [orders, updateOrderStatus],
  );

  const handleViewDetails = useCallback(
    (order: OrderData) => {
      const found = orderMap.get(order.id);
      if (found) setDetailsOrder(found);
    },
    [orderMap],
  );

  const handleOpenCancel = useCallback(
    (order: OrderData) => {
      const found = orderMap.get(order.id);
      if (found) {
        setCancelTarget(found);
        setCancelReason('');
      }
    },
    [orderMap],
  );

  const handleConfirmCancel = useCallback(async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    const ok = await cancelOrder(cancelTarget.id, cancelReason.trim());
    if (ok) {
      setCancelTarget(null);
      setCancelReason('');
    }
  }, [cancelTarget, cancelReason, cancelOrder]);

  const handleOpenEdit = useCallback(
    (order: OrderData) => {
      const found = orderMap.get(order.id);
      if (found) {
        setEditTarget(found);
        setEditNotes(found.notes || '');
        setEditDeliveryTime(found.deliveryTime || '');
      }
    },
    [orderMap],
  );

  const handleConfirmEdit = useCallback(async () => {
    if (!editTarget) return;
    const ok = await updateOrderDetails(editTarget.id, {
      notes: editNotes.trim(),
      delivery_time: editDeliveryTime.trim() || undefined,
    });
    if (ok) {
      setEditTarget(null);
    }
  }, [editTarget, editNotes, editDeliveryTime, updateOrderDetails]);

  const handlePrintOrder = useCallback((order: OrderData) => {
    const found = orderMap.get(order.id);
    if (found) {
      setDetailsOrder(found);
      setPendingPrintOrderId(found.id);
    } else if (typeof window !== 'undefined' && typeof window.print === 'function') {
      window.print();
    }
  }, [orderMap]);

  const handleRefresh = useCallback(() => {
    setActionError(null);
    loadOrdersAndSummary();
  }, [loadOrdersAndSummary]);

  /* ─── Render ────────────────────────────────────────────────────────── */
  return (
    <>
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
        headerTitle={t('terminal.nav.orders')}
        headerSubtitle={t('terminal.orderMgmtSubtitle', { defaultValue: 'Order Management' })}
        stats={stats}
        orders={stitchOrders}
        activeFilter={activeFilter}
        activeChannel={activeChannel}
        searchQuery={searchInput}
        searchField={searchField}
        statusCounts={statusCounts}
        isLoading={loading}
        error={error}
        mutationError={mutationError}
        onDismissMutationError={clearMutationError}
        onFilterChange={handleFilterChange}
        onChannelChange={handleChannelChange}
        onSearch={handleSearch}
        onSearchFieldChange={handleSearchFieldChange}
        onOrderAction={handleOrderAction}
        onViewDetails={handleViewDetails}
        onCancelOrder={handleOpenCancel}
        onEditOrder={handleOpenEdit}
        onPrintOrder={handlePrintOrder}
        onRefresh={handleRefresh}
        currentPage={currentPage}
        pageSize={ADMIN_ORDERS_PAGE_SIZE}
        totalCount={totalCount || stitchOrders.length}
        onPageChange={handlePageChange}
        showDashboardPanels={false}
      />
      {/* Order Details / Log Modal */}
      {detailsOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('orderMgmt.detailsModalTitle')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0A1A2E] p-6 text-white shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {t('orderMgmt.detailsModalTitle')} — {detailsOrder.id}
              </h2>
              <button
                type="button"
                onClick={() => setDetailsOrder(null)}
                aria-label={t('orderMgmt.close')}
                className="rounded p-1 hover:bg-white/10"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 text-sm text-white/80">
              <p><strong>{t('orderMgmt.searchField.customer_name')}:</strong> {detailsOrder.customer}</p>
              {detailsOrder.customerPhone && (
                <p><strong>{t('orderMgmt.searchField.customer_phone')}:</strong> {detailsOrder.customerPhone}</p>
              )}
              {detailsOrder.customerAddress && (
                <p><strong>{t('orderMgmt.searchField.address')}:</strong> {detailsOrder.customerAddress}</p>
              )}
              {detailsOrder.tableNumber && (
                <p><strong>{t('orderMgmt.searchField.table')}:</strong> {detailsOrder.tableNumber}</p>
              )}
              <p>
                <strong>{t('orderMgmt.statusColumn')}:</strong>{' '}
                {t(`orderMgmt.${normalizeOrderStatus(detailsOrder.status)}`, { defaultValue: detailsOrder.status })}
              </p>
              <p>
                <strong>{t('orderMgmt.paymentLabel')}:</strong>{' '}
                {detailsOrder.paymentMethod || '--'} ({detailsOrder.paymentStatus || '--'})
              </p>
              {(() => {
                const rawRefund = detailsOrder as unknown as { refund_status?: string | null; refund_amount?: number | null };
                if (!rawRefund.refund_status && !rawRefund.refund_amount) return null;
                return (
                  <p>
                    <strong>{t('orderMgmt.refundLabel')}:</strong>{' '}
                    {rawRefund.refund_status || '--'}
                    {typeof rawRefund.refund_amount === 'number' && rawRefund.refund_amount > 0
                      ? ` (${formatCurrency(rawRefund.refund_amount)})`
                      : ''}
                  </p>
                );
              })()}
              {detailsOrder.notes && (
                <p><strong>{t('orderMgmt.searchField.notes')}:</strong> {detailsOrder.notes}</p>
              )}
              <div className="border-t border-white/10 pt-2">
                <p className="mb-1 font-semibold">{t('terminal.items')}</p>
                <ul className="space-y-1">
                  {(detailsOrder.itemsList || []).map((item, idx) => (
                    <li key={`${item.name}-${idx}`}>
                      <div>x{item.quantity} {item.name}</div>
                      {item.modifiers && item.modifiers.length > 0 && (
                        <div className="pl-4 text-xs text-white/60">+ {item.modifiers.join(', ')}</div>
                      )}
                      {item.notes && (
                        <div className="pl-4 text-xs italic text-amber-200/80">{item.notes}</div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              <p className="border-t border-white/10 pt-2 text-base font-bold text-amber-300">
                {t('terminal.total')}: {formatCurrency(detailsOrder.total)}
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailsOrder(null)}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold hover:bg-white/10"
              >
                {t('orderMgmt.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {cancelTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('orderMgmt.cancelModalTitle')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0A1A2E] p-6 text-white shadow-2xl">
            <h2 className="mb-3 text-lg font-semibold">
              {t('orderMgmt.cancelModalTitle')} — {cancelTarget.id}
            </h2>
            <label className="mb-1 block text-xs text-white/70">
              {t('orderMgmt.cancelReasonLabel')}
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder={t('orderMgmt.cancelReasonPlaceholder')}
              className="w-full rounded-lg border border-white/15 bg-white/5 p-2.5 text-sm text-white outline-none focus:border-red-400"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold hover:bg-white/10"
              >
                {t('orderMgmt.close')}
              </button>
              <button
                type="button"
                disabled={!cancelReason.trim()}
                onClick={() => { void handleConfirmCancel(); }}
                className="rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-40"
              >
                {t('orderMgmt.confirmCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Notes / Delivery Time Modal */}
      {editTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('orderMgmt.editModalTitle')}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0A1A2E] p-6 text-white shadow-2xl">
            <h2 className="mb-3 text-lg font-semibold">
              {t('orderMgmt.editModalTitle')} — {editTarget.id}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-white/70">
                  {t('orderMgmt.searchField.notes')}
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-white/15 bg-white/5 p-2.5 text-sm text-white outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-white/70">
                  {t('orderMgmt.deliveryTimeLabel')}
                </label>
                <input
                  type="text"
                  value={editDeliveryTime}
                  onChange={(e) => setEditDeliveryTime(e.target.value)}
                  placeholder="14:30"
                  className="w-full rounded-lg border border-white/15 bg-white/5 p-2.5 text-sm text-white outline-none focus:border-amber-400"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold hover:bg-white/10"
              >
                {t('orderMgmt.close')}
              </button>
              <button
                type="button"
                onClick={() => { void handleConfirmEdit(); }}
                className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-[#0c1c30] hover:bg-amber-300"
              >
                {t('orderMgmt.saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
