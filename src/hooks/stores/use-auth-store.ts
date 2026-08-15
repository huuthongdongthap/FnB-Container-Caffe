import { create } from 'zustand';
import { apiFetch } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   Auth store — httpOnly cookie auth (no token in client).
   Backend sets access_token cookie on login/register.
   Pattern: matches use-cart-store.ts — manual state, no middleware.
   ═══════════════════════════════════════════════════════════════════ */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'staff' | 'owner';
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      // Backend sets httpOnly cookie — just fetch the user
      await get().fetchMe();
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  register: async (name, email, phone, password) => {
    set({ loading: true, error: null });
    try {
      await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, password }),
      });
      // Backend sets httpOnly cookie — just fetch the user
      await get().fetchMe();
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  logout: async () => {
    // Hit backend to clear httpOnly cookie, then clear client state
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    } catch { /* best-effort */ }
    set({ user: null, loading: false, error: null });
  },

  fetchMe: async () => {
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<{ user: AuthUser }>('/api/auth/me');
      set({ user: body.user, loading: false, error: null });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error', user: null });
    }
  },

  clearError: () => set({ error: null }),
}));
