import { create } from 'zustand';
import { readClientSession, saveClientSession, invalidateClientSession, subscribeClientSession, sessionErrorRequiresLogin, beginClientLogin, isCurrentLogin } from '../../lib/client-session';
import { apiFetch, ApiClientError } from '../../lib/api-client';

/* ═══════════════════════════════════════════════════════════════════
   Auth store — dual-mode auth (Bearer token in localStorage + cookie fallback).
   Backend sets access_token cookie AND returns { user, token } in JSON.
   Persisting token in localStorage guarantees Safari ITP & cross-origin resilience.
   ═══════════════════════════════════════════════════════════════════ */

export const AUTH_TOKEN_KEY = 'aura_auth_token';
export const AUTH_USER_KEY = 'aura_auth_user';

function clearScopedBrowserState(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    for (const key of ['aura-cart', 'aura_pos_cart', 'aura_selected_table', 'aura_active_customer']) {
      localStorage.removeItem(key);
    }
  } catch { /* restricted */ }
  try {
    sessionStorage.clear();
  } catch { /* restricted */ }
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'customer' | 'staff' | 'supervisor' | 'manager' | 'owner' | 'admin' | 'cashier' | 'waiter' | 'shipper' | 'kitchen' | 'barista' | 'chef';
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
  return readClientSession().user as AuthUser | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: getInitialUser(),
  sessionVersion: 0,
  loading: false,
  error: null,

  login: async (email, password) => {
    const attempt = beginClientLogin();
    set({ loading: true, error: null });
    try {
      const res = await apiFetch<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      if (!isCurrentLogin(attempt)) return;
      if (res?.token && typeof window !== 'undefined') {
        try {
          localStorage.setItem(AUTH_TOKEN_KEY, res.token);
        } catch { /* storage quota or restricted */ }
      }

      const resolvedUser = res?.user || res?.data?.user;
      if (resolvedUser) {
        if (res?.token) saveClientSession(res.token, resolvedUser);
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
      if (!isCurrentLogin(attempt)) return;
      set({ user: null, loading: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  register: async (name, email, phone, password) => {
    const attempt = beginClientLogin();
    set({ loading: true, error: null });
    try {
      const res = await apiFetch<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, password }),
      });

      if (!isCurrentLogin(attempt)) return;
      if (res?.token && typeof window !== 'undefined') {
        try {
          localStorage.setItem(AUTH_TOKEN_KEY, res.token);
        } catch { /* storage quota or restricted */ }
      }

      const resolvedUser = res?.user || res?.data?.user;
      if (resolvedUser) {
        if (res?.token) saveClientSession(res.token, resolvedUser);
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
      if (!isCurrentLogin(attempt)) return;
      set({ user: null, loading: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  logout: async () => {
    // Begin the authenticated revoke request, then hide private state immediately.
    const revoke = apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    clearScopedBrowserState();
    invalidateClientSession();
    set(state => ({ user: null, loading: false, error: null, sessionVersion: state.sessionVersion + 1 }));
    await revoke;
  },

  fetchMe: async () => {
    const generation = get().sessionVersion;
    const token =
      readClientSession().token ||
      (typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null);
    set({ loading: true, error: null });
    try {
      const body = await apiFetch<AuthResponse>(
        '/api/auth/me',
        token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
      );
      const currentToken =
        readClientSession().token ||
        (typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null);
      if (generation !== get().sessionVersion || token !== currentToken) return;
      const resolvedUser = body?.user || body?.data?.user;
      if (resolvedUser) {
        const prevUser = get().user;
        if (prevUser && (prevUser.id !== resolvedUser.id || prevUser.tenantId !== resolvedUser.tenantId)) {
          if (typeof window !== 'undefined') {
            try {
              for (const key of ['aura-cart', 'aura_pos_cart', 'aura_selected_table', 'aura_active_customer']) {
                localStorage.removeItem(key);
              }
            } catch { /* restricted */ }
          }
        }
        const activeToken =
          body?.token ||
          token ||
          (typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null);
        if (activeToken) {
          saveClientSession(activeToken, resolvedUser);
        }
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
      const currentToken =
        readClientSession().token ||
        (typeof window !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) : null);
      if (generation !== get().sessionVersion || token !== currentToken) return;
      if (err instanceof ApiClientError && sessionErrorRequiresLogin(err.status, err.code)) {
        invalidateClientSession(undefined, err.message);
        clearScopedBrowserState();
        set(state => ({ user: null, loading: false, error: err.message, sessionVersion: state.sessionVersion + 1 }));
        return;
      }
      set({ loading: false, error: err instanceof Error ? err.message : 'Network error' });
    }
  },

  clearError: () => set({ error: null }),
}));

// Mobile login/refresh, revocation and cross-tab changes update the same cache
// generation that KDS uses to cancel private requests and streams.
if (typeof window !== 'undefined') subscribeClientSession(session => {
  useAuthStore.setState(state => ({ user: session.user as AuthUser | null, loading: false,
    error: session.error, sessionVersion: state.sessionVersion + 1 }));
});
