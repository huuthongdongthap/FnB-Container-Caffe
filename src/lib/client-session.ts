/** Shared web/mobile session state. Device enrollment survives logout/expiry. */
import { useEffect, useState } from 'react';
import { offlineDb } from './offline-db';
export interface ClientSessionUser { id: string; name: string; role: string; email?: string; tenantId?: string; tenant_id?: string; phone?: string; device_id?: string }
export interface SessionSnapshot {
  token: string | null;
  userId: string | null;
  tenantId: string;
  userScope: string;
}
const EVENT = 'aura:session-change';
let revision = 0;
export const beginClientLogin = () => ++revision;
export const isCurrentLogin = (attempt: number) => attempt === revision;
const cartScopedKeys = [
  'aura_cart',
  'aura_cart_v3',
  'aura-cart',
];
const sessionKeys = [
  'aura_auth_token',
  'aura_auth_user',
  'aura_user_data',
  'mobile_token',
  'mobile_user',
  'aura_recruitment_applications',
  'aura_loyalty',
  'aura_referral',
  'aura_customer_phone',
  'aura_customer_profile',
  'aura_checkout_form',
  'aura_saved_customer',
  ...cartScopedKeys,
];
const accountScopedKeys = [
  'aura_recruitment_applications',
  'aura_loyalty',
  'aura_referral',
  'aura_customer_phone',
  'aura_customer_profile',
  'aura_checkout_form',
  'aura_saved_customer',
  ...cartScopedKeys,
];
export function storedValue<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; }
  catch { try { return (localStorage.getItem(key) as T) || fallback; } catch { return fallback; } }
}
export const storedDevice = () => storedValue<string | null>('aura_device_token', null) || storedValue<string | null>('mobile_device', null);
export function readClientSession() {
  const token = storedValue<string | null>('aura_auth_token', null) || storedValue<string | null>('mobile_token', null);
  const user = token ? storedValue<ClientSessionUser | null>('aura_auth_user', null)
    || storedValue<ClientSessionUser | null>('mobile_user', null) || storedValue<ClientSessionUser | null>('aura_user_data', null) : null;
  return { token, user, deviceToken: storedDevice(), error: null as string | null };
}
function publish(error: string | null = null) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(EVENT, { detail: { ...readClientSession(), error } }));
}
export function saveClientSession(token: string, user: ClientSessionUser, deviceToken?: string | null) {
  revision++;
  try {
    const previous = readClientSession().user;
    if (previous?.id !== user.id || previous?.tenantId !== user.tenantId || previous?.role !== user.role) {
      accountScopedKeys.forEach(key => localStorage.removeItem(key));
      try { sessionStorage.removeItem('aura_checkout_intent_v1'); } catch { /* ignore */ }
      void offlineDb.clear().catch(() => {});
    }
    for (const key of ['aura_auth_user', 'aura_user_data', 'mobile_user']) localStorage.setItem(key, JSON.stringify(user));
    for (const key of ['mobile_token', 'aura_auth_token']) localStorage.setItem(key, token);
    if (deviceToken) for (const key of ['mobile_device', 'aura_device_token']) localStorage.setItem(key, deviceToken);
  } catch { /* Restricted browser storage. */ }
  publish();
}
export function invalidateClientSession(expectedToken?: string | null, error: string | null = null, forgetDevice = false) {
  if (expectedToken && readClientSession().token !== expectedToken) return false;
  revision++;
  try {
    sessionKeys.forEach(key => localStorage.removeItem(key));
    if (forgetDevice) ['mobile_device', 'aura_device_token'].forEach(key => localStorage.removeItem(key));
    try { sessionStorage.removeItem('aura_checkout_intent_v1'); } catch { /* ignore */ }
    void offlineDb.clear().catch(() => {});
    if (typeof navigator !== 'undefined' && navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_AUTH_CACHE' });
    }
  } catch { /* Restricted browser storage. */ }
  publish(error);
  return true;
}
export const sessionErrorRequiresLogin = (status: number, code?: string) => status === 401
  || (status === 403 && ['SESSION_REVOKED', 'DEVICE_REVOKED', 'STAFF_ACCOUNT_INACTIVE'].includes(code || ''));
