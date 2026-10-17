import { create } from 'zustand';
import { apiFetch } from '@/lib/api-client';


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
  fetchStaff: () => Promise<void>;
  registerStaff: (data: RegisterStaffPayload) => Promise<void>;
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

  fetchStaff: async () => {
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<any>('/api/auth/staff');
      const rawList: Array<Record<string, unknown>> = Array.isArray(body)
        ? body
        : body?.staff || body?.users || body?.data?.staff || [];
      set({
        staff: rawList.map(normalizeStaffMember),
        loading: false,
        error: null,
      });
    } catch (err) {
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
    }
  },
}));
