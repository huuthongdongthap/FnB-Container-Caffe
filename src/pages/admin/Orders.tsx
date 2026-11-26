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
import { formatTableWithPrefix } from '@/hooks/kds-order';
import { AUTH_TOKEN_KEY, useAuthStore } from '@/hooks/stores/use-auth-store';
import { ManualOrderRefund } from '@/components/admin/manual-order-refund';
import { API_BASE, apiFetch, ApiClientError } from '@/lib/api-client';
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
  'pending->preparing': new Set(['admin', 'manager', 'staff', 'kitchen']),
  'confirmed->preparing': new Set(['admin', 'manager', 'staff', 'kitchen']),
  'preparing->ready': new Set(['admin', 'manager', 'staff', 'kitchen']),
  'ready->served': new Set(['admin', 'manager', 'staff', 'kitchen']),
  'ready->delivering': new Set(['admin', 'manager', 'staff', 'rider']),
  'ready->delivered': new Set(['admin', 'manager', 'rider']),
  'delivering->delivered': new Set(['admin', 'manager', 'staff', 'rider']),
  'delivering->failed': new Set(['admin', 'manager', 'staff', 'rider']),
  'delivering->cancelled': new Set(['admin', 'manager', 'rider']),
  'served->completed': new Set(['admin', 'manager', 'staff']),
  'served->failed': new Set(['admin', 'manager']),
  'served->cancelled': new Set(['admin', 'manager']),
  'delivered->completed': new Set(['admin', 'manager', 'staff', 'rider']),
  'delivered->failed': new Set(['admin', 'manager', 'rider']),
  'delivered->cancelled': new Set(['admin', 'manager', 'rider']),
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

const ONLINE_QR_PAYMENT_METHODS = new Set(['payos', 'bank_transfer', 'qr', 'vietqr']);
const PAID_STATUS_SET = new Set(['paid', 'completed', 'partially_refunded']);

function isPaidStatus(raw: string | undefined | null): boolean {
  if (!raw) return false;
  return PAID_STATUS_SET.has(raw.trim().toLowerCase());
}

