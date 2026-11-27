import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { OrderRoutes } from '../../schemas/orders';
import {
  formatCustomerOrder,
  formatOrder,
  fetchOrderItemsAndPayments,
  resolveOpenApiOrdersTenant,
  isAllowedOrderLocationForTenant,
} from './helpers';
import { getDatabase } from '../../lib/db';
import { handleGetOrderSummary } from './order-summary-handlers';
import { canAccessOrder, verifyGuestOrderToken } from '@aura/domain-order';

export { handleGetOrderSummary };

const STAFF_ROLES = ['owner', 'manager', 'supervisor', 'staff', 'admin', 'waiter', 'kitchen', 'barista', 'chef', 'cashier', 'shipper', 'rider'];
const KITCHEN_ROLES = new Set(['kitchen', 'barista', 'chef', 'bep']);
const SHIPPER_ROLES = new Set(['shipper', 'rider']);
const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  created_at: 'o.created_at',
  total_amount: 'COALESCE(o.total_amount, o.total)',
  status: 'o.status',
  order_number: 'o.order_number',
  total: 'COALESCE(o.total_amount, o.total)',
};

interface ActorReadScope {
  allowAll: boolean;
  owner: string | null;
  isKitchen: boolean;
  isShipper: boolean;
  actorId: string | null;
}

function resolveCustomerScope(c: Context<{ Bindings: Env }>): ActorReadScope {
  const user = c.get('user') as unknown as Record<string, unknown> | undefined;
  const role = typeof user?.role === 'string' ? user.role.toLowerCase() : '';
  const actorId = typeof user?.id === 'string' && user.id.trim() ? user.id.trim() : null;
  if (user && STAFF_ROLES.includes(role)) {
    return {
      allowAll: true,
      owner: null,
      isKitchen: KITCHEN_ROLES.has(role),
      isShipper: SHIPPER_ROLES.has(role),
      actorId,
    };
  }
  const owner =
    role === 'customer'
      ? String(user?.id ?? user?.customerId ?? user?.customer_id ?? '').trim() || null
      : null;
  return { allowAll: false, owner, isKitchen: false, isShipper: false, actorId };
}

