import type { Hono } from 'hono';
import { publishOrderEvent } from '@aura/domain-order';
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
  // ── GET /checkouts ──────────────────────────────────────────────────────────
  router.get('/checkouts', async (c) => {
    const statusFilter = c.req.query('status');
    let checkouts: Array<Record<string, unknown>> = [];
    try {
      const { results } = await c.env.AURA_DB.prepare(
        "SELECT id, customer_name, customer_phone, payment_method, items, total, status, created_at FROM orders WHERE customer_name = 'DIN' OR id LIKE 'DIN%' ORDER BY created_at DESC LIMIT 50"
      ).all<{
        id: string;
        customer_name: string | null;
        customer_phone: string | null;
        payment_method: string | null;
        items: string | null;
        total: number | null;
        status: string | null;
        created_at: string | null;
      }>();

      for (const row of results || []) {
        const rowStatus = row.status || 'pending';
        if (statusFilter && statusFilter !== 'all' && rowStatus !== statusFilter) {
          continue;
        }
        let parsedItems: Array<Record<string, unknown>> = [];
        try {
          const raw = JSON.parse(row.items || '[]');
          if (Array.isArray(raw)) {
            parsedItems = raw.map((it: Record<string, unknown>) => {
              const qty = Math.max(1, Number(it.quantity ?? it.qty ?? 1));
              return {
                ...it,
                id: String(it.product_id ?? it.id ?? ''),
                name: String(it.name ?? ''),
                price: Number(it.price ?? 0),
                qty,
                quantity: qty,
              };
            });
          }
        } catch {
          parsedItems = [];
        }
        const printedState = await kvGet<{ printed?: boolean }>(c.env.AUTH_KV, `dindin:print:${row.id}`);
        const qcState = await kvGet<{ qcPassed?: boolean }>(c.env.AUTH_KV, `dindin:qc:${row.id}`);
        checkouts.push({
          id: row.id,
          orderId: row.id,
          sessionId: row.customer_phone || '',
          payment_method: row.payment_method || 'cod',
          paymentMethod: row.payment_method || 'cod',
          items: parsedItems,
          total: Number(row.total ?? 0),
          status: row.status || 'pending',
          printed: Boolean(printedState?.printed),
          qcPassed: Boolean(qcState?.qcPassed || row.status === 'completed'),
          created_at: row.created_at || new Date().toISOString(),
          createdAt: row.created_at || new Date().toISOString(),
        });
      }
    } catch {
      checkouts = [];
    }
    return c.json({ success: true, data: checkouts, checkouts });
  });

  // ── POST /checkout/:orderId/print ───────────────────────────────────────────
  router.post('/checkout/:orderId/print', async (c) => {
    const { orderId } = c.req.param();
    const printedAt = new Date().toISOString();
    await kvSet(c.env.AUTH_KV, `dindin:print:${orderId}`, JSON.stringify({ printed: true, printedAt }), 86400);
    return c.json({ success: true, orderId, printed: true, printedAt });
  });

  // ── POST /checkout/:orderId/qc ──────────────────────────────────────────────
  router.post('/checkout/:orderId/qc', async (c) => {
    const { orderId } = c.req.param();
    const checkedAt = new Date().toISOString();
    await kvSet(c.env.AUTH_KV, `dindin:qc:${orderId}`, JSON.stringify({ qcPassed: true, checkedAt }), 86400);
    try {
      await execute(c.env.AURA_DB, 'UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', 'completed', checkedAt, orderId);
    } catch {
      // Best-effort DB status update
    }
    if (c.env.AUTH_KV) {
      await Promise.all([
        kvSet(c.env.AUTH_KV, 'latest_order_ts', checkedAt, 3600),
        kvSet(c.env.AUTH_KV, 'orders:latest_updated_at', checkedAt, 3600),
        publishOrderEvent(c.env.AUTH_KV, orderId, 'completed').catch(() => {}),
      ]).catch(() => undefined);
    }
    return c.json({ success: true, orderId, qcPassed: true, status: 'completed', checkedAt });
  });

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
        const cached = await kvGet<{ ok?: boolean; orderId?: string; status?: string; at?: string }>(
          c.env.AUTH_KV,
          idempotencyKVKey(idempotencyKey)
        );
        if (cached && cached.orderId) {
          return c.json({ success: true, orderId: cached.orderId, status: cached.status || 'pending', cached: true });
        }
      }

      const cart = await readCartRD(c.env, sessionId);
      if (!cart || cart.items.length === 0) {
        return errorResponse(c as DindinContext, err('D01', 400, 'Giỏ hàng trống hoặc phiên đã hết hạn'));
      }

      let configRow: { config: string } | null = null;
      try {
        configRow = await queryFirst<{ config: string }>(c.env.AURA_DB, 'SELECT config FROM dindin_config LIMIT 1');
      } catch {
        const kvConfig = await kvGet<Record<string, unknown> | string>(c.env.AUTH_KV, 'dindin:config');
        if (kvConfig) {
          configRow = { config: typeof kvConfig === 'string' ? kvConfig : JSON.stringify(kvConfig) };
        }
      }
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
          name: i.name ?? '',
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
        if (idempotencyKey && c.env.AUTH_KV) {
          await c.env.AUTH_KV.delete(idempotencyKVKey(idempotencyKey)).catch(() => {});
        }
        return errorResponse(c as DindinContext, err('D06', 500, 'Lỗi ghi CSDL - vui lòng thử lại sau'));
      }

      await writeCart(c.env, sessionId, emptyCart());

      if (c.env.AUTH_KV) {
        const ts = new Date().toISOString();
        await Promise.all([
          kvSet(c.env.AUTH_KV, 'latest_order_ts', ts, 3600),
          kvSet(c.env.AUTH_KV, 'orders:latest_updated_at', ts, 3600),
          kvSet(c.env.AUTH_KV, `order_event:${orderId}`, JSON.stringify({ status: 'pending', updatedAt: ts }), 3600),
          publishOrderEvent(c.env.AUTH_KV, orderId, 'pending').catch(() => {}),
        ]).catch(() => undefined);
      }

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
