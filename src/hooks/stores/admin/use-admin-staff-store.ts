import { createPrivateStore as create } from '@/lib/create-private-store';
import { apiFetch } from '@/lib/api-client';
import { readClientSession, subscribeClientSession } from '@/lib/client-session';

// A slow refetch from an earlier save must not replace a newer server snapshot.
let staffFetchVersion = 0;
let staffSessionGeneration = 0;

export interface StaffMember {
  id: string;
  name: string;
  role: string;
  phone: string;
  email: string;
  isActive: boolean;
  startedAt: string;
}

export interface RegisterStaffPayload {
  name: string;
  role: string;
  phone: string;
  email: string;
  password: string;
}

interface AdminStaffState {
  staff: StaffMember[];
  loading: boolean;
  error: string | null;
  /** Staff ids with a save in flight. Guards against a second toggle winning the race. */
  pendingToggles: Set<string>;
  fetchStaff: (settledId?: string) => Promise<void>;
  registerStaff: (data: RegisterStaffPayload) => Promise<void>;
  toggleStaffActive: (id: string) => Promise<void>;
}

function normalizeStaffMember(raw: Record<string, unknown>): StaffMember {
  if (typeof raw.isActive === 'boolean' && typeof raw.startedAt === 'string') {
    return raw as unknown as StaffMember;
  }
  const isActive =
    typeof raw.isActive === 'boolean'
      ? raw.isActive
      : raw.active !== undefined
        ? Boolean(raw.active)
        : raw.is_active !== undefined
          ? Boolean(raw.is_active)
          : true;
  const startedAt = String(raw.startedAt ?? raw.created_at ?? raw.hire_date ?? raw.createdAt ?? '');
  return {
    ...(raw as unknown as StaffMember),
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    role: String(raw.position ?? raw.role ?? 'staff'),
    phone: String(raw.phone ?? ''),
    email: String(raw.email ?? ''),
    isActive,
    startedAt,
  };
}

export const useAdminStaffStore = create<AdminStaffState>((set, get) => ({
  staff: [],
  loading: false,
  error: null,
  pendingToggles: new Set<string>(),

  fetchStaff: async (settledId) => {
    const version = ++staffFetchVersion;
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<any>('/api/auth/staff');
      if (version !== staffFetchVersion) return;
      const rawList: Array<Record<string, unknown>> = Array.isArray(body)
        ? body
        : body?.staff || body?.users || body?.data?.staff || [];
      const current = get();
      set({
        staff: rawList.map(normalizeStaffMember).map(member => {
          const pending = current.staff.find(saved => saved.id === member.id);
          return member.id !== settledId && current.pendingToggles.has(member.id) && pending
            ? { ...member, isActive: pending.isActive } : member;
        }),
        loading: false,
        error: null,
      });
    } catch (err) {
      if (version !== staffFetchVersion) return;
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ loading: false, error: message });
    }
  },

  registerStaff: async (data) => {
    try {
      await apiFetch<any>('/api/auth/register-staff', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      set({ error: null });
      await get().fetchStaff();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      set({ error: message });
      throw err instanceof Error ? err : new Error(message);
    }
  },

  toggleStaffActive: async (id: string) => {
    const generation = staffSessionGeneration;
    // One in-flight save per staff member. A second toggle for the same id would
    // otherwise apply its optimistic flip on top of an unconfirmed state.
    if (get().pendingToggles.has(id)) return;

    const target = get().staff.find((s) => s.id === id);
    if (!target) return;
    const previous = target.isActive;
    const nextActive = !previous;
    staffFetchVersion++;

    set((state) => ({
      staff: state.staff.map((s) => (s.id === id ? { ...s, isActive: nextActive } : s)),
      pendingToggles: new Set(state.pendingToggles).add(id),
    }));

    try {
      await apiFetch<any>(`/api/staff/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextActive, is_active: nextActive ? 1 : 0, active: nextActive }),
      });
      if (generation !== staffSessionGeneration) return;
      // Server state is authoritative only once the write has been accepted.
      await get().fetchStaff(id);
    } catch (err) {
      if (generation !== staffSessionGeneration) return;
      // The optimistic flip was never confirmed — undo it rather than leave the
      // list claiming a save that failed.
      const reverted = get().staff.map((s) => (s.id === id ? { ...s, isActive: previous } : s));
      set({ staff: reverted });
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      try {
        await get().fetchStaff(id);
      } catch {
        // Server state is unknown; keep the rolled-back snapshot rather than an
        // empty list, and let the write error be the reported cause.
        set({ staff: reverted });
      }
      // Set after refetch: fetchStaff clears error on success, which would
      // otherwise hide a write that genuinely failed.
      set({ error: message });
      throw err instanceof Error ? err : new Error(message);
    } finally {
      set((state) => {
        const next = new Set(state.pendingToggles);
        next.delete(id);
        return { pendingToggles: next };
      });
    }
  },
}));

if (typeof window !== 'undefined') {
  const identity = () => {
    const user = readClientSession().user;
    return `${user?.id || ''}:${user?.tenantId || ''}:${user?.role || ''}`;
  };
  let previous = identity();
  subscribeClientSession(() => {
    const next = identity();
    if (next === previous) return;
    previous = next;
    staffFetchVersion++;
    staffSessionGeneration++;
    useAdminStaffStore.setState({ staff: [], pendingToggles: new Set(), loading: false, error: null });
  });
}
