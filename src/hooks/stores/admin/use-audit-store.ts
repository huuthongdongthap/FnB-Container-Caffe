import { create } from 'zustand';
import { apiFetch } from '@/lib/api-client';


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
    const { filters } = get();
    set({ loading: true, error: null });

    try {
      const params = new URLSearchParams();
      params.set('page', String(filters.page));
      params.set('page_size', String(filters.pageSize));
      if (filters.actorId) params.set('actor_id', filters.actorId);
      if (filters.action) params.set('action', filters.action);
      if (filters.resourceType) params.set('resource_type', filters.resourceType);
      if (filters.dateFrom) params.set('date_from', filters.dateFrom);
      if (filters.dateTo) params.set('date_to', filters.dateTo);

      const body = await apiFetch<any>(`/api/admin/audit-logs?${params}`);
      set({
        entries: body.rows || [],
        total: body.total ?? body.rows?.length ?? 0,
        loading: false,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ loading: false, error: message });
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
