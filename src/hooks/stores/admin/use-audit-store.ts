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

function normalizeAuditEntry(raw: Record<string, unknown>): AuditEntry {
  if (
    typeof raw.actorId === 'string' &&
    typeof raw.resourceType === 'string' &&
    typeof raw.createdAt === 'string'
  ) {
    return raw as unknown as AuditEntry;
  }
  const rawActorId = String(raw.actorId ?? raw.actor_id ?? '');
  const actorId =
    rawActorId && rawActorId !== 'system'
      ? rawActorId
      : String(raw.user_id ?? (rawActorId || 'system'));
  const actorName = String(raw.actorName ?? raw.actor_name ?? actorId);
  const rawResourceType = String(raw.resourceType ?? raw.resource_type ?? '');
  const resourceType =
    rawResourceType && rawResourceType !== 'system'
      ? rawResourceType
      : String(raw.entity_type ?? (rawResourceType || 'system'));
  const resourceId = String(raw.resourceId ?? raw.resource_id ?? raw.entity_id ?? '');
  const ipAddress =
    raw.ipAddress !== undefined
      ? (raw.ipAddress as string | null)
      : raw.ip_address !== undefined
        ? (raw.ip_address as string | null)
        : null;
  const createdAt = String(raw.createdAt ?? raw.created_at ?? '');

  let details: Record<string, unknown> | null = null;
  const rawDetails =
    raw.details !== undefined && raw.details !== '{}' && raw.details !== null
      ? raw.details
      : raw.metadata ?? raw.details ?? null;
  if (typeof rawDetails === 'string') {
    try {
      const parsed = JSON.parse(rawDetails);
      details = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : { value: rawDetails };
    } catch {
      details = rawDetails ? { value: rawDetails } : null;
    }
  } else if (rawDetails && typeof rawDetails === 'object') {
    details = rawDetails as Record<string, unknown>;
  }

  return {
    id: String(raw.id ?? ''),
    actorId,
    actorName,
    action: String(raw.action ?? ''),
    resourceType,
    resourceId,
    details,
    ipAddress,
    createdAt,
  };
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
      const rawRows: Array<Record<string, unknown>> = body?.rows || body?.data || [];
      set({
        entries: rawRows.map(normalizeAuditEntry),
        total: body?.total ?? rawRows.length ?? 0,
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
