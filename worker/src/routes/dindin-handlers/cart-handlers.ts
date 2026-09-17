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
  // ── GET /cart/:sessionId ─────────────────────────────────────────────────────
  router.get('/cart/:sessionId', async (c) => {
    const { sessionId } = c.req.param();
    const cart = await readCartRD(c.env, sessionId);
    return c.json({ success: true, data: cart ?? emptyCart() });
  });

  // ── PATCH /cart/:sessionId ───────────────────────────────────────────────────
  router.patch('/cart/:sessionId', async (c) => {
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
}
