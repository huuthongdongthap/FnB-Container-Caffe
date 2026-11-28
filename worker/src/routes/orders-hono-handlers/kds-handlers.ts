import { collectCodPayment } from '../../../../packages/domain/kitchen/commands/collect-cod-payment';
import type { Hono, Context } from 'hono';
import { updateOrderStatusSchema, zodErrorResponse } from '../../lib/validators';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { getTenantId } from '../../middleware/tenant';
import { getDatabase } from '../../lib/db';
import { createMetricsCollector } from '../../lib/metrics-collector';
import { audit } from '../../middleware/audit-log';
import {
  fanOutOrderBroadcast,
  normalizeBroadcastTotal,
  parseBroadcastItems,
  parseBroadcastTimestamp,
  publishOrderEvent,
} from '@aura/domain-order';
import {
  executeKdsStatusTransition,
  buildIndexFromDbRows,
  isHeldOutOfKds,
  sanitizeKdsOrderNotes,
} from '@aura/domain-kitchen';
import { type OrderRecord, type OrderItem, type KdsOrder } from './types';

function verifyKdsOrderTenant(
  c: Context<{ Bindings: Env }>,
  mode: 'read' | 'write',
): { ok: true; tenantId: string } | { ok: false } {
  const user = c.get('user' as any) as
    | { id?: string; role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  const rawResolvedTenant = getTenantId(c).trim() || 'default';
  const resolvedTenant = rawResolvedTenant.toLowerCase() === 'hq' ? '*' : rawResolvedTenant;
  const requestedTenant = (
    c.req.query('tenant_id') ||
    c.req.query('tenantId') ||
    c.req.query('store_id') ||
    c.req.query('storeId') ||
    c.req.header('X-Tenant-ID') ||
    c.req.header('x-tenant-id') ||
    c.req.header('X-Store-ID') ||
    c.req.header('x-store-id') ||
    ''
  ).trim();

  if (!user) {
    if ((requestedTenant === '*' || requestedTenant.toLowerCase() === 'hq' || (requestedTenant && requestedTenant !== 'default')) && mode === 'write') {
      return { ok: false };
    }
    if (requestedTenant === '*' || requestedTenant.toLowerCase() === 'hq' || resolvedTenant === '*') {
      return { ok: false };
    }
    return { ok: true, tenantId: resolvedTenant };
  }

  const rawUserTenant = user.tenantId ?? user.tenant_id;
  const contextTenant =
    typeof (c as unknown as { get?: (k: string) => unknown }).get === 'function' &&
    typeof (c as unknown as { get: (k: string) => unknown }).get('tenantId') === 'string'
      ? String((c as unknown as { get: (k: string) => unknown }).get('tenantId')).trim()
      : '';
  const userTenant =
    (rawUserTenant && String(rawUserTenant).trim()) ||
    (!requestedTenant && contextTenant ? contextTenant : 'default');
  const isHqAdmin =
    (user.role === 'owner' || user.role === 'admin') &&
    (userTenant === '*' || userTenant.toLowerCase() === 'hq');

  if (isHqAdmin) {
    const cleanReq =
      requestedTenant && requestedTenant !== '*' && requestedTenant.toLowerCase() !== 'hq'
        ? requestedTenant
        : '';
    const cleanCtx =
      contextTenant && contextTenant !== '*' && contextTenant.toLowerCase() !== 'hq' && contextTenant !== 'default'
        ? contextTenant
        : '';
    const cleanResolved =
      resolvedTenant && resolvedTenant !== '*' && resolvedTenant !== 'default'
        ? resolvedTenant
        : '';
    return { ok: true, tenantId: cleanReq || cleanCtx || cleanResolved || '*' };
  }

  if (
    userTenant === '*' ||
    userTenant.toLowerCase() === 'hq' ||
    requestedTenant === '*' ||
    requestedTenant.toLowerCase() === 'hq' ||
    resolvedTenant === '*'
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

const CANCEL_ALERT_WINDOW_MS = 10 * 60_000;
const PREP_HISTORY_STATUSES = new Set(['preparing', 'ready', 'delivering', 'served', 'delivered', 'completed']);

function parseUtcTimestampMs(raw: unknown): number {
  if (typeof raw !== 'string' || !raw.trim()) return NaN;
  const trimmed = raw.trim();
  const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(trimmed)
    ? trimmed.replace(' ', 'T')
    : `${trimmed.replace(' ', 'T')}Z`;
  return Date.parse(iso);
}

/** A cancelled order the kitchen already started on, so baristas must stop and discard. */
function isRecentPrepCancellation(order: Record<string, unknown>, nowMs: number): boolean {
  if (String(order.status ?? '').trim().toLowerCase() !== 'cancelled') return false;
  const cancelledMs = parseUtcTimestampMs(order.cancelled_at);
  if (!Number.isFinite(cancelledMs) || nowMs - cancelledMs > CANCEL_ALERT_WINDOW_MS || nowMs < cancelledMs - 60_000) return false;
  const prev = String(order.previous_status ?? '').trim().toLowerCase();
  const explicit = order.cancel_alert === true || Number(order.cancel_alert) === 1;
  return (
    explicit ||
    PREP_HISTORY_STATUSES.has(prev) ||
    Boolean(order.started_at) ||
    Boolean(order.ready_at) ||
    Boolean(order.served_at)
  );
}

export async function handleGetKdsOrders(c: Context<{ Bindings: Env }>) {
  const tenantCheck = verifyKdsOrderTenant(c, 'read');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant KDS access denied' }, 403);
  }
  const db = getDatabase(c as unknown as { env: Record<string, unknown> });
  const rawStation = (c.req.query('station_id') || c.req.query('station') || '').trim();
  const stationId = rawStation && rawStation.toLowerCase() !== 'all' ? rawStation : '';
  const tenantId = tenantCheck.tenantId;

  let categoryIndex: Map<string, { station_id: string; station_name: string | null }> | null = null;
  if (stationId) {
    try {
      let mappings: Record<string, unknown>[] = [];
      let loadedMappings = false;
      if (tenantId === '*') {
        const res = await db.prepare(
          'SELECT cs.category_id, cs.station_id, ks.name AS station_name FROM category_stations cs JOIN kitchen_stations ks ON ks.id = cs.station_id'
        ).all<Record<string, unknown>>();
        mappings = res.results || [];
        loadedMappings = true;
      } else {
        try {
          const res = await db.prepare(
            "SELECT cs.category_id, cs.station_id, ks.name AS station_name, ks.tenant_id FROM category_stations cs JOIN kitchen_stations ks ON ks.id = cs.station_id WHERE COALESCE(NULLIF(TRIM(ks.tenant_id), ''), 'default') = ?"
          ).bind(tenantId).all<Record<string, unknown>>();
          mappings = res.results || [];
          loadedMappings = true;
        } catch {
          if (tenantId === 'default') {
            const res = await db.prepare(
              'SELECT cs.category_id, cs.station_id, ks.name AS station_name FROM category_stations cs JOIN kitchen_stations ks ON ks.id = cs.station_id'
            ).all<Record<string, unknown>>();
            mappings = res.results || [];
            loadedMappings = true;
          }
        }
      }
      if (loadedMappings) {
        categoryIndex = buildIndexFromDbRows(mappings);
      }
    } catch {
      // Table unseeded or mock DB
    }
  }

  const tenantClauseO = tenantId === '*'
    ? ''
    : tenantId === 'default'
      ? " AND (o.tenant_id = ? OR o.tenant_id IS NULL OR o.tenant_id = '' OR TRIM(o.tenant_id) = '')"
      : ' AND (o.tenant_id = ? OR TRIM(o.tenant_id) = ?1)';
  const tenantClause = tenantId === '*'
    ? ''
    : tenantId === 'default'
      ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
      : ' AND (tenant_id = ? OR TRIM(tenant_id) = ?1)';
  let results: OrderRecord[] | undefined;
  try {
    const joinedStmt = db.prepare(
      `SELECT o.*, COALESCE(NULLIF(TRIM(t.table_number), ''), NULLIF(TRIM(t.name), ''), o.table_id) AS table_name
       FROM orders o
       LEFT JOIN cafe_tables t ON t.id = o.table_id
         AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
       WHERE o.status IN ('pending', 'confirmed', 'preparing', 'ready')${tenantClauseO}
         AND NOT (TRIM(COALESCE(o.notes, '')) LIKE 'Khách QR - cho don mon%' AND TRIM(COALESCE(o.items, '')) = '[]')
       ORDER BY CASE WHEN o.status = 'ready' THEN 1 ELSE 0 END ASC, o.created_at ASC LIMIT 500`
    );
    ({ results } = await (tenantId === '*' ? joinedStmt : joinedStmt.bind(tenantId)).all<OrderRecord>());
  } catch {
    const statement = db.prepare(
      `SELECT * FROM orders
       WHERE status IN ('pending', 'confirmed', 'preparing', 'ready')${tenantClause}
         AND NOT (TRIM(COALESCE(notes, '')) LIKE 'Khách QR - cho don mon%' AND TRIM(COALESCE(items, '')) = '[]')
       ORDER BY CASE WHEN status = 'ready' THEN 1 ELSE 0 END ASC, created_at ASC LIMIT 500`
    );
    ({ results } = await (tenantId === '*' ? statement : statement.bind(tenantId)).all<OrderRecord>());
  }

  const nowMs = Date.now();
  let recentCancelled: OrderRecord[] = [];
  try {
    const cutoff = new Date(nowMs - CANCEL_ALERT_WINDOW_MS).toISOString().replace('T', ' ').slice(0, 19);
    let cancelledRes: { results?: OrderRecord[] } | undefined;
    try {
      const cancelledJoined = db.prepare(
        `SELECT o.*, COALESCE(NULLIF(TRIM(t.table_number), ''), NULLIF(TRIM(t.name), ''), o.table_id) AS table_name
         FROM orders o
         LEFT JOIN cafe_tables t ON t.id = o.table_id
           AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
         WHERE o.status = 'cancelled' AND o.cancelled_at IS NOT NULL AND datetime(o.cancelled_at) >= datetime(?)${tenantClauseO ? tenantClauseO.replace('?1', '?2') : ''} LIMIT 20`
      );
      cancelledRes = await (tenantId === '*'
        ? cancelledJoined.bind(cutoff)
        : cancelledJoined.bind(cutoff, tenantId)).all<OrderRecord>();
    } catch {
      const cancelledStatement = db.prepare(
        `SELECT * FROM orders WHERE status = 'cancelled' AND cancelled_at IS NOT NULL AND datetime(cancelled_at) >= datetime(?)${tenantClause ? tenantClause.replace('?1', '?2') : ''} LIMIT 20`
      );
      cancelledRes = await (tenantId === '*'
        ? cancelledStatement.bind(cutoff)
        : cancelledStatement.bind(cutoff, tenantId)).all<OrderRecord>();
    }
    const activeIds = new Set((results || []).map((o) => o.id));
    recentCancelled = (cancelledRes?.results || []).filter(
      (o) => !activeIds.has(o.id) && isRecentPrepCancellation(o as unknown as Record<string, unknown>, nowMs)
    );
  } catch {
    // cancelled_at / previous_status absent in minimal schemas: no cancel alerts
  }

  const kdsOrders: KdsOrder[] = [];
  let activeCount = 0;
  for (const order of [...(results || []), ...recentCancelled]) {
    const rawOrder = order as unknown as Record<string, unknown>;
    const isCancelAlert = rawOrder.status === 'cancelled';
    if (!isCancelAlert && activeCount >= 200) continue;
    if (!isCancelAlert && isHeldOutOfKds(rawOrder)) continue;
    let items: OrderItem[] = [];
    if (Array.isArray(order.items)) {
      items = order.items;
    } else {
      try {
        const parsed = JSON.parse(order.items);
        if (Array.isArray(parsed)) items = parsed;
      } catch { /* keep empty */ }
    }

    if (stationId && categoryIndex) {
      items = items.filter((item) => {
        const catId = String(item.category_id || (item as unknown as Record<string, unknown>).categoryId || '');
        const mappedStation = categoryIndex!.get(catId)?.station_id;
        return mappedStation === stationId;
      });
      if (items.length === 0) continue;
    }
    if (!isCancelAlert) activeCount += 1;

    const createdMs = parseUtcTimestampMs(order.created_at);
    const elapsed = Number.isFinite(createdMs)
      ? Math.max(0, Math.round((Date.now() - createdMs) / 60000))
      : 0;
    const orderType = typeof rawOrder.order_type === 'string' && rawOrder.order_type.trim()
      ? rawOrder.order_type.trim()
      : undefined;
    const tableName = typeof rawOrder.table_name === 'string' && rawOrder.table_name.trim()
      ? rawOrder.table_name.trim()
      : undefined;
    const orderNumber = typeof rawOrder.order_number === 'string' && rawOrder.order_number.trim()
      ? rawOrder.order_number.trim()
      : undefined;
    const updatedAt = typeof rawOrder.updated_at === 'string' && rawOrder.updated_at.trim()
      ? rawOrder.updated_at.trim()
      : undefined;
    const startedAt = typeof rawOrder.started_at === 'string' && rawOrder.started_at.trim()
      ? rawOrder.started_at.trim()
      : undefined;
    const readyAt = typeof rawOrder.ready_at === 'string' && rawOrder.ready_at.trim()
      ? rawOrder.ready_at.trim()
      : undefined;
    const paymentStatus = typeof rawOrder.payment_status === 'string' && rawOrder.payment_status.trim()
      ? rawOrder.payment_status.trim()
      : undefined;
    const paymentMethod = typeof rawOrder.payment_method === 'string' && rawOrder.payment_method.trim()
      ? rawOrder.payment_method.trim()
      : undefined;
    const deliveryTime = typeof rawOrder.delivery_time === 'string' && rawOrder.delivery_time.trim()
      ? rawOrder.delivery_time.trim()
      : undefined;
    const cleanNotes = sanitizeKdsOrderNotes(order.notes);
    const entry: KdsOrder & {
      table_name?: string;
      order_number?: string;
      order_type?: string;
      payment_status?: string;
      payment_method?: string;
      is_cod?: number;
      delivery_time?: string;
      updated_at?: string;
      started_at?: string;
      ready_at?: string;
      cancel_alert?: boolean;
      kds_alert?: string;
    } = {
      id: order.id,
      customer_name: order.customer_name,
      table_id: order.table_id,
      ...(tableName ? { table_name: tableName } : {}),
      ...(orderNumber ? { order_number: orderNumber } : {}),
      ...(orderType ? { order_type: orderType } : {}),
      ...(paymentStatus ? { payment_status: paymentStatus } : {}),
      ...(paymentMethod ? { payment_method: paymentMethod } : {}),
      ...(rawOrder.is_cod !== undefined && rawOrder.is_cod !== null ? { is_cod: Number(rawOrder.is_cod) } : {}),
      ...(deliveryTime ? { delivery_time: deliveryTime } : {}),
      items,
      ...(cleanNotes ? { notes: cleanNotes } : {}),
      status: order.status,
      elapsed_minutes: elapsed,
      created_at: order.created_at,
      ...(updatedAt ? { updated_at: updatedAt } : {}),
      ...(startedAt ? { started_at: startedAt } : {}),
      ...(readyAt ? { ready_at: readyAt } : {}),
      ...(isCancelAlert ? { cancel_alert: true, kds_alert: 'cancelled' } : {}),
    };
    kdsOrders.push(entry as KdsOrder);
  }

  let shiftAvgPrepMinutes: number | null = null;
  try {
    const cutoff24h = new Date(nowMs - 24 * 3600_000).toISOString();
    const avgStmt = db.prepare(
      `SELECT AVG((julianday(ready_at) - julianday(COALESCE(started_at, created_at))) * 1440.0) AS avg_prep
       FROM orders
       WHERE status IN ('ready', 'served', 'delivering', 'delivered', 'completed')
         AND ready_at IS NOT NULL
         AND datetime(ready_at) >= datetime(?)${tenantClause ? tenantClause.replace('?1', '?2') : ''}
         AND julianday(ready_at) >= julianday(COALESCE(started_at, created_at))`
    );
    const avgRow = await (tenantId === '*'
      ? avgStmt.bind(cutoff24h)
      : avgStmt.bind(cutoff24h, tenantId)).first<{ avg_prep?: number | null }>();
    if (avgRow?.avg_prep !== null && avgRow?.avg_prep !== undefined && Number.isFinite(Number(avgRow.avg_prep))) {
      shiftAvgPrepMinutes = Math.max(0, Math.round(Number(avgRow.avg_prep)));
    }
  } catch {
    // ready_at/started_at absent in minimal schemas
  }

  return c.json({
    success: true,
    data: kdsOrders,
    ...(shiftAvgPrepMinutes !== null ? { meta: { avg_prep_minutes: shiftAvgPrepMinutes } } : {}),
  });
}

export async function handleUpdateOrderStatus(c: Context<{ Bindings: Env }>, forcedStatus?: unknown) {
  const tenantCheck = verifyKdsOrderTenant(c, 'write');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant KDS access denied' }, 403);
  }
  const db = getDatabase(c as unknown as { env: Record<string, unknown> });
  const id = c.req.param('id')!;
  const body = typeof forcedStatus === 'string' ? { status: forcedStatus } : await c.req.json().catch(() => null);
  const parsed = updateOrderStatusSchema.safeParse(body);
  if (!parsed.success) return zodErrorResponse(c, parsed.error);
  const { status, assigned_shipper_id, shipper_name, failure_reason } = parsed.data;
  const user = c.get('user' as never) as { id?: string; sub?: string; role?: string } | undefined;
  const normalizedUserRole = String(user?.role || '').trim().toLowerCase();
  const isVoidTarget = status === 'cancelled' || status === 'failed' || status === 'expired';
  const allowPaidCompensation =
    isVoidTarget &&
    (['owner', 'admin', 'manager', 'supervisor'].includes(normalizedUserRole) ||
      (status === 'failed' &&
        Boolean(failure_reason && failure_reason.trim()) &&
        ['staff', 'cashier', 'waiter'].includes(normalizedUserRole)));

  let waitUntilFn: ((p: Promise<unknown>) => void) | undefined;
  try {
    if (c.executionCtx) waitUntilFn = (p) => c.executionCtx.waitUntil(p);
  } catch { /* absent in test harness */ }

  const deliveryFields: Record<string, unknown> = {};
  if (assigned_shipper_id !== undefined) deliveryFields.assigned_shipper_id = assigned_shipper_id.trim() || null;
  if (shipper_name !== undefined) deliveryFields.shipper_name = shipper_name.trim() || null;
  if (failure_reason !== undefined) deliveryFields.failure_reason = failure_reason.trim() || null;

  const result = await executeKdsStatusTransition(db, id, status, user?.role, {
    tenantId: tenantCheck.tenantId,
    kv: c.env.AUTH_KV,
    env: c.env as unknown as Record<string, unknown>,
    waitUntil: waitUntilFn,
    allowPaidCompensation,
    actorId: user?.id || user?.sub,
    validateAssignedShipper: true,
    ...(Object.keys(deliveryFields).length > 0 ? { fields: deliveryFields } : {}),
  });

  if (!result.success) {
    const errStatus = (result.statusCode || 400) as 400 | 401 | 403 | 404 | 409 | 500;
    return c.json({ success: false, error: result.error }, errStatus);
  }
  if (result.idempotent) return c.json({ success: true, message: `Order ${id} is already ${status}`, idempotent: true });
  return c.json({ success: true, message: `Order ${id} → ${status}` });
}

type CodOrderLookupRow = {
  id: string;
  items?: string | unknown[] | null;
  total?: number | null;
  total_amount?: number | null;
  customer_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  table_id?: string | null;
  created_at?: string | null;
  tenant_id?: string | null;
};

export async function handleMarkCodPaid(c: Context<{ Bindings: Env }>) {
  const tenantCheck = verifyKdsOrderTenant(c, 'write');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant KDS access denied' }, 403);
  }
  const id = c.req.param('id');
  if (!id) return c.json({ success: false, error: 'Missing order id' }, 400);
  const db = getDatabase(c as unknown as { env: Record<string, unknown> });
  const callerTenant = tenantCheck.tenantId;
  const actor = c.get('user' as never) as { id?: string; sub?: string; role?: string } | undefined;
  const rawBody = (await c.req.json().catch(() => null)) as { shift_id?: string; shiftId?: string } | null;
  const explicitShiftId =
    typeof rawBody?.shift_id === 'string'
      ? rawBody.shift_id.trim()
      : typeof rawBody?.shiftId === 'string'
        ? rawBody.shiftId.trim()
        : undefined;
  const result = await collectCodPayment(db, id, callerTenant, actor?.id || actor?.sub, {
    env: c.env as unknown as Record<string, unknown>,
    actorRole: actor?.role,
    explicitShiftId,
  });
  if (result.success === false) {
    const errStatus = (result.statusCode || 400) as 400 | 401 | 403 | 404 | 409 | 500;
    return c.json(
      { success: false, error: result.error, ...(result.code ? { code: result.code } : {}) },
      errStatus,
    );
  }
  let orderRow: CodOrderLookupRow | null = null;
  try {
    if (callerTenant && callerTenant !== '*') {
      try {
        orderRow = await db.prepare(
          "SELECT id, items, total, total_amount, customer_id, customer_name, customer_phone, customer_email, customer_address, table_id, created_at, tenant_id FROM orders WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
        ).bind(id, callerTenant).first<CodOrderLookupRow>();
      } catch (primaryErr) {
        try {
          orderRow = await db.prepare(
            "SELECT id, items, total, total_amount, customer_id, customer_name, customer_phone, customer_email, table_id, created_at, tenant_id FROM orders WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(id, callerTenant).first<CodOrderLookupRow>();
        } catch (fallbackErr) {
          // Only fall back to unscoped lookup on legacy default schemas lacking orders.tenant_id
          if (
            callerTenant === 'default' &&
            /no such column:\s*tenant_id/i.test(`${String(primaryErr)} ${String(fallbackErr)}`)
          ) {
            orderRow = await db.prepare(
              'SELECT id, total, total_amount, customer_id, customer_phone, customer_email FROM orders WHERE id = ?'
            ).bind(id).first<CodOrderLookupRow>().catch(() => null);
          }
        }
      }
    } else {
      orderRow = await db.prepare(
        'SELECT id, items, total, total_amount, customer_id, customer_name, customer_phone, customer_email, customer_address, table_id, created_at, tenant_id FROM orders WHERE id = ?'
      ).bind(id).first<CodOrderLookupRow>().catch(() =>
        db.prepare(
          'SELECT id, items, total, total_amount, customer_id, customer_name, customer_phone, customer_email, table_id, created_at, tenant_id FROM orders WHERE id = ?'
        ).bind(id).first<CodOrderLookupRow>().catch(() =>
          db.prepare(
            'SELECT id, total, total_amount, customer_id, customer_phone, customer_email FROM orders WHERE id = ?'
          ).bind(id).first<CodOrderLookupRow>().catch(() => null)
        )
      );
    }
  } catch {
    orderRow = null;
  }
  const effectiveEventTenant =
    typeof orderRow?.tenant_id === 'string' &&
    orderRow.tenant_id.trim() &&
    orderRow.tenant_id.trim() !== '*' &&
    orderRow.tenant_id.trim().toLowerCase() !== 'hq'
      ? orderRow.tenant_id.trim()
      : callerTenant && callerTenant !== '*'
        ? callerTenant
        : 'default';
  const settledAmount = Number(orderRow?.total ?? orderRow?.total_amount ?? 0);
  if (!result.idempotent && settledAmount > 0) {
    try {
      const metrics = createMetricsCollector(db);
      const metricPromise = Promise.all([
        metrics.recordMetric('payment_success', settledAmount, { provider: 'cod', order_id: id, tenant_id: effectiveEventTenant }),
        metrics.recordMetric('revenue', settledAmount, { provider: 'cod', tenant_id: effectiveEventTenant }),
      ]).catch(() => {});
      try {
        if (c.executionCtx) c.executionCtx.waitUntil(metricPromise);
        else await metricPromise;
      } catch {
        await metricPromise;
      }
    } catch {
      /* Non-blocking metrics recording */
    }
  }
  if (!result.idempotent && c.env.AUTH_KV) {
    await publishOrderEvent(c.env.AUTH_KV, id, result.status, {
      previousStatus: result.status,
      tenantId: effectiveEventTenant,
      paymentStatus: 'paid',
    }).catch(() => {});
    // Best-effort ERPNext invoice sync for settled COD orders when tenant ERPNext URL is configured
    const erpTask = (async () => {
      try {
        const erpPrefix = effectiveEventTenant === 'default' ? 'erpnext' : `erpnext:${effectiveEventTenant}`;
        const erpUrl = await c.env.AUTH_KV.get(`${erpPrefix}:api_url`).catch(() => null);
        if (!erpUrl || !orderRow) return;
        const { createErpnextClientWithKv } = await import('../../clients/erpnext-client');
        const { ErpnextAccountingClient } = await import('../../clients/erpnext-accounting-client');
        const erpClient = await createErpnextClientWithKv(c.env as never, effectiveEventTenant);
        if (!erpClient) return;
        const accounting = new ErpnextAccountingClient(erpClient, db);
        await accounting.processOrderToInvoice(
          {
            id,
            items: orderRow.items as string | Array<Record<string, unknown>> | undefined,
            customer_phone: orderRow.customer_phone ?? undefined,
            customer_email: orderRow.customer_email ?? undefined,
            customer_name: orderRow.customer_name ?? undefined,
            customer_address: orderRow.customer_address ?? undefined,
          },
          c.env as never,
          effectiveEventTenant,
        );
      } catch {
        /* Non-blocking ERPNext sync */
      }
    })();
    try {
      if (c.executionCtx) c.executionCtx.waitUntil(erpTask);
      else await erpTask;
    } catch {
      await erpTask;
    }
  }
  if (!result.idempotent && c.env.ORDER_BROADCASTER) {
    try {
      const event = {
        orderId: id,
        status: result.status,
        payment_status: 'paid',
        items: parseBroadcastItems(orderRow?.items),
        total: normalizeBroadcastTotal(orderRow?.total ?? orderRow?.total_amount ?? 0),
        customer_name: orderRow?.customer_name ?? '',
        customer_phone: orderRow?.customer_phone ?? '',
        table_id: orderRow?.table_id ?? null,
        ...(effectiveEventTenant !== 'default' ? { tenant_id: effectiveEventTenant } : {}),
        createdAt: parseBroadcastTimestamp(orderRow?.created_at),
        updatedAt: Date.now(),
      };
      await fanOutOrderBroadcast(
        c.env.ORDER_BROADCASTER,
        id,
        effectiveEventTenant,
        event,
      ).catch(() => {});
    } catch {
      /* Non-blocking DO broadcast after COD settlement */
    }
  }
  // Loyalty & referral side-effects are idempotent in D1, so running on idempotent retry
  // safely heals any post-commit failure from an earlier attempt without double-crediting.
  try {
    if (orderRow && (orderRow.customer_id || orderRow.customer_phone || orderRow.customer_email)) {
      const { creditLoyaltyIfEligible } = await import('@aura/domain-order');
      await creditLoyaltyIfEligible(db, c.env as unknown as Record<string, unknown>, id).catch(() => {});
      const digits = String(orderRow.customer_phone || '').replace(/\D/g, '');
      const normalizedPhone = digits.length >= 9 && digits.length <= 15 && !/^0+$/.test(digits) ? digits : null;
      const trimmedEmail = typeof orderRow.customer_email === 'string' ? orderRow.customer_email.trim() : '';
      const sanitizedEmail = trimmedEmail.length > 0 && trimmedEmail.includes('@') ? trimmedEmail : null;
      let refCustomerId = orderRow.customer_id ? String(orderRow.customer_id).trim() || null : null;
      if (!refCustomerId && (normalizedPhone || sanitizedEmail)) {
        const orderTenant = typeof orderRow.tenant_id === 'string' && orderRow.tenant_id.trim()
          ? orderRow.tenant_id.trim()
          : callerTenant;
        let cust: { id: string } | null = null;
        try {
          cust = await db.prepare(
            "SELECT id FROM customers WHERE ((email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL)) AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1"
          ).bind(sanitizedEmail, normalizedPhone, orderTenant, orderTenant).first<{ id: string }>();
        } catch {
          if (orderTenant === 'default' || orderTenant === '*') {
            cust = await db.prepare(
              'SELECT id FROM customers WHERE (email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL) LIMIT 1'
            ).bind(sanitizedEmail, normalizedPhone).first<{ id: string }>().catch(() => null);
          }
        }
        refCustomerId = cust?.id ?? null;
      }
      const orderTotal = Number(orderRow.total ?? orderRow.total_amount ?? 0);
      if (refCustomerId && orderTotal >= 20000) {
        const { rewardReferralOnFirstOrder, resolveReferralPolicy, DEFAULT_REFERRAL_POLICY } = await import('@aura/domain-crm');
        const orderTenantForRef = typeof orderRow.tenant_id === 'string' && orderRow.tenant_id.trim()
          ? orderRow.tenant_id.trim()
          : (callerTenant && callerTenant !== '*' ? callerTenant : undefined);
        const refPolicy = await resolveReferralPolicy(c.env.AUTH_KV, orderTenantForRef).catch(() => DEFAULT_REFERRAL_POLICY);
        await rewardReferralOnFirstOrder(db, refCustomerId, id, orderTotal, refPolicy, orderTenantForRef).catch(() => {});
      }
    }
  } catch { /* Non-blocking post-payment loyalty/referral trigger */ }
  return c.json({ success: true, message: result.idempotent ? 'Already paid' : 'Marked as paid', order_id: id });
}

/**
 * Every role that may read the kitchen queue or advance an order's status.
 * Single source of truth — the mounts in index.ts and orders-unified.ts, the
 * KDS queue router, and this file all guard with the same set.
 */
export const KDS_ROLES = ['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'admin', 'kitchen', 'barista', 'chef'];
export const KDS_PREP_ROLES = ['owner', 'manager', 'supervisor', 'staff', 'admin', 'kitchen', 'barista', 'chef'];
export const COD_COLLECTION_ROLES = ['owner', 'manager', 'supervisor', 'cashier', 'admin', 'waiter', 'shipper', 'rider'];

export async function handleGetKdsRecentOrders(c: Context<{ Bindings: Env }>) {
  const tenantCheck = verifyKdsOrderTenant(c, 'read');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant KDS access denied' }, 403);
  }
  const db = getDatabase(c as unknown as { env: Record<string, unknown> });
  const tenantId = tenantCheck.tenantId;
  const cutoffIso = new Date(Date.now() - 8 * 3600_000).toISOString();
  const tenantClauseO = tenantId === '*'
    ? ''
    : tenantId === 'default'
      ? " AND (o.tenant_id = ?2 OR o.tenant_id IS NULL OR o.tenant_id = '' OR TRIM(o.tenant_id) = '')"
      : ' AND (o.tenant_id = ?2 OR TRIM(o.tenant_id) = ?2)';
  const tenantClause = tenantId === '*'
    ? ''
    : tenantId === 'default'
      ? " AND (tenant_id = ?2 OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
      : ' AND (tenant_id = ?2 OR TRIM(tenant_id) = ?2)';

  let rows: Array<Record<string, unknown>> = [];
  try {
    const stmt = db.prepare(
      `SELECT o.id, o.order_number, o.customer_name, o.table_id,
              COALESCE(NULLIF(TRIM(t.table_number), ''), NULLIF(TRIM(t.name), ''), o.table_id) AS table_name,
              o.order_type, o.items, o.notes, o.status, o.created_at, o.updated_at, o.started_at, o.ready_at, o.served_at
       FROM orders o
       LEFT JOIN cafe_tables t ON t.id = o.table_id
         AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
       WHERE o.status IN ('ready', 'served')
         AND datetime(COALESCE(o.served_at, o.ready_at, o.updated_at, o.created_at)) >= datetime(?1)${tenantClauseO}
       ORDER BY datetime(COALESCE(o.served_at, o.ready_at, o.updated_at, o.created_at)) DESC
       LIMIT 30`,
    );
    const res = await (tenantId === '*' ? stmt.bind(cutoffIso) : stmt.bind(cutoffIso, tenantId)).all<Record<string, unknown>>();
    rows = res.results ?? [];
  } catch {
    try {
      const stmt = db.prepare(
        `SELECT id, order_number, customer_name, table_id, order_type, items, notes, status, created_at, updated_at
         FROM orders
         WHERE status IN ('ready', 'served')
           AND datetime(COALESCE(updated_at, created_at)) >= datetime(?1)${tenantClause}
         ORDER BY datetime(COALESCE(updated_at, created_at)) DESC
         LIMIT 30`,
      );
      const res = await (tenantId === '*' ? stmt.bind(cutoffIso) : stmt.bind(cutoffIso, tenantId)).all<Record<string, unknown>>();
      rows = res.results ?? [];
    } catch {
      rows = [];
    }
  }

  const mapped = rows.map((r) => ({
    id: String(r.id ?? ''),
    ...(typeof r.order_number === 'string' && r.order_number.trim() ? { order_number: r.order_number.trim() } : {}),
    customer_name: typeof r.customer_name === 'string' ? r.customer_name : '',
    table_id: (r.table_id as string | null) ?? null,
    ...(typeof r.table_name === 'string' && r.table_name.trim() ? { table_name: r.table_name.trim() } : {}),
    ...(typeof r.order_type === 'string' && r.order_type.trim() ? { order_type: r.order_type.trim() } : {}),
    items: parseBroadcastItems(r.items),
    ...(sanitizeKdsOrderNotes(r.notes) ? { notes: sanitizeKdsOrderNotes(r.notes) } : {}),
    status: String(r.status ?? 'ready'),
    created_at: String(r.created_at ?? ''),
    ...(typeof r.started_at === 'string' && r.started_at.trim() ? { started_at: r.started_at.trim() } : {}),
    ...(typeof r.ready_at === 'string' && r.ready_at.trim() ? { ready_at: r.ready_at.trim() } : {}),
    ...(typeof r.served_at === 'string' && r.served_at.trim() ? { served_at: r.served_at.trim() } : {}),
  }));

  return c.json({ success: true, data: mapped });
}

export async function handleRecallKdsOrder(c: Context<{ Bindings: Env }>) {
  const user = c.get('user' as never) as { role?: string } | undefined;
  const role = String(user?.role ?? '').trim().toLowerCase();
  if (role && !KDS_PREP_ROLES.includes(role)) {
    return c.json({ success: false, error: 'Insufficient permissions to recall ticket' }, 403);
  }
  const tenantCheck = verifyKdsOrderTenant(c, 'write');
  if (!tenantCheck.ok) {
    return c.json({ success: false, error: 'Cross-tenant KDS access denied' }, 403);
  }
  const id = c.req.param('id');
  if (!id) return c.json({ success: false, error: 'Missing order id' }, 400);

  const db = getDatabase(c as unknown as { env: Record<string, unknown> });
  const tenantId = tenantCheck.tenantId;
  const tenantClause = tenantId === '*'
    ? ''
    : tenantId === 'default'
      ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
      : ' AND TRIM(tenant_id) = ?';
  const tenantBinds = tenantId === '*' ? [] : [tenantId];

  const orderRow = await db
    .prepare(
      `SELECT id, status, items, total, payment_status, customer_name, customer_phone, table_id, created_at, tenant_id
       FROM orders WHERE id = ?${tenantClause}`,
    )
    .bind(id, ...tenantBinds)
    .first<Record<string, unknown>>()
    .catch(() => null);
  if (!orderRow) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  const currentStatus = String(orderRow.status ?? '').trim().toLowerCase();
  if (currentStatus !== 'ready' && currentStatus !== 'served') {
    return c.json({ success: false, error: `Cannot recall order from '${currentStatus}' status` }, 409);
  }
  if (String(orderRow.payment_status ?? '').trim().toLowerCase() === 'refunded') {
    return c.json({ success: false, error: 'Cannot recall a refunded order' }, 409);
  }

  const body = (await c.req.json().catch(() => ({}))) as { target_status?: string };
  const requestedTarget = String(body?.target_status ?? '').trim().toLowerCase();
  const targetStatus =
    requestedTarget === 'preparing' || requestedTarget === 'ready'
      ? requestedTarget
      : currentStatus === 'served'
        ? 'ready'
        : 'preparing';

  const now = new Date().toISOString();
  const effectiveTenant =
    typeof orderRow.tenant_id === 'string' &&
    orderRow.tenant_id.trim() &&
    orderRow.tenant_id.trim() !== '*' &&
    orderRow.tenant_id.trim().toLowerCase() !== 'hq'
      ? orderRow.tenant_id.trim()
      : tenantId === '*'
        ? 'default'
        : tenantId;
  const writeClause = effectiveTenant === 'default'
    ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
    : ' AND TRIM(tenant_id) = ?';

  let updatedItems = parseBroadcastItems(orderRow.items) as Array<Record<string, unknown>>;
  if (targetStatus === 'preparing') {
    updatedItems = updatedItems.map((it) => {
      const copy = { ...(it ?? {}) };
      delete copy.ready_at;
      copy.ready = false;
      copy.status = 'preparing';
      return copy;
    });
  }

  const updateRes = await db
    .prepare(
      targetStatus === 'preparing'
        ? `UPDATE orders SET status = 'preparing', ready_at = NULL, served_at = NULL, items = ?, updated_at = ? WHERE id = ? AND status = ?${writeClause}`
        : `UPDATE orders SET status = 'ready', served_at = NULL, updated_at = ? WHERE id = ? AND status = ?${writeClause}`,
    )
    .bind(
      ...(targetStatus === 'preparing'
        ? [JSON.stringify(updatedItems), now, id, orderRow.status, effectiveTenant]
        : [now, id, orderRow.status, effectiveTenant]),
    )
    .run()
    .catch(() =>
      db
        .prepare(`UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND status = ?${writeClause}`)
        .bind(targetStatus, now, id, orderRow.status, effectiveTenant)
        .run(),
    );

  const changes = (updateRes as { meta?: { changes?: number }; changes?: number } | null)?.meta?.changes
    ?? (updateRes as { changes?: number } | null)?.changes
    ?? 0;
  if (changes < 1) {
    return c.json({ success: false, error: 'Order changed concurrently; refresh and retry' }, 409);
  }

  if (targetStatus === 'preparing') {
    await db
      .prepare('UPDATE order_item_stations SET ready_at = NULL WHERE order_item_id LIKE ?')
      .bind(`${id}:%`)
      .run()
      .catch(() => {});
  }

  if (c.env.AUTH_KV) {
    await publishOrderEvent(c.env.AUTH_KV, id, targetStatus, {
      previousStatus: currentStatus,
      tenantId: effectiveTenant,
      paymentStatus: String(orderRow.payment_status ?? 'unpaid'),
    }).catch(() => {});
  }
  if (c.env.ORDER_BROADCASTER) {
    await fanOutOrderBroadcast(c.env.ORDER_BROADCASTER, id, effectiveTenant, {
      orderId: id,
      status: targetStatus,
      payment_status: String(orderRow.payment_status ?? 'unpaid'),
      items: updatedItems,
      total: normalizeBroadcastTotal(orderRow.total),
      customer_name: String(orderRow.customer_name ?? ''),
      customer_phone: String(orderRow.customer_phone ?? ''),
      table_id: orderRow.table_id ? String(orderRow.table_id) : null,
      ...(effectiveTenant !== 'default' ? { tenant_id: effectiveTenant } : {}),
      createdAt: parseBroadcastTimestamp(orderRow.created_at),
      updatedAt: Date.now(),
    }).catch(() => {});
  }

  return c.json({ success: true, order_id: id, status: targetStatus, previous_status: currentStatus });
}

export function registerKdsHandlers(app: Hono<{ Bindings: Env }>) {
  app.get('/kds', requireAuth(KDS_ROLES), handleGetKdsOrders);
  app.patch('/:id/status', requireAuth([...KDS_ROLES, 'shipper', 'rider']), audit('order_status_change'), (c) => handleUpdateOrderStatus(c));
  app.patch('/:id/mark-cod-paid', requireAuth(COD_COLLECTION_ROLES), audit('order_cod_paid'), handleMarkCodPaid);
  app.post('/:id/recall', requireAuth(KDS_PREP_ROLES), audit('order_status_change'), handleRecallKdsOrder);
}
