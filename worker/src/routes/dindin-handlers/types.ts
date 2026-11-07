import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../../types/env';
import { queryFirst, execute, getTenantId, matchesTenantRow } from '../../lib/db';
import { kvGet, kvSet } from '../../lib/kv';
import { isHQSuperAdmin } from '../../middleware/tenant';

export type DindinContext = Context<{ Bindings: Env }>;

export const DINDIN_SESSION_ID_RE = /^[A-Za-z0-9:_-]{1,128}$/;

// ── DinDin checkout body schema (re-exported for use by validators.ts) ──
export const dindinCheckoutSchema = z.object({
  sessionId: z.string().min(1, 'sessionId là bắt buộc').max(128).regex(DINDIN_SESSION_ID_RE, 'sessionId không hợp lệ'),
  payment_method: z.enum(['cod', 'payos']),
});

// ── Error codes ──
export type DinDinErrorCode =
  | 'D01'
  | 'D02'
  | 'D03'
  | 'D04'
  | 'D05'
  | 'D06'
  | 'D07'
  | 'D08';

export type DinDinError = { code: DinDinErrorCode; status: number; detail: string };

export function err(code: DinDinErrorCode, status: number, detail: string): DinDinError {
  return { code, status, detail };
}

export function errorResponse(c: DindinContext, e: DinDinError): Response {
  return c.json(
    { success: false as const, error: e.detail, code: e.code },
    { status: e.status as 400 | 401 | 403 | 404 | 409 | 422 | 500 }
  );
}

// ── Helpers ──
function normalizeDinDinTenant(tenantId?: string): string {
  const trimmed = typeof tenantId === 'string' ? tenantId.trim() : '';
  return trimmed && trimmed !== '*' && trimmed.toLowerCase() !== 'hq' ? trimmed : 'default';
}

export function scopedCartSessionId(sessionId: string, tenantId?: string): string {
  const effective = normalizeDinDinTenant(tenantId);
  if (effective !== 'default') {
    return `${effective}::${sessionId}`;
  }
  return sessionId.includes('::') ? `default::${sessionId}` : sessionId;
}

export function hasCrossTenantDindinOverride(c: {
  get?: (_k: string) => unknown;
  req: { query: (_k: string) => string | undefined; header: (_k: string) => string | undefined };
}): boolean {
  const candidates = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidates).size > 1) return true;
  const user = (typeof c.get === 'function' ? c.get('user') : undefined) as
    | { id?: string; role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  if (!user) return false;
  if (isHQSuperAdmin(user)) return false;
  const userTenant = (user.tenantId ?? user.tenant_id ?? '').trim();
  if (userTenant === '*' || userTenant.toLowerCase() === 'hq') return true;
  const headerOrQueryTenant = candidates[0] || '';
  if (!headerOrQueryTenant) return false;
  if (headerOrQueryTenant === '*' || headerOrQueryTenant.toLowerCase() === 'hq') return true;
  const boundTenant = userTenant || 'default';
  return headerOrQueryTenant !== boundTenant;
}

export const hasForbiddenTenantOverride = hasCrossTenantDindinOverride;

export function resolveDinDinTenant(c: {
  get?: (_k: string) => unknown;
  env?: unknown;
  req: { query: (_k: string) => string | undefined; header: (_k: string) => string | undefined };
}): string {
  const raw = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]).trim();
  const user = (typeof c.get === 'function' ? c.get('user') : undefined) as
    | { id?: string; role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  const candidate = (
    c.req.query('tenant_id') ||
    c.req.query('tenantId') ||
    c.req.query('store_id') ||
    c.req.query('storeId') ||
    c.req.header('X-Tenant-ID') ||
    c.req.header('x-tenant-id') ||
    c.req.header('X-Store-ID') ||
    c.req.header('x-store-id') ||
    ''
  ).trim();
  if (user) {
    if (isHQSuperAdmin(user)) {
      const target = candidate || raw || '*';
      return target.toLowerCase() === 'hq' ? '*' : target;
    }
    const userTenant = (user.tenantId ?? user.tenant_id ?? '').trim() || raw || 'default';
    return userTenant === '*' || userTenant.toLowerCase() === 'hq' ? 'default' : userTenant;
  }
  const resolved = raw && raw !== 'default' ? raw : candidate || raw || 'default';
  return resolved.toLowerCase() === 'hq' ? '*' : resolved;
}

export function cartKVKey(sessionId: string, tenantId?: string): string {
  const effective = normalizeDinDinTenant(tenantId);
  const safeSession = effective === 'default' && sessionId.includes('::') ? `default::${sessionId}` : sessionId;
  return effective === 'default' ? `dindin:cart:${safeSession}` : `dindin:${effective}:cart:${sessionId}`;
}

export function idempotencyKVKey(key: string, tenantId?: string): string {
  const effective = normalizeDinDinTenant(tenantId);
  return effective === 'default' ? `dindin:idempotency:${key}` : `dindin:${effective}:idempotency:${key}`;
}

