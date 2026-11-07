import type { Context, Hono } from 'hono';
import { publishOrderEvent } from '@aura/domain-order';
import type { Env } from '../../types/env';
import { queryFirst, execute, matchesTenantRow } from '../../lib/db';
import { kvGet, kvSet } from '../../lib/kv';
import {
  dindinCheckoutSchema,
  err,
  errorResponse,
  hasCrossTenantDindinOverride,
  hasForbiddenTenantOverride,
  resolveDinDinTenant,
  readCartRD,
  readConfigRaw,
  writeCart,
  emptyCart,
  configKVKey,
  idempotencyKVKey,
  type DindinContext,
} from './types';

export function registerCheckoutHandlers(router: Hono<{ Bindings: Env }>): void {
  // ── GET /checkouts ──────────────────────────────────────────────────────────
  router.get('/checkouts', async (c) => {
    if (
      hasCrossTenantDindinOverride(c as unknown as Parameters<typeof hasCrossTenantDindinOverride>[0]) ||
      hasForbiddenTenantOverride(c as unknown as Parameters<typeof hasForbiddenTenantOverride>[0])
    ) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const statusFilter = c.req.query('status');
    const tenantId = resolveDinDinTenant(c as unknown as Parameters<typeof resolveDinDinTenant>[0]);
    let checkouts: Array<Record<string, unknown>> = [];
    try {
      let rows: Array<{
        id: string;
        customer_name: string | null;
        customer_phone: string | null;
        payment_method: string | null;
        items: string | null;
        total: number | null;
        status: string | null;
        created_at: string | null;
        tenant_id?: string | null;
      }> = [];
      const effectiveTenant = tenantId?.trim() || 'default';
      try {
        const res = await c.env.AURA_DB.prepare(
          "SELECT id, customer_name, customer_phone, payment_method, items, total, status, created_at, tenant_id FROM orders WHERE customer_name = 'DIN' AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) OR (id LIKE 'DIN%' AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)) ORDER BY created_at DESC LIMIT 50"
        ).bind(effectiveTenant, effectiveTenant, effectiveTenant, effectiveTenant).all<typeof rows[number]>();
        rows = res.results || [];
      } catch {
        try {
          const res = await c.env.AURA_DB.prepare(
            "SELECT id, customer_name, customer_phone, payment_method, items, total, status, created_at, tenant_id FROM orders WHERE (customer_name = 'DIN' OR id LIKE 'DIN%') AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) ORDER BY created_at DESC LIMIT 50"
          ).bind(effectiveTenant, effectiveTenant).all<typeof rows[number]>();
          rows = res.results || [];
        } catch {
          if (effectiveTenant === 'default' || effectiveTenant === '*') {
            const res = await c.env.AURA_DB.prepare(
              "SELECT id, customer_name, customer_phone, payment_method, items, total, status, created_at FROM orders WHERE customer_name = 'DIN' OR id LIKE 'DIN%' ORDER BY created_at DESC LIMIT 50"
            ).all<typeof rows[number]>();
            rows = res.results || [];
          }
        }
      }

      for (const row of rows) {
        if (!matchesTenantRow(row, tenantId)) {
          continue;
        }
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
        const rowTenant =
          (typeof row.tenant_id === 'string' && row.tenant_id.trim() ? row.tenant_id.trim() : '') ||
          (tenantId && tenantId !== '*' && tenantId.toLowerCase() !== 'hq' ? tenantId : 'default');
        const printKey = rowTenant !== 'default' ? `dindin:print:${rowTenant}:${row.id}` : `dindin:print:${row.id}`;
        const qcKey = rowTenant !== 'default' ? `dindin:qc:${rowTenant}:${row.id}` : `dindin:qc:${row.id}`;
        const printedState = await kvGet<{ printed?: boolean }>(c.env.AUTH_KV, printKey);
        const qcState = await kvGet<{ qcPassed?: boolean }>(c.env.AUTH_KV, qcKey);
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
    if (hasForbiddenTenantOverride(c as unknown as Parameters<typeof hasForbiddenTenantOverride>[0])) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const { orderId } = c.req.param();
    const tenantId = resolveDinDinTenant(c as unknown as Parameters<typeof resolveDinDinTenant>[0]);
    let ordRow: { id: string; tenant_id?: string | null } | null = null;
    try {
      ordRow = await c.env.AURA_DB.prepare('SELECT id, tenant_id FROM orders WHERE id = ?').bind(orderId).first<{ id: string; tenant_id?: string | null }>();
    } catch {
      if (!tenantId || tenantId === 'default' || tenantId === '*') {
        ordRow = await c.env.AURA_DB.prepare('SELECT id FROM orders WHERE id = ?').bind(orderId).first<{ id: string }>().catch(() => null);
      } else {
        ordRow = null;
      }
    }
    if (!ordRow || !matchesTenantRow(ordRow, tenantId)) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }
    const printedAt = new Date().toISOString();
    const rowTenant =
      (typeof ordRow.tenant_id === 'string' && ordRow.tenant_id.trim() ? ordRow.tenant_id.trim() : '') ||
      (tenantId && tenantId !== '*' && tenantId.toLowerCase() !== 'hq' ? tenantId : 'default');
    const printKey = rowTenant !== 'default' ? `dindin:print:${rowTenant}:${orderId}` : `dindin:print:${orderId}`;
    await kvSet(c.env.AUTH_KV, printKey, JSON.stringify({ printed: true, printedAt }), 86400);
    return c.json({ success: true, orderId, printed: true, printedAt });
  });

  // ── POST /checkout/:orderId/qc ──────────────────────────────────────────────
  const handleQcComplete = async (c: Context<{ Bindings: Env }>) => {
    if (hasForbiddenTenantOverride(c as unknown as Parameters<typeof hasForbiddenTenantOverride>[0])) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const params = c.req.param() as { orderId?: string; id?: string };
    const orderId = params.orderId || params.id || '';
    const tenantId = resolveDinDinTenant(c as unknown as Parameters<typeof resolveDinDinTenant>[0]);
    type QcOrderRow = {
      id: string;
      status?: string | null;
      customer_name?: string | null;
      payment_method?: string | null;
      payment_status?: string | null;
      tenant_id?: string | null;
    };
    let ordRow: QcOrderRow | null = null;
    try {
      ordRow = await c.env.AURA_DB.prepare(
        'SELECT id, status, customer_name, payment_method, payment_status, tenant_id FROM orders WHERE id = ?'
      ).bind(orderId).first<QcOrderRow>();
    } catch {
      ordRow = await c.env.AURA_DB.prepare(
        'SELECT id, status, customer_name, payment_method, tenant_id FROM orders WHERE id = ?'
      ).bind(orderId).first<QcOrderRow>().catch(async () =>
        c.env.AURA_DB.prepare('SELECT id, status, tenant_id FROM orders WHERE id = ?').bind(orderId).first<QcOrderRow>().catch(async () => {
          if (!tenantId || tenantId === 'default' || tenantId === '*') {
            return c.env.AURA_DB.prepare('SELECT id, status, customer_name, payment_method FROM orders WHERE id = ?').bind(orderId).first<QcOrderRow>().catch(async () =>
              c.env.AURA_DB.prepare('SELECT id, status FROM orders WHERE id = ?').bind(orderId).first<QcOrderRow>().catch(async () =>
                c.env.AURA_DB.prepare('SELECT id FROM orders WHERE id = ?').bind(orderId).first<QcOrderRow>().catch(() => null)
              )
            );
          }
          return null;
        })
      );
    }
    if (!ordRow || !matchesTenantRow(ordRow, tenantId)) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }
    const isDindinOrder =
      String(ordRow.id || '').startsWith('DIN') ||
      String(ordRow.customer_name || '').toUpperCase() === 'DIN';
    if (!isDindinOrder) {
      return c.json({ success: false, error: 'Order is not a DinDin order' }, 400);
    }
    if (ordRow.status && ['cancelled', 'canceled', 'failed', 'refunded', 'expired', 'rejected'].includes(String(ordRow.status).trim().toLowerCase())) {
      return c.json({ success: false, error: 'Cannot complete QC for a cancelled or failed order' }, 409);
    }
    const paymentMethod = String(ordRow.payment_method || '').trim().toLowerCase();
    const paymentStatus = ordRow.payment_status != null ? String(ordRow.payment_status).trim().toLowerCase() : '';
    const ordStatus = String(ordRow.status || '').trim().toLowerCase();
    if (paymentStatus && ['refunded', 'failed', 'cancelled', 'canceled'].includes(paymentStatus)) {
      return c.json({ success: false, error: 'Cannot complete QC for refunded or failed payment' }, 409);
    }
    if (paymentStatus && ['unpaid', 'pending'].includes(paymentStatus)) {
      return c.json({ success: false, error: 'Cannot complete QC for unpaid non-cash order' }, 409);
    }
    if (
      !['cash', 'cod', ''].includes(paymentMethod) &&
      paymentStatus !== 'paid' &&
      paymentStatus !== 'completed' &&
      (Boolean(paymentStatus) || !['paid', 'processing', 'preparing', 'ready', 'completed'].includes(ordStatus))
    ) {
      return c.json({ success: false, error: 'Cannot complete QC for unpaid non-cash order' }, 409);
    }
    const checkedAt = new Date().toISOString();
    const rowTenant =
      (typeof ordRow.tenant_id === 'string' && ordRow.tenant_id.trim() ? ordRow.tenant_id.trim() : '') ||
      (tenantId && tenantId !== '*' && tenantId.toLowerCase() !== 'hq' ? tenantId : 'default');
    {
      const tenantId = rowTenant;
      const qcKey = tenantId !== 'default' ? `dindin:qc:${tenantId}:${orderId}` : `dindin:qc:${orderId}`;
      await kvSet(c.env.AUTH_KV, qcKey, JSON.stringify({ qcPassed: true, checkedAt }), 86400);
    }
    try {
      try {
        await execute(
          c.env.AURA_DB,
          "UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status NOT IN ('cancelled', 'canceled', 'failed', 'refunded', 'expired', 'rejected') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
          'completed',
          checkedAt,
          orderId,
          rowTenant
        );
      } catch {
        if (rowTenant === 'default') {
          await execute(
            c.env.AURA_DB,
            "UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status NOT IN ('cancelled', 'canceled', 'failed', 'refunded', 'expired', 'rejected')",
            'completed',
            checkedAt,
            orderId
          );
        }
      }
    } catch {
      // Best-effort DB status update
    }
    const effectiveOrderTenant = rowTenant;
    if (c.env.AUTH_KV) {
      const eventPayload = JSON.stringify({
        orderId,
        status: 'completed',
        tenant_id: effectiveOrderTenant,
        tenantId: effectiveOrderTenant,
        updatedAt: checkedAt,
      });
      await Promise.all([
        kvSet(c.env.AUTH_KV, effectiveOrderTenant === 'default' ? 'latest_order_ts' : `latest_order_ts:${effectiveOrderTenant}`, checkedAt, 3600),
        kvSet(c.env.AUTH_KV, effectiveOrderTenant === 'default' ? 'orders:latest_updated_at' : `orders:latest_updated_at:${effectiveOrderTenant}`, checkedAt, 3600),
        kvSet(c.env.AUTH_KV, `order_event:${effectiveOrderTenant}:${orderId}`, eventPayload, 3600),
        ...(effectiveOrderTenant === 'default'
          ? [kvSet(c.env.AUTH_KV, `order_event:${orderId}`, eventPayload, 3600)]
          : []),
        publishOrderEvent(c.env.AUTH_KV, orderId, 'completed', { tenantId: effectiveOrderTenant }).catch(() => {}),
      ]).catch(() => undefined);
    }
    return c.json({ success: true, orderId, qcPassed: true, status: 'completed', checkedAt });
  };
  router.post('/checkout/:orderId/qc', handleQcComplete);
  router.post('/checkout/:orderId/complete-qc', handleQcComplete);
  router.post('/orders/:id/qc-complete', handleQcComplete);
  router.post('/orders/:id/complete-qc', handleQcComplete);

  // ── POST /checkout ──────────────────────────────────────────────────────────
  router.post('/checkout', async (c) => {
    try {
      if (hasForbiddenTenantOverride(c as unknown as Parameters<typeof hasForbiddenTenantOverride>[0])) {
        return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
      }
      const body = await c.req.json<unknown>();
      const parsed = dindinCheckoutSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(c as DindinContext, err('D03', 400, 'Body không hợp lệ'));
      }
      const { sessionId, payment_method } = parsed.data;
      if (!['cod', 'payos'].includes(payment_method)) {
        return errorResponse(c as DindinContext, err('D03', 400, 'Phương thức thanh toán không hợp lệ - chỉ hỗ trợ cod | payos'));
      }

      const rawTenantId = resolveDinDinTenant(c as unknown as Parameters<typeof resolveDinDinTenant>[0]);
      let effectiveWriteTenant = rawTenantId && rawTenantId !== '*' && rawTenantId.toLowerCase() !== 'hq' ? rawTenantId : '';
      let wildcardCartFallback: { items: Array<{ id?: string; name?: string; price?: number; qty?: number }>; total: number } | null = null;
      if (!effectiveWriteTenant) {
        if (sessionId.includes('::')) {
          const prefix = sessionId.split('::')[0]?.trim() || '';
          effectiveWriteTenant = prefix && prefix !== '*' && prefix.toLowerCase() !== 'hq' ? prefix : '';
        }
        try {
          const cartRow = await queryFirst<{ raw?: string; cart?: string; tenant_id?: string | null; session_id?: string | null }>(
            c.env.AURA_DB,
            'SELECT COALESCE(raw, cart) as raw, tenant_id, session_id FROM dindin_cart WHERE session_id = ? OR session_id LIKE ? LIMIT 1',
            sessionId,
            `%::${sessionId}`
          ).catch(() => null);
          const fallbackRow =
            cartRow ??
            (await queryFirst<{ raw?: string; cart?: string; items?: string; total?: number; tenant_id?: string | null; session_id?: string | null }>(
              c.env.AURA_DB,
              'SELECT *, COALESCE(cart, items) as raw FROM dindin_carts WHERE session_id = ? OR session_id LIKE ? LIMIT 1',
              sessionId,
              `%::${sessionId}`
            ).catch(() => null));
          if (fallbackRow) {
            const rowTenant = typeof fallbackRow.tenant_id === 'string' ? fallbackRow.tenant_id.trim() : '';
            const rowSession = typeof fallbackRow.session_id === 'string' ? fallbackRow.session_id.trim() : '';
            const sessionPrefix = rowSession.includes('::') ? rowSession.split('::')[0]?.trim() || '' : '';
            effectiveWriteTenant =
              (rowTenant && rowTenant !== '*' && rowTenant.toLowerCase() !== 'hq' ? rowTenant : '') ||
              (sessionPrefix && sessionPrefix !== '*' && sessionPrefix.toLowerCase() !== 'hq' ? sessionPrefix : '') ||
              effectiveWriteTenant;
            const rawCartJson =
              (typeof fallbackRow.raw === 'string' && fallbackRow.raw.trim()) ||
              (typeof fallbackRow.cart === 'string' && fallbackRow.cart.trim()) ||
              (typeof (fallbackRow as { items?: string }).items === 'string' && (fallbackRow as { items?: string }).items!.trim()) ||
              '';
            if (rawCartJson) {
              try {
                const parsedCart = JSON.parse(rawCartJson);
                wildcardCartFallback = Array.isArray(parsedCart)
                  ? {
                      items: parsedCart,
                      total: Number(
                        (fallbackRow as { total?: number }).total ??
                          parsedCart.reduce((s: number, i: { price?: number; qty?: number; quantity?: number }) => s + Number(i.price ?? 0) * Number(i.qty ?? i.quantity ?? 1), 0)
                      ),
                    }
                  : parsedCart;
              } catch {
                wildcardCartFallback = null;
              }
            }
          }
        } catch {
          // ignore lookup failure; fall back to default
        }
        if (!effectiveWriteTenant) {
          effectiveWriteTenant = 'default';
        }
      }
      const tenantId = effectiveWriteTenant;
      const idempotencyKey = c.req.header('Idempotency-Key');
      if (idempotencyKey) {
        const cached = await kvGet<{ ok?: boolean; queued?: boolean; orderId?: string; status?: string; at?: string }>(
          c.env.AUTH_KV,
          idempotencyKVKey(idempotencyKey, tenantId)
        );
        if (cached && cached.orderId) {
          return c.json({ success: true, orderId: cached.orderId, status: cached.status || 'pending', cached: true });
        }
        if (cached && cached.queued && !cached.orderId) {
          return c.json({ success: false, error: 'Checkout with this Idempotency-Key is already in progress' }, 409);
        }
      }

      const cart = (await readCartRD(c.env, sessionId, tenantId)) ?? wildcardCartFallback;
      if (!cart || cart.items.length === 0) {
        return errorResponse(c as DindinContext, err('D01', 400, 'Giỏ hàng trống hoặc phiên đã hết hạn'));
      }

      let configRow: { config: string } | null = null;
      try {
        if (tenantId && tenantId !== 'default' && tenantId !== '*') {
          configRow = await readConfigRaw(c.env, tenantId);
        } else {
          try {
            const candidate = await queryFirst<{ config: string; tenant_id?: string | null }>(
              c.env.AURA_DB,
              "SELECT config, tenant_id FROM dindin_config WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = 'default' LIMIT 1"
            );
            if (candidate && matchesTenantRow(candidate, tenantId || 'default')) {
              configRow = candidate;
            }
          } catch {
            const fallbackRow = await queryFirst<{ config: string; tenant_id?: string | null }>(
              c.env.AURA_DB,
              'SELECT config FROM dindin_config LIMIT 1'
            );
            if (fallbackRow && matchesTenantRow(fallbackRow, tenantId || 'default')) {
              configRow = fallbackRow;
            }
          }
        }
      } catch {
        const kvConfig = await kvGet<Record<string, unknown> | string>(c.env.AUTH_KV, configKVKey(tenantId));
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
      const validatedOrderItems: Array<{ product_id: string; name: string; quantity: number; price: number }> = [];
      for (const it of cart.items) {
        const cast = it as { product_id?: string; id?: string; name?: string; price?: number; qty?: number; quantity?: number };
        if (
          cast.qty !== undefined &&
          cast.quantity !== undefined &&
          Math.floor(Number(cast.qty)) !== Math.floor(Number(cast.quantity))
        ) {
          return errorResponse(c as DindinContext, err('D07', 400, 'Số lượng sản phẩm không hợp lệ'));
        }
        const rawQty = Number(cast.qty ?? cast.quantity ?? 1);
        const qty = Math.floor(rawQty);
        if (!Number.isFinite(rawQty) || !Number.isFinite(qty) || qty < 1 || qty > 100) {
          return errorResponse(c as DindinContext, err('D07', 400, 'Số lượng sản phẩm không hợp lệ'));
        }
        const itemIdKey = String(cast.product_id || cast.id || '').trim();
        const itemNameKey = String(cast.name || '').trim().toLowerCase();
        const byId = itemIdKey ? (lookup.get(itemIdKey) ?? lookup.get(itemIdKey.toLowerCase())) : undefined;
        const byName = itemNameKey ? lookup.get(itemNameKey) : undefined;
        if (
          byId &&
          byName &&
          ((byId.id && byName.id && String(byId.id) !== String(byName.id)) ||
            byId.name.toLowerCase() !== byName.name.toLowerCase())
        ) {
          return errorResponse(c as DindinContext, err('D07', 400, 'Cart item id and name mismatch'));
        }
        const entry = byId ?? byName;
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
        validatedOrderItems.push({
          product_id: entry.id || itemIdKey || `dindin_${entry.name.replace(/\s+/g, '_').toLowerCase()}`,
          name: entry.name,
          quantity: qty,
          price: Number(entry.price ?? 0),
        });
      }

      if (idempotencyKey) {
        await kvSet(
          c.env.AUTH_KV,
          idempotencyKVKey(idempotencyKey, tenantId),
          JSON.stringify({ queued: true, at: new Date().toISOString() }),
          86400
        );
      }

      const randBytes = new Uint8Array(3);
      crypto.getRandomValues(randBytes);
      const randHex = Array.from(randBytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
      const orderId = `DIN${Date.now().toString(36).toUpperCase()}${randHex}`;
      const itemsJson = JSON.stringify(validatedOrderItems);
      const writeTenant = effectiveWriteTenant;
      const effectiveOrderTenant = effectiveWriteTenant;
      const initialPaymentStatus = payment_method === 'cod' ? 'cod_pending' : 'pending';
      try {
        try {
          await execute(
            c.env.AURA_DB,
            'INSERT INTO orders (id, customer_name, customer_phone, customer_email, payment_method, items, total, status, tenant_id, payment_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
            orderId,
            'DIN',
            sessionId,
            null,
            payment_method,
            itemsJson,
            Math.max(0, totalFromMenu),
            'pending',
            writeTenant,
            initialPaymentStatus
          );
        } catch (insertErr) {
          const msg = insertErr instanceof Error ? insertErr.message : String(insertErr);
          if (msg.includes('payment_status')) {
            await execute(
              c.env.AURA_DB,
              'INSERT INTO orders (id, customer_name, customer_phone, customer_email, payment_method, items, total, status, tenant_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
              orderId,
              'DIN',
              sessionId,
              null,
              payment_method,
              itemsJson,
              Math.max(0, totalFromMenu),
              'pending',
              writeTenant
            );
          } else {
            if (writeTenant !== 'default') {
              throw insertErr;
            }
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
          }
        }
      } catch {
        if (idempotencyKey && c.env.AUTH_KV) {
          await c.env.AUTH_KV.delete(idempotencyKVKey(idempotencyKey, tenantId)).catch(() => {});
        }
        return errorResponse(c as DindinContext, err('D06', 500, 'Lỗi ghi CSDL - vui lòng thử lại sau'));
      }

      await writeCart(c.env, sessionId, emptyCart(), tenantId);

      if (c.env.AUTH_KV) {
        const ts = new Date().toISOString();
        const eventPayload = JSON.stringify({
          orderId,
          status: 'pending',
          tenant_id: effectiveOrderTenant,
          tenantId: effectiveOrderTenant,
          updatedAt: ts,
        });
        await Promise.all([
          kvSet(c.env.AUTH_KV, effectiveOrderTenant === 'default' ? 'latest_order_ts' : `latest_order_ts:${effectiveOrderTenant}`, ts, 3600),
          kvSet(c.env.AUTH_KV, effectiveOrderTenant === 'default' ? 'orders:latest_updated_at' : `orders:latest_updated_at:${effectiveOrderTenant}`, ts, 3600),
          kvSet(c.env.AUTH_KV, `order_event:${effectiveOrderTenant}:${orderId}`, eventPayload, 3600),
          ...(effectiveOrderTenant === 'default'
            ? [kvSet(c.env.AUTH_KV, `order_event:${orderId}`, eventPayload, 3600)]
            : []),
          publishOrderEvent(c.env.AUTH_KV, orderId, 'pending', { tenantId: effectiveOrderTenant }).catch(() => {}),
        ]).catch(() => undefined);
      }

      if (idempotencyKey) {
        await kvSet(
          c.env.AUTH_KV,
          idempotencyKVKey(idempotencyKey, tenantId),
          JSON.stringify({ ok: true, orderId, status: 'pending', at: new Date().toISOString() })
        );
      }
      return c.json({ success: true, orderId, status: 'pending' });
    } catch {
      return errorResponse(c as DindinContext, err('D06', 500, 'Lỗi ghi CSDL - vui lòng thử lại sau'));
    }
  });
}
