/* ═══════════════════════════════════════════════════════════════════
useMobileAuth — JWT + device_token management for AURA Mobile staff
Storage: localStorage keys `mobile_token`, `mobile_user`, `mobile_device`
═══════════════════════════════════════════════════════════════════ */

import { useState, useCallback, useEffect, createContext, useContext } from 'react';

const STORAGE_KEYS = {
  token: 'mobile_token',
  user: 'mobile_user',
  device: 'mobile_device',
};

interface MobileUser {
  id: string;
  name: string;
  role: 'owner' | 'manager' | 'staff' | 'waiter';
  email?: string;
}

interface AuthState {
  user: MobileUser | null;
  token: string | null;
  deviceToken: string | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextType extends AuthState {
  login: (deviceToken: string, pin: string) => Promise<boolean>;
  logout: () => void;
  refresh: () => Promise<boolean>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

/* ── Helpers ──────────────────────────────────────────────────────── */

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded or private mode — silent fail
  }
}

function clearStorage() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
}

/* ── Context Provider ─────────────────────────────────────────────── */

export function MobileAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    user: readStorage<MobileUser | null>(STORAGE_KEYS.user, null),
    token: readStorage<string | null>(STORAGE_KEYS.token, null),
    deviceToken: readStorage<string | null>(STORAGE_KEYS.device, null),
    loading: false,
    error: null,
  }));

  /* Auto-refresh on mount if token exists */
  useEffect(() => {
    if (state.token && state.deviceToken) {
      refreshToken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    const deviceToken = state.deviceToken || readStorage(STORAGE_KEYS.device, null);
    if (!deviceToken) return false;

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE || 'https://aura-space-worker.agencyos-openclaw.workers.dev'}/mobile/refresh`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_token: deviceToken }),
        }
      );
      if (!res.ok) {
        // Token invalid — clean up
        clearStorage();
        setState(s => ({ ...s, user: null, token: null, deviceToken: null, error: null }));
        return false;
      }
      const data = await res.json();
      writeStorage(STORAGE_KEYS.token, data.token);
      writeStorage(STORAGE_KEYS.device, deviceToken);
      setState(s => ({ ...s, token: data.token, deviceToken, error: null }));
      return true;
    } catch {
      return false;
    }
  }, [state.deviceToken]);

  const login = useCallback(async (deviceToken: string, pin: string): Promise<boolean> => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_BASE || 'https://aura-space-worker.agencyos-openclaw.workers.dev'}/mobile/login`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_token: deviceToken, pin }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setState(s => ({ ...s, loading: false, error: data.error || 'Đăng nhập thất bại' }));
        return false;
      }
      writeStorage(STORAGE_KEYS.token, data.token);
      writeStorage(STORAGE_KEYS.user, data.user);
      writeStorage(STORAGE_KEYS.device, deviceToken);
      setState({
        user: data.user,
        token: data.token,
        deviceToken,
        loading: false,
        error: null,
      });
      return true;
    } catch (err) {
      setState(s => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Lỗi mạng',
      }));
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    clearStorage();
    setState({ user: null, token: null, deviceToken: null, loading: false, error: null });
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    logout,
    refresh: refreshToken,
    isAuthenticated: !!state.token && !!state.user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ── Hook (convenience — use context directly OR this standalone) ─── */

export function useMobileAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Standalone fallback: read from localStorage directly
    const token = readStorage<string | null>(STORAGE_KEYS.token, null);
    const user = readStorage<MobileUser | null>(STORAGE_KEYS.user, null);
    const deviceToken = readStorage<string | null>(STORAGE_KEYS.device, null);
    return {
      user,
      token,
      deviceToken,
      loading: false,
      error: null,
      login: async () => false,
      logout: () => clearStorage(),
      refresh: async () => false,
      isAuthenticated: false,
    };
  }
  return ctx;
}
