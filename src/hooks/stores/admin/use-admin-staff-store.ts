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

export const useAdminStaffStore = create<AdminStaffState>((set, get) => ({
  staff: [],
  loading: false,
  error: null,

  fetchStaff: async () => {
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<any>('/api/auth/staff');
      set({
        staff: Array.isArray(body) ? body : body.staff || [],
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
