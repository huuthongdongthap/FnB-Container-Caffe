import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import {
  err,
  errorResponse,
  readCartRD,
  writeCart,
  emptyCart,
  type DindinContext,
} from './types';

export function registerCartHandlers(router: Hono<{ Bindings: Env }>): void {
  // ── GET /carts ───────────────────────────────────────────────────────────────
  router.get('/carts', async (c) => {
    let carts: Array<Record<string, unknown>> = [];
    try {
      const { results } = await c.env.AURA_DB.prepare(
        'SELECT session_id, cart, updated_at FROM dindin_carts ORDER BY updated_at DESC LIMIT 50'
      ).all<{ session_id: string; cart: string; updated_at?: string }>();
      for (const row of results || []) {
        try {
          const parsed = JSON.parse(row.cart) as {
            items?: Array<Record<string, unknown>>;
            total?: number;
            createdAt?: string;
            updatedAt?: string;
          };
          const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
          const items = rawItems.map((it) => {
            const qty = Math.max(1, Number(it.qty ?? it.quantity ?? 1));
            return {
              ...it,
              id: String(it.id ?? ''),
              name: String(it.name ?? it.id ?? 'Item'),
              price: Number(it.price ?? 0),
              qty,
              quantity: qty,
            };
          });
          const ts = row.updated_at || new Date().toISOString();
          carts.push({
            sessionId: row.session_id,
            items,
            total: Number(parsed.total ?? items.reduce((s, i) => s + i.price * i.qty, 0)),
            createdAt: parsed.createdAt || ts,
            updatedAt: parsed.updatedAt || ts,
          });
        } catch {
          // skip malformed cart JSON
        }
      }
    } catch {
      carts = [];
    }
    return c.json({ success: true, data: carts, carts });
  });

  // ── GET /cart/:sessionId ─────────────────────────────────────────────────────
  router.get('/cart/:sessionId', async (c) => {
    const { sessionId } = c.req.param();
    const cart = (await readCartRD(c.env, sessionId)) ?? emptyCart();
    return c.json({ success: true, data: { sessionId, ...cart }, cart: { sessionId, ...cart } });
  });

  // ── PATCH /cart/:sessionId ───────────────────────────────────────────────────
  router.patch('/cart/:sessionId', async (c) => {
    const { sessionId } = c.req.param();
    const body = await c.req.json<{
      action?: 'add' | 'remove' | 'update';
      op?: 'add' | 'remove' | 'update';
      itemId?: string;
      qty?: number;
      item?: {
        id?: string;
        name?: string;
        price?: number;
        qty?: number;
        quantity?: number;
      };
    }>();
    const action = body.action ?? body.op;
    if (!action || !['add', 'remove', 'update'].includes(action)) {
      return errorResponse(c as DindinContext, err('D07', 400, 'action phải là add|remove|update'));
    }
    const item = body.item ?? (body.itemId ? { id: body.itemId, qty: body.qty ?? 1 } : undefined);
    if (!item) {
      return errorResponse(c as DindinContext, err('D07', 400, 'item là bắt buộc'));
    }
    const cart = (await readCartRD(c.env, sessionId)) ?? emptyCart();

    if (action === 'add') {
      let itemName = item.name;
      let itemPrice = item.price;
      if ((!itemName || itemPrice === undefined) && item.id) {
        try {
          const cfgRow = await c.env.AURA_DB.prepare('SELECT config FROM dindin_config LIMIT 1').first<{ config: string }>();
          if (cfgRow?.config) {
            const cfg = JSON.parse(cfgRow.config) as { menu?: { sections?: Array<{ items?: Array<{ id?: string; name?: string; price?: number }> }> } };
            for (const sec of cfg.menu?.sections ?? []) {
              const found = (sec.items ?? []).find((mi) => mi.id === item.id || mi.name === item.id);
              if (found) {
                itemName = itemName ?? found.name;
                itemPrice = itemPrice ?? found.price;
                break;
              }
            }
          }
        } catch {
          // config enrichment is best-effort
        }
      }
      const qty = Math.max(1, Number(item.qty ?? item.quantity ?? 1));
      const price = Number(itemPrice ?? 0);
      cart.items.push({ ...item, name: itemName ?? item.id ?? '', price, qty, quantity: qty } as (typeof cart.items)[number]);
      cart.total = Math.round(cart.total + price * qty);
    } else if (action === 'remove') {
      if (!item.id) {
        return errorResponse(c as DindinContext, err('D07', 400, 'item.id là bắt buộc'));
      }
      const removedPrices = cart.items
        .filter((it) => it.id === item.id)
        .reduce((sum, it) => sum + (Number(it.price ?? 0) * Number(it.qty ?? 1)), 0);
      cart.items = cart.items.filter((it) => it.id !== item.id);
      cart.total = Math.max(0, cart.total - removedPrices);
    } else {
      const idx = cart.items.findIndex((it) => it.id === item.id);
      if (idx === -1) {
        return errorResponse(c as DindinContext, err('D01', 400, 'Món không có trong giỏ'));
      }
      const prevQty = Math.max(1, Number(cart.items[idx].qty ?? 1));
      const prevPrice = Number(cart.items[idx].price ?? 0);
      const nextQty = Math.max(1, Number(item.qty ?? item.quantity ?? prevQty));
      const nextPrice = Number(item.price ?? prevPrice);
      cart.items[idx] = { ...cart.items[idx], ...item, price: nextPrice, qty: nextQty, quantity: nextQty } as (typeof cart.items)[number];
      cart.total = Math.round(cart.total + (nextPrice * (nextQty - prevQty)));
    }

    await writeCart(c.env, sessionId, cart);
    return c.json({ success: true, data: { sessionId, ...cart }, cart: { sessionId, ...cart } });
  });
}