async function resolveCustomerOwnerIds(
  db: ReturnType<typeof getDatabase>,
  user: Record<string, any> | undefined,
  tenantId: string,
): Promise<string[]> {
  if (!user || user.role !== 'customer') return [];
  const ids = new Set<string>();
  for (const candidate of [user.id, user.sub, user.customerId, user.customer_id]) {
    if (typeof candidate === 'string' && candidate.trim()) {
      ids.add(candidate.trim());
    }
  }
  const userId =
    typeof user.id === 'string' && user.id.trim()
      ? user.id.trim()
      : typeof user.sub === 'string' && user.sub.trim()
        ? user.sub.trim()
        : '';
  if (userId) {
    try {
      const res: { results?: Array<{ id?: string }> } =
        tenantId !== '*'
          ? await db
              .prepare(
                "SELECT id FROM customers WHERE user_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              )
              .bind(userId, tenantId)
              .all<{ id?: string }>()
              .catch(async (): Promise<{ results?: Array<{ id?: string }> }> =>
                tenantId === 'default'
                  ? await db.prepare('SELECT id FROM customers WHERE user_id = ?').bind(userId).all<{ id?: string }>()
                  : { results: [] }
              )
          : await db.prepare('SELECT id FROM customers WHERE user_id = ?').bind(userId).all<{ id?: string }>();
      for (const row of res?.results || []) {
        if (row?.id && String(row.id).trim()) {
          ids.add(String(row.id).trim());
        }
      }
    } catch {
      // Optional user_id column in minimal test schemas
    }
  }
  return Array.from(ids);
}

function redactOrderPii<T extends Record<string, unknown>>(formatted: T): T {
  const copy = { ...formatted } as Record<string, unknown>;
  if ('customerPhone' in copy) copy.customerPhone = null;
  if ('customerEmail' in copy) copy.customerEmail = null;
  if ('customerAddress' in copy) copy.customerAddress = null;
  if ('customer_phone' in copy) copy.customer_phone = null;
  if ('customer_email' in copy) copy.customer_email = null;
  if ('customer_address' in copy) copy.customer_address = null;
  return copy as T;
}

function projectForActor<TOrder extends Record<string, unknown>, TItem, TPayment>(
  scope: ActorReadScope,
  order: TOrder,
  items: TItem[],
  full: (_o: TOrder, _i: TItem[], _p: TPayment[]) => Record<string, unknown>,
  guest: (_o: TOrder, _i: TItem[]) => Record<string, unknown>,
  payments: TPayment[],
): Record<string, unknown> {
  if (!scope.allowAll) {
    return guest(order, items);
  }
  const formatted = full(order, items, payments);
  if (scope.isKitchen) {
    return redactOrderPii(formatted);
  }
  if (scope.isShipper) {
    const assignedShipperId = String(order.assigned_shipper_id ?? order.shipper_id ?? '').trim();
    if (!scope.actorId || assignedShipperId !== scope.actorId) {
      return redactOrderPii(formatted);
    }
  }
  return formatted;
}

/**
 * Fetches a single order with its table name.
 *
 * tenant_id is dropped from the WHERE clause only for HQ aggregate reads ('*').
 * The join to cafe_tables is best-effort: a schema without that table falls back
 * to a bare select, but never past the tenant boundary.
 */
export async function fetchOrderForRead(
  db: ReturnType<typeof getDatabase>,
  id: string,
  tenantId: string,
): Promise<Record<string, any> | null> {
  const rawTenant = (tenantId || '').trim() || 'default';
  const cleanTenant = rawTenant.toLowerCase() === 'hq' ? '*' : rawTenant;
  const scoped = cleanTenant !== '*';
  const joinTenantClause = !scoped
    ? ''
    : cleanTenant === 'default'
      ? " AND (o.tenant_id = ? OR o.tenant_id IS NULL OR o.tenant_id = '' OR TRIM(o.tenant_id) = '')"
      : ' AND (o.tenant_id = ?2 OR TRIM(o.tenant_id) = ?2)';
  const tableJoinTenantClause = !scoped
    ? " AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')"
    : cleanTenant === 'default'
      ? " AND (t.tenant_id IS NULL OR t.tenant_id = '' OR TRIM(t.tenant_id) = '' OR TRIM(t.tenant_id) = 'default')"
      : ' AND TRIM(t.tenant_id) = ?2';
  const bareTenantClause = !scoped
    ? ''
    : cleanTenant === 'default'
      ? " AND (tenant_id = ? OR tenant_id IS NULL OR tenant_id = '' OR TRIM(tenant_id) = '')"
      : ' AND (tenant_id = ?2 OR TRIM(tenant_id) = ?2)';
  const idPlaceholder = scoped && cleanTenant !== 'default' ? '?1' : '?';
  try {
    return (await db.prepare(
      `SELECT o.*, COALESCE(t.table_number, t.id) as table_name FROM orders o LEFT JOIN cafe_tables t ON o.table_id = t.id${tableJoinTenantClause} WHERE o.id = ${idPlaceholder}${joinTenantClause}`
    ).bind(...(scoped ? [id, cleanTenant] : [id])).first()) as Record<string, any> | null;
  } catch {
    try {
      return (await db.prepare(
        `SELECT o.*, COALESCE(t.table_number, t.id) as table_name FROM orders o LEFT JOIN cafe_tables t ON o.table_id = t.id WHERE o.id = ${idPlaceholder}${joinTenantClause}`
      ).bind(...(scoped ? [id, cleanTenant] : [id])).first()) as Record<string, any> | null;
    } catch {
      return (await db.prepare(`SELECT * FROM orders WHERE id = ${idPlaceholder}${bareTenantClause}`)
        .bind(...(scoped ? [id, cleanTenant] : [id])).first()) as Record<string, any> | null;
    }
  }
}

export async function handleListOrders(c: Context<{ Bindings: Env }>) {
  const tenantCheck = resolveOpenApiOrdersTenant(c, 'read');
  if (!tenantCheck.ok) {
    return tenantCheck.response;
  }
  const rawTenantId = (tenantCheck.tenantId || 'default').trim() || 'default';
  const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
  const db = getDatabase(c);
  const query = ((c.req as any).valid ? (c.req as any).valid('query') : null) || c.req.query();
  const { page = 1, limit = 20, sort = 'created_at', order = 'desc', tableId, locationId, status, paymentStatus, date, dateFrom, dateTo, customerId } = query;
  const rawPage = Number(page || 1);
  const pageNum = Number.isFinite(rawPage) ? Math.max(1, Math.trunc(rawPage)) : 1;
  const rawLimit = Number(limit || 20);
  const limitNum = Number.isFinite(rawLimit) ? Math.min(Math.max(1, Math.trunc(rawLimit)), 100) : 20;

  if (locationId && !(await isAllowedOrderLocationForTenant(db, locationId, tenantId))) {
    return c.json({
      success: true,
      data: { orders: [], meta: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 } },
    });
  }

  const vnToday = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const scope = resolveCustomerScope(c);

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];
  if (tenantId !== '*') {
    whereClause += tenantId === 'default'
      ? " AND (o.tenant_id = ? OR o.tenant_id IS NULL OR o.tenant_id = '' OR TRIM(o.tenant_id) = '')"
      : ' AND (o.tenant_id = ? OR TRIM(o.tenant_id) = ?1)';
    params.push(tenantId);
  }

  if (scope.allowAll) {
    if (scope.isShipper) {
      whereClause += " AND o.order_type = 'delivery' AND (o.shipper_id IS NULL OR o.shipper_id = ?)";
      params.push(scope.actorId || '');
    }
    if (customerId) { whereClause += ' AND o.customer_id = ?'; params.push(customerId); }
  } else if (scope.owner) {
    const ownerIds = await resolveCustomerOwnerIds(db, c.get('user') as Record<string, any> | undefined, tenantId);
    if (ownerIds.length === 1) {
      whereClause += ' AND o.customer_id = ?';
      params.push(ownerIds[0]);
    } else if (ownerIds.length > 1) {
      whereClause += ` AND o.customer_id IN (${ownerIds.map(() => '?').join(', ')})`;
      params.push(...ownerIds);
    } else {
      whereClause += ' AND o.customer_id = ?';
      params.push(scope.owner);
    }
  } else {
    whereClause += ' AND 1=0';
  }

  if (tableId) { whereClause += ' AND o.table_id = ?'; params.push(tableId); }
  if (locationId) { whereClause += ' AND o.location_id = ?'; params.push(locationId); }
  if (status) { whereClause += ' AND o.status = ?'; params.push(status); }
  if (paymentStatus) { whereClause += ' AND o.payment_status = ?'; params.push(paymentStatus); }
  if (date) { whereClause += " AND date(o.created_at, '+7 hours') = ?"; params.push(date === 'today' ? vnToday : date); }
  if (dateFrom) { whereClause += " AND date(o.created_at, '+7 hours') >= ?"; params.push(dateFrom === 'today' ? vnToday : dateFrom); }
  if (dateTo) { whereClause += " AND date(o.created_at, '+7 hours') <= ?"; params.push(dateTo === 'today' ? vnToday : dateTo); }

  const countResult = (await db.prepare(`SELECT COUNT(*) as total FROM orders o ${whereClause}`).bind(...params).first()) as { total?: number } | null;
  const total = Number(countResult?.total || 0);
  const offset = (pageNum - 1) * limitNum;
  const safeSort = ALLOWED_SORT_COLUMNS[sort] || 'o.created_at';
  const safeDirection = (order?.toLowerCase() === 'asc') ? 'ASC' : 'DESC';
  const orderClause = `${safeSort} ${safeDirection}`;
  let rows: { results: any[] };
  try {
    rows = (await db.prepare(
      `SELECT o.*, COALESCE(t.table_number, t.id) as table_name FROM orders o LEFT JOIN cafe_tables t ON o.table_id = t.id AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`
    ).bind(...params, limitNum, offset).all()) as { results: any[] };
  } catch {
    try {
      rows = (await db.prepare(
        `SELECT o.*, COALESCE(t.table_number, t.id) as table_name FROM orders o LEFT JOIN cafe_tables t ON o.table_id = t.id ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`
      ).bind(...params, limitNum, offset).all()) as { results: any[] };
    } catch {
      rows = (await db.prepare(`SELECT o.* FROM orders o ${whereClause} ORDER BY ${orderClause} LIMIT ? OFFSET ?`)
        .bind(...params, limitNum, offset).all()) as { results: any[] };
    }
  }

  const orders = await Promise.all(rows.results.map(async (_order) => {
    const rawOrderTenant = typeof _order?.tenant_id === 'string' ? _order.tenant_id.trim() : '';
    const effectiveRowTenant =
      tenantId === '*'
        ? (rawOrderTenant && rawOrderTenant !== '*' && rawOrderTenant.toLowerCase() !== 'hq' ? rawOrderTenant : 'default')
        : tenantId;
    const { items, payments } = await fetchOrderItemsAndPayments(db, _order.id as string, effectiveRowTenant);
    return projectForActor(scope, _order, items, formatOrder, formatCustomerOrder, payments);
  }));

  return c.json({
    success: true,
    data: { orders, meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } },
  });
}

