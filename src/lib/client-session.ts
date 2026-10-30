/** Shared web/mobile session state. Device enrollment survives logout/expiry. */
import { offlineDb } from './offline-db';
export interface ClientSessionUser { id: string; name: string; role: string; email?: string; tenantId?: string; phone?: string; device_id?: string }
const EVENT = 'aura:session-change';
let revision = 0;
export const beginClientLogin = () => ++revision;
export const isCurrentLogin = (attempt: number) => attempt === revision;
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
];
const accountScopedKeys = [
  'aura_recruitment_applications',
  'aura_loyalty',
  'aura_referral',
  'aura_customer_phone',
  'aura_customer_profile',
  'aura_checkout_form',
  'aura_saved_customer',
];
export function storedValue<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; }
  catch { try { return (localStorage.getItem(key) as T) || fallback; } catch { return fallback; } }
}
export const storedDevice = () => storedValue<string | null>('mobile_device', null) || storedValue<string | null>('aura_device_token', null);
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
export function subscribeClientSession(listener: (state: ReturnType<typeof readClientSession>) => void) {
  const changed = (event: Event) => listener((event as CustomEvent).detail);
  const fromOtherTab = (event: StorageEvent) => {
    if (event.key === 'aura_auth_token' || event.key === null) {
      revision++;
      listener(readClientSession());
    }
  };
  window.addEventListener(EVENT, changed);
  window.addEventListener('storage', fromOtherTab);
  return () => { window.removeEventListener(EVENT, changed); window.removeEventListener('storage', fromOtherTab); };
}
export function tokenClaims(token: string | null): { exp?: number; sessionType?: string } {
  try { return JSON.parse(atob((token!.split('.')[1] || '').replace(/-/g, '+').replace(/_/g, '/'))); } catch { return {}; }
}