function canActorCancelStatus(role: CanonicalRole, status: OrderStatus): boolean {
  if (status === 'cancelled' || status === 'completed' || status === 'failed' || status === 'expired') {
    return false;
  }
  if (role === 'admin' || role === 'manager') return true;
  if (role === 'staff') return status !== 'served' && status !== 'delivered';
  if (role === 'kitchen') return status === 'confirmed' || status === 'preparing';
  if (role === 'rider') return status === 'delivering';
  return false;
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

  const rawRecord = ao as unknown as Record<string, unknown>;
  const method = String(ao.paymentMethod ?? rawRecord.payment_method ?? '').trim().toLowerCase();
  const isCod = method === 'cod' || method === 'cash' || Number(ao.isCod ?? rawRecord.is_cod ?? 0) === 1;
  const isPrepaidOnline = ONLINE_QR_PAYMENT_METHODS.has(method);
  const requiresPrepayment = isPrepaidOnline || (orderType === 'delivery' && !isCod);
  const rawPayStatus = String(ao.paymentStatus ?? rawRecord.payment_status ?? '').trim().toLowerCase();
  const isUnpaid = !isPaidStatus(rawPayStatus);
  const unpaidWarning =
    requiresPrepayment && isUnpaid && (status === 'pending' || status === 'confirmed')
      ? t('orderMgmt.unpaidOnlineWarning')
      : undefined;

  const canCancel = canActorCancelStatus(role, status);

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
    const nextStatus = orderType === 'delivery' ? 'delivering' : 'served';
    const allowed = canRoleTransition(role, 'ready', nextStatus);
    return {
      nextStatus,
      label: orderType === 'delivery' ? t('terminal.dispatch') : t('terminal.serve'),
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
  const rawTable = ao.tableNumber || ao.tableId || '';
  const baseTableLabel = rawTable
    ? formatTableWithPrefix(rawTable, (clean) => `${t('orderMgmt.tablePrefix', { defaultValue: 'Bàn' })} ${clean}`)
    : '';
  const tableDisplay = baseTableLabel
    ? `${baseTableLabel}${ao.tableZone ? ` (${ao.tableZone})` : ''}`
    : '';
  const lineItems =
    Array.isArray(ao.itemsList) && ao.itemsList.length > 0
      ? ao.itemsList
      : [{ name: `${ao.items} ${t('terminal.items').toLowerCase()}`, quantity: 1 }];
  const nextInfo = computeNextAction(ao, actorRole, t);
  const normalizedStatus = normalizeOrderStatus(ao.status);
  const orderType: OrderChannel =
    ao.orderType === 'delivery' || ao.orderType === 'takeaway' || ao.orderType === 'dine_in'
      ? ao.orderType
      : ao.tableNumber || ao.tableId
        ? 'dine_in'
        : 'takeaway';
  const displayId = ao.orderNumber ? `#${ao.orderNumber.replace(/^#/, '')}` : ao.id;
  const isHeldOutOfKds =
    typeof ao.isHeldOutOfKds === 'boolean'
      ? ao.isHeldOutOfKds
      : Boolean(nextInfo.unpaidWarning && (normalizedStatus === 'pending' || normalizedStatus === 'confirmed'));

  return {
    id: ao.id,
    displayId,
    orderNumber: ao.orderNumber,
    customer: ao.customer || t('terminal.guest', { defaultValue: 'Guest' }),
    customerPhone: ao.customerPhone,
    customerAddress: ao.customerAddress,
    table: tableDisplay,
    tableName: tableDisplay || undefined,
    orderType,
    paymentMethod: ao.paymentMethod || getPaymentMethod(ao) || undefined,
    paymentStatus: ao.paymentStatus || getPaymentStatus(ao),
    isHeldOutOfKds,
    notes: ao.notes,
    deliveryTime: ao.deliveryTime,
    createdAt: ao.createdAt,
    startedAt: ao.startedAt,
    readyAt: ao.readyAt,
    cancelledAt: ao.cancelledAt,
    shipperName: ao.shipperName,
    failureReason: ao.failureReason,
    cancelledReason: ao.cancelledReason || (normalizedStatus === 'cancelled' ? ao.failureReason : undefined),
    createdTimeLabel: formatCreatedTime(ao.createdAt),
    timeAgo: formatTimeAgo(ao.createdAt, t),
    status: normalizedStatus,
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
  const counts = summary?.kdsByStatus ?? summary?.byStatus;
  const activeOrders = counts
    ? Object.entries(counts).reduce((sum, [status, count]) => {
        const normalized = status.trim().toLowerCase();
        return TERMINAL_ORDER_STATUSES.has(normalized) || normalized === 'served' || normalized === 'delivered'
          ? sum
          : sum + Number(count || 0);
      }, 0)
    : orders.filter((o) => !TERMINAL_ORDER_STATUSES.has(o.status) && !o.isHeldOutOfKds).length;
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
  const actorUser = useAuthStore((s) => s.user);
  const actorRole = actorUser?.role ?? 'staff';
  const actorTenantId = actorUser?.tenantId ?? 'default';
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

  // Shipper assignment & delivery failure modals (#226)
  const [shipperOptions, setShipperOptions] = useState<Array<{ id: string; name: string; role: string }>>([]);
  const [assignShipperTarget, setAssignShipperTarget] = useState<AdminOrder | null>(null);
  const [selectedShipperId, setSelectedShipperId] = useState('');
  const [customShipperName, setCustomShipperName] = useState('');
  const [isSavingShipper, setIsSavingShipper] = useState(false);
  const [failTarget, setFailTarget] = useState<AdminOrder | null>(null);
  const [failureReasonInput, setFailureReasonInput] = useState('');
  const [isMarkingFailed, setIsMarkingFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const normRole = (actorRole || '').trim().toLowerCase();
    if (!['owner', 'admin', 'super_admin', 'manager', 'supervisor', 'staff', 'cashier', 'waiter', 'shipper', 'rider'].includes(normRole)) {
      return;
    }
    void apiFetch<{
      data?: Array<{ id?: string; name?: string; full_name?: string; role?: string; is_active?: number | boolean }>;
      staff?: Array<{ id?: string; name?: string; full_name?: string; role?: string; is_active?: number | boolean }>;
    }>('/api/staff', { silent: true })
      .then((res) => {
        if (!active) return;
        const rawList = Array.isArray(res?.data) ? res.data : Array.isArray(res?.staff) ? res.staff : [];
        const options = rawList
          .filter((s) => s?.id && (s.is_active === undefined || Boolean(s.is_active)))
          .map((s) => ({
            id: String(s.id),
            name: String(s.name || s.full_name || s.id),
            role: String(s.role || 'staff').toLowerCase(),
          }))
          .filter((s) => s.role !== 'customer' && s.role !== 'barista' && s.role !== 'kitchen' && s.role !== 'chef');
        setShipperOptions(options);
      })
      .catch(() => {
        // Optional staff directory in minimal test contexts
      });
    return () => {
      active = false;
    };
  }, [actorRole, actorTenantId]);

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
    void fetchSummary?.(currentFilters);
  }, [fetchOrders, fetchSummary, currentPage, currentFilters]);

  useEffect(() => {
    loadOrdersAndSummary();
  }, [loadOrdersAndSummary]);

  // Background polling + cross-screen event + store-wide DO WebSocket realtime sync
  useEffect(() => {
    const interval = setInterval(() => {
      void fetchOrders(currentPage, currentFilters, ADMIN_ORDERS_PAGE_SIZE);
      void fetchSummary?.(currentFilters);
    }, POLL_INTERVAL_MS);

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void fetchOrders(currentPage, currentFilters, ADMIN_ORDERS_PAGE_SIZE);
        void fetchSummary?.(currentFilters);
      }, 250);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('aura:orders-changed', scheduleRefresh);
    }

    let ws: WebSocket | null = null;
    if (actorUser && typeof WebSocket === 'function' && typeof window !== 'undefined') {
      try {
        const token = typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null;
        if (token) {
          const baseOrigin = API_BASE || window.location.origin;
          const wsOrigin = baseOrigin.replace(/^http/i, 'ws');
          const channel =
            actorTenantId && actorTenantId !== 'default' && actorTenantId !== '*'
              ? `${actorTenantId}:orders`
              : 'orders';
          ws = new WebSocket(`${wsOrigin}/api/realtime/${encodeURIComponent(channel)}?token=${encodeURIComponent(token)}`);
          ws.onmessage = (evt) => {
            try {
              const msg = JSON.parse(String(evt.data)) as { type?: string };
              if (msg?.type === 'order_update') {
                scheduleRefresh();
              }
            } catch {
              // ignore non-JSON frames
            }
          };
          ws.onerror = () => {};
        }
      } catch {
        ws = null;
      }
    }

    return () => {
      clearInterval(interval);
      if (debounceTimer) clearTimeout(debounceTimer);
      if (typeof window !== 'undefined') {
        window.removeEventListener('aura:orders-changed', scheduleRefresh);
      }
      try {
        ws?.close();
      } catch {
        // ignore close errors
      }
    };
  }, [fetchOrders, fetchSummary, currentPage, currentFilters, actorUser, actorTenantId]);

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
        if (
          payStatus === 'paid' ||
          payStatus === 'completed' ||
          ordStatus === 'cancelled' ||
          ordStatus === 'failed' ||
          ordStatus === 'expired'
        ) {
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
    return ['owner', 'manager', 'supervisor', 'cashier', 'admin', 'waiter', 'shipper', 'rider'].includes(normalizedRole);
  }, [actorRole]);

  const handleConfirmAssignShipper = useCallback(async () => {
    if (!assignShipperTarget || isSavingShipper) return;
    const chosenOption = shipperOptions.find((s) => s.id === selectedShipperId);
    const effectiveShipperId = selectedShipperId.trim() || undefined;
    const effectiveShipperName = (customShipperName.trim() || chosenOption?.name || '').trim() || undefined;
    if (!effectiveShipperId && !effectiveShipperName) {
      setActionError('Vui lòng chọn tài khoản shipper hoặc nhập tên người giao hàng.');
      return;
    }
    setIsSavingShipper(true);
    setActionError(null);
    try {
      const nextStatus = assignShipperTarget.status === 'ready' ? 'delivering' : assignShipperTarget.status;
      await apiFetch(`/api/orders/${encodeURIComponent(assignShipperTarget.id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: nextStatus,
          ...(effectiveShipperId ? { assigned_shipper_id: effectiveShipperId } : {}),
          ...(effectiveShipperName ? { shipper_name: effectiveShipperName } : {}),
        }),
      });
      setAssignShipperTarget(null);
      setSelectedShipperId('');
      setCustomShipperName('');
      loadOrdersAndSummary();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể gán shipper cho đơn hàng.');
    } finally {
      setIsSavingShipper(false);
    }
  }, [assignShipperTarget, isSavingShipper, shipperOptions, selectedShipperId, customShipperName, loadOrdersAndSummary]);

  const handleConfirmDeliveryFailed = useCallback(async () => {
    if (!failTarget || !failureReasonInput.trim() || isMarkingFailed) return;
    setIsMarkingFailed(true);
    setActionError(null);
    try {
      await apiFetch(`/api/orders/${encodeURIComponent(failTarget.id)}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'failed',
          failure_reason: failureReasonInput.trim(),
        }),
      });
      setFailTarget(null);
      setFailureReasonInput('');
      loadOrdersAndSummary();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Không thể đánh dấu giao thất bại.');
    } finally {
      setIsMarkingFailed(false);
    }
  }, [failTarget, failureReasonInput, isMarkingFailed, loadOrdersAndSummary]);

  const stitchOrders: OrderData[] = useMemo(
    () =>
      orders.map((order) => {
        const payStatus = getPaymentStatus(order);
        const canonicalActor = normalizeActorRole(actorRole);
        const isTerminal =
          order.status === 'cancelled' ||
          order.status === 'completed' ||
          order.status === 'failed' ||
          order.status === 'expired';
        const unpaidCod =
          canCollectCod &&
          isCodMethod(order) &&
          !isPaidStatus(payStatus) &&
          payStatus !== 'refunded' &&
          !isTerminal;
        const canShowPayosQr =
          ONLINE_QR_PAYMENT_METHODS.has(getPaymentMethod(order)) &&
          !isPaidStatus(payStatus) &&
          payStatus !== 'refunded' &&
          !isTerminal;
        const hasRefundAction =
          Boolean((order as { payment_id?: string | null }).payment_id) &&
          ['owner', 'admin', 'super_admin', 'manager'].includes((actorRole || '').trim().toLowerCase());
        const isDeliveryChannel = order.orderType === 'delivery';
        const canAssignShipper =
          isDeliveryChannel &&
          (order.status === 'ready' || order.status === 'delivering') &&
          ['admin', 'manager', 'staff', 'rider'].includes(canonicalActor) &&
          (isPaidStatus(payStatus) || isCodMethod(order));
        const canMarkDeliveryFailed =
          !isTerminal &&
          ((order.status === 'delivering' && ['admin', 'manager', 'staff', 'rider'].includes(canonicalActor)) ||
            (order.status === 'delivered' && !isPaidStatus(payStatus) && ['admin', 'manager', 'rider'].includes(canonicalActor)) ||
            (order.status === 'served' && !isPaidStatus(payStatus) && ['admin', 'manager'].includes(canonicalActor)));
        const hasMetaBadges = Boolean(order.shipperName || (order.status === 'failed' && order.failureReason));
        return {
          ...mapAdminOrder(order, actorRole, t),
          additionalActions:
            canShowPayosQr || unpaidCod || hasRefundAction || canAssignShipper || canMarkDeliveryFailed || hasMetaBadges ? (
              <div className="inline-flex flex-wrap items-center gap-2">
                {order.shipperName && (
                  <span
                    data-testid={`shipper-badge-${order.id}`}
                    className="rounded bg-indigo-500/20 border border-indigo-400/30 px-2 py-0.5 text-[11px] font-medium text-indigo-200"
                  >
                    Shipper: {order.shipperName}
                  </span>
                )}
                {order.status === 'failed' && order.failureReason && (
                  <span
                    data-testid={`failure-reason-badge-${order.id}`}
                    className="rounded bg-red-500/20 border border-red-400/30 px-2 py-0.5 text-[11px] font-medium text-red-200"
                  >
                    Thất bại: {order.failureReason}
                  </span>
                )}
                {canAssignShipper && (
                  <button
                    type="button"
                    data-testid={`assign-shipper-${order.id}`}
                    onClick={() => {
                      setAssignShipperTarget(order);
                      setSelectedShipperId(order.assignedShipperId || '');
                      setCustomShipperName(order.shipperName || '');
                    }}
                    className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 cursor-pointer"
                  >
                    {order.shipperName ? 'Đổi Shipper' : 'Gán Shipper'}
                  </button>
                )}
                {canMarkDeliveryFailed && (
                  <button
                    type="button"
                    data-testid={`mark-delivery-failed-${order.id}`}
                    onClick={() => {
                      setFailTarget(order);
                      setFailureReasonInput('');
                    }}
                    className="rounded-md bg-rose-600/85 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer"
                  >
                    Giao thất bại
                  </button>
                )}
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
          : normalized === 'dispatch' || normalized === 'delivering'
            ? 'delivering'
            : normalized === 'deliver'
              ? 'delivered'
              : normalized === 'complete'
                ? 'completed'
                : normalized === 'cancel'
                  ? 'cancelled'
                  : normalized;
      if (!VALID_STATUSES.has(targetStatus)) return;
      if (targetStatus === 'served' || targetStatus === 'delivered' || targetStatus === 'completed') {
        const targetOrder = orders.find((o) => o.id === orderId);
        if (
          targetOrder &&
          isCodMethod(targetOrder) &&
          !isPaidStatus(getPaymentStatus(targetOrder))
        ) {
          setActionError('Đơn tiền mặt/COD chưa thu tiền. Vui lòng bấm "Thu tiền COD" trước khi phục vụ/hoàn tất đơn.');
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
      orderNumber: found.orderNumber,
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
                {t('orderMgmt.detailsModalTitle')} — {detailsOrder.orderNumber ? `#${detailsOrder.orderNumber.replace(/^#/, '')} (${detailsOrder.id})` : detailsOrder.id}
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
              {(detailsOrder.tableNumber || detailsOrder.tableId) && (
                <p><strong>{t('orderMgmt.searchField.table')}:</strong> {detailsOrder.tableNumber || detailsOrder.tableId}</p>
              )}
              {detailsOrder.deliveryTime && detailsOrder.deliveryTime !== 'now' && (
                <p><strong>{t('orderMgmt.deliveryTimeLabel')}:</strong> {detailsOrder.deliveryTime}</p>
              )}
              {detailsOrder.shipperName && (
                <p><strong>{t('orderMgmt.shipperLabel', { defaultValue: 'Shipper' })}:</strong> {detailsOrder.shipperName}</p>
              )}
              <p>
                <strong>{t('orderMgmt.statusColumn')}:</strong>{' '}
                {t(`orderMgmt.${normalizeOrderStatus(detailsOrder.status)}`, { defaultValue: detailsOrder.status })}
                {detailsOrder.isHeldOutOfKds ? ` — ${t('orderMgmt.heldOutOfKds', { defaultValue: 'Đang giữ khỏi KDS (chờ thanh toán)' })}` : ''}
              </p>
              {(detailsOrder.startedAt || detailsOrder.readyAt || detailsOrder.cancelledAt) && (
                <p className="text-xs text-white/65">
                  {detailsOrder.startedAt ? `${t('kds.preparing', { defaultValue: 'Bắt đầu' })}: ${formatCreatedTime(detailsOrder.startedAt)} ` : ''}
                  {detailsOrder.readyAt ? `· ${t('kds.ready', { defaultValue: 'Sẵn sàng' })}: ${formatCreatedTime(detailsOrder.readyAt)} ` : ''}
                  {detailsOrder.cancelledAt ? `· ${t('orderMgmt.cancelled', { defaultValue: 'Đã hủy' })}: ${formatCreatedTime(detailsOrder.cancelledAt)}` : ''}
                </p>
              )}
              {(detailsOrder.cancelledReason || detailsOrder.failureReason) && (
                <p className="text-red-300">
                  <strong>{t('orderMgmt.cancelReasonLabel')}:</strong> {detailsOrder.cancelledReason || detailsOrder.failureReason}
                </p>
              )}
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

      {/* Assign Shipper Modal (#226) */}
      {assignShipperTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Gán Shipper giao hàng"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0A1A2E] p-6 text-white shadow-2xl space-y-3">
            <h2 className="text-lg font-semibold">
              Gán Shipper — {assignShipperTarget.orderNumber || assignShipperTarget.id}
            </h2>
            {shipperOptions.length > 0 && (
              <div>
                <label htmlFor="assign-shipper-select" className="mb-1 block text-xs text-white/70">
                  Chọn nhân viên giao hàng (cửa hàng hiện tại)
                </label>
                <select
                  id="assign-shipper-select"
                  data-testid="assign-shipper-select"
                  value={selectedShipperId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setSelectedShipperId(nextId);
                    const found = shipperOptions.find((s) => s.id === nextId);
                    if (found) setCustomShipperName(found.name);
                  }}
                  className="w-full rounded-lg border border-white/15 bg-[#0c1c30] p-2.5 text-sm text-white outline-none focus:border-indigo-400"
                >
                  <option value="">-- Chọn tài khoản shipper / nhân viên --</option>
                  {shipperOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.name} ({opt.role})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label htmlFor="assign-shipper-name-input" className="mb-1 block text-xs text-white/70">
                Tên người giao hiển thị
              </label>
              <input
                id="assign-shipper-name-input"
                type="text"
                data-testid="assign-shipper-name-input"
                value={customShipperName}
                onChange={(e) => setCustomShipperName(e.target.value)}
                placeholder="Nhập tên shipper..."
                className="w-full rounded-lg border border-white/15 bg-white/5 p-2.5 text-sm text-white outline-none focus:border-indigo-400"
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={isSavingShipper}
                onClick={() => {
                  setAssignShipperTarget(null);
                  setSelectedShipperId('');
                  setCustomShipperName('');
                }}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold hover:bg-white/10"
              >
                {t('orderMgmt.close', { defaultValue: 'Đóng' })}
              </button>
              <button
                type="button"
                data-testid="confirm-assign-shipper-btn"
                disabled={isSavingShipper || (!selectedShipperId.trim() && !customShipperName.trim())}
                onClick={() => { void handleConfirmAssignShipper(); }}
                className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-40"
              >
                {isSavingShipper ? 'Đang lưu...' : (assignShipperTarget.status === 'ready' ? 'Gán & Xuất giao' : 'Lưu Shipper')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mark Delivery Failed Modal (#226) */}
      {failTarget && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Báo giao hàng thất bại"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0A1A2E] p-6 text-white shadow-2xl">
            <h2 className="mb-2 text-lg font-semibold">
              Báo giao thất bại — {failTarget.orderNumber || failTarget.id}
            </h2>
            <p className="mb-3 text-xs text-amber-200/90">
              {isPaidStatus(getPaymentStatus(failTarget))
                ? 'Đơn đã thanh toán trước sẽ giữ trạng thái đã thu tiền kèm đánh dấu cần hoàn tiền để quản lý xử lý hoàn tiền.'
                : 'Đơn COD chưa thu tiền sẽ được đóng ở trạng thái thất bại và ghi nhận hao hụt kho nếu đã pha chế.'}
            </p>
            <label htmlFor="delivery-failure-reason-input" className="mb-1 block text-xs text-white/70">
              Lý do giao thất bại (bắt buộc)
            </label>
            <textarea
              id="delivery-failure-reason-input"
              data-testid="delivery-failure-reason-input"
              value={failureReasonInput}
              onChange={(e) => setFailureReasonInput(e.target.value)}
              rows={3}
              placeholder="VD: Khách không nghe máy / từ chối nhận hàng..."
              className="w-full rounded-lg border border-white/15 bg-white/5 p-2.5 text-sm text-white outline-none focus:border-rose-400"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={isMarkingFailed}
                onClick={() => {
                  setFailTarget(null);
                  setFailureReasonInput('');
                }}
                className="rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold hover:bg-white/10"
              >
                {t('orderMgmt.close', { defaultValue: 'Đóng' })}
              </button>
              <button
                type="button"
                data-testid="confirm-delivery-failed-btn"
                disabled={isMarkingFailed || !failureReasonInput.trim()}
                onClick={() => { void handleConfirmDeliveryFailed(); }}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-40"
              >
                {isMarkingFailed ? 'Đang cập nhật...' : 'Xác nhận giao thất bại'}
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
