/**
 * DinDin / AURA CAFE menu-ordering Admin Routes
 *
 * Endpoints:
 * GET /api/admin/dindin/config - read current menu + settings
 * PUT /api/admin/dindin/config - overwrite config
 * GET /api/admin/dindin/cart/:sessionId - read cart for a session
 * PATCH /api/admin/dindin/cart/:sessionId - mutate cart
 * POST /api/admin/dindin/checkout - create order from cart
 */
import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { queryAll, queryFirst, execute } from '../lib/db';
import { kvGet, kvSet } from '../lib/kv';

// Shorthand for the context shape expected by Hono 4 when inferring types at route-runtime.
// The 'Bindings' parameter needs only to contain Env; Hono's Context type dispatches
// the output schema (BlankSchema) and base path ("/") for sub-routes at runtime.
type DindinContext = Context<{ Bindings: Env }>;

// ── DinDin checkout body schema (re-exported for use by validators.ts) ──
export const dindinCheckoutSchema = z.object({
  sessionId: z.string().min(1, 'sessionId là bắt buộc'),
  payment_method: z.enum(['cod', 'payos'])
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

function err(code: DinDinErrorCode, status: number, detail: string): DinDinError {
  return { code, status, detail };
}

function errorResponse(c: DindinContext, e: DinDinError): Response {
  return c.json(
    { success: false as const, error: e.detail, code: e.code },
    { status: e.status as 400 | 401 | 403 | 404 | 409 | 422 | 500 }
  );
}

// ── Router ──
export const dindinRouter = new Hono<{ Bindings: Env }>();
// All endpoints protected by admin auth
dindinRouter.use('*', requireAuth(['owner', 'staff']));

// ── Helpers ──
function cartKVKey(sessionId: string): string {
  return `dindin:cart:${sessionId}`;
}

function idempotencyKVKey(key: string): string {
  return `dindin:idempotency:${key}`;
}

type Cart = {
  items: Array<{ id?: string; name?: string; price?: number; qty?: number }>;
  total: number;
};

function emptyCart(): Cart {
  return { items: [], total: 0 };
}

async function readCartRD(env: Env, sessionId: string): Promise<Cart | null> {
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

async function writeCart(env: Env, sessionId: string, cart: Cart): Promise<void> {
  const blob = JSON.stringify(cart);
  await Promise.all([
    kvSet(env.AUTH_KV, cartKVKey(sessionId), blob),
    execute(
      env.AURA_DB,
      'INSERT INTO dindin_cart (session_id, raw, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(session_id) DO UPDATE SET raw = excluded.raw, updated_at = excluded.updated_at',
      sessionId,
      blob
    )
  ]);
}

async function writeConfig(env: Env, configBlob: string): Promise<void> {
  await execute(
    env.AURA_DB,
    'INSERT INTO dindin_config (id, config, updated_at) VALUES (1, ?, CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET config = excluded.config, updated_at = excluded.updated_at',
    configBlob
  );
}

// ── GET /config ──────────────────────────────────────────────────────────────
dindinRouter.get('/config', async(c) => {
  try {
    const row = await queryFirst<{ config: string }>(c.env.AURA_DB, 'SELECT config FROM dindin_config LIMIT 1');
    if (!row?.config) {
      return c.json({ success: true, data: { menu: { sections: [] }, settings: {} } });
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.config);
    } catch {
      return errorResponse(c as DindinContext, err('D07', 400, 'Định dạng config menu không hợp lệ'));
    }
    const menuSource = (parsed as Record<string, unknown>)?.menu as Record<string, unknown> | undefined;
    const menu = { sections: Array.isArray(menuSource?.sections) ? menuSource.sections : [] };
    const settings = (parsed as Record<string, unknown>)?.settings as Record<string, unknown> | undefined;
    return c.json({
      success: true,
      data: {
        menu,
        settings: settings && typeof settings === 'object' ? settings : {}
      }
    });
  } catch {
    return errorResponse(c as DindinContext, err('D06', 500, 'Lỗi ghi CSDL - vui lòng thử lại sau'));
  }
});

// ── PUT /config ──────────────────────────────────────────────────────────────
dindinRouter.put('/config', async(c) => {
  try {
    const body = await c.req.json<Record<string, unknown>>();
    const menuRaw = body.menu as Record<string, unknown> | undefined;
    if (!menuRaw || !Array.isArray(menuRaw.sections)) {
      return errorResponse(c as DindinContext, err('D07', 400, 'Thiếu menu.sections'));
    }
    for (const section of menuRaw.sections as Array<{ items?: Array<{ name?: unknown; price?: unknown }> }>) {
      const items = section.items ?? [];
      for (const item of items) {
        if (typeof item.name !== 'string') {
          return errorResponse(c as DindinContext, err('D07', 400, 'Định dạng config menu không hợp lệ'));
        }
        if (typeof item.price !== 'number') {
          return errorResponse(c as DindinContext, err('D07', 400, 'Định dạng config menu không hợp lệ'));
        }
      }
    }
    await writeConfig(c.env, JSON.stringify(body));
    return c.json({ success: true } as const);
  } catch {
    return errorResponse(c as DindinContext, err('D06', 500, 'Lỗi ghi CSDL - vui lòng thử lại sau'));
  }
});

// ── GET /cart/:sessionId ─────────────────────────────────────────────────────
dindinRouter.get('/cart/:sessionId', async(c) => {
  const { sessionId } = c.req.param();
  const cart = await readCartRD(c.env, sessionId);
  return c.json({ success: true, data: cart ?? emptyCart() });
});

// ── PATCH /cart/:sessionId ───────────────────────────────────────────────────
dindinRouter.patch('/cart/:sessionId', async(c) => {
  const { sessionId } = c.req.param();
  const body = await c.req.json<{
    action: 'add' | 'remove' | 'update';
    item?: {
      id?: string;
      name?: string;
      price?: number;
      qty?: number;
      quantity?: number;
    };
  }>();
  if (!body.action || !['add', 'remove', 'update'].includes(body.action)) {
    return errorResponse(c as DindinContext, err('D07', 400, 'action phải là add|remove|update'));
  }
  if (!body.item) {
    return errorResponse(c as DindinContext, err('D07', 400, 'item là bắt buộc'));
  }
  const cart = (await readCartRD(c.env, sessionId)) ?? emptyCart();

  if (body.action === 'add') {
    const qty = Math.max(1, Number(body.item.qty ?? body.item.quantity ?? 1));
    const price = Number(body.item.price ?? 0);
    cart.items.push({ ...body.item, qty });
    cart.total = Math.round(cart.total + price * qty);
  } else if (body.action === 'remove') {
    if (!body.item.id) {
      return errorResponse(c as DindinContext, err('D07', 400, 'item.id là bắt buộc'));
    }
    const removedPrices = cart.items
      .filter((it) => it.id === body.item!.id)
      .reduce((sum, it) => sum + (Number(it.price ?? 0) * Number(it.qty ?? 1)), 0);
    cart.items = cart.items.filter((it) => it.id !== body.item!.id);
    cart.total = Math.max(0, cart.total - removedPrices);
  } else {
    const idx = cart.items.findIndex((it) => it.id === body.item!.id);
    if (idx === -1) {
      return errorResponse(c as DindinContext, err('D01', 400, 'Món không có trong giỏ'));
    }
    const prevQty = Math.max(1, Number(cart.items[idx].qty ?? 1));
    const prevPrice = Number(cart.items[idx].price ?? 0);
    const nextQty = Math.max(1, Number(body.item.qty ?? body.item.quantity ?? prevQty));
    const nextPrice = Number(body.item.price ?? prevPrice);
    cart.items[idx] = { ...cart.items[idx], ...body.item, qty: nextQty };
    cart.total = Math.round(cart.total + (nextPrice * (nextQty - prevQty)));
  }

  await writeCart(c.env, sessionId, cart);
  return c.json({ success: true, data: cart });
});

// ── POST /checkout ──────────────────────────────────────────────────────────
dindinRouter.post('/checkout', async(c) => {
  try {
    const body = await c.req.json<unknown>();
    const parsed = dindinCheckoutSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(c as DindinContext, err('D03', 400, 'Body không hợp lệ'));
    }
    const { sessionId, payment_method } = parsed.data;
    if (!['cod', 'payos'].includes(payment_method)) {
      return errorResponse(c as DindinContext, err('D03', 400, 'Phương thức thanh toán không hợp lệ - chỉ hỗ trợ cod | payos'));
    }

    const idempotencyKey = c.req.header('Idempotency-Key');
    if (idempotencyKey) {
      const cached = await kvGet<{ ok: boolean; orderId: string; status: string; at: string }>(
        c.env.AUTH_KV,
        idempotencyKVKey(idempotencyKey)
      );
      if (cached) {
        return c.json({ success: true, orderId: cached.orderId, status: cached.status, cached: true });
      }
    }

    const cart = await readCartRD(c.env, sessionId);
    if (!cart || cart.items.length === 0) {
      return errorResponse(c as DindinContext, err('D01', 400, 'Giỏ hàng trống hoặc phiên đã hết hạn'));
    }

    const configRow = await queryFirst<{ config: string }>(c.env.AURA_DB, 'SELECT config FROM dindin_config LIMIT 1');
    if (!configRow?.config) {
      return errorResponse(c as DindinContext, err('D07', 400, 'Định dạng config menu không hợp lệ'));
    }
    let config: Record<string, unknown>;
    try {
      config = JSON.parse(configRow.config) as Record<string, unknown>;
    } catch {
      return errorResponse(c as DindinContext, err('D07', 400, 'Định dạng config menu không hợp lệ'));
    }

    const sections = Array.isArray((config.menu as Record<string, unknown>)?.sections)
      ? ((config.menu as Record<string, unknown>).sections as Array<{ items?: unknown[] }>)
      : [];
    const lookup = new Map<string, { id?: string; price: number; sold_out: boolean; name: string }>();
    for (const section of sections) {
      const items = section.items ?? [];
      for (const raw of items) {
        const mi = raw as { id?: string; name?: string; price?: number; sold_out?: boolean };
        if (!mi.name) {
          continue;
        }
        const entry = { id: mi.id, price: Number(mi.price ?? 0), sold_out: Boolean(mi.sold_out), name: mi.name };
        lookup.set(mi.name.toLowerCase(), entry);
        if (mi.id) {
          lookup.set(mi.id, entry);
        }
      }
    }

    let totalFromMenu = 0;
    for (const it of cart.items) {
      const cast = it as { id?: string; name?: string; price?: number; qty?: number };
      const qty = Math.max(1, Number(cast.qty ?? 1));
      const entry = lookup.get((cast.name ?? '').toLowerCase()) ?? lookup.get(cast.id ?? '');
      if (!entry) {
        return errorResponse(c as DindinContext, err('D02', 422, 'Sản phẩm không tồn tại trên menu hoặc giá thay đổi >10%'));
      }
      const cartPrice = Number(cast.price ?? entry.price);
      const delta = Number(
        entry.price === 0 ? Number(cartPrice !== 0) : Math.abs(cartPrice - entry.price) / Math.max(1, entry.price)
      );
      if (delta > 0.10) {
        return errorResponse(c as DindinContext, err('D02', 422, 'Sản phẩm không tồn tại trên menu hoặc giá thay đổi >10%'));
      }
      if (entry.sold_out) {
        return errorResponse(c as DindinContext, err('D04', 409, 'Món đã hết hàng hoặc xung đột nguyên liệu'));
      }
      totalFromMenu += entry.price * qty;
    }

    if (idempotencyKey) {
      await kvSet(
        c.env.AUTH_KV,
        idempotencyKVKey(idempotencyKey),
        JSON.stringify({ queued: true, at: new Date().toISOString() }),
        86400
      );
    }

    const orderId = `DIN${Date.now().toString(36).toUpperCase()}`;
    const itemsJson = JSON.stringify(
      cart.items.map((i) => ({
        product_id: i.id ?? `dindin_${(i.name ?? '').replace(/\s+/g, '_').toLowerCase()}`,
        quantity: Math.max(1, Number(i.qty ?? 1)),
        price: Number(i.price ?? 0)
      }))
    );
    try {
      await execute(
        c.env.AURA_DB,
        'INSERT INTO orders (id, customer_name, customer_phone, customer_email, payment_method, items, total, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        orderId,
        'DIN',
        sessionId,
        null,
        payment_method,
        itemsJson,
        Math.max(0, totalFromMenu),
        'pending'
      );
    } catch {
      return errorResponse(c as DindinContext, err('D06', 500, 'Lỗi ghi CSDL - vui lòng thử lại sau'));
    }

    await writeCart(c.env, sessionId, emptyCart());

    if (idempotencyKey) {
      await kvSet(
        c.env.AUTH_KV,
        idempotencyKVKey(idempotencyKey),
        JSON.stringify({ ok: true, orderId, status: 'pending', at: new Date().toISOString() })
      );
    }
    return c.json({ success: true, orderId, status: 'pending' });
  } catch {
    return errorResponse(c as DindinContext, err('D06', 500, 'Lỗi ghi CSDL - vui lòng thử lại sau'));
  }
});

export default dindinRouter;
