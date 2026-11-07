import { Hono } from 'hono';
import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import type { Env } from 'worker/src/types/env';
import type { Context } from 'hono';
import { executeKdsStatusTransition } from './kds-status-transition';
import { getTenantId } from 'worker/src/middleware/tenant';
import { requireStaff } from 'worker/src/middleware/staff-auth';

const log = createLogger({ route: 'kds-mobile' });

export function hasCrossTenantOverride(
  context: Context<{ Bindings: Env }>,
  user?: { role?: string; tenantId?: string; tenant_id?: string }
): boolean {
  const effectiveUser =
    user ?? (context.get?.('user' as never) as { role?: string; tenantId?: string; tenant_id?: string } | undefined);
  return !verifyKdsMobileTenant(context, effectiveUser, 'read').ok;
}

// Allowed roles per action
const VIEW_ROLES: string[] = ['owner', 'manager', 'supervisor', 'staff', 'kitchen', 'barista', 'chef', 'admin', 'waiter', 'cashier'];
const UPDATE_ROLES: string[] = ['owner', 'manager', 'supervisor', 'staff', 'kitchen', 'barista', 'chef', 'admin', 'waiter'];
const VALID_STATUSES: string[] = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'];

function parseKdsItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function verifyKdsMobileTenant(
  context: Context<{ Bindings: Env }>,
  user: { role?: string; tenantId?: string; tenant_id?: string } | undefined,
  _mode: 'read' | 'write'
): { ok: true; tenantId: string } | { ok: false } {
  const resolvedTenant = getTenantId(context).trim() || 'default';
  const candidateOverrides = [
    typeof context.req?.query === 'function' ? context.req.query('tenant_id') : undefined,
    typeof context.req?.query === 'function' ? context.req.query('tenantId') : undefined,
    typeof context.req?.query === 'function' ? context.req.query('store_id') : undefined,
    typeof context.req?.query === 'function' ? context.req.query('storeId') : undefined,
    typeof context.req?.header === 'function' ? context.req.header('X-Tenant-ID') : undefined,
    typeof context.req?.header === 'function' ? context.req.header('x-tenant-id') : undefined,
    typeof context.req?.header === 'function' ? context.req.header('X-Store-ID') : undefined,
    typeof context.req?.header === 'function' ? context.req.header('x-store-id') : undefined,
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return { ok: false };
  }
  const requestedTenant = candidateOverrides[0] || '';
  const rawUserTenant = user?.tenantId ?? user?.tenant_id;
  const contextTenant =
    typeof (context as unknown as { get?: (k: string) => unknown }).get === 'function' &&
    typeof (context as unknown as { get: (k: string) => unknown }).get('tenantId') === 'string'
      ? String((context as unknown as { get: (k: string) => unknown }).get('tenantId')).trim()
      : '';
  const userTenant =
    (rawUserTenant && String(rawUserTenant).trim()) ||
    (!requestedTenant && contextTenant ? contextTenant : 'default');
  const isHqAdmin =
    (user?.role === 'owner' || user?.role === 'admin') &&
    (userTenant === 'hq' || userTenant === '*' || userTenant.toLowerCase() === 'hq');

  if (isHqAdmin) {
    const cleanRequested =
      requestedTenant && requestedTenant !== '*' && requestedTenant.toLowerCase() !== 'hq'
        ? requestedTenant
        : '';
    const cleanResolved =
      resolvedTenant && resolvedTenant !== '*' && resolvedTenant.toLowerCase() !== 'hq'
        ? resolvedTenant
        : '';
    const normTarget =
      requestedTenant === '*' || requestedTenant.toLowerCase() === 'hq'
        ? '*'
        : cleanRequested || cleanResolved || '*';
    return { ok: true, tenantId: normTarget };
  }

  if (
    userTenant === '*' ||
    userTenant.toLowerCase() === 'hq' ||
    requestedTenant === '*' ||
    requestedTenant.toLowerCase() === 'hq' ||
    contextTenant === '*' ||
    contextTenant.toLowerCase() === 'hq' ||
    resolvedTenant === '*' ||
    resolvedTenant.toLowerCase() === 'hq'
  ) {
    return { ok: false };
  }
  if (resolvedTenant !== userTenant) {
    return { ok: false };
  }
  if (requestedTenant && requestedTenant !== userTenant) {
    return { ok: false };
  }

  return { ok: true, tenantId: userTenant };
}

