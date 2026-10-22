import { create } from 'zustand';
import { apiFetch, ApiClientError } from '@/lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   Auth store — dual-mode auth (Bearer token in localStorage + cookie fallback).
   Backend sets access_token cookie AND returns { user, token } in JSON.
   Persisting token in localStorage guarantees Safari ITP & cross-origin resilience.
   ═══════════════════════════════════════════════════════════════════ */

export const AUTH_TOKEN_KEY = 'aura_auth_token';
export const AUTH_USER_KEY = 'aura_auth_user';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'staff' | 'manager' | 'owner' | 'admin' | 'cashier' | 'waiter' | 'kitchen' | 'barista' | 'chef';
  tenantId?: string;
  phone?: string;
}

interface AuthResponse {
  success?: boolean;
  user?: AuthUser;
  token?: string;
  message?: string;
  data?: {
    user?: AuthUser;
  };
}

interface AuthState {
  sessionVersion: number;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
}

function getInitialUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getInitialUser(),
  sessionVersion: 0,
  loading: false,
  error: null,

  login: async (email, password) => {
    set({ loading: true, error: null });
    try {
      const res = await apiFetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (res?.token && typeof window !== 'undefined') {
        try {
          localStorage.setItem(AUTH_TOKEN_KEY, res.token);
        } catch { /* storage quota or restricted */ }
      }

      const resolvedUser = res?.user || res?.data?.user;
      if (resolvedUser) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(resolvedUser));
          } catch { /* storage quota or restricted */ }
        }
        set(state => ({ user: resolvedUser, loading: false, error: null, sessionVersion: state.sessionVersion + 1 }));
      } else {
        await get().fetchMe();
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  register: async (name, email, phone, password) => {
    set({ loading: true, error: null });
    try {
      const res = await apiFetch<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, password }),
      });

      if (res?.token && typeof window !== 'undefined') {
        try {
          localStorage.setItem(AUTH_TOKEN_KEY, res.token);
        } catch { /* storage quota or restricted */ }
      }

      const resolvedUser = res?.user || res?.data?.user;
      if (resolvedUser) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(resolvedUser));
          } catch { /* storage quota or restricted */ }
        }
        set(state => ({ user: resolvedUser, loading: false, error: null, sessionVersion: state.sessionVersion + 1 }));
      } else {
        await get().fetchMe();
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  logout: async () => {
    // Begin the authenticated revoke request, then hide private state immediately.
    const revoke = apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
      } catch { /* restricted */ }
    }
    set(state => ({ user: null, loading: false, error: null, sessionVersion: state.sessionVersion + 1 }));
    await revoke;
  },

  fetchMe: async () => {
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<AuthResponse>('/api/auth/me');
      const resolvedUser = body?.user || body?.data?.user;
      if (resolvedUser) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(resolvedUser));
          } catch { /* restricted */ }
        }
        set(state => ({ user: resolvedUser, loading: false, error: null, sessionVersion: state.sessionVersion + 1 }));
      } else {
        set({ loading: false, error: null });
      }
    } catch (err) {
      if (err instanceof ApiClientError && (err.status === 401 || err.status === 403)) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.removeItem(AUTH_TOKEN_KEY);
            localStorage.removeItem(AUTH_USER_KEY);
          } catch { /* restricted */ }
        }
        set({ user: null, loading: false, error: err.message });
        return;
      }
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error', user: null });
    }
  },

  clearError: () => set({ error: null }),
}));
