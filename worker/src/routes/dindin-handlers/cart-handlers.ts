import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { matchesTenantRow } from '../../lib/db';
import {
  DINDIN_SESSION_ID_RE,
  err,
  errorResponse,
  hasForbiddenTenantOverride,
  resolveDinDinTenant,
  readCartRD,
  readConfigRaw,
  writeCart,
  emptyCart,
  type DindinContext,
} from './types';

export function registerCartHandlers(router: Hono<{ Bindings: Env }>): void {
  // ── GET /carts ───────────────────────────────────────────────────────────────
  router.get('/carts', async (c) => {
    if (hasForbiddenTenantOverride(c as unknown as Parameters<typeof hasForbiddenTenantOverride>[0])) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const tenantId = resolveDinDinTenant(c as unknown as Parameters<typeof resolveDinDinTenant>[0]);
    let carts: Array<Record<string, unknown>> = [];
    try {
      let results: Array<{ session_id: string; cart: string; raw?: string; updated_at?: string; tenant_id?: string | null }> | undefined;
      const effectiveTenant = tenantId?.trim() || 'default';
      try {
        const res = await c.env.AURA_DB.prepare(
          "SELECT *, COALESCE(raw, cart) as cart FROM dindin_cart WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) ORDER BY updated_at DESC LIMIT 50"
        ).bind(effectiveTenant, effectiveTenant).all<{ session_id: string; cart: string; raw?: string; updated_at?: string; tenant_id?: string | null }>();
        results = res.results;
      } catch {
        if (effectiveTenant !== 'default' && effectiveTenant !== '*') {
          results = [];
        } else {
          try {
            const res = await c.env.AURA_DB.prepare(
              'SELECT *, COALESCE(raw, cart) as cart FROM dindin_cart ORDER BY updated_at DESC LIMIT 50'
            ).all<{ session_id: string; cart: string; raw?: string; updated_at?: string; tenant_id?: string | null }>();
            results = res.results;
          } catch {
            try {
              const res = await c.env.AURA_DB.prepare(
                'SELECT session_id, COALESCE(raw, cart) as cart, raw, updated_at FROM dindin_cart ORDER BY updated_at DESC LIMIT 50'
              ).all<{ session_id: string; cart: string; raw?: string; updated_at?: string }>();
              results = res.results;
            } catch {
              const res = await c.env.AURA_DB.prepare(
                'SELECT session_id, cart, updated_at FROM dindin_carts ORDER BY updated_at DESC LIMIT 50'
              ).all<{ session_id: string; cart: string; updated_at?: string }>();
              results = res.results;
            }
          }
        }
      }
      const prefix = tenantId && tenantId !== 'default' && tenantId !== '*' ? `${tenantId}::` : '';
      for (const row of results || []) {
        const rawSessionId = String(row.session_id || '');
        if ('tenant_id' in row && row.tenant_id !== undefined) {
          if (!matchesTenantRow(row as unknown as Record<string, unknown>, tenantId)) {
            continue;
          }
        } else if (prefix) {
          if (!rawSessionId.startsWith(prefix)) {
            continue;
          }
        } else if (rawSessionId.includes('::') && !rawSessionId.startsWith('default::')) {
          continue;
        }
        const displaySessionId = prefix && rawSessionId.startsWith(prefix)
          ? rawSessionId.slice(prefix.length)
          : rawSessionId.startsWith('default::')
            ? rawSessionId.slice('default::'.length)
            : rawSessionId;
        try {
          const parsed = JSON.parse(row.cart || (row as { raw?: string }).raw || '{}') as {
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
            sessionId: displaySessionId,
            session_id: displaySessionId,
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
    if (hasForbiddenTenantOverride(c as unknown as Parameters<typeof hasForbiddenTenantOverride>[0])) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const { sessionId } = c.req.param();
    if (!DINDIN_SESSION_ID_RE.test(sessionId)) {
      return errorResponse(c as DindinContext, err('D07', 400, 'sessionId không hợp lệ'));
    }
    const tenantId = resolveDinDinTenant(c as unknown as Parameters<typeof resolveDinDinTenant>[0]);
    const cart = (await readCartRD(c.env, sessionId, tenantId)) ?? emptyCart();
    return c.json({ success: true, data: { sessionId, ...cart }, cart: { sessionId, ...cart } });
  });

  // ── PATCH /cart/:sessionId & POST /cart ──────────────────────────────────────
  const handleUpsertCart = async (c: DindinContext) => {
    if (hasForbiddenTenantOverride(c as unknown as Parameters<typeof hasForbiddenTenantOverride>[0])) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const paramSessionId = c.req.param('sessionId');
    if (paramSessionId && !DINDIN_SESSION_ID_RE.test(paramSessionId)) {
      return errorResponse(c as DindinContext, err('D07', 400, 'sessionId không hợp lệ'));
    }
    const tenantId = resolveDinDinTenant(c as unknown as Parameters<typeof resolveDinDinTenant>[0]);
    const body = await c.req.json<{
      sessionId?: string;
      session_id?: string;
      action?: 'add' | 'remove' | 'update';
      op?: 'add' | 'remove' | 'update';
      itemId?: string;
      qty?: number;
      items?: Array<{
        id?: string;
        product_id?: string;
        name?: string;
        price?: number;
        qty?: number;
        quantity?: number;
      }>;
      item?: {
        id?: string;
        product_id?: string;
        name?: string;
        price?: number;
        qty?: number;
        quantity?: number;
      };
    }>();
    const sessionId = String(paramSessionId || body.sessionId || body.session_id || '').trim();
    if (!DINDIN_SESSION_ID_RE.test(sessionId)) {
      return errorResponse(c as DindinContext, err('D07', 400, 'sessionId không hợp lệ'));
    }
    const action = body.action ?? body.op;
    const cart = (await readCartRD(c.env, sessionId, tenantId)) ?? emptyCart();

    if (!action && Array.isArray(body.items)) {
      const normalizedItems: typeof cart.items = [];
      let total = 0;
      for (const rawItem of body.items) {
        if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
          return errorResponse(c as DindinContext, err('D07', 400, 'item không hợp lệ'));
        }
        if (
          rawItem.id &&
          rawItem.product_id &&
          String(rawItem.id).trim() !== String(rawItem.product_id).trim()
        ) {
          return errorResponse(c as DindinContext, err('D07', 400, 'id và product_id không khớp'));
        }
        if (
          rawItem.qty !== undefined &&
          rawItem.quantity !== undefined &&
          Math.floor(Number(rawItem.qty)) !== Math.floor(Number(rawItem.quantity))
        ) {
          return errorResponse(c as DindinContext, err('D07', 400, 'Số lượng không đồng nhất'));
        }
        const rawQty = Number(rawItem.qty ?? rawItem.quantity ?? 1);
        const qty = Math.floor(rawQty);
        const price = Number(rawItem.price ?? 0);
        if (!Number.isFinite(rawQty) || !Number.isFinite(qty) || qty < 1 || qty > 100 || !Number.isFinite(price) || price < 0) {
          return errorResponse(c as DindinContext, err('D07', 400, 'Số lượng hoặc đơn giá không hợp lệ'));
        }
        const id = String(rawItem.id ?? rawItem.product_id ?? '').trim();
        const name = String(rawItem.name ?? id ?? '').trim();
        normalizedItems.push({ id, name, price, qty, quantity: qty } as (typeof cart.items)[number]);
        total += Math.round(price * qty);
      }
      cart.items = normalizedItems;
      cart.total = Math.max(0, total);
      await writeCart(c.env, sessionId, cart, tenantId);
      return c.json({ success: true, data: { sessionId, ...cart }, cart: { sessionId, ...cart } });
    }

    if (!action || !['add', 'remove', 'update'].includes(action)) {
      return errorResponse(c as DindinContext, err('D07', 400, 'action phải là add|remove|update'));
    }
    const item = body.item ?? (body.itemId ? { id: body.itemId, qty: body.qty ?? 1 } : undefined);
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return errorResponse(c as DindinContext, err('D07', 400, 'item là bắt buộc'));
    }
    if (item.id && item.product_id && String(item.id).trim() !== String(item.product_id).trim()) {
      return errorResponse(c as DindinContext, err('D07', 400, 'id và product_id không khớp'));
    }
    if (
      item.qty !== undefined &&
      item.quantity !== undefined &&
      Math.floor(Number(item.qty)) !== Math.floor(Number(item.quantity))
    ) {
      return errorResponse(c as DindinContext, err('D07', 400, 'Số lượng không đồng nhất'));
    }

    if (action === 'add') {
      const resolvedItemId = String(item.id ?? item.product_id ?? '').trim();
      let itemName = item.name;
      let itemPrice = item.price;
      if ((!itemName || itemPrice === undefined) && resolvedItemId) {
        try {
          const cfgRow = await readConfigRaw(c.env, tenantId);
          if (cfgRow?.config) {
            const cfg = JSON.parse(cfgRow.config) as { menu?: { sections?: Array<{ items?: Array<{ id?: string; name?: string; price?: number }> }> } };
            for (const sec of cfg.menu?.sections ?? []) {
              const found = (sec.items ?? []).find((mi) => mi.id === resolvedItemId || mi.name === resolvedItemId);
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
      const rawQty = Number(item.qty ?? item.quantity ?? 1);
      const qty = Math.floor(rawQty);
      const rawPrice = Number(itemPrice ?? 0);
      if (!Number.isFinite(rawQty) || !Number.isFinite(qty) || qty < 1 || qty > 100 || !Number.isFinite(rawPrice) || rawPrice < 0) {
        return errorResponse(c as DindinContext, err('D07', 400, 'Số lượng hoặc đơn giá không hợp lệ'));
      }
      const price = rawPrice;
      cart.items.push({
        id: resolvedItemId,
        name: String(itemName ?? resolvedItemId ?? ''),
        price,
        qty,
        quantity: qty,
      } as (typeof cart.items)[number]);
      cart.total = Math.round(cart.total + price * qty);
    } else if (action === 'remove') {
      const targetId = String(item.id ?? item.product_id ?? '').trim();
      if (!targetId) {
        return errorResponse(c as DindinContext, err('D07', 400, 'item.id là bắt buộc'));
      }
      const removedPrices = cart.items
        .filter((it) => it.id === targetId)
        .reduce((sum, it) => sum + (Number(it.price ?? 0) * Math.max(1, Math.floor(Number(it.qty ?? (it as { quantity?: number }).quantity ?? 1)))), 0);
      cart.items = cart.items.filter((it) => it.id !== targetId);
      cart.total = Math.max(0, cart.total - removedPrices);
    } else {
      const targetId = String(item.id ?? item.product_id ?? '').trim();
      const idx = cart.items.findIndex((it) => it.id === targetId);
      if (idx === -1) {
        return errorResponse(c as DindinContext, err('D01', 400, 'Món không có trong giỏ'));
      }
      const prevQty = Math.max(1, Math.floor(Number(cart.items[idx].qty ?? (cart.items[idx] as { quantity?: number }).quantity ?? 1)));
      const prevPrice = Number(cart.items[idx].price ?? 0);
      const rawNextQty = Number(item.qty ?? item.quantity ?? prevQty);
      const nextQty = Math.floor(rawNextQty);
      const rawNextPrice = Number(item.price ?? prevPrice);
      if (!Number.isFinite(rawNextQty) || !Number.isFinite(nextQty) || nextQty < 1 || nextQty > 100 || !Number.isFinite(rawNextPrice) || rawNextPrice < 0) {
        return errorResponse(c as DindinContext, err('D07', 400, 'Số lượng hoặc đơn giá không hợp lệ'));
      }
      const nextPrice = rawNextPrice;
      cart.items[idx] = {
        id: targetId,
        name: String(item.name ?? cart.items[idx].name ?? targetId ?? ''),
        price: nextPrice,
        qty: nextQty,
        quantity: nextQty,
      } as (typeof cart.items)[number];
      cart.total = Math.max(0, Math.round(cart.total + (nextPrice * nextQty - prevPrice * prevQty)));
    }

    await writeCart(c.env, sessionId, cart, tenantId);
    return c.json({ success: true, data: { sessionId, ...cart }, cart: { sessionId, ...cart } });
  };

  router.patch('/cart/:sessionId', handleUpsertCart);
  router.post('/cart/:sessionId', handleUpsertCart);
  router.post('/cart', handleUpsertCart);
}