export async function handleGetOrderById(c: Context<{ Bindings: Env }>) {
  const tenantCheck = resolveOpenApiOrdersTenant(c, c.get('user') ? 'read' : 'public');
  if (!tenantCheck.ok) {
    return tenantCheck.response;
  }
  const rawTenantId = (tenantCheck.tenantId || 'default').trim() || 'default';
  const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
  const db = getDatabase(c);
  const id = ((c.req as any).valid ? (c.req as any).valid('param') : null)?.id || c.req.param('id');
  const user = c.get('user');

  const order = await fetchOrderForRead(db, id, tenantId);
  if (!order) return c.json({ success: false, error: 'Order not found' }, 404);

  const rawOrderTenant = typeof order.tenant_id === 'string' ? order.tenant_id.trim() : '';
  const effectiveOrderTenant =
    tenantId === '*'
      ? (rawOrderTenant && rawOrderTenant !== '*' && rawOrderTenant.toLowerCase() !== 'hq' ? rawOrderTenant : 'default')
      : tenantId;
  let effectiveUser = user as Record<string, any> | undefined;
  if (effectiveUser?.role === 'customer' && order.customer_id) {
    const ownerIds = await resolveCustomerOwnerIds(db, effectiveUser, effectiveOrderTenant);
    const ordCustId = String(order.customer_id).trim();
    if (ownerIds.includes(ordCustId)) {
      effectiveUser = { ...effectiveUser, id: ordCustId };
    }
  }

  const presentedOrderToken = (
    c.req.header('X-Order-Token') ||
    c.req.header('x-order-token') ||
    c.req.query('order_token') ||
    ''
  ).trim();
  const orderTokenVerified = order.guest_token_hash
    ? await verifyGuestOrderToken(order.guest_token_hash, presentedOrderToken)
    : false;
  const access = canAccessOrder(
    effectiveUser as any,
    {
      id: order.id,
      customer_id: order.customer_id,
      guest_token_hash: order.guest_token_hash,
    },
    { orderTokenVerified },
  );
  if (!access.allowed) {
    const status = !user && !presentedOrderToken ? 401 : 403;
    return c.json({ success: false, error: access.reason || (status === 401 ? 'Unauthorized' : 'Forbidden') }, status);
  }

  const scope = resolveCustomerScope(c);
  if (scope.isShipper) {
    const orderType = String(order.order_type || '').toLowerCase();
    const assignedShipperId = String(order.assigned_shipper_id ?? order.shipper_id ?? '').trim();
    if (orderType !== 'delivery' || (assignedShipperId && assignedShipperId !== scope.actorId)) {
      return c.json({ success: false, error: 'Forbidden: order is not assigned to this shipper' }, 403);
    }
  }
  const { items, payments } = await fetchOrderItemsAndPayments(db, id, effectiveOrderTenant);
  return c.json({
    success: true,
    data: projectForActor(scope, order, items, formatOrder, formatCustomerOrder, payments),
  });
}

