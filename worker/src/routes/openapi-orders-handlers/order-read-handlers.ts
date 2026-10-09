import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { OrderRoutes } from '../../schemas/orders';
import { formatCustomerOrder, formatOrder, fetchOrderItemsAndPayments } from './helpers';
import { getDatabase } from '../../lib/db';
import { handleGetOrderSummary } from './order-summary-handlers';
import { canAccessOrder } from '@aura/domain-order';

export { handleGetOrderSummary };

const STAFF_ROLES = ['owner', 'manager', 'staff'];
const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  created_at: 'o.created_at',
  total_amount: 'o.total_amount',
  status: 'o.status',
  order_number: 'o.order_number',
  total: 'o.total_amount',
};

function resolveCustomerScope(c: Context<{ Bindings: Env }>): { allowAll: boolean; owner: string | null } {
  const user = c.get('user');
  if (user && STAFF_ROLES.includes(user.role)) {
    return { allowAll: true, owner: null };
  }
  const owner = user?.role === 'customer' ? user.id : null;
  return { allowAll: false, owner };
}

function projectForActor(
  scope: { allowAll: boolean },
  order: any,
  items: any[],
  full: (_o: any, _i: any[], _p: any[]) => any,
  guest: (_o: any, _i: any[]) => any,
  payments: any[],
): any {
  return scope.allowAll ? full(order, items, payments) : guest(order, items);
}

export async function handleListOrders(c: Context<{ Bindings: Env }>) {
  const db = getDatabase(c);
  const query = ((c.req as any).valid ? (c.req as any).valid('query') : null) || c.req.query();
  const { page = 1, limit = 20, sort = 'created_at', order = 'desc', tableId, locationId, status, paymentStatus, dateFrom, dateTo, customerId } = query;
  const scope = resolveCustomerScope(c);

  let whereClause = 'WHERE 1=1';
  const params: (string | number)[] = [];

  if (scope.allowAll) {
    if (customerId) {
      whereClause += ' AND o.customer_id = ?';
      params.push(customerId);
    }
  } else if (scope.owner) {
    whereClause += ' AND o.customer_id = ?';
    params.push(scope.owner);
  } else {
    whereClause += ' AND 1=0';
  }

  if (tableId) {
    whereClause += ' AND o.table_id = ?';
    params.push(tableId);
  }
  if (locationId) {
    whereClause += ' AND o.location_id = ?';
    params.push(locationId);
  }
  if (status) {
    whereClause += ' AND o.status = ?';
    params.push(status);
  }
  if (paymentStatus) {
    whereClause += ' AND o.payment_status = ?';
    params.push(paymentStatus);
  }
  if (dateFrom) {
    whereClause += ' AND date(o.created_at) >= ?';
    params.push(dateFrom);
  }
  if (dateTo) {
    whereClause += ' AND date(o.created_at) <= ?';
    params.push(dateTo);
  }

  const countResult = (await db.prepare(
    `SELECT COUNT(*) as total FROM orders o ${whereClause}`
  ).bind(...params).first()) as { total?: number } | null;
  const total = Number(countResult?.total || 0);
  const pageNum = Number(page || 1);
  const limitNum = Number(limit || 20);

  const offset = (pageNum - 1) * limitNum;
  const safeSort = ALLOWED_SORT_COLUMNS[sort] || 'o.created_at';
  const safeDirection = (order?.toLowerCase() === 'asc') ? 'ASC' : 'DESC';
  const orderClause = `${safeSort} ${safeDirection}`;
  const rows = (await db.prepare(
    `SELECT o.*, COALESCE(t.table_number, t.id) as table_name
     FROM orders o
     LEFT JOIN cafe_tables t ON o.table_id = t.id
     ${whereClause}
     ORDER BY ${orderClause}
     LIMIT ? OFFSET ?`
  ).bind(...params, limitNum, offset).all()) as { results: any[] };

  const orders = await Promise.all(rows.results.map(async (_order) => {
    const { items, payments } = await fetchOrderItemsAndPayments(db, _order.id as string);
    return projectForActor(scope, _order, items, formatOrder, formatCustomerOrder, payments);
  }));

  return c.json({
    success: true,
    data: { orders, meta: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) } },
  });
}

export async function handleGetOrderById(c: Context<{ Bindings: Env }>) {
  const db = getDatabase(c);
  const id = ((c.req as any).valid ? (c.req as any).valid('param') : null)?.id || c.req.param('id');
  const user = c.get('user');

  const order = (await db.prepare(
    `SELECT o.*, COALESCE(t.table_number, t.id) as table_name
     FROM orders o
     LEFT JOIN cafe_tables t ON o.table_id = t.id
     WHERE o.id = ?`
  ).bind(id).first()) as Record<string, any> | null;

  if (!order) {
    return c.json({ success: false, error: 'Order not found' }, 404);
  }

  const access = canAccessOrder(user, { id: order.id, customer_id: order.customer_id });
  if (!access.allowed) {
    return c.json({ success: false, error: access.reason || 'Forbidden' }, 403);
  }

  const scope = resolveCustomerScope(c);
  const { items, payments } = await fetchOrderItemsAndPayments(db, id);

  return c.json({
    success: true,
    data: projectForActor(scope, order, items, formatOrder, formatCustomerOrder, payments),
  });
}

export function registerOrderReadHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  app.openapi(OrderRoutes.list as any, handleListOrders as any);
  app.openapi(OrderRoutes.get as any, handleGetOrderById as any);
  app.openapi(OrderRoutes.summary as any, handleGetOrderSummary as any);
}
