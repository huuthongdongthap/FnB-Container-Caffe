import { create } from 'zustand';
import { useAuthStore } from '@/hooks/stores/use-auth-store';

const API_BASE = import.meta.env.VITE_API_BASE || 'https://aura-space-worker.agencyos-openclaw.workers.dev';

/* ── Types ─────────────────────────────────────────────────────── */

export interface AuditEntry {
  id: string;
  actorId: string;
  actorName: string;
  action: string;
  resourceType: string;
  resourceId: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditFilters {
  actorId: string;
  action: string;
  resourceType: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
}

const DEFAULT_FILTERS: AuditFilters = {
  actorId: '',
  action: '',
  resourceType: '',
  dateFrom: '',
  dateTo: '',
  page: 1,
  pageSize: 50,
};

/* ── Store ─────────────────────────────────────────────────────── */

interface AuditStoreState {
  entries: AuditEntry[];
  total: number;
  loading: boolean;
  error: string | null;
  filters: AuditFilters;

  fetchLogs: () => Promise<void>;
  setFilter: <K extends keyof AuditFilters>(field: K, value: AuditFilters[K]) => Promise<void>;
  resetFilters: () => Promise<void>;
}

export const useAuditStore = create<AuditStoreState>((set, get) => ({
  entries: [],
  total: 0,
  loading: false,
  error: null,
  filters: { ...DEFAULT_FILTERS },

  fetchLogs: async () => {
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: 'Chưa đăng nhập', loading: false });
      return;
    }

    const { filters } = get();
    set({ loading: true, error: null });

    try {
      const params = new URLSearchParams();
      params.set('page', String(filters.page));
      params.set('pageSize', String(filters.pageSize));
      if (filters.actorId) params.set('actorId', filters.actorId);
      if (filters.action) params.set('action', filters.action);
      if (filters.resourceType) params.set('resourceType', filters.resourceType);
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params.set('dateTo', filters.dateTo);

      const res = await fetch(`${API_BASE}/api/admin/audit-logs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ loading: false, error: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({ loading: false, error: body.message || 'Không thể tải nhật ký kiểm toán' });
        return;
      }

      const body = await res.json();
      set({
        entries: body.entries || [],
        total: body.total ?? body.entries?.length ?? 0,
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },

  setFilter: async <K extends keyof AuditFilters>(field: K, value: AuditFilters[K]) => {
    set((state) => ({
      filters: {
        ...state.filters,
        [field]: value,
        page: field === 'page' ? (value as number) : 1,
      },
    }));
    await get().fetchLogs();
  },

  resetFilters: async () => {
    set({ filters: { ...DEFAULT_FILTERS } });
    await get().fetchLogs();
  },
}));