// GET /mobile/kds/orders — list active kitchen orders
export async function getKdsMobile(
  context: Context<{ Bindings: Env }>
) {
  try {
    const user = context.get('user') as { role?: string; tenantId?: string } | undefined;
    const role = user?.role || '';
    if (!VIEW_ROLES.includes(role)) {
      return errorResponse('Không có quyền', 403);
    }

    const tenantCheck = verifyKdsMobileTenant(context, user, 'read');
    if (!tenantCheck.ok) {
      return errorResponse('Không có quyền truy cập chi nhánh khác', 403);
    }

    const tenantId = tenantCheck.tenantId;
    const tenantClause = tenantId === '*'
      ? ''
      : tenantId === 'default'
        ? " AND (o.tenant_id = ? OR o.tenant_id IS NULL OR o.tenant_id = '' OR TRIM(o.tenant_id) = '')"
        : ' AND (o.tenant_id = ? OR TRIM(o.tenant_id) = ?1)';
    const tenantBinds = tenantId === '*' ? [] : [tenantId];
    let orders: { results: unknown[] };
    try {
      orders = await context.env.AURA_DB
        .prepare(
          `SELECT o.id, o.order_number, o.table_id, o.items, o.notes, o.status, o.order_type, o.payment_status, o.created_at, o.updated_at,
                  COALESCE(t.table_number, t.id) as table_name
           FROM orders o
           LEFT JOIN cafe_tables t ON (t.id = o.table_id OR CAST(t.table_number AS TEXT) = CAST(o.table_id AS TEXT))
             AND COALESCE(NULLIF(t.tenant_id, ''), 'default') = COALESCE(NULLIF(o.tenant_id, ''), 'default')
           WHERE o.status IN ('pending','confirmed','preparing','ready')${tenantClause}
           ORDER BY o.created_at ASC
           LIMIT 200`
        )
        .bind(...tenantBinds).all();
    } catch {
      try {
        orders = await context.env.AURA_DB
          .prepare(
            `SELECT o.id, o.table_id, o.items, o.status, o.created_at, o.updated_at,
                    COALESCE(t.table_number, t.id) as table_name
             FROM orders o
             LEFT JOIN cafe_tables t ON t.id = o.table_id
               AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
             WHERE o.status IN ('pending','confirmed','preparing','ready')${tenantClause}
             ORDER BY o.created_at ASC
             LIMIT 200`
          )
          .bind(...tenantBinds).all();
      } catch {
        orders = await context.env.AURA_DB
          .prepare(
            `SELECT o.id, o.order_number, o.items, o.status, o.created_at, o.updated_at
             FROM orders o
             WHERE o.status IN ('pending','confirmed','preparing','ready')${tenantClause}
             ORDER BY o.created_at ASC
             LIMIT 200`
          )
          .bind(...tenantBinds).all();
      }
    }

    const rows = (orders.results as Array<Record<string, unknown>>).filter(
      (r) => !(r.order_type === 'delivery' && r.payment_status !== 'paid')
    );
    return jsonResponse({
      success: true,
      orders: rows.map((r) => ({
        id: r.id as string,
        order_number: (r.order_number as string | undefined) ?? undefined,
        table_id: r.table_id as string,
        table_name: r.table_name as string | null,
        items: parseKdsItems(r.items),
        notes: (r.notes as string | null | undefined) ?? null,
        status: r.status as string,
        created_at: r.created_at as string,
        updated_at: r.updated_at as string,
      })),
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('getKdsMobile error:', { message: errMsg });
    return errorResponse('Không thể tải danh sách đơn bếp', 500);
  }
}

// POST /api/kds/orders/:id/ready — mark a specific line item (by orderItemId / itemIndex / productId) or order ready
export async function markKdsOrderItemReady(
  context: Context<{ Bindings: Env }>
) {
  try {
    const user = context.get('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
    const role = user?.role || '';
    if (!UPDATE_ROLES.includes(role)) {
      return errorResponse('Không có quyền cập nhật', 403);
    }

    const tenantCheck = verifyKdsMobileTenant(context, user, 'write');
    if (!tenantCheck.ok) {
      return errorResponse('Không có quyền cập nhật chi nhánh khác', 403);
    }

    const orderId = context.req.param('id');
    if (!orderId) {
      return errorResponse('Thiếu order id', 400);
    }

    const body = (await context.req.json().catch(() => ({}))) as {
      productId?: string;
      product_id?: string;
      itemIndex?: number;
      item_index?: number;
      orderItemId?: string;
      order_item_id?: string;
    };

    const tenantId = tenantCheck.tenantId;
    const tenantClause =
      tenantId === '*'
        ? ''
        : tenantId === 'default'
          ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
          : ' AND TRIM(tenant_id) = ?';
    const tenantBinds = tenantId === '*' ? [] : [tenantId];

    const orderRow = await context.env.AURA_DB
      .prepare(`SELECT id, status, items, tenant_id FROM orders WHERE id = ?${tenantClause}`)
      .bind(orderId, ...tenantBinds)
      .first<{ id: string; status: string; items?: string; tenant_id?: string | null }>()
      .catch(() => null);
    if (!orderRow) {
      return errorResponse('Không tìm thấy đơn hàng', 404);
    }

    const rawItems = parseKdsItems(orderRow.items) as Array<Record<string, unknown>>;
    const targetOrderItemId = String(body.orderItemId ?? body.order_item_id ?? '').trim();
    const rawItemIndex = body.itemIndex ?? body.item_index;
    const targetItemIndex =
      rawItemIndex !== undefined && rawItemIndex !== null && Number.isInteger(Number(rawItemIndex))
        ? Number(rawItemIndex)
        : undefined;
    const targetProductId = String(body.productId ?? body.product_id ?? '').trim();

    let matched = false;
    if (targetOrderItemId) {
      for (const it of rawItems) {
        const itId = String(it.id ?? it.orderItemId ?? it.order_item_id ?? '').trim();
        if (itId && itId === targetOrderItemId) {
          it.status = 'ready';
          it.ready = true;
          matched = true;
          break;
        }
      }
    } else if (targetItemIndex !== undefined) {
      if (targetItemIndex < 0 || targetItemIndex >= rawItems.length) {
        return errorResponse('Chỉ mục món không hợp lệ', 400);
      }
      const targetItem = rawItems[targetItemIndex];
      if (targetProductId) {
        const itemProdId = String(targetItem.productId ?? targetItem.product_id ?? targetItem.menuItemId ?? targetItem.id ?? '').trim();
        if (itemProdId && itemProdId !== targetProductId) {
          return errorResponse('Món không khớp với chỉ mục', 400);
        }
      }
      targetItem.status = 'ready';
      targetItem.ready = true;
      matched = true;
    } else if (targetProductId) {
      for (const it of rawItems) {
        const itemProdId = String(it.productId ?? it.product_id ?? it.menuItemId ?? it.id ?? '').trim();
        const isAlreadyReady = it.status === 'ready' || it.ready === true;
        if (itemProdId === targetProductId && !isAlreadyReady) {
          it.status = 'ready';
          it.ready = true;
          matched = true;
          break;
        }
      }
    } else {
      for (const it of rawItems) {
        it.status = 'ready';
        it.ready = true;
      }
      matched = true;
    }

    if (!matched && rawItems.length > 0) {
      return errorResponse('Không tìm thấy món cần cập nhật', 404);
    }

    const effectiveOrderTenant =
      typeof orderRow.tenant_id === 'string' &&
      orderRow.tenant_id.trim() &&
      orderRow.tenant_id.trim() !== '*' &&
      orderRow.tenant_id.trim().toLowerCase() !== 'hq'
        ? orderRow.tenant_id.trim()
        : tenantId === '*'
          ? 'default'
          : tenantId;
    const now = new Date().toISOString();
    await context.env.AURA_DB
      .prepare(
        "UPDATE orders SET items = ?, updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      )
      .bind(JSON.stringify(rawItems), now, orderId, effectiveOrderTenant)
      .run()
      .catch(() =>
        context.env.AURA_DB
          .prepare('UPDATE orders SET items = ? WHERE id = ?')
          .bind(JSON.stringify(rawItems), orderId)
          .run()
      );

    const allReady =
      rawItems.length === 0 ||
      rawItems.every((it) => it.status === 'ready' || it.ready === true);
    let finalStatus = orderRow.status;
    if (allReady && ['pending', 'confirmed', 'preparing'].includes(String(orderRow.status || '').toLowerCase())) {
      if (orderRow.status === 'pending' || orderRow.status === 'confirmed') {
        await executeKdsStatusTransition(context.env.AURA_DB, orderId, 'preparing', role, {
          tenantId: effectiveOrderTenant,
          kv: context.env.AUTH_KV,
        }).catch(() => null);
      }
      const trans = await executeKdsStatusTransition(context.env.AURA_DB, orderId, 'ready', role, {
        tenantId: effectiveOrderTenant,
        kv: context.env.AUTH_KV,
      }).catch(() => null);
      if (trans?.success) {
        finalStatus = 'ready';
      }
    }

    return jsonResponse({
      success: true,
      all_items_ready: allReady,
      order_status: finalStatus,
      items: rawItems,
    });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('markKdsOrderItemReady error:', { message: errMsg });
    return errorResponse('Không thể cập nhật món bếp', 500);
  }
}

export const kdsRouter = new Hono<{ Bindings: Env }>();
kdsRouter.use('/*', requireStaff(VIEW_ROLES as any));
kdsRouter.get('/orders', (c) => getKdsMobile(c));
kdsRouter.patch('/orders/:id/status', (c) => updateKdsStatus(c));
kdsRouter.post('/orders/:id/ready', (c) => markKdsOrderItemReady(c));

// PATCH /mobile/kds/orders/:id/status — update order status (staff+ only)
export async function updateKdsStatus(
  context: Context<{ Bindings: Env }>
) {
  try {
    const user = context.get('user') as { role?: string; tenantId?: string } | undefined;
    const role = user?.role || '';
    if (!UPDATE_ROLES.includes(role)) {
      return errorResponse('Không có quyền cập nhật', 403);
    }

    const tenantCheck = verifyKdsMobileTenant(context, user, 'write');
    if (!tenantCheck.ok) {
      return errorResponse('Không có quyền cập nhật chi nhánh khác', 403);
    }

    const orderId = context.req.param('id');
    if (!orderId) {
      return errorResponse('Thiếu order id', 400);
    }

    const body = await context.req.json<{ status: string }>();
    if (!body?.status || !VALID_STATUSES.includes(body.status)) {
      return errorResponse('Trạng thái không hợp lệ', 400);
    }

    if (role === 'waiter' && body.status !== 'served' && body.status !== 'completed') {
      return errorResponse('Không có quyền cập nhật', 403);
    }

    let waitUntilFn: ((p: Promise<unknown>) => void) | undefined;
    try {
      const ctx = context.executionCtx;
      if (ctx) waitUntilFn = (p) => ctx.waitUntil(p);
    } catch {
      // Context without Cloudflare executionCtx (e.g. test harness)
    }

    const result = await executeKdsStatusTransition(
      context.env.AURA_DB,
      orderId,
      body.status,
      role,
      {
        tenantId: tenantCheck.tenantId,
        kv: context.env.AUTH_KV,
        waitUntil: waitUntilFn,
        env: context.env as unknown as Record<string, unknown>,
      }
    );

    if (!result.success) {
      return errorResponse(`Trạng thái không hợp lệ: ${result.error || ''}`, result.statusCode || 400);
    }

    if (result.idempotent) {
      return jsonResponse({ success: true, idempotent: true });
    }

    return jsonResponse({ success: true });
  } catch (err) {
    const errMsg = (err as Error).message;
    log.error('updateKdsStatus error:', { message: errMsg });
    return errorResponse('Không thể cập nhật trạng thái đơn bếp', 500);
  }
}
