import { createPrivateStore as create } from '@/lib/create-private-store';
import type { AdminOrder } from '@/hooks/use-admin';
import { apiFetch, ApiClientError } from '@/lib/api-client';
import { readClientSession } from '@/lib/client-session';

export type OrderSearchField =
  | 'all'
  | 'id'
  | 'customer_name'
  | 'customer_phone'
  | 'table'
  | 'item'
  | 'address'
  | 'notes';

export interface OrderFilters {
  status?: string;
  payment?: string;
  paymentMethod?: string;
  orderType?: string;
  search?: string;
  searchField?: OrderSearchField;
  dateFrom?: string;
  dateTo?: string;
}

export interface OrderSummaryData {
  total: number;
  byStatus: Record<string, number>;
  kdsByStatus?: Record<string, number>;
  heldOrdersCount?: number;
  avgLeadTimeMinutes?: number | null;
  todayRevenue?: number;
  completedToday?: number;
}

interface AdminOrdersState {
  orders: AdminOrder[];
  totalCount: number;
  page: number;
  pageSize: number;
  activeFilters: OrderFilters;
  loading: boolean;
  error: string | null;
  mutationError: string | null;
  summary: OrderSummaryData | null;
  fetchOrders: (page?: number, filters?: OrderFilters, pageSize?: number) => Promise<void>;
  fetchSummary: (filters?: OrderFilters) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<boolean>;
  cancelOrder: (orderId: string, reason: string) => Promise<boolean>;
  updateOrderDetails: (orderId: string, patch: { notes?: string; delivery_time?: string }) => Promise<boolean>;
  clearMutationError: () => void;
}

export function stripSystemOrderNotes(notes?: string | null): string | undefined {
  if (typeof notes !== 'string') return undefined;
  const cleaned = notes
    .replace(/\s*\|\s*\[OVERDUE\]/gi, '')
    .replace(/\[OVERDUE\]\s*\|\s*/gi, '')
    .replace(/\[OVERDUE\]/gi, '')
    .trim();
  return cleaned || undefined;
}