export function configKVKey(tenantId?: string): string {
  const effective = normalizeDinDinTenant(tenantId);
  return effective === 'default' ? 'dindin:config' : `dindin:${effective}:config`;
}

export type Cart = {
  items: Array<{ id?: string; name?: string; price?: number; qty?: number }>;
  total: number;
};

export function emptyCart(): Cart {
  return { items: [], total: 0 };
}

export async function readCartRD(env: Env, sessionId: string, tenantId?: string): Promise<Cart | null> {
  const effective = normalizeDinDinTenant(tenantId);
  const fromKv = await kvGet<Cart>(env.AUTH_KV, cartKVKey(sessionId, effective));
  if (fromKv && Array.isArray(fromKv.items)) {
    return fromKv;
  }

  let row: { raw: string; tenant_id?: string | null } | null = null;
  const scopedSessionId = scopedCartSessionId(sessionId, effective);
  if (effective !== 'default') {
    try {
      const candidate = await queryFirst<{ raw: string; tenant_id?: string | null }>(
        env.AURA_DB,
        "SELECT COALESCE(raw, cart) as raw, tenant_id FROM dindin_cart WHERE session_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
        scopedSessionId,
        effective
      );
      if (candidate && matchesTenantRow(candidate as unknown as Record<string, unknown>, effective)) {
        row = candidate;
      }
      if (!row && scopedSessionId !== sessionId) {
        const unprefixed = await queryFirst<{ raw: string; tenant_id?: string | null }>(
          env.AURA_DB,
          "SELECT COALESCE(raw, cart) as raw, tenant_id FROM dindin_cart WHERE session_id IN (?, ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
          scopedSessionId,
          sessionId,
          effective
        ).catch(() => null);
        if (unprefixed && matchesTenantRow(unprefixed as unknown as Record<string, unknown>, effective)) {
          row = unprefixed;
        }
      }
      if (!row) {
        const cartsCandidate = await queryFirst<{ raw?: string; cart?: string; items?: string; total?: number; tenant_id?: string | null }>(
          env.AURA_DB,
          "SELECT *, COALESCE(cart, items) as raw FROM dindin_carts WHERE session_id IN (?, ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
          scopedSessionId,
          sessionId,
          effective
        ).catch(() => null);
        if (cartsCandidate && matchesTenantRow(cartsCandidate as unknown as Record<string, unknown>, effective)) {
          const rawStr = cartsCandidate.raw ?? cartsCandidate.cart ?? cartsCandidate.items ?? '';
          if (rawStr) {
            const parsed = JSON.parse(rawStr);
            row = {
              raw: Array.isArray(parsed)
                ? JSON.stringify({ items: parsed, total: Number(cartsCandidate.total ?? 0) })
                : rawStr,
              tenant_id: cartsCandidate.tenant_id,
            };
          }
        }
      }
    } catch {
      try {
        row = await queryFirst<{ raw: string }>(
          env.AURA_DB,
          'SELECT COALESCE(raw, cart) as raw FROM dindin_cart WHERE session_id = ?',
          scopedSessionId
        );
      } catch {
        row = null;
      }
    }
  } else {
    try {
      const candidate = await queryFirst<{ raw: string; tenant_id?: string | null }>(
        env.AURA_DB,
        'SELECT *, COALESCE(raw, cart) as raw FROM dindin_cart WHERE session_id = ?',
        scopedSessionId
      );
      if (candidate && matchesTenantRow(candidate as unknown as Record<string, unknown>, 'default')) {
        row = candidate;
      }
    } catch {
      try {
        row = await queryFirst<{ raw: string }>(
          env.AURA_DB,
          'SELECT COALESCE(raw, cart) as raw FROM dindin_cart WHERE session_id = ?',
          scopedSessionId
        );
      } catch {
        try {
          row = await queryFirst<{ raw: string }>(
            env.AURA_DB,
            'SELECT raw FROM dindin_cart WHERE session_id = ?',
            scopedSessionId
          );
        } catch {
          row = null;
        }
      }
    }
  }
  if (!row) {
    return null;
  }
  try {
    return JSON.parse(row.raw) as Cart;
  } catch {
    return emptyCart();
  }
}

