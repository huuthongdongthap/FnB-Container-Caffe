import { createPrivateStore as create } from '@/lib/create-private-store';
import type { AdminOrder } from '@/hooks/use-admin';
import { apiFetch } from '@/lib/api-client';
import { readClientSession } from '@/lib/client-session';


export interface OrderFilters {
  status?: string;
  payment?: string;
  search?: string;
}

interface AdminOrdersState {
  orders: AdminOrder[];
  totalCount: number;
  page: number;
  pageSize: number;
  activeFilters: OrderFilters;
  loading: boolean;
  error: string | null;
  fetchOrders: (page?: number, filters?: OrderFilters, pageSize?: number) => Promise<void>;
  updateOrderStatus: (orderId: string, status: string) => Promise<void>;
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
  let itemsList: Array<{ name: string; quantity: number }> | undefined;
  const extractItems = (arr: unknown[]) =>
    arr.map((entry) => {
      const it = (entry ?? {}) as Record<string, unknown>;
      return {
        name: String(it.name ?? it.product_name ?? it.title ?? 'Item'),
        quantity: typeof it.quantity === 'number' ? it.quantity : typeof it.qty === 'number' ? it.qty : 1,
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
    items: itemsCount,
    ...(itemsList ? { itemsList } : {}),
    total: Number(raw.total ?? 0),
    status: String(raw.status ?? 'pending'),
    payment: String(raw.payment ?? raw.paymentMethod ?? raw.payment_method ?? raw.payment_status ?? 'cash'),
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
      if (resolvedFilters.status) params.set('status', resolvedFilters.status);
      if (resolvedFilters.payment) params.set('payment_status', resolvedFilters.payment);
      if (resolvedFilters.search) params.set('search', resolvedFilters.search);

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

  updateOrderStatus: async (orderId, status) => {
    const session = readClientSession().token;
    try {
      try {
        await apiFetch<Record<string, unknown>>(`/api/orders/${orderId}`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
      } catch (error) {
        if (session !== readClientSession().token) throw error;
        await apiFetch<Record<string, unknown>>(`/api/orders/${orderId}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ status }),
        });
      }
      await get().fetchOrders(get().page, get().activeFilters, get().pageSize);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ error: message });
    }
  },
}));
