import { readClientSession, subscribeSessionChange } from './client-session';

/**
 * Session-scoped store for guest order capability tokens returned once at order creation.
 * Survives same-tab external redirects (e.g. PayOS checkout -> /order-success) via
 * sessionStorage while isolating entries across tenants and clearing on user logout.
 */
export const GUEST_ORDER_TOKENS_KEY = 'aura_guest_order_tokens_v1';
const MAX_STORED_TOKENS = 32;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

interface StoredGuestTokenEntry {
  token: string;
  tenantId: string;
  ownerUserId: string | null;
  savedAt: number;
  claimedAt?: number;
}

type StoredTokenMap = Record<string, StoredGuestTokenEntry>;

let memoryTokens: StoredTokenMap = {};

function activeContext(): { tenantId: string; userId: string | null } {
  const user = readClientSession().user as
    | { id?: string; tenantId?: string; tenant_id?: string }
    | null;
  const rawTenant = String(user?.tenantId ?? user?.tenant_id ?? '').trim();
  const tenantId =
    rawTenant && rawTenant !== '*' && rawTenant.toLowerCase() !== 'hq'
      ? rawTenant
      : 'default';
  const userId = typeof user?.id === 'string' && user.id.trim() ? user.id.trim() : null;
  return { tenantId, userId };
}

function parseStorageMap(raw: string | null): StoredTokenMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as StoredTokenMap;
  } catch {
    return {};
  }
}

function readMap(): StoredTokenMap {
  const now = Date.now();
  let localMap: StoredTokenMap = {};
  let sessionMap: StoredTokenMap = {};
  try {
    if (typeof localStorage !== 'undefined') {
      localMap = parseStorageMap(localStorage.getItem(GUEST_ORDER_TOKENS_KEY));
    }
  } catch {
    /* ignore restricted localStorage */
  }
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionMap = parseStorageMap(sessionStorage.getItem(GUEST_ORDER_TOKENS_KEY));
    }
  } catch {
    /* ignore restricted sessionStorage */
  }
  const merged: StoredTokenMap = { ...localMap, ...sessionMap, ...memoryTokens };
  const valid: StoredTokenMap = {};
  for (const [id, entry] of Object.entries(merged)) {
    if (!entry || typeof entry.token !== 'string' || !entry.token.trim()) continue;
    if (entry.savedAt && now - entry.savedAt > TOKEN_TTL_MS) continue;
    valid[id] = entry;
  }
  return valid;
}

function writeMap(next: StoredTokenMap): void {
  const now = Date.now();
  const entries = Object.entries(next)
    .filter(
      ([, v]) =>
        v &&
        typeof v.token === 'string' &&
        v.token.trim().length > 0 &&
        (!v.savedAt || now - v.savedAt <= TOKEN_TTL_MS),
    )
    .sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0))
    .slice(0, MAX_STORED_TOKENS);
  const trimmed = Object.fromEntries(entries);
  memoryTokens = trimmed;
  const serialized = JSON.stringify(trimmed);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(GUEST_ORDER_TOKENS_KEY, serialized);
    }
  } catch {
    /* Restricted storage: in-memory map still serves the active tab. */
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(GUEST_ORDER_TOKENS_KEY, serialized);
    }
  } catch {
    /* Restricted localStorage: sessionStorage + memory still serve same-tab flows. */
  }
}

export function rememberGuestOrderToken(
  orderId: string | null | undefined,
  token: string | null | undefined,
): void {
  const id = typeof orderId === 'string' ? orderId.trim() : '';
  const tok = typeof token === 'string' ? token.trim() : '';
  if (!id || !tok) return;
  const { tenantId, userId } = activeContext();
  const current = readMap();
  current[id] = {
    token: tok,
    tenantId,
    ownerUserId: userId,
    savedAt: Date.now(),
  };
  writeMap(current);
}