export function normalizeAdminOrder(raw: Record<string, unknown>): AdminOrder {
  if (
    typeof raw.customer === 'string' &&
    typeof raw.items === 'number' &&
    typeof raw.payment === 'string' &&
    typeof raw.createdAt === 'string'
  ) {
    return {
      ...(raw as unknown as AdminOrder),
      notes: stripSystemOrderNotes(typeof raw.notes === 'string' ? raw.notes : undefined),
    };
  }
  let itemsCount = 1;
  let itemsList: Array<{ name: string; quantity: number; price?: number; notes?: string; modifiers?: string[] }> | undefined;
  const extractItems = (arr: unknown[]) =>
    arr.map((entry) => {
      const it = (entry ?? {}) as Record<string, unknown>;
      const rawMods = Array.isArray(it.modifiers)
        ? it.modifiers.map((m) => (typeof m === 'string' ? m : String((m as Record<string, unknown>)?.name ?? ''))).filter(Boolean)
        : undefined;
      const rawPrice = it.price ?? it.unit_price ?? it.unitPrice;
      const parsedPrice =
        rawPrice !== undefined && rawPrice !== null && rawPrice !== '' && Number.isFinite(Number(rawPrice))
          ? Number(rawPrice)
          : undefined;
      return {
        name: String(it.name ?? it.product_name ?? it.title ?? 'Item'),
        quantity: typeof it.quantity === 'number' ? it.quantity : typeof it.qty === 'number' ? it.qty : 1,
        ...(parsedPrice !== undefined ? { price: parsedPrice } : {}),
        ...(typeof it.notes === 'string' && it.notes.trim() ? { notes: it.notes.trim() } : {}),
        ...(rawMods && rawMods.length > 0 ? { modifiers: rawMods } : {}),
      };
    });
  if (typeof raw.items === 'number') {
    itemsCount = raw.items;
  } else if (Array.isArray(raw.items)) {
    itemsList = extractItems(raw.items);
    itemsCount = itemsList.reduce((sum, it) => sum + it.quantity, 0) || raw.items.length;
  } else if (typeof raw.items === 'string' || typeof raw.items_json === 'string') {
    try {
      const parsed = JSON.parse(String(raw.items ?? raw.items_json));
      if (Array.isArray(parsed)) {
        itemsList = extractItems(parsed);
        itemsCount = itemsList.reduce((sum, it) => sum + it.quantity, 0) || parsed.length;
      }
    } catch {
      itemsCount = 1;
    }
  }
  const toOptionalNumber = (...vals: unknown[]): number | undefined => {
    for (const v of vals) {
      if (v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v))) {
        return Number(v);
      }
    }
    return undefined;
  };
  const toOptionalString = (...vals: unknown[]): string | undefined => {
    for (const v of vals) {
      if (typeof v === 'string' && v.trim()) {
        return v.trim();
      }
    }
    return undefined;
  };
  return {
    ...(raw as unknown as AdminOrder),
    id: String(raw.id ?? ''),
    orderNumber: toOptionalString(raw.orderNumber, raw.order_number),
    customer: String(raw.customer ?? raw.customerName ?? raw.customer_name ?? 'Guest'),
    customerPhone: toOptionalString(raw.customerPhone, raw.customer_phone),
    customerAddress: toOptionalString(raw.customerAddress, raw.customer_address),
    orderType: toOptionalString(raw.orderType, raw.order_type),
    tableId: toOptionalString(raw.tableId, raw.table_id),
    tableNumber: toOptionalString(raw.tableNumber, raw.table_number, raw.table_name),
    tableZone: toOptionalString(raw.tableZone, raw.table_zone),
    paymentMethod: toOptionalString(raw.paymentMethod, raw.payment_method),
    paymentStatus: toOptionalString(raw.paymentStatus, raw.payment_status),
    isCod: raw.isCod !== undefined ? (raw.isCod as number | boolean) : (raw.is_cod as number | boolean | undefined),
    isHeldOutOfKds:
      typeof raw.isHeldOutOfKds === 'boolean'
        ? raw.isHeldOutOfKds
        : typeof raw.is_held_out_of_kds === 'boolean'
          ? raw.is_held_out_of_kds
          : undefined,
    notes: stripSystemOrderNotes(typeof raw.notes === 'string' ? raw.notes : undefined),
    deliveryTime: toOptionalString(raw.deliveryTime, raw.delivery_time),
    startedAt: toOptionalString(raw.startedAt, raw.started_at),
    readyAt: toOptionalString(raw.readyAt, raw.ready_at),
    servedAt: toOptionalString(raw.servedAt, raw.served_at),
    cancelledAt: toOptionalString(raw.cancelledAt, raw.cancelled_at),
    cancelledReason: toOptionalString(raw.cancelledReason, raw.cancelled_reason),
    assignedShipperId: toOptionalString(raw.assignedShipperId, raw.assigned_shipper_id),
    shipperName: toOptionalString(raw.shipperName, raw.shipper_name),
    failureReason: toOptionalString(raw.failureReason, raw.failure_reason),
    items: itemsCount,
    ...(itemsList ? { itemsList } : {}),
    subtotal: toOptionalNumber(raw.subtotal),
    shippingFee: toOptionalNumber(raw.shippingFee, raw.shipping_fee),
    discount: toOptionalNumber(raw.discount),
    serviceFee: toOptionalNumber(raw.serviceFee, raw.service_fee),
    cashbackUsed: toOptionalNumber(raw.cashbackUsed, raw.cashback_used),
    total: Number(raw.total ?? 0),
    status: String(raw.status ?? 'pending'),
    payment: String(raw.payment ?? raw.paymentMethod ?? raw.payment_method ?? 'cash'),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
    pendingLoyaltyReversal: Boolean(raw.pendingLoyaltyReversal ?? raw.pending_loyalty_reversal),
    pendingLoyaltyTransferRef:
      typeof raw.pendingLoyaltyTransferRef === 'string'
        ? raw.pendingLoyaltyTransferRef
        : typeof raw.pending_loyalty_transfer_ref === 'string'
          ? raw.pending_loyalty_transfer_ref
          : undefined,
    pendingLoyaltyRefundAmount: toOptionalNumber(raw.pendingLoyaltyRefundAmount, raw.pending_loyalty_refund_amount),
  };
}