export function clearSessionClientState() {
  try {
    accountScopedKeys.forEach(key => localStorage.removeItem(key));
    try { sessionStorage.removeItem('aura_checkout_intent_v1'); } catch { /* ignore */ }
  } catch { /* Restricted browser storage. */ }
}
export function subscribeClientSession(listener: (state: ReturnType<typeof readClientSession>) => void) {
  if (typeof window === 'undefined') return () => {};
  const changed = (event: Event) => listener((event as CustomEvent).detail);
  const fromOtherTab = (event: StorageEvent) => {
    if (
      event.key === 'aura_auth_token' ||
      event.key === 'aura_auth_user' ||
      event.key === 'aura_cart' ||
      event.key === 'aura_cart_v3' ||
      event.key === 'aura-cart' ||
      event.key === null
    ) {
      revision++;
      listener(readClientSession());
    }
  };
  window.addEventListener(EVENT, changed);
  window.addEventListener('storage', fromOtherTab);
  return () => { window.removeEventListener(EVENT, changed); window.removeEventListener('storage', fromOtherTab); };
}
export function initClientSessionSync() {
  return subscribeClientSession(() => {});
}
export function readSessionSnapshot(sessionInput?: ReturnType<typeof readClientSession>): SessionSnapshot {
  const session = sessionInput ?? readClientSession();
  const rawUser = session.user ?? storedValue<ClientSessionUser | null>('aura_auth_user', null);
  const userId = typeof rawUser?.id === 'string' && rawUser.id.trim() ? rawUser.id.trim() : null;
  const email = typeof rawUser?.email === 'string' && rawUser.email.trim() ? rawUser.email.trim() : null;
  const userTenant =
    typeof rawUser?.tenantId === 'string' && rawUser.tenantId.trim()
      ? rawUser.tenantId.trim()
      : typeof rawUser?.tenant_id === 'string' && rawUser.tenant_id.trim()
        ? rawUser.tenant_id.trim()
        : '';
  const storedTenant = !userTenant ? (storedValue<string | null>('aura_tenant_id', null) ?? '').trim() : '';
  const tenantId = userTenant || storedTenant || 'default';
  const userScope = userId || email || (session.token ? `token:${session.token.slice(-12)}` : 'anon');
  return {
    token: session.token,
    userId,
    tenantId,
    userScope,
  };
}
export function isSameSessionSnapshot(a: SessionSnapshot, b: SessionSnapshot): boolean {
  return (
    a.token === b.token &&
    a.userId === b.userId &&
    a.tenantId === b.tenantId &&
    a.userScope === b.userScope
  );
}
export function subscribeSessionChange(
  listener: (next: SessionSnapshot, prev: SessionSnapshot) => void,
): () => void {
  let prev = readSessionSnapshot();
  return subscribeClientSession(session => {
    const next = readSessionSnapshot(session);
    if (!isSameSessionSnapshot(next, prev)) {
      const old = prev;
      prev = next;
      listener(next, old);
    }
  });
}
export function useClientSessionScope(): SessionSnapshot {
  const [snapshot, setSnapshot] = useState<SessionSnapshot>(() => readSessionSnapshot());
  useEffect(() => {
    setSnapshot(cur => {
      const fresh = readSessionSnapshot();
      return isSameSessionSnapshot(cur, fresh) ? cur : fresh;
    });
    return subscribeSessionChange(next => {
      setSnapshot(next);
    });
  }, []);
  return snapshot;
}
export function tokenClaims(token: string | null): { exp?: number; sessionType?: string } {
  try { return JSON.parse(atob((token!.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/'))); } catch { return {}; }
}