export function captureGuestOrderTokenFromResponse(payload: unknown): void {
  if (!payload || typeof payload !== 'object') return;
  const root = payload as Record<string, unknown>;
  if (root.order_tokens && typeof root.order_tokens === 'object' && !Array.isArray(root.order_tokens)) {
    for (const [oid, tok] of Object.entries(root.order_tokens as Record<string, unknown>)) {
      if (typeof tok === 'string') rememberGuestOrderToken(oid, tok);
    }
  }
  const arrayCandidates = [root.orders, Array.isArray(root.data) ? root.data : null];
  for (const list of arrayCandidates) {
    if (Array.isArray(list)) {
      for (const item of list) {
        if (item && typeof item === 'object') {
          const rec = item as Record<string, unknown>;
          if (typeof rec.id === 'string' && typeof rec.order_token === 'string') {
            rememberGuestOrderToken(rec.id, rec.order_token);
          }
        }
      }
    }
  }
  const nestedData =
    root.data && typeof root.data === 'object' && !Array.isArray(root.data)
      ? (root.data as Record<string, unknown>)
      : null;
  const nestedOrder =
    root.order && typeof root.order === 'object' ? (root.order as Record<string, unknown>) : null;
  const orderId =
    (typeof nestedData?.id === 'string' && nestedData.id) ||
    (typeof nestedData?.order_id === 'string' && nestedData.order_id) ||
    (typeof nestedOrder?.id === 'string' && nestedOrder.id) ||
    (typeof root.order_id === 'string' && root.order_id) ||
    (typeof root.id === 'string' && root.id) ||
    null;
  const token =
    (typeof root.order_token === 'string' && root.order_token) ||
    (typeof nestedData?.order_token === 'string' && nestedData.order_token) ||
    (typeof nestedOrder?.order_token === 'string' && nestedOrder.order_token) ||
    null;
  rememberGuestOrderToken(orderId, token);
}

export function getGuestOrderToken(orderId: string | null | undefined): string | null {
  const id = typeof orderId === 'string' ? orderId.trim() : '';
  if (!id) return null;
  const entry = readMap()[id];
  if (!entry || typeof entry.token !== 'string' || !entry.token.trim()) return null;
  const { tenantId, userId } = activeContext();
  if ((entry.tenantId || 'default') !== tenantId) return null;
  // Anonymous tokens remain usable if the same browser session signs in to claim the order,
  // whereas tokens created while signed in belong strictly to that authenticated user.
  if (entry.ownerUserId && entry.ownerUserId !== userId) return null;
  return entry.token.trim();
}

export function listClaimableGuestOrderTokens(): Array<{ orderId: string; token: string }> {
  const { tenantId, userId } = activeContext();
  if (!userId) return [];
  return Object.entries(readMap())
    .filter(
      ([, entry]) =>
        entry &&
        typeof entry.token === 'string' &&
        entry.token.trim().length > 0 &&
        (entry.tenantId || 'default') === tenantId &&
        !entry.ownerUserId &&
        !entry.claimedAt,
    )
    .map(([orderId, entry]) => ({ orderId, token: entry.token.trim() }));
}

export function markGuestOrderTokenClaimed(orderId: string | null | undefined): void {
  const id = typeof orderId === 'string' ? orderId.trim() : '';
  if (!id) return;
  const current = readMap();
  const entry = current[id];
  if (!entry) return;
  const { userId } = activeContext();
  current[id] = {
    ...entry,
    ownerUserId: entry.ownerUserId || userId,
    claimedAt: Date.now(),
  };
  writeMap(current);
}

export function clearGuestOrderTokens(): void {
  memoryTokens = {};
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(GUEST_ORDER_TOKENS_KEY);
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(GUEST_ORDER_TOKENS_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function stripOrderTokenFromBrowserUrl(): void {
  try {
    if (typeof window === 'undefined' || !window.location || !window.history?.replaceState) return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has('order_token')) return;
    url.searchParams.delete('order_token');
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  } catch {
    /* ignore restricted history API */
  }
}

if (typeof window !== 'undefined') {
  subscribeSessionChange((next, prev) => {
    const prevTenant =
      prev.tenantId && prev.tenantId !== '*' && prev.tenantId.toLowerCase() !== 'hq'
        ? prev.tenantId
        : 'default';
    const nextTenant =
      next.tenantId && next.tenantId !== '*' && next.tenantId.toLowerCase() !== 'hq'
        ? next.tenantId
        : 'default';
    // Purge guest capability tokens on logout, account switch, or tenant switch.
    const loggedOutOrSwitchedAccount =
      prev.userId !== null && next.userId !== prev.userId;
    const switchedTenant = nextTenant !== prevTenant;
    if (loggedOutOrSwitchedAccount || switchedTenant) {
      clearGuestOrderTokens();
    }
  });
}
