export const STOREFRONT_ORDER_TOKENS_KEY = 'aura_storefront_order_tokens_v1';

const ORDER_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_STORED_TOKENS = 24;

interface StoredStorefrontOrderToken {
  tenantId: string;
  tenantSlug: string;
  orderId: string;
  token: string;
  savedAt: number;
}

type StoredStorefrontTokenMap = Record<string, StoredStorefrontOrderToken>;

let fallbackMemoryTokens: StoredStorefrontTokenMap = {};

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

/**
 * Validates external checkout/redirect URLs strictly as HTTPS with a valid hostname and no embedded credentials.
 */
export function sanitizeHttpsExternalUrl(rawUrl: string | null | undefined): string | null {
  const url = rawUrl?.trim();
  if (!url || !/^https:\/\/[^/]/i.test(url) || /[\s\\]/.test(url) || hasControlChars(url)) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname) return null;
    return parsed.username || parsed.password ? null : parsed.href;
  } catch {
    return null;
  }
}

export function sanitizePayosCheckoutUrl(rawUrl: string | null | undefined): string | null {
  const url = sanitizeHttpsExternalUrl(rawUrl);
  return url && new URL(url).origin === 'https://pay.payos.vn' ? url : null;
}

/**
 * Validates product thumbnails and merchant logos for storefront rendering.
 * Accepts only same-origin relative paths starting with a single "/" or absolute "https://" URLs.
 * Rejects protocol-relative ("//", "/\\"), http, javascript, data, blob, and malformed values.
 */
export function sanitizeStorefrontMediaUrl(rawUrl: string | null | undefined): string | null {
  const url = rawUrl?.trim();
  if (!url || /[\s\\]/.test(url) || hasControlChars(url)) {
    return null;
  }
  if (url.startsWith('/')) {
    if (url.startsWith('//')) return null;
    try {
      const parsed = new URL(url, 'https://auraspace.cafe');
      if (parsed.origin !== 'https://auraspace.cafe' || !parsed.pathname.startsWith('/')) {
        return null;
      }
      return url;
    } catch {
      return null;
    }
  }
  return sanitizeHttpsExternalUrl(url);
}

function buildTokenKey(tenantId: string, tenantSlug: string, orderId: string): string {
  return `${tenantId.trim()}::${tenantSlug.trim().toLowerCase()}::${orderId.trim()}`;
}

function parseTokenMap(raw: string | null): StoredStorefrontTokenMap {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as StoredStorefrontTokenMap;
  } catch {
    return {};
  }
}

function readTokenMap(): StoredStorefrontTokenMap {
  const now = Date.now();
  let source: StoredStorefrontTokenMap;
  try {
    source =
      typeof sessionStorage !== 'undefined'
        ? parseTokenMap(sessionStorage.getItem(STOREFRONT_ORDER_TOKENS_KEY))
        : fallbackMemoryTokens;
  } catch {
    source = fallbackMemoryTokens;
  }

  const valid: StoredStorefrontTokenMap = {};
  for (const [key, entry] of Object.entries(source)) {
    if (!entry || typeof entry.token !== 'string' || !entry.token.trim()) continue;
    if (entry.savedAt && now - entry.savedAt > ORDER_TOKEN_TTL_MS) continue;
    valid[key] = entry;
  }
  return valid;
}

function writeTokenMap(next: StoredStorefrontTokenMap): void {
  const now = Date.now();
  const trimmedEntries = Object.entries(next)
    .filter(
      ([, entry]) =>
        entry &&
        typeof entry.token === 'string' &&
        entry.token.trim().length > 0 &&
        (!entry.savedAt || now - entry.savedAt <= ORDER_TOKEN_TTL_MS),
    )
    .sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0))
    .slice(0, MAX_STORED_TOKENS);
  const trimmed = Object.fromEntries(trimmedEntries);
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(STOREFRONT_ORDER_TOKENS_KEY, JSON.stringify(trimmed));
      return;
    }
  } catch {
    // Restricted storage falls back to tab memory only.
  }
  fallbackMemoryTokens = trimmed;
}

export function rememberStorefrontOrderToken(
  tenantId: string,
  tenantSlug: string,
  orderId: string,
  token: string,
): void {
  const cleanTenantId = tenantId.trim();
  const cleanSlug = tenantSlug.trim().toLowerCase();
  const cleanOrderId = orderId.trim();
  const cleanToken = token.trim();
  if (!cleanTenantId || !cleanSlug || !cleanOrderId || !cleanToken) return;

  const map = readTokenMap();
  const key = buildTokenKey(cleanTenantId, cleanSlug, cleanOrderId);
  map[key] = {
    tenantId: cleanTenantId,
    tenantSlug: cleanSlug,
    orderId: cleanOrderId,
    token: cleanToken,
    savedAt: Date.now(),
  };
  writeTokenMap(map);
}

export function getStorefrontOrderToken(
  tenantId: string,
  tenantSlug: string,
  orderId: string,
): string | null {
  const cleanTenantId = tenantId.trim();
  const cleanSlug = tenantSlug.trim().toLowerCase();
  const cleanOrderId = orderId.trim();
  if (!cleanTenantId || !cleanSlug || !cleanOrderId) return null;

  const entry = readTokenMap()[buildTokenKey(cleanTenantId, cleanSlug, cleanOrderId)];
  if (!entry) return null;
  if (
    entry.tenantId !== cleanTenantId ||
    entry.tenantSlug !== cleanSlug ||
    entry.orderId !== cleanOrderId
  ) {
    return null;
  }
  return entry.token.trim() || null;
}
