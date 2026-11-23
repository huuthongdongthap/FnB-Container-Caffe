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
  fetchSummary: () => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<boolean>;
  cancelOrder: (orderId: string, reason: string) => Promise<boolean>;
  updateOrderDetails: (orderId: string, patch: { notes?: string; delivery_time?: string }) => Promise<boolean>;
  clearMutationError: () => void;
}

function normalizeAdminOrder(raw: Record<string, unknown>): AdminOrder {
  if (
    typeof raw.customer === 'string' &&
    typeof raw.items === 'number' &&
    typeof raw.payment === 'string' &&
    typeof raw.createdAt === 'string'
  ) {
    return raw as unknown as AdminOrder;
  }
  let itemsCount = 1;
  let itemsList: Array<{ name: string; quantity: number; notes?: string; modifiers?: string[] }> | undefined;
  const extractItems = (arr: unknown[]) =>
    arr.map((entry) => {
      const it = (entry ?? {}) as Record<string, unknown>;
      const rawMods = Array.isArray(it.modifiers)
        ? it.modifiers.map((m) => (typeof m === 'string' ? m : String((m as Record<string, unknown>)?.name ?? ''))).filter(Boolean)
        : undefined;
      return {
        name: String(it.name ?? it.product_name ?? it.title ?? 'Item'),
        quantity: typeof it.quantity === 'number' ? it.quantity : typeof it.qty === 'number' ? it.qty : 1,
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
  return {
    ...(raw as unknown as AdminOrder),
    id: String(raw.id ?? ''),
    customer: String(raw.customer ?? raw.customerName ?? raw.customer_name ?? 'Guest'),
    customerPhone: typeof raw.customerPhone === 'string' ? raw.customerPhone : typeof raw.customer_phone === 'string' ? raw.customer_phone : undefined,
    customerAddress: typeof raw.customerAddress === 'string' ? raw.customerAddress : typeof raw.customer_address === 'string' ? raw.customer_address : undefined,
    orderType: typeof raw.orderType === 'string' ? raw.orderType : typeof raw.order_type === 'string' ? raw.order_type : undefined,
    tableId: typeof raw.tableId === 'string' ? raw.tableId : typeof raw.table_id === 'string' ? raw.table_id : undefined,
    tableNumber: typeof raw.tableNumber === 'string' ? raw.tableNumber : typeof raw.table_number === 'string' ? raw.table_number : undefined,
    tableZone: typeof raw.tableZone === 'string' ? raw.tableZone : typeof raw.table_zone === 'string' ? raw.table_zone : undefined,
    paymentMethod: typeof raw.paymentMethod === 'string' ? raw.paymentMethod : typeof raw.payment_method === 'string' ? raw.payment_method : undefined,
    paymentStatus: typeof raw.paymentStatus === 'string' ? raw.paymentStatus : typeof raw.payment_status === 'string' ? raw.payment_status : undefined,
    notes: typeof raw.notes === 'string' ? raw.notes : undefined,
    deliveryTime: typeof raw.deliveryTime === 'string' ? raw.deliveryTime : typeof raw.delivery_time === 'string' ? raw.delivery_time : undefined,
    items: itemsCount,
    ...(itemsList ? { itemsList } : {}),
    total: Number(raw.total ?? 0),
    status: String(raw.status ?? 'pending'),
    payment: String(raw.payment ?? raw.paymentMethod ?? raw.payment_method ?? 'cash'),
    createdAt: String(raw.createdAt ?? raw.created_at ?? ''),
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

  fetchSummary: async () => {
    try {
      const body = await apiFetch<{
        success?: boolean;
        data?: {
          totalOrders?: number;
          total?: number;
          ordersByStatus?: Record<string, number>;
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
      }>('/api/orders/summary');
      const payload = body?.data ?? body;
      const byStatus = payload?.ordersByStatus ?? payload?.by_status ?? payload?.byStatus ?? payload?.statusCounts ?? {};
      const total = typeof payload?.totalOrders === 'number'
        ? payload.totalOrders
        : typeof payload?.total === 'number'
          ? payload.total
          : Object.values(byStatus).reduce((sum, n) => sum + (Number(n) || 0), 0);
      set({
        summary: {
          total,
          byStatus,
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