export async function writeCart(env: Env, sessionId: string, cart: Cart, tenantId?: string): Promise<void> {
  const effective = normalizeDinDinTenant(tenantId);
  const scopedSessionId = scopedCartSessionId(sessionId, effective);
  const blob = JSON.stringify(cart);
  if (effective !== 'default') {
    await Promise.all([
      kvSet(env.AUTH_KV, cartKVKey(sessionId, effective), blob),
      execute(
        env.AURA_DB,
        "INSERT INTO dindin_cart (session_id, raw, cart, tenant_id, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(session_id) DO UPDATE SET raw = excluded.raw, cart = excluded.cart, tenant_id = excluded.tenant_id, updated_at = excluded.updated_at WHERE COALESCE(NULLIF(TRIM(dindin_cart.tenant_id), ''), 'default') = excluded.tenant_id",
        scopedSessionId,
        blob,
        blob,
        effective
      ).catch(() => {}),
    ]);
    return;
  }

  await Promise.all([
    kvSet(env.AUTH_KV, cartKVKey(sessionId), blob),
    execute(
      env.AURA_DB,
      "INSERT INTO dindin_cart (session_id, raw, cart, tenant_id, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(session_id) DO UPDATE SET raw = excluded.raw, cart = excluded.cart, tenant_id = excluded.tenant_id, updated_at = excluded.updated_at WHERE COALESCE(NULLIF(TRIM(dindin_cart.tenant_id), ''), 'default') = excluded.tenant_id",
      scopedSessionId,
      blob,
      blob,
      effective
    ).catch(() =>
      execute(
        env.AURA_DB,
        'INSERT INTO dindin_cart (session_id, raw, cart, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(session_id) DO UPDATE SET raw = excluded.raw, cart = excluded.cart, updated_at = excluded.updated_at',
        scopedSessionId,
        blob,
        blob
      ).catch(() =>
        execute(
          env.AURA_DB,
          'INSERT INTO dindin_cart (session_id, raw, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(session_id) DO UPDATE SET raw = excluded.raw, updated_at = excluded.updated_at',
          scopedSessionId,
          blob
        ).catch(() => {})
      )
    ),
  ]);
}

export async function readConfigRaw(env: Env, tenantId?: string): Promise<{ config: string } | null> {
  const effective = normalizeDinDinTenant(tenantId);
  if (effective !== 'default') {
    try {
      const row = await queryFirst<{ config: string; tenant_id?: string | null }>(
        env.AURA_DB,
        "SELECT config, tenant_id FROM dindin_config WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY updated_at DESC LIMIT 1",
        effective
      );
      if (row?.config && matchesTenantRow(row as unknown as Record<string, unknown>, effective)) {
        return { config: row.config };
      }
    } catch {
      // fall through to tenant KV
    }
    const kvConfig = await kvGet<Record<string, unknown> | string>(env.AUTH_KV, configKVKey(effective));
    if (kvConfig) {
      return { config: typeof kvConfig === 'string' ? kvConfig : JSON.stringify(kvConfig) };
    }
    return null;
  }

  try {
    const row = await queryFirst<{ config: string; tenant_id?: string | null }>(
      env.AURA_DB,
      "SELECT config, tenant_id FROM dindin_config WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default' LIMIT 1"
    );
    if (row?.config) {
      return { config: row.config };
    }
    const anyRow = await queryFirst<{ config: string; tenant_id?: string | null }>(
      env.AURA_DB,
      'SELECT config, tenant_id FROM dindin_config LIMIT 1'
    );
    if (anyRow?.config && matchesTenantRow(anyRow as unknown as Record<string, unknown>, 'default')) {
      return { config: anyRow.config };
    }
    return null;
  } catch {
    const row = await queryFirst<{ config: string }>(env.AURA_DB, 'SELECT config FROM dindin_config LIMIT 1');
    return row?.config ? { config: row.config } : null;
  }
}

export async function writeConfig(env: Env, configBlob: string, tenantId?: string): Promise<void> {
  const effective = normalizeDinDinTenant(tenantId);
  if (effective !== 'default') {
    await Promise.all([
      kvSet(env.AUTH_KV, configKVKey(effective), configBlob),
      (async () => {
        try {
          const existing = await queryFirst<{ id: number | string }>(
            env.AURA_DB,
            'SELECT id FROM dindin_config WHERE tenant_id = ? LIMIT 1',
            effective
          );
          if (existing?.id !== undefined) {
            await execute(
              env.AURA_DB,
              'UPDATE dindin_config SET config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?',
              configBlob,
              existing.id,
              effective
            );
          } else {
            await execute(
              env.AURA_DB,
              'INSERT INTO dindin_config (config, tenant_id, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
              configBlob,
              effective
            );
          }
        } catch {
          // KV holds the tenant-scoped config if dindin_config table lacks tenant_id
        }
      })(),
    ]);
    return;
  }

  await Promise.all([
    kvSet(env.AUTH_KV, 'dindin:config', configBlob),
    execute(
      env.AURA_DB,
      "INSERT INTO dindin_config (id, config, tenant_id, updated_at) VALUES (1, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET config = excluded.config, tenant_id = excluded.tenant_id, updated_at = excluded.updated_at WHERE COALESCE(NULLIF(TRIM(dindin_config.tenant_id), ''), 'default') = excluded.tenant_id",
      configBlob,
      effective
    ).catch(() =>
      execute(
        env.AURA_DB,
        'INSERT INTO dindin_config (id, config, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at',
        configBlob
      ).catch(() => {})
    ),
  ]);
}
