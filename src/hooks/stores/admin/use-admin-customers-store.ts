import { createPrivateStore as create } from '@/lib/create-private-store';
import type { AdminCustomer } from '@/hooks/use-admin';
import { apiFetch } from '@/lib/api-client';
import { confirmedRecord, createSubmissionKey, requireConfirmation, submissionError, submissionSession } from '@/lib/server-confirmed-submission';

export interface AdminCustomersPagination {
  page: number;
  limit: number;
  total: number;
  totalPages?: number;
}

interface AdminCustomersState {
  customers: AdminCustomer[];
  totalCount: number;
  pagination: AdminCustomersPagination | null;
  loading: boolean;
  pending: Record<string, boolean>;
  error: string | null;
  fetchCustomers: (page?: number, search?: string, tier?: string) => Promise<void>;
  addCustomer: (data: { name: string; phone: string; tier: string }, requestKey?: string) => Promise<boolean>;
  updateCustomer: (id: string, data: Partial<AdminCustomer>) => Promise<boolean>;
  deleteCustomer: (id: string) => Promise<boolean>;
}

function normalizeCustomer(raw: Record<string, unknown>): AdminCustomer {
  if (
    typeof raw.totalOrders === 'number' &&
    typeof raw.totalSpent === 'number' &&
    typeof raw.lastVisit === 'string'
  ) {
    return raw as unknown as AdminCustomer;
  }
  return {
    ...(raw as unknown as AdminCustomer),
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    phone: String(raw.phone ?? ''),
    tier: String(raw.tier ?? raw.loyalty_tier ?? 'bronze'),
    totalOrders: Number(raw.totalOrders ?? raw.visit_count ?? 0),
    totalSpent: Number(raw.totalSpent ?? raw.total_spent ?? 0),
    lastVisit: String(raw.lastVisit ?? raw.updated_at ?? raw.created_at ?? ''),
  };
}

export const useAdminCustomersStore = create<AdminCustomersState>((set, get) => {
  const createKey = createSubmissionKey();
  let readVersion = 0;
  let mutationVersion = 0;
  const mutate = async (entity: string, request: () => Promise<unknown>, apply: (body: unknown) => void) => {
    if (get().pending[entity]) return false;
    const session = submissionSession();
    mutationVersion++;
    set(state => ({ pending: { ...state.pending, [entity]: true }, error: null }));
    try {
      const body = await request();
      if (session !== submissionSession()) return false;
      apply(body);
      return true;
    } catch (error) {
      if (session === submissionSession()) set({ error: `Chưa xác nhận đã lưu. ${submissionError(error)}` });
      return false;
    } finally {
      if (session === submissionSession()) {
        mutationVersion++;
        set(state => ({ pending: { ...state.pending, [entity]: false }, loading: false }));
      }
    }
  };
  return {
    customers: [], totalCount: 0, pagination: null, loading: false, pending: {}, error: null,
    fetchCustomers: async (page = 1, search, tier) => {
      const read = ++readVersion;
      const mutation = mutationVersion;
      const session = submissionSession();
      set({ loading: true, error: null });
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (search) params.set('search', search);
        if (tier) params.set('tier', tier);
        const body = await apiFetch<any>(`/api/admin/customers?${params}`);
        if (session !== submissionSession() || read !== readVersion || mutation !== mutationVersion || Object.values(get().pending).some(Boolean)) return;
        const rawList = body?.data ?? body?.customers;
        if (body?.success === false || !Array.isArray(rawList)) throw new Error('Không thể tải danh sách khách hàng. Vui lòng thử lại.');
        const pagination = body.pagination ? {
          page: Number(body.pagination.page ?? page), limit: Number(body.pagination.limit ?? 50),
          total: Number(body.pagination.total ?? rawList.length),
          ...(body.pagination.totalPages !== undefined ? { totalPages: Number(body.pagination.totalPages) } : {}),
        } : null;
        set({ customers: rawList.map(normalizeCustomer), totalCount: pagination?.total ?? body.totalCount ?? rawList.length,
          pagination, loading: false, error: null });
      } catch (error) {
        if (session === submissionSession() && read === readVersion && mutation === mutationVersion) set({ loading: false, error: submissionError(error) });
      } finally {
        if (session === submissionSession() && read === readVersion) set({ loading: false });
      }
    },
    addCustomer: async (data, requestKey) => mutate('create', () => apiFetch('/api/admin/customers', {
      method: 'POST', body: JSON.stringify(data), headers: { 'Idempotency-Key': requestKey || createKey.forPayload(data) },
    }), body => {
      const raw = confirmedRecord(body);
      const customer = normalizeCustomer({ ...data, ...raw });
      set(state => ({ customers: [customer, ...state.customers.filter(item => item.id !== customer.id)],
        totalCount: state.totalCount + (state.customers.some(item => item.id === customer.id) ? 0 : 1) }));
      createKey.clear();
    }),
    updateCustomer: async (id, data) => mutate(id, () => apiFetch(`/api/admin/customers/${id}`, {
      method: 'PATCH', body: JSON.stringify(data),
    }), body => {
      const raw = confirmedRecord(body);
      if (raw.id !== id) throw new Error('Mã khách hàng trả về không khớp. Vui lòng tải lại.');
      set(state => ({ customers: state.customers.map(item => item.id === id ? normalizeCustomer({ ...item, ...data, ...raw, tier: raw.tier ?? raw.loyalty_tier ?? data.tier ?? item.tier }) : item) }));
    }),
    deleteCustomer: async id => mutate(id, () => apiFetch(`/api/admin/customers/${id}`, { method: 'DELETE' }), body => {
      requireConfirmation(body);
      set(state => ({ customers: state.customers.filter(item => item.id !== id), totalCount: Math.max(0, state.totalCount - 1) }));
    }),
  };
});
