/* ═══════════════════════════════════════════════════════════════════
useMobileAuth — JWT + device_token management for AURA Mobile staff
Storage: localStorage keys `mobile_token`, `mobile_user`, `mobile_device`
═══════════════════════════════════════════════════════════════════ */

import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { API_BASE } from '@/lib/api-client';

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
    if (raw === null || raw === undefined) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return raw as unknown as T;
    }
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  try {
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);
    localStorage.setItem(key, serialized);
  } catch {
    // quota exceeded or private mode — silent fail
  }
}

function clearStorage() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  localStorage.removeItem('aura_auth_token');
  localStorage.removeItem('aura_user_data');
  localStorage.removeItem('aura_device_token');
}

function getStoredToken(): string | null {
  return readStorage<string | null>(STORAGE_KEYS.token, null) || readStorage<string | null>('aura_auth_token', null);
}

function getStoredUser(): MobileUser | null {
  return readStorage<MobileUser | null>(STORAGE_KEYS.user, null) || readStorage<MobileUser | null>('aura_user_data', null);
}

function getStoredDevice(): string | null {
  return readStorage<string | null>(STORAGE_KEYS.device, null) || readStorage<string | null>('aura_device_token', null);
}

/* ── Context Provider ─────────────────────────────────────────────── */

export function MobileAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({
    user: getStoredUser(),
    token: getStoredToken(),
    deviceToken: getStoredDevice(),
    loading: false,
    error: null,
  }));

  /* Auto-refresh on mount if token exists */
  useEffect(() => {
    if (!state.token || !state.deviceToken) return;
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/mobile/refresh`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_token: state.deviceToken }),
            signal: controller.signal,
          }
        );
        if (!res.ok) {
          clearStorage();
          setState(s => ({ ...s, user: null, token: null, deviceToken: null, error: null }));
          return;
        }
        const data = await res.json();
        writeStorage(STORAGE_KEYS.token, data.token);
        writeStorage(STORAGE_KEYS.device, state.deviceToken);
        setState(s => ({ ...s, token: data.token, deviceToken: state.deviceToken, error: null }));
      } catch { /* network error or aborted */ }
    })();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshToken = useCallback(async (): Promise<boolean> => {
    const deviceToken = state.deviceToken || getStoredDevice();
    if (!deviceToken) return false;

    try {
      const res = await fetch(
        `${API_BASE}/mobile/refresh`,
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
        `${API_BASE}/mobile/login`,
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
      writeStorage('aura_auth_token', data.token);
      writeStorage('aura_user_data', data.user);
      writeStorage('aura_device_token', deviceToken);
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
    const token = getStoredToken();
    const user = getStoredUser();
    const deviceToken = getStoredDevice();
    return {
      user,
      token,
      deviceToken,
      loading: false,
      error: null,
      login: async () => false,
      logout: () => clearStorage(),
      refresh: async () => false,
      isAuthenticated: !!token && !!user,
    };
  }
  return ctx;
}
