import { create } from 'zustand';
import { API_BASE } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   Auth store — Zustand with localStorage persistence (aura_auth key).
   Pattern: matches use-cart-store.ts — manual localStorage, no middleware.
   ═══════════════════════════════════════════════════════════════════ */

const AUTH_KEY = 'aura_auth';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'staff' | 'owner';
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
  clearError: () => void;
}

interface StoredAuth {
  token: string;
  user: AuthUser;
}

function loadInitialAuth(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.token && parsed?.user) return parsed as StoredAuth;
    }
  } catch { /* ignore parse errors */ }
  return null;
}

function persistAuth(token: string | null, user: AuthUser | null): void {
  if (token && user) {
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify({ token, user }));
    } catch { /* storage full or unavailable */ }
  } else {
    try {
      localStorage.removeItem(AUTH_KEY);
    } catch { /* ignore */ }
  }
}

const initial = loadInitialAuth();

export const useAuthStore = create<AuthState>((set, get) => ({
  token: initial?.token ?? null,
  user: initial?.user ?? null,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const body = await res.json();

      if (!res.ok) {
        set({ loading: false, error: body.message || 'Đăng nhập thất bại' });
        return;
      }

      persistAuth(body.token, body.user);
      set({ token: body.token, user: body.user, loading: false, error: null });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  register: async (name, email, phone, password) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, password }),
      });

      const body = await res.json();

      if (!res.ok) {
        set({ loading: false, error: body.message || 'Đăng ký thất bại' });
        return;
      }

      persistAuth(body.token, body.user);
      set({ token: body.token, user: body.user, loading: false, error: null });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  logout: () => {
    persistAuth(null, null);
    set({ token: null, user: null, loading: false, error: null });
  },

  fetchMe: async () => {
    const { token } = get();
    if (!token) {
      set({ error: 'No token available' });
      return;
    }

    set({ loading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        persistAuth(null, null);
        set({ token: null, user: null, loading: false, error: null });
        return;
      }

      const body = await res.json();

      if (!res.ok) {
        set({ loading: false, error: body.message || 'Failed to fetch user' });
        return;
      }

      set({ user: body.user, loading: false, error: null });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  clearError: () => set({ error: null }),
}));
