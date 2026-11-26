import { Hono } from 'hono';
import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import type { Env } from 'worker/src/types/env';
import type { Context } from 'hono';
import { executeKdsStatusTransition } from './kds-status-transition';
import { isHeldOutOfKds, sanitizeKdsOrderNotes } from '../policies/kds-hold-policy';
import { isTerminal } from '../../order/model/order-state-machine';
import { publishOrderEvent } from '../../order/policies/customer-order-payload';
import {
  fanOutOrderBroadcast,
  normalizeBroadcastTotal,
  parseBroadcastItems,
  parseBroadcastTimestamp,
} from '../../order/policies/order-broadcast';
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
    const qrPlaceholderClause =
      " AND NOT (TRIM(COALESCE(o.notes, '')) LIKE 'Khách QR - cho don mon%' AND TRIM(COALESCE(o.items, '')) = '[]')";
    const statusOrderClause = "ORDER BY CASE WHEN o.status = 'ready' THEN 1 ELSE 0 END ASC, o.created_at ASC";
    let orders: { results: unknown[] };
    try {
      orders = await context.env.AURA_DB
        .prepare(
          `SELECT o.id, o.order_number, o.customer_name, o.table_id, o.items, o.notes, o.status, o.order_type, o.payment_status, o.payment_method, o.is_cod, o.delivery_time, o.started_at, o.ready_at, o.created_at, o.updated_at,
                  COALESCE(NULLIF(TRIM(t.table_number), ''), NULLIF(TRIM(t.name), ''), o.table_id) as table_name
           FROM orders o
           LEFT JOIN cafe_tables t ON (t.id = o.table_id OR CAST(t.table_number AS TEXT) = CAST(o.table_id AS TEXT))
             AND COALESCE(NULLIF(t.tenant_id, ''), 'default') = COALESCE(NULLIF(o.tenant_id, ''), 'default')
           WHERE o.status IN ('pending','confirmed','preparing','ready')${tenantClause}${qrPlaceholderClause}
           ${statusOrderClause}
           LIMIT 500`
        )
        .bind(...tenantBinds).all();
    } catch {
      try {
        orders = await context.env.AURA_DB
          .prepare(
            `SELECT o.id, o.order_number, o.table_id, o.items, o.notes, o.status, o.order_type, o.payment_status, o.payment_method, o.is_cod, o.created_at, o.updated_at,
                    COALESCE(NULLIF(TRIM(t.table_number), ''), NULLIF(TRIM(t.name), ''), o.table_id) as table_name
             FROM orders o
             LEFT JOIN cafe_tables t ON (t.id = o.table_id OR CAST(t.table_number AS TEXT) = CAST(o.table_id AS TEXT))
               AND COALESCE(NULLIF(t.tenant_id, ''), 'default') = COALESCE(NULLIF(o.tenant_id, ''), 'default')
             WHERE o.status IN ('pending','confirmed','preparing','ready')${tenantClause}${qrPlaceholderClause}
             ${statusOrderClause}
             LIMIT 500`
          )
          .bind(...tenantBinds).all();
      } catch {
        try {
          orders = await context.env.AURA_DB
            .prepare(
              `SELECT o.id, o.order_number, o.table_id, o.items, o.notes, o.status, o.order_type, o.payment_status, o.created_at, o.updated_at,
                      COALESCE(NULLIF(TRIM(t.table_number), ''), NULLIF(TRIM(t.name), ''), o.table_id) as table_name
               FROM orders o
               LEFT JOIN cafe_tables t ON (t.id = o.table_id OR CAST(t.table_number AS TEXT) = CAST(o.table_id AS TEXT))
                 AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
               WHERE o.status IN ('pending','confirmed','preparing','ready')${tenantClause}
               ${statusOrderClause}
               LIMIT 500`
            )
            .bind(...tenantBinds).all();
        } catch {
          try {
            orders = await context.env.AURA_DB
              .prepare(
                `SELECT o.id, o.table_id, o.items, o.status, o.created_at, o.updated_at,
                        COALESCE(t.table_number, o.table_id) as table_name
                 FROM orders o
                 LEFT JOIN cafe_tables t ON t.id = o.table_id
                   AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
                 WHERE o.status IN ('pending','confirmed','preparing','ready')${tenantClause}
                 ${statusOrderClause}
                 LIMIT 200`
              )
              .bind(...tenantBinds).all();
          } catch {
            orders = await context.env.AURA_DB
              .prepare(
                `SELECT o.id, o.order_number, o.items, o.status, o.created_at, o.updated_at
                 FROM orders o
                 WHERE o.status IN ('pending','confirmed','preparing','ready')${tenantClause}
                 ${statusOrderClause}
                 LIMIT 200`
              )
              .bind(...tenantBinds).all();
          }
        }
      }
    }

    const rows = (orders.results as Array<Record<string, unknown>>)
      .filter((r) => !isHeldOutOfKds(r))
      .slice(0, 200);

    const nowMs = Date.now();
    const cancelWindowMs = 10 * 60_000;
    const prepHistoryStatuses = new Set(['preparing', 'ready', 'delivering', 'served', 'delivered', 'completed']);
    let recentCancelled: Array<Record<string, unknown>> = [];
    try {
      const cutoff = new Date(nowMs - cancelWindowMs).toISOString().replace('T', ' ').slice(0, 19);
      const cancelledTenantClause = tenantClause ? tenantClause.replace('?1', '?2') : '';
      const cancelledRes = await context.env.AURA_DB
        .prepare(
          `SELECT o.*, COALESCE(NULLIF(TRIM(t.table_number), ''), NULLIF(TRIM(t.name), ''), o.table_id) as table_name
           FROM orders o
           LEFT JOIN cafe_tables t ON (t.id = o.table_id OR CAST(t.table_number AS TEXT) = CAST(o.table_id AS TEXT))
             AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
           WHERE o.status = 'cancelled' AND o.cancelled_at IS NOT NULL AND datetime(o.cancelled_at) >= datetime(?)${cancelledTenantClause}
           LIMIT 20`
        )
        .bind(cutoff, ...tenantBinds)
        .all();
      const activeIds = new Set(rows.map((r) => String(r.id ?? '')));
      recentCancelled = ((cancelledRes?.results ?? []) as Array<Record<string, unknown>>).filter((r) => {
        if (activeIds.has(String(r.id ?? ''))) return false;
        const rawCancelledAt = typeof r.cancelled_at === 'string' ? r.cancelled_at.trim() : '';
        if (!rawCancelledAt) return false;
        const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(rawCancelledAt)
          ? rawCancelledAt.replace(' ', 'T')
          : `${rawCancelledAt.replace(' ', 'T')}Z`;
        const cancelledMs = Date.parse(iso);
        if (!Number.isFinite(cancelledMs) || nowMs - cancelledMs > cancelWindowMs || nowMs < cancelledMs - 60_000) {
          return false;
        }
        const prev = String(r.previous_status ?? '').trim().toLowerCase();
        const explicit = r.cancel_alert === true || Number(r.cancel_alert) === 1;
        return (
          explicit ||
          prepHistoryStatuses.has(prev) ||
          Boolean(r.started_at) ||
          Boolean(r.ready_at) ||
          Boolean(r.served_at)
        );
      });
    } catch {
      // cancelled_at / previous_status absent in minimal schemas: no cancel alerts
    }

    const mapMobileRow = (r: Record<string, unknown>, isCancelAlert: boolean) => ({
      id: r.id as string,
      order_number: (r.order_number as string | undefined) ?? undefined,
      customer_name: typeof r.customer_name === 'string' && r.customer_name.trim() ? r.customer_name.trim() : null,
      table_id: (r.table_id as string | null) ?? null,
      table_name: (r.table_name as string | null) ?? null,
      order_type: (r.order_type as string | null | undefined) ?? null,
      payment_status: typeof r.payment_status === 'string' ? r.payment_status : null,
      payment_method: typeof r.payment_method === 'string' ? r.payment_method : null,
      is_cod: r.is_cod !== undefined && r.is_cod !== null ? Number(r.is_cod) : 0,
      delivery_time: typeof r.delivery_time === 'string' ? r.delivery_time : null,
      items: parseKdsItems(r.items),
      notes: sanitizeKdsOrderNotes(r.notes),
      status: r.status as string,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      started_at: typeof r.started_at === 'string' && r.started_at.trim() ? r.started_at.trim() : null,
      ready_at: typeof r.ready_at === 'string' && r.ready_at.trim() ? r.ready_at.trim() : null,
      ...(isCancelAlert ? { cancel_alert: true, kds_alert: 'cancelled' } : {}),
    });

    return jsonResponse({
      success: true,
      orders: [
        ...rows.map((r) => mapMobileRow(r, false)),
        ...recentCancelled.map((r) => mapMobileRow(r, true)),
      ],
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
    if (!UPDATE_ROLES.includes(role) || role === 'waiter') {
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
      .prepare(
        `SELECT id, status, items, notes, order_type, payment_status, payment_method, is_cod, tenant_id FROM orders WHERE id = ?${tenantClause}`
      )
      .bind(orderId, ...tenantBinds)
      .first<{
        id: string;
        status: string;
        items?: string;
        notes?: string | null;
        order_type?: string | null;
        payment_status?: string | null;
        payment_method?: string | null;
        is_cod?: number | string | null;
        tenant_id?: string | null;
      }>()
      .catch(() =>
        context.env.AURA_DB
          .prepare(`SELECT id, status, items, tenant_id FROM orders WHERE id = ?${tenantClause}`)
          .bind(orderId, ...tenantBinds)
          .first<{ id: string; status: string; items?: string; tenant_id?: string | null }>()
          .catch(() => null)
      );
    if (!orderRow) {
      return errorResponse('Không tìm thấy đơn hàng', 404);
    }
    const normalizedOrderStatus = String(orderRow.status || '').trim().toLowerCase();
    if (
      isTerminal(normalizedOrderStatus) ||
      normalizedOrderStatus === 'served' ||
      !['pending', 'confirmed', 'preparing', 'ready'].includes(normalizedOrderStatus)
    ) {
      return errorResponse('Đơn hàng đã kết thúc hoặc đã phục vụ', 409);
    }
    if (isHeldOutOfKds(orderRow as unknown as Record<string, unknown>)) {
      return errorResponse('Đơn hàng phải hoàn tất thanh toán trước khi chế biến', 409);
    }

    const rawItems = parseKdsItems(orderRow.items) as Array<Record<string, unknown>>;
    const targetOrderItemId = String(body.orderItemId ?? body.order_item_id ?? '').trim();
    const rawItemIndex = body.itemIndex ?? body.item_index;
    const targetItemIndex =
      rawItemIndex !== undefined && rawItemIndex !== null && Number.isInteger(Number(rawItemIndex))
        ? Number(rawItemIndex)
        : undefined;
    const targetProductId = String(body.productId ?? body.product_id ?? '').trim();

    const now = new Date().toISOString();
    let matched = false;
    const matchedItemKeys = new Set<string>();
    const markItemObjReady = (it: Record<string, unknown>, idx: number) => {
      it.started_at = it.started_at || now;
      it.ready_at = it.ready_at || now;
      it.status = 'ready';
      it.ready = true;
      matchedItemKeys.add(`${orderId}:${idx}`);
      const rawId = String(it.id ?? it.orderItemId ?? it.order_item_id ?? it.productId ?? it.product_id ?? it.menuItemId ?? '').trim();
      if (rawId) {
        matchedItemKeys.add(rawId.startsWith(`${orderId}:`) ? rawId : `${orderId}:${rawId}`);
      }
    };

    if (targetOrderItemId) {
      for (let idx = 0; idx < rawItems.length; idx++) {
        const it = rawItems[idx]!;
        const itId = String(it.id ?? it.orderItemId ?? it.order_item_id ?? '').trim();
        if (itId && itId === targetOrderItemId) {
          markItemObjReady(it, idx);
          matched = true;
          break;
        }
      }
    } else if (targetItemIndex !== undefined) {
      if (targetItemIndex < 0 || targetItemIndex >= rawItems.length) {
        return errorResponse('Chỉ mục món không hợp lệ', 400);
      }
      const targetItem = rawItems[targetItemIndex]!;
      if (targetProductId) {
        const itemProdId = String(targetItem.productId ?? targetItem.product_id ?? targetItem.menuItemId ?? targetItem.id ?? '').trim();
        if (itemProdId && itemProdId !== targetProductId) {
          return errorResponse('Món không khớp với chỉ mục', 400);
        }
      }
      markItemObjReady(targetItem, targetItemIndex);
      matched = true;
    } else if (targetProductId) {
      for (let idx = 0; idx < rawItems.length; idx++) {
        const it = rawItems[idx]!;
        const itemProdId = String(it.productId ?? it.product_id ?? it.menuItemId ?? it.id ?? '').trim();
        const isAlreadyReady = it.status === 'ready' || it.ready === true;
        if (itemProdId === targetProductId && !isAlreadyReady) {
          markItemObjReady(it, idx);
          matched = true;
          break;
        }
      }
    } else {
      for (let idx = 0; idx < rawItems.length; idx++) {
        markItemObjReady(rawItems[idx]!, idx);
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

    // Synchronize order_item_stations so station tickets stay in lockstep with JSON items
    for (const key of matchedItemKeys) {
      await context.env.AURA_DB
        .prepare(
          'UPDATE order_item_stations SET started_at = COALESCE(started_at, ?), ready_at = COALESCE(ready_at, ?) WHERE order_item_id = ?',
        )
        .bind(now, now, key)
        .run()
        .catch(() => {});
    }

    let hasPendingStationRow = false;
    try {
      const pendingRes = await context.env.AURA_DB
        .prepare('SELECT COUNT(*) AS cnt FROM order_item_stations WHERE order_item_id LIKE ? AND ready_at IS NULL')
        .bind(`${orderId}:%`)
        .first<{ cnt: number }>();
      hasPendingStationRow = Number(pendingRes?.cnt ?? 0) > 0;
    } catch {
      hasPendingStationRow = false;
    }

    const allReady =
      !hasPendingStationRow &&
      (rawItems.length === 0 ||
        rawItems.every((it) => it.status === 'ready' || it.ready === true || Boolean(it.ready_at)));
    let finalStatus = orderRow.status;
    if (allReady && ['pending', 'confirmed', 'preparing'].includes(normalizedOrderStatus)) {
      let canMarkReady = normalizedOrderStatus === 'preparing';
      if (normalizedOrderStatus === 'pending' || normalizedOrderStatus === 'confirmed') {
        const prepTrans = await executeKdsStatusTransition(context.env.AURA_DB, orderId, 'preparing', role, {
          tenantId: effectiveOrderTenant,
          kv: context.env.AUTH_KV,
          env: context.env as unknown as Record<string, unknown>,
        }).catch(() => null);
        if (prepTrans?.success) {
          finalStatus = 'preparing';
          canMarkReady = true;
        }
      }
      if (canMarkReady) {
        const trans = await executeKdsStatusTransition(context.env.AURA_DB, orderId, 'ready', role, {
          tenantId: effectiveOrderTenant,
          kv: context.env.AUTH_KV,
          env: context.env as unknown as Record<string, unknown>,
        }).catch(() => null);
        if (trans?.success) {
          finalStatus = 'ready';
        }
      }
    } else {
      if (context.env.AUTH_KV) {
        await publishOrderEvent(context.env.AUTH_KV, orderId, finalStatus, {
          tenantId: effectiveOrderTenant,
        }).catch(() => {});
      }
      if (context.env.ORDER_BROADCASTER) {
        const metaRow = await context.env.AURA_DB
          .prepare('SELECT total, payment_status, customer_name, customer_phone, table_id, created_at FROM orders WHERE id = ?')
          .bind(orderId)
          .first<Record<string, unknown>>()
          .catch(() => null);
        if (metaRow) {
          await fanOutOrderBroadcast(context.env.ORDER_BROADCASTER, orderId, effectiveOrderTenant, {
            orderId,
            status: finalStatus,
            payment_status: String(metaRow.payment_status || 'unpaid'),
            items: parseBroadcastItems(rawItems),
            total: normalizeBroadcastTotal(metaRow.total),
            customer_name: String(metaRow.customer_name ?? ''),
            customer_phone: String(metaRow.customer_phone ?? ''),
            table_id: metaRow.table_id ? String(metaRow.table_id) : null,
            ...(effectiveOrderTenant !== 'default' ? { tenant_id: effectiveOrderTenant } : {}),
            createdAt: parseBroadcastTimestamp(metaRow.created_at),
            updatedAt: Date.now(),
          }).catch(() => {});
        }
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
