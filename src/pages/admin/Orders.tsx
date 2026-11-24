import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { X, QrCode, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
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
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { ThermalReceipt, type ThermalReceiptData } from '@/components/receipt/ThermalReceipt';

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
  if ((ao.paymentStatus ?? '').toLowerCase() === 'refunded') {
    return {
      disabled: true,
      canConfirm: false,
      canCancel: false,
    };
  }
  const role = normalizeActorRole(actorRole);
  const orderType: OrderChannel =
    ao.orderType === 'delivery' || ao.orderType === 'takeaway' || ao.orderType === 'dine_in'
      ? ao.orderType
      : ao.tableNumber || ao.tableId
        ? 'dine_in'
        : 'takeaway';

  const method = (ao.paymentMethod ?? '').toLowerCase();
  const isCod = method === 'cod' || method === 'cash';
  const isPrepaidOnline =
    method === 'payos' || method === 'bank_transfer' || method === 'qr' || method === 'vietqr';
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

function getPaymentMethod(order: AdminOrder): string {
  const raw = order as unknown as Record<string, unknown>;
  return String(raw.payment_method ?? raw.paymentMethod ?? '').trim().toLowerCase();
}

function isCodMethod(order: AdminOrder): boolean {
  const raw = order as unknown as Record<string, unknown>;
  const method = getPaymentMethod(order);
  return method === 'cod' || method === 'cash' || raw.is_cod === 1;
}

function getPaymentStatus(order: AdminOrder): string {
  const raw = order as unknown as Record<string, unknown>;
  return String(raw.payment_status ?? raw.paymentStatus ?? 'unpaid').trim().toLowerCase() || 'unpaid';
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
    subtotal: ao.subtotal,
    shippingFee: ao.shippingFee,
    discount: ao.discount,
    serviceFee: ao.serviceFee,
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

const TERMINAL_ORDER_STATUSES = new Set([
  'completed',
  'cancelled',
  'canceled',
  'failed',
  'rejected',
  'expired',
  'refunded',
]);

function computeStats(
  orders: AdminOrder[],
  summary: OrderSummaryData | null,
  t: (k: string, opts?: Record<string, unknown>) => string,
): StatCardData[] {
  const counts = summary?.byStatus;
  const activeOrders = counts
    ? Object.entries(counts).reduce((sum, [status, count]) => {
        const normalized = status.trim().toLowerCase();
        return TERMINAL_ORDER_STATUSES.has(normalized) ? sum : sum + Number(count || 0);
      }, 0)
    : orders.filter((o) => !TERMINAL_ORDER_STATUSES.has(o.status)).length;
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
  const [searchInput, setSearchInput] = useState(() => {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get('search') ?? '';
  });
  const [debouncedSearch, setDebouncedSearch] = useState(() => {
    if (typeof window === 'undefined') return '';
    return (new URLSearchParams(window.location.search).get('search') ?? '').trim();
  });
  const [searchField, setSearchField] = useState<OrderSearchFieldType>(() => {
    if (typeof window === 'undefined') return 'all';
    const f = new URLSearchParams(window.location.search).get('searchField');
    if (f === 'table' || f === 'id' || f === 'customer_name' || f === 'customer_phone' || f === 'item' || f === 'address' || f === 'notes') {
      return f;
    }
    return 'all';
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [codCollectingId, setCodCollectingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // PayOS QR Modal state (#173)
  const [qrOrder, setQrOrder] = useState<AdminOrder | null>(null);
  const [qrCheckoutUrl, setQrCheckoutUrl] = useState<string | null>(null);
  const [qrEmvcoPayload, setQrEmvcoPayload] = useState<string | null>(null);
  const [qrMode, setQrMode] = useState<'vietqr' | 'web'>('vietqr');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);

  // Modals state
  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);
  const [printReceipt, setPrintReceipt] = useState<ThermalReceiptData | null>(null);
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

  // Trigger window.print() only after ThermalReceipt has committed to the DOM
  useEffect(() => {
    if (!pendingPrintOrderId || printReceipt?.orderId !== pendingPrintOrderId) return;
    const frame = requestAnimationFrame(() => {
      if (typeof window !== 'undefined' && typeof window.print === 'function') {
        window.print();
      }
      setPendingPrintOrderId(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [pendingPrintOrderId, printReceipt]);

  const orderMap = useMemo(() => {
    const map = new Map<string, AdminOrder>();
    for (const o of orders) {
      map.set(o.id, o);
    }
    return map;
  }, [orders]);

  const detailsOrder = useMemo(
    () => (detailsOrderId ? orderMap.get(detailsOrderId) ?? null : null),
    [detailsOrderId, orderMap],
  );

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

  const hasQrEmvco = Boolean(qrEmvcoPayload && !/^https?:\/\//i.test(qrEmvcoPayload));
  const activeQrContent = qrMode === 'web' || !hasQrEmvco ? qrCheckoutUrl : qrEmvcoPayload;

  useEffect(() => {
    if (!activeQrContent) {
      setQrDataUrl(null);
      return;
    }
    let cancelled = false;
    void QRCode.toDataURL(activeQrContent, { width: 360, margin: 2, errorCorrectionLevel: 'M' })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeQrContent]);

  const handleOpenOrderQr = useCallback(async (order: AdminOrder, regenerate = false) => {
    setQrOrder(order);
    setQrLoading(true);
    setQrError(null);
    if (!regenerate) {
      setQrCheckoutUrl(null);
      setQrEmvcoPayload(null);
    }
    try {
      const res = await apiFetch<{
        payment_url?: string;
        checkout_url?: string;
        checkoutUrl?: string;
        qrCode?: string;
        qr_code?: string;
        data?: { checkoutUrl?: string; payment_url?: string; qrCode?: string };
      }>('/api/payment/create-link', {
        method: 'POST',
        body: JSON.stringify({
          order_id: order.id,
          total: order.total,
          return_url: window.location.href,
          cancel_url: window.location.href,
          description: `Order #${order.id.slice(0, 8)}`,
          ...(regenerate ? { regenerate: true } : {}),
        }),
      });
      const rawUrl = res.payment_url || res.checkout_url || res.checkoutUrl || res.data?.checkoutUrl || res.data?.payment_url || null;
      let url: string | null = null;
      if (rawUrl) {
        try {
          const parsed = new URL(rawUrl, window.location.origin);
          if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
            url = parsed.toString();
          }
        } catch {
          url = null;
        }
      }
      const emvco = res.qrCode || res.qr_code || res.data?.qrCode || null;
      if (!url) {
        setQrError('Không nhận được liên kết thanh toán PayOS hợp lệ.');
        return;
      }
      setQrCheckoutUrl(url);
      setQrEmvcoPayload(emvco);
      setQrMode(emvco && !/^https?:\/\//i.test(emvco) ? 'vietqr' : 'web');
    } catch (err) {
      if (err instanceof ApiClientError && err.code === 'ORDER_ALREADY_PAID') {
        setQrOrder(null);
        setQrCheckoutUrl(null);
        setQrEmvcoPayload(null);
        setQrError(null);
        loadOrdersAndSummary();
        return;
      }
      setQrError(err instanceof Error ? err.message : 'Không thể tạo mã QR thanh toán.');
    } finally {
      setQrLoading(false);
    }
  }, [loadOrdersAndSummary]);

  // Poll payment status while QR modal is open
  useEffect(() => {
    if (!qrOrder) return;
    let active = true;
    const poll = async () => {
      try {
        const res = await apiFetch<{
          order?: { status?: string; payment_status?: string; paymentStatus?: string; payment?: { status?: string } };
          data?: { status?: string; payment_status?: string; paymentStatus?: string; payment?: { status?: string } };
          status?: string;
          payment_status?: string;
          paymentStatus?: string;
          payment?: { status?: string };
        }>(`/api/orders/${encodeURIComponent(qrOrder.id)}`);
        if (!active) return;
        const orderObj = res?.order ?? res?.data ?? res;
        const payStatus = String(
          orderObj?.payment_status ?? orderObj?.paymentStatus ?? orderObj?.payment?.status ?? '',
        ).toLowerCase();
        const ordStatus = String(orderObj?.status ?? '').toLowerCase();
        if (payStatus === 'paid' || payStatus === 'completed' || ordStatus === 'cancelled') {
          setQrOrder(null);
          setQrCheckoutUrl(null);
          setQrEmvcoPayload(null);
          setQrError(null);
          loadOrdersAndSummary();
        }
      } catch {
        // transient poll error
      }
    };
    const interval = setInterval(() => void poll(), 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [qrOrder, loadOrdersAndSummary]);

  const canCollectCod = useMemo(() => {
    const normalizedRole = (actorRole || '').trim().toLowerCase();
    return ['owner', 'manager', 'supervisor', 'cashier', 'admin', 'waiter', 'shipper'].includes(normalizedRole);
  }, [actorRole]);

  const stitchOrders: OrderData[] = useMemo(
    () =>
      orders.map((order) => {
        const payStatus = getPaymentStatus(order);
        const isTerminal =
          order.status === 'cancelled' ||
          order.status === 'completed' ||
          order.status === 'failed' ||
          order.status === 'expired';
        const unpaidCod =
          canCollectCod &&
          isCodMethod(order) &&
          payStatus !== 'paid' &&
          payStatus !== 'completed' &&
          payStatus !== 'refunded' &&
          !isTerminal;
        const canShowPayosQr =
          getPaymentMethod(order) === 'payos' &&
          (payStatus === 'pending' || payStatus === 'unpaid') &&
          !isTerminal;
        const hasRefundAction =
          Boolean((order as { payment_id?: string | null }).payment_id) &&
          ['owner', 'admin', 'super_admin', 'manager'].includes((actorRole || '').trim().toLowerCase());
        return {
          ...mapAdminOrder(order, actorRole, t),
          additionalActions:
            canShowPayosQr || unpaidCod || hasRefundAction ? (
              <div className="inline-flex items-center gap-2">
                {canShowPayosQr && (
                  <button
                    type="button"
                    data-testid={`show-payos-qr-${order.id}`}
                    onClick={() => { void handleOpenOrderQr(order, false); }}
                    className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-sky-700 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    Hiện mã QR
                  </button>
                )}
                {unpaidCod && (
                  <button
                    type="button"
                    data-testid={`mark-cod-paid-${order.id}`}
                    disabled={codCollectingId === order.id}
                    onClick={() => { void handleMarkCodPaid(order.id); }}
                    className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {codCollectingId === order.id
                      ? t('orderMgmt.codCollecting', { defaultValue: 'Đang thu...' })
                      : t('orderMgmt.collectCod', { defaultValue: 'Thu tiền COD' })}
                  </button>
                )}
                {hasRefundAction && (
                  <ManualOrderRefund
                    order={order}
                    onRecorded={() => {
                      loadOrdersAndSummary();
                    }}
                  />
                )}
              </div>
            ) : undefined,
        };
      }),
    [orders, actorRole, canCollectCod, t, loadOrdersAndSummary, codCollectingId, handleMarkCodPaid, handleOpenOrderQr],
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
      if (found) setDetailsOrderId(found.id);
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
    if (!found) return;
    setPrintReceipt({
      orderId: found.id,
      createdAt: found.createdAt,
      orderType: found.orderType,
      tableName: found.tableNumber || found.tableId,
      customerName: found.customer,
      customerPhone: found.customerPhone,
      customerAddress: found.customerAddress,
      items: (found.itemsList && found.itemsList.length > 0
        ? found.itemsList
        : [{ name: t('terminal.items'), quantity: found.items || 1 }]),
      subtotal: found.subtotal,
      shippingFee: found.shippingFee,
      serviceFee: found.serviceFee,
      discount: found.discount,
      cashbackUsed: found.cashbackUsed,
      total: found.total,
      paymentMethod: found.paymentMethod || found.payment,
      paymentStatus: found.paymentStatus,
      notes: found.notes,
    });
    setPendingPrintOrderId(found.id);
  }, [orderMap, t]);

  const handleRefresh = useCallback(() => {
    setActionError(null);
    loadOrdersAndSummary();
  }, [loadOrdersAndSummary]);

  /* ─── Render ────────────────────────────────────────────────────────── */
  return (
    <>
      <ThermalReceipt receipt={printReceipt} />
      <div className="print:hidden no-print">
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
            {t('orderMgmt.close', { defaultValue: 'Đóng' })}
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
                onClick={() => setDetailsOrderId(null)}
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
                {detailsOrder.paymentMethod
                  ? t(`orderMgmt.paymentMethod.${detailsOrder.paymentMethod}`, { defaultValue: detailsOrder.paymentMethod })
                  : '--'}{' '}
                (
                {detailsOrder.paymentStatus
                  ? t(`orderMgmt.paymentStatus.${detailsOrder.paymentStatus}`, { defaultValue: detailsOrder.paymentStatus })
                  : '--'}
                )
              </p>
              {(() => {
                const rawRefund = detailsOrder as unknown as { refund_status?: string | null; refund_amount?: number | null };
                if (!rawRefund.refund_status && !rawRefund.refund_amount) return null;
                return (
                  <p>
                    <strong>{t('orderMgmt.refundLabel')}:</strong>{' '}
                    {rawRefund.refund_status
                      ? t(`orderMgmt.paymentStatus.${rawRefund.refund_status === 'completed' ? 'refunded' : rawRefund.refund_status === 'partial' ? 'partially_refunded' : rawRefund.refund_status}`, { defaultValue: rawRefund.refund_status })
                      : '--'}
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
                      <div className="flex items-baseline justify-between gap-2">
                        <span>x{item.quantity} {item.name}</span>
                        {typeof item.price === 'number' && Number.isFinite(item.price) && (
                          <span className="font-mono text-xs text-white/70">
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                        )}
                      </div>
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
              {((detailsOrder.shippingFee ?? 0) > 0 || (detailsOrder.serviceFee ?? 0) > 0 || (detailsOrder.discount ?? 0) > 0) && (
                <div className="space-y-1 border-t border-white/10 pt-2 text-xs text-white/75">
                  {(detailsOrder.shippingFee ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span>{t('orderMgmt.shippingFee', { defaultValue: 'Phí giao hàng' })}</span>
                      <span className="font-mono">+{formatCurrency(detailsOrder.shippingFee!)}</span>
                    </div>
                  )}
                  {(detailsOrder.serviceFee ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span>{t('orderMgmt.serviceFee', { defaultValue: 'Phí dịch vụ' })}</span>
                      <span className="font-mono">+{formatCurrency(detailsOrder.serviceFee!)}</span>
                    </div>
                  )}
                  {(detailsOrder.discount ?? 0) > 0 && (
                    <div className="flex justify-between text-emerald-300">
                      <span>{t('orderMgmt.discount', { defaultValue: 'Giảm giá' })}</span>
                      <span className="font-mono">-{formatCurrency(detailsOrder.discount!)}</span>
                    </div>
                  )}
                </div>
              )}
              <p className="border-t border-white/10 pt-2 text-base font-bold text-amber-300">
                {t('terminal.total')}: {formatCurrency(detailsOrder.total)}
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDetailsOrderId(null)}
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
      {/* PayOS Payment QR Modal (#173) */}
      {qrOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Mã QR thanh toán PayOS"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4"
        >
          <div className="flex flex-col items-center gap-3 w-full max-w-sm rounded-2xl border border-white/15 bg-[#0A1A2E] p-6 text-center text-white shadow-2xl">
            <div className="w-full flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-300">
                Thanh toán PayOS #{qrOrder.id.slice(0, 8)}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setQrOrder(null);
                  setQrCheckoutUrl(null);
                  setQrEmvcoPayload(null);
                  setQrError(null);
                }}
                className="rounded p-1 hover:bg-white/10 cursor-pointer"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm font-bold text-white">
              {formatCurrency(qrOrder.total)}
            </p>

            {qrError && (
              <div
                role="alert"
                className="w-full flex items-start gap-2 rounded-lg bg-red-500/20 border border-red-400/40 px-3 py-2 text-left text-xs text-red-100"
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-red-300 mt-0.5" />
                <span className="flex-1">{qrError}</span>
              </div>
            )}

            {hasQrEmvco && (
              <div className="w-full grid grid-cols-2 gap-1.5 rounded-lg bg-white/5 p-1" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={qrMode === 'vietqr'}
                  onClick={() => setQrMode('vietqr')}
                  className={`px-2 py-1.5 rounded-md text-[11px] font-semibold cursor-pointer ${
                    qrMode === 'vietqr' ? 'bg-amber-400 text-[#0c1c30]' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  VietQR (App Ngân hàng)
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={qrMode === 'web'}
                  onClick={() => setQrMode('web')}
                  className={`px-2 py-1.5 rounded-md text-[11px] font-semibold cursor-pointer ${
                    qrMode === 'web' ? 'bg-amber-400 text-[#0c1c30]' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Link thanh toán (iPhone)
                </button>
              </div>
            )}

            <div className="rounded-lg bg-white p-3 min-h-[216px] min-w-[216px] flex items-center justify-center">
              {qrLoading ? (
                <span className="text-xs text-slate-600">Đang tạo mã QR...</span>
              ) : qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt={qrMode === 'web' ? 'PayOS Web Link QR' : 'PayOS VietQR'}
                  className="h-48 w-48 object-contain"
                />
              ) : (
                <span className="text-xs text-slate-600">Chưa có mã QR</span>
              )}
            </div>

            {qrCheckoutUrl && (
              <a
                href={qrCheckoutUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-sky-600 text-white text-xs font-semibold hover:bg-sky-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Mở trang thanh toán
              </a>
            )}

            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                disabled={qrLoading}
                onClick={() => void handleOpenOrderQr(qrOrder, true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Tạo lại QR
              </button>
              <button
                type="button"
                onClick={() => {
                  setQrOrder(null);
                  setQrCheckoutUrl(null);
                  setQrEmvcoPayload(null);
                  setQrError(null);
                }}
                className="px-3 py-1.5 rounded-full border border-white/15 text-xs text-slate-300 hover:text-white cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </>
  );
}
