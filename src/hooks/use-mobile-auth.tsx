/** Staff sessions share identity with web; PIN enrollment survives session expiry. */
import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { API_BASE, apiFetch } from '@/lib/api-client';
import { readClientSession, storedDevice, saveClientSession, invalidateClientSession,
  beginClientLogin, isCurrentLogin, sessionErrorRequiresLogin, subscribeClientSession, tokenClaims, type ClientSessionUser } from '@/lib/client-session';

interface AuthState { user: ClientSessionUser | null; token: string | null; deviceToken: string | null; loading: boolean; error: string | null }
interface AuthContextType extends AuthState {
  login: (tokenOrDevice: string, userOrPin: string | ClientSessionUser) => Promise<boolean>;
  logout: () => void; forgetDevice: () => void; refresh: () => Promise<boolean>; isAuthenticated: boolean;
}
const AuthContext = createContext<AuthContextType | null>(null);

export function MobileAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({ ...readClientSession(), loading: false }));
  useEffect(() => subscribeClientSession(session => setState({ ...session, loading: false })), []);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const { token, user } = readClientSession();
    const device = storedDevice();
    if (!token || !user || !device) return false;
    // Password sessions can use mobile screens but cannot become PIN refresh sessions.
    if (tokenClaims(token).sessionType === 'staff-web') return true;
    try {
      const res = await fetch(`${API_BASE}/mobile/refresh`, {
        method: 'POST', credentials: 'include', signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ device_token: device }),
      });
      const data = await res.json().catch(() => ({}));
      if (signal?.aborted || readClientSession().token !== token) return false;
      if (!res.ok) {
        if (sessionErrorRequiresLogin(res.status, data.code)) invalidateClientSession(token, data.error || 'Vui lòng nhập PIN lại');
        else setState(s => ({ ...s, error: data.error || 'Không thể kiểm tra phiên, vui lòng thử lại' }));
        return false;
      }
      if (!data.token || !data.user) return false;
      saveClientSession(data.token, data.user, device);
      return true;
    } catch { return false; }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    if (readClientSession().token && storedDevice()) void refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    const exp = tokenClaims(state.token).exp;
    if (!state.token || !Number.isFinite(exp)) return;
    const token = state.token;
    const timer = setTimeout(() => invalidateClientSession(token, 'Phiên đã hết hạn, vui lòng nhập PIN lại'), Math.max(0, exp! * 1000 - Date.now()));
    return () => clearTimeout(timer);
  }, [state.token]);

  const login = useCallback(async (tokenOrDevice: string, userOrPin: string | ClientSessionUser) => {
    if (typeof userOrPin === 'object') {
      saveClientSession(tokenOrDevice, userOrPin, storedDevice());
      return true;
    }
    const attempt = beginClientLogin();
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch(`${API_BASE}/mobile/login`, { method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ device_token: tokenOrDevice, pin: userOrPin }) });
      const data = await res.json();
      if (!isCurrentLogin(attempt)) return false;
      const user = data.user || data.staff;
      if (!res.ok || !data.token || !user) {
        setState(s => ({ ...s, loading: false, error: data.error || 'Đăng nhập thất bại' }));
        return false;
      }
      saveClientSession(data.token, user, tokenOrDevice);
      return true;
    } catch (error) {
      if (!isCurrentLogin(attempt)) return false;
      setState(s => ({ ...s, loading: false, error: error instanceof Error ? error.message : 'Lỗi mạng' }));
      return false;
    }
  }, []);
  const logout = useCallback(() => {
    void apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    invalidateClientSession();
  }, []);
  const forgetDevice = useCallback(() => {
    void apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    invalidateClientSession(undefined, null, true);
  }, []);
  return <AuthContext.Provider value={{ ...state, login, logout, forgetDevice, refresh, isAuthenticated: Boolean(state.token && state.user) }}>{children}</AuthContext.Provider>;
}
export function useMobileAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context) return context;
  const state = readClientSession();
  return { ...state, loading: false, login: async () => false, refresh: async () => false,
    logout: () => invalidateClientSession(), forgetDevice: () => invalidateClientSession(undefined, null, true),
    isAuthenticated: Boolean(state.token && state.user) };
}