let latestAdminOrdersRequestId = 0;

export const useAdminOrdersStore = create<AdminOrdersState>((set, get) => ({
  orders: [],
  totalCount: 0,
  page: 1,
  pageSize: 12,
  activeFilters: {},
  loading: false,
  error: null,
  mutationError: null,
  summary: null,

  clearMutationError: () => set({ mutationError: null }),

  fetchOrders: async (page = 1, filters?: OrderFilters, pageSize?: number) => {
    const requestId = ++latestAdminOrdersRequestId;
    const resolvedPage = Math.max(1, Math.floor(page));
    const resolvedPageSize = Math.max(1, Math.min(200, Math.floor(pageSize ?? get().pageSize ?? 12)));
    const resolvedFilters: OrderFilters = filters ?? {};
    const offset = (resolvedPage - 1) * resolvedPageSize;

    set({
      loading: true,
      error: null,
      page: resolvedPage,
      pageSize: resolvedPageSize,
      activeFilters: resolvedFilters,
    });
    try {
      const params = new URLSearchParams({
        page: String(resolvedPage),
        limit: String(resolvedPageSize),
        offset: String(offset),
      });
      if (resolvedFilters.status && resolvedFilters.status !== 'all') params.set('status', resolvedFilters.status);
      if (resolvedFilters.payment && resolvedFilters.payment !== 'all') params.set('payment_status', resolvedFilters.payment);
      if (resolvedFilters.paymentMethod && resolvedFilters.paymentMethod !== 'all') params.set('payment_method', resolvedFilters.paymentMethod);
      if (resolvedFilters.orderType && resolvedFilters.orderType !== 'all') params.set('order_type', resolvedFilters.orderType);
      if (resolvedFilters.search) {
        params.set('search', resolvedFilters.search);
        if (resolvedFilters.searchField && resolvedFilters.searchField !== 'all') {
          params.set('search_field', resolvedFilters.searchField);
        }
      }
      if (resolvedFilters.dateFrom) params.set('dateFrom', resolvedFilters.dateFrom);
      if (resolvedFilters.dateTo) params.set('dateTo', resolvedFilters.dateTo);

      const body = await apiFetch<{
        orders?: Array<Record<string, unknown>>;
        data?: Array<Record<string, unknown>>;
        totalCount?: number;
        pagination?: { total?: number; limit?: number; offset?: number };
      }>(`/api/admin/orders?${params}`);
      if (requestId !== latestAdminOrdersRequestId) return;

      const rawOrders: Array<Record<string, unknown>> = body?.orders || body?.data || [];
      set({
        orders: rawOrders.map(normalizeAdminOrder),
        totalCount: body?.totalCount ?? body?.pagination?.total ?? rawOrders.length ?? 0,
        page: resolvedPage,
        pageSize: resolvedPageSize,
        loading: false,
        error: null,
      });
    } catch (err) {
      if (requestId !== latestAdminOrdersRequestId) return;
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ loading: false, error: message });
    }
  },

  fetchSummary: async (filters?: OrderFilters) => {
    try {
      const effectiveFilters = filters ?? get().activeFilters;
      const summaryParams = new URLSearchParams();
      if (effectiveFilters?.orderType && effectiveFilters.orderType !== 'all') {
        summaryParams.set('order_type', effectiveFilters.orderType);
      }
      if (effectiveFilters?.dateFrom) summaryParams.set('dateFrom', effectiveFilters.dateFrom);
      if (effectiveFilters?.dateTo) summaryParams.set('dateTo', effectiveFilters.dateTo);
      if (effectiveFilters?.search) summaryParams.set('search', effectiveFilters.search);
      const qs = summaryParams.toString();
      const body = await apiFetch<{
        success?: boolean;
        data?: {
          totalOrders?: number;
          total?: number;
          ordersByStatus?: Record<string, number>;
          kdsByStatus?: Record<string, number>;
          heldOrdersCount?: number;
          by_status?: Record<string, number>;
          byStatus?: Record<string, number>;
          statusCounts?: Record<string, number>;
          avg_lead_time_minutes?: number | null;
          avgLeadTimeMinutes?: number | null;
          totalRevenue?: number;
          today_revenue?: number;
          todayRevenue?: number;
          completed_today?: number;
          completedToday?: number;
        };
        totalOrders?: number;
        total?: number;
        ordersByStatus?: Record<string, number>;
        kdsByStatus?: Record<string, number>;
        heldOrdersCount?: number;
        by_status?: Record<string, number>;
        byStatus?: Record<string, number>;
        statusCounts?: Record<string, number>;
        avg_lead_time_minutes?: number | null;
        avgLeadTimeMinutes?: number | null;
        totalRevenue?: number;
        today_revenue?: number;
        todayRevenue?: number;
        completed_today?: number;
        completedToday?: number;
      }>(`/api/orders/summary${qs ? `?${qs}` : ''}`);
      const payload = body?.data ?? body;
      const byStatus = payload?.ordersByStatus ?? payload?.by_status ?? payload?.byStatus ?? payload?.statusCounts ?? {};
      const kdsByStatus = payload?.kdsByStatus;
      const total = typeof payload?.totalOrders === 'number'
        ? payload.totalOrders
        : typeof payload?.total === 'number'
          ? payload.total
          : Object.values(byStatus).reduce((sum, n) => sum + (Number(n) || 0), 0);
      set({
        summary: {
          total,
          byStatus,
          ...(kdsByStatus ? { kdsByStatus } : {}),
          ...(typeof payload?.heldOrdersCount === 'number' ? { heldOrdersCount: payload.heldOrdersCount } : {}),
          avgLeadTimeMinutes: payload?.avg_lead_time_minutes ?? payload?.avgLeadTimeMinutes ?? null,
          todayRevenue: payload?.totalRevenue ?? payload?.today_revenue ?? payload?.todayRevenue,
          completedToday: payload?.completed_today ?? payload?.completedToday,
        },
      });
    } catch {
      // Non-fatal: summary fallback uses current orders when unavailable
    }
  },

  updateOrderStatus: async (orderId, status) => {
    const session = readClientSession().token;
    set({ mutationError: null });
    try {
      try {
        await apiFetch<Record<string, unknown>>(`/api/orders/${orderId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
      } catch (error) {
        if (session !== readClientSession().token) throw error;
        const errStatus = error instanceof ApiClientError
          ? error.status
          : (error && typeof error === 'object' && 'status' in error ? Number((error as { status?: unknown }).status) : undefined);
        // Never blindly retry deterministic 400/403/409/422 business/RBAC errors
        if (errStatus && [400, 403, 409, 422].includes(errStatus)) {
          throw error;
        }
        await apiFetch<Record<string, unknown>>(`/api/orders/${orderId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
      }
      await Promise.all([
        get().fetchOrders(get().page, get().activeFilters, get().pageSize),
        get().fetchSummary(),
      ]);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ mutationError: message });
      return false;
    }
  },

  cancelOrder: async (orderId, reason) => {
    set({ mutationError: null });
    try {
      await apiFetch<Record<string, unknown>>(`/api/orders/${orderId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.trim() }),
      });
      await Promise.all([
        get().fetchOrders(get().page, get().activeFilters, get().pageSize),
        get().fetchSummary(),
      ]);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ mutationError: message });
      return false;
    }
  },

  updateOrderDetails: async (orderId, patch) => {
    set({ mutationError: null });
    try {
      await apiFetch<Record<string, unknown>>(`/api/orders/${orderId}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      await get().fetchOrders(get().page, get().activeFilters, get().pageSize);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ mutationError: message });
      return false;
    }
  },
}));
