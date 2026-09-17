import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../../types/env';
import { queryFirst, execute } from '../../lib/db';
import { kvGet, kvSet } from '../../lib/kv';

export type DindinContext = Context<{ Bindings: Env }>;

// ── DinDin checkout body schema (re-exported for use by validators.ts) ──
export const dindinCheckoutSchema = z.object({
  sessionId: z.string().min(1, 'sessionId là bắt buộc'),
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
export function cartKVKey(sessionId: string): string {
  return `dindin:cart:${sessionId}`;
}

export function idempotencyKVKey(key: string): string {
  return `dindin:idempotency:${key}`;
}

export type Cart = {
  items: Array<{ id?: string; name?: string; price?: number; qty?: number }>;
  total: number;
};

export function emptyCart(): Cart {
  return { items: [], total: 0 };
}

export async function readCartRD(env: Env, sessionId: string): Promise<Cart | null> {
  const fromKv = await kvGet<Cart>(env.AUTH_KV, cartKVKey(sessionId));
  if (fromKv && Array.isArray(fromKv.items)) {
    return fromKv;
  }

  const row = await queryFirst<{ raw: string }>(
    env.AURA_DB,
    'SELECT raw FROM dindin_cart WHERE session_id = ?',
    sessionId
  );
  if (!row) {
    return null;
  }
  try {
    return JSON.parse(row.raw) as Cart;
  } catch {
    return emptyCart();
  }
}

export async function writeCart(env: Env, sessionId: string, cart: Cart): Promise<void> {
  const blob = JSON.stringify(cart);
  await Promise.all([
    kvSet(env.AUTH_KV, cartKVKey(sessionId), blob),
    execute(
      env.AURA_DB,
      'INSERT INTO dindin_cart (session_id, raw, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(session_id) DO UPDATE SET raw = excluded.raw, updated_at = excluded.updated_at',
      sessionId,
      blob
    ),
  ]);
}

export async function writeConfig(env: Env, configBlob: string): Promise<void> {
  await execute(
    env.AURA_DB,
    'INSERT INTO dindin_config (id, config, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at',
    configBlob
  );
}
