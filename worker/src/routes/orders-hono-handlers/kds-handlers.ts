import { collectCodPayment } from '../../../../packages/domain/kitchen/commands/collect-cod-payment';
import type { Hono, Context } from 'hono';
import { updateOrderStatusSchema, zodErrorResponse } from '../../lib/validators';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { getTenantId } from '../../middleware/tenant';
import { getDatabase } from '../../lib/db';
import { audit } from '../../middleware/audit-log';
import { publishOrderEvent } from '@aura/domain-order';
import { executeKdsStatusTransition, buildIndexFromDbRows, isHeldOutOfKds } from '@aura/domain-kitchen';
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
  return explicit || PREP_HISTORY_STATUSES.has(prev) || Boolean(order.served_at);
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
       ORDER BY CASE WHEN o.status = 'ready' THEN 1 ELSE 0 END ASC, o.created_at ASC LIMIT 200`
    );
    ({ results } = await (tenantId === '*' ? joinedStmt : joinedStmt.bind(tenantId)).all<OrderRecord>());
  } catch {
    const statement = db.prepare(
      `SELECT * FROM orders
       WHERE status IN ('pending', 'confirmed', 'preparing', 'ready')${tenantClause}
         AND NOT (TRIM(COALESCE(notes, '')) LIKE 'Khách QR - cho don mon%' AND TRIM(COALESCE(items, '')) = '[]')
       ORDER BY CASE WHEN status = 'ready' THEN 1 ELSE 0 END ASC, created_at ASC LIMIT 200`
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
  for (const order of [...(results || []), ...recentCancelled]) {
    const rawOrder = order as unknown as Record<string, unknown>;
    const isCancelAlert = rawOrder.status === 'cancelled';
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
    const entry: KdsOrder & {
      table_name?: string;
      order_number?: string;
      order_type?: string;
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
      items,
      ...(order.notes ? { notes: order.notes } : {}),
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

  return c.json({ success: true, data: kdsOrders });
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
  const user = c.get('user' as any) as { role?: string } | undefined;

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
    ...(Object.keys(deliveryFields).length > 0 ? { fields: deliveryFields } : {}),
  });

  if (!result.success) return c.json({ success: false, error: result.error }, (result.statusCode || 400) as any);
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
  const actor = c.get('user' as any) as { id?: string; sub?: string } | undefined;
  const result = await collectCodPayment(db, id, callerTenant, actor?.id || actor?.sub);
  if (result.success === false) return c.json({ success: false, error: result.error }, result.statusCode);
  let orderRow: CodOrderLookupRow | null = null;
  if (!result.idempotent) {
    try {
      orderRow = await (callerTenant && callerTenant !== '*'
        ? db.prepare(
            "SELECT id, items, total, total_amount, customer_id, customer_name, customer_phone, customer_email, table_id, created_at, tenant_id FROM orders WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          ).bind(id, callerTenant).first<CodOrderLookupRow>().catch(() => null)
        : db.prepare(
            'SELECT id, items, total, total_amount, customer_id, customer_name, customer_phone, customer_email, table_id, created_at, tenant_id FROM orders WHERE id = ?'
          ).bind(id).first<CodOrderLookupRow>().catch(() => null));
      if (!orderRow) {
        orderRow = await db.prepare(
          'SELECT id, total, total_amount, customer_id, customer_phone, customer_email FROM orders WHERE id = ?'
        ).bind(id).first<CodOrderLookupRow>().catch(() => null);
      }
    } catch {
      orderRow = null;
    }
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
  if (!result.idempotent && c.env.AUTH_KV) {
    await publishOrderEvent(c.env.AUTH_KV, id, result.status, {
      previousStatus: result.status,
      tenantId: effectiveEventTenant,
      paymentStatus: 'paid',
    }).catch(() => {});
  }
  if (!result.idempotent && c.env.ORDER_BROADCASTER) {
    try {
      const ns = c.env.ORDER_BROADCASTER as unknown as {
        idFromName?: (name: string) => unknown;
        get?: (doId: unknown) => { fetch: (input: Request | string, init?: RequestInit) => Promise<unknown> };
      };
      if (ns?.idFromName && ns?.get) {
        const doChannel = effectiveEventTenant !== 'default' ? `${effectiveEventTenant}:${id}` : id;
        const stub = ns.get(ns.idFromName(doChannel));
        let parsedItems: unknown[] = [];
        if (Array.isArray(orderRow?.items)) {
          parsedItems = orderRow.items;
        } else if (typeof orderRow?.items === 'string' && orderRow.items.trim()) {
          try {
            const parsed = JSON.parse(orderRow.items);
            if (Array.isArray(parsed)) parsedItems = parsed;
          } catch {
            parsedItems = [];
          }
        }
        const createdMs = orderRow?.created_at
          ? Date.parse(
              orderRow.created_at.includes('T')
                ? orderRow.created_at
                : `${orderRow.created_at.replace(' ', 'T')}Z`,
            )
          : NaN;
        const event = {
          orderId: id,
          status: result.status,
          payment_status: 'paid',
          items: parsedItems,
          total: Number(orderRow?.total ?? orderRow?.total_amount ?? 0),
          customer_name: orderRow?.customer_name ?? '',
          customer_phone: orderRow?.customer_phone ?? '',
          table_id: orderRow?.table_id ?? null,
          ...(effectiveEventTenant !== 'default' ? { tenant_id: effectiveEventTenant } : {}),
          createdAt: Number.isFinite(createdMs) ? createdMs : Date.now(),
          updatedAt: Date.now(),
        };
        const broadcastPromise = stub
          .fetch(
            new Request('https://do/broadcast', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(event),
            }),
          )
          .catch(() => {});
        try {
          if (c.executionCtx) c.executionCtx.waitUntil(broadcastPromise);
          else await broadcastPromise;
        } catch {
          await broadcastPromise;
        }
      }
    } catch {
      /* Non-blocking DO broadcast after COD settlement */
    }
  }
  if (!result.idempotent) {
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
  }
  return c.json({ success: true, message: result.idempotent ? 'Already paid' : 'Marked as paid', order_id: id });
}

/**
 * Every role that may read the kitchen queue or advance an order's status.
 * Single source of truth — the mounts in index.ts and orders-unified.ts, the
 * KDS queue router, and this file all guard with the same set.
 */
export const KDS_ROLES = ['owner', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'admin', 'kitchen', 'barista', 'chef'];
export const COD_COLLECTION_ROLES = ['owner', 'manager', 'supervisor', 'cashier', 'admin', 'waiter', 'shipper', 'rider'];

export function registerKdsHandlers(app: Hono<{ Bindings: Env }>) {
  app.get('/kds', requireAuth(KDS_ROLES), handleGetKdsOrders);
  app.patch('/:id/status', requireAuth([...KDS_ROLES, 'shipper', 'rider']), audit('order_status_change'), (c) => handleUpdateOrderStatus(c));
  app.patch('/:id/mark-cod-paid', requireAuth(COD_COLLECTION_ROLES), audit('order_cod_paid'), handleMarkCodPaid);
}