export async function handleTrackOrder(c: Context<{ Bindings: Env }>) {
  const tenantCheck = resolveOpenApiOrdersTenant(c, 'public');
  if (!tenantCheck.ok) {
    return tenantCheck.response;
  }
  const rawTenantId = (tenantCheck.tenantId || 'default').trim() || 'default';
  const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
  const db = getDatabase(c);
  const id = ((c.req as any).valid ? (c.req as any).valid('param') : null)?.id || c.req.param('id');
  const user = c.get('user');

  const order = await fetchOrderForRead(db, id, tenantId);
  if (!order) return c.json({ success: false, error: 'Order not found' }, 404);

  const rawOrderTenant = typeof order.tenant_id === 'string' ? order.tenant_id.trim() : '';
  const effectiveOrderTenant =
    tenantId === '*'
      ? (rawOrderTenant && rawOrderTenant !== '*' && rawOrderTenant.toLowerCase() !== 'hq' ? rawOrderTenant : 'default')
      : tenantId;
  let effectiveUser = user as Record<string, any> | undefined;
  if (effectiveUser?.role === 'customer' && order.customer_id) {
    const ownerIds = await resolveCustomerOwnerIds(db, effectiveUser, effectiveOrderTenant);
    const ordCustId = String(order.customer_id).trim();
    if (ownerIds.includes(ordCustId)) {
      effectiveUser = { ...effectiveUser, id: ordCustId };
    }
  }

  const presentedOrderToken = (
    c.req.header('X-Order-Token') ||
    c.req.header('x-order-token') ||
    c.req.query('order_token') ||
    ''
  ).trim();
  const orderTokenVerified = order.guest_token_hash
    ? await verifyGuestOrderToken(order.guest_token_hash, presentedOrderToken)
    : false;

  // Anonymous callers without a token keep shareable zero-PII tracking links working;
  // signed-in customers and explicit token presenters must match ownership or guest_token_hash.
  const access = canAccessOrder(
    effectiveUser as any,
    {
      id: order.id,
      customer_id: order.customer_id,
      guest_token_hash: effectiveUser || presentedOrderToken ? order.guest_token_hash : null,
    },
    { orderTokenVerified },
  );
  if (!access.allowed) {
    const status = !user && !presentedOrderToken ? 401 : 403;
    return c.json({ success: false, error: access.reason || (status === 401 ? 'Unauthorized' : 'Forbidden') }, status);
  }

  const { items } = await fetchOrderItemsAndPayments(db, id, effectiveOrderTenant);
  return c.json({ success: true, data: formatCustomerOrder(order, items) });
}

export function registerOrderReadHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(OrderRoutes.list as any, handleListOrders as any);
  app.openapi(OrderRoutes.summary as any, handleGetOrderSummary as any);
  app.openapi(OrderRoutes.get as any, handleGetOrderById as any);
}
