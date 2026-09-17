import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { queryFirst, execute } from '../../lib/db';
import { kvGet, kvSet } from '../../lib/kv';
import {
  dindinCheckoutSchema,
  err,
  errorResponse,
  readCartRD,
  writeCart,
  emptyCart,
  idempotencyKVKey,
  type DindinContext,
} from './types';

export function registerCheckoutHandlers(router: Hono<{ Bindings: Env }>): void {
  // ── POST /checkout ──────────────────────────────────────────────────────────
  router.post('/checkout', async (c) => {
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
          price: Number(i.price ?? 0),
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
}
