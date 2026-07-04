import { create } from 'zustand';
import { useAuthStore } from '@/hooks/stores/use-auth-store';
import { API_BASE } from '@/lib/api-client';


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
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: 'Chưa đăng nhập', loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/auth/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ loading: false, error: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({ loading: false, error: body.message || 'Không thể tải danh sách nhân viên' });
        return;
      }

      const body = await res.json();
      set({
        staff: Array.isArray(body) ? body : body.staff || [],
        loading: false,
        error: null,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },

  registerStaff: async (data) => {
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ error: 'Chưa đăng nhập' });
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/register-staff`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (res.status === 401) {
        useAuthStore.getState().logout();
        set({ error: 'Phiên đăng nhập hết hạn' });
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        set({ error: body.message || 'Không thể thêm nhân viên' });
        return;
      }

      // Refresh staff list after successful registration
      set({ error: null });
      await get().fetchStaff();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Lỗi kết nối' });
    }
  },
}));
