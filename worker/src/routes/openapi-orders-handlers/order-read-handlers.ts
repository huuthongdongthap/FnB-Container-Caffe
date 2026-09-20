import type { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { Env } from '../../types/env';
import { OrderRoutes } from '../../schemas/orders';
import { formatCustomerOrder, formatOrder, fetchOrderItemsAndPayments } from './helpers';

const STAFF_ROLES = ['owner', 'manager', 'staff'];

/**
 * Ownership scope for guest sessions. A customer token may only ever reach rows
 * whose customer_id matches its own subject; staff roles see everything.
 * `allowAll: false` with no owner means "match nothing" (fail closed).
 */
function resolveCustomerScope(c: Context<{ Bindings: Env }>): { allowAll: boolean; owner: string | null } {
  const user = c.get('user');
  if (user && STAFF_ROLES.includes(user.role)) {
    return { allowAll: true, owner: null };
  }
  const owner = user?.role === 'customer' ? user.id : null;
  return { allowAll: false, owner };
}

/**
 * Guest-facing payloads go through the allowlist projection so staff and
 * procurement columns never leave the worker. Staff keep the full row.
 */
function projectForActor<T, U>(
  scope: { allowAll: boolean },
  order: T,
  items: T[],
  full: (_o: T, _i: T[], _p: T[]) => U,
  guest: (_o: T, _i: T[]) => U,
  payments: T[],
): U {
  return scope.allowAll ? full(order, items, payments) : guest(order, items);
}

export function registerOrderReadHandlers(app: OpenAPIHono<{ Bindings: Env }>) {
  // GET /api/orders - List orders with pagination and filtering
  app.openapi(OrderRoutes.list, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const query = c.req.valid('query');
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
    if (customerId) {
      whereClause += ' AND o.customer_id = ?';
      params.push(customerId);
    }

    // Get total count
    const countResult = await db.prepare(
      `SELECT COUNT(*) as total FROM orders o ${whereClause}`
    ).bind(...params).first();
    const total = countResult?.total || 0;

    // Get orders with items and payments
    const offset = (page - 1) * limit;
    const orderClause = `${sort} ${order.toUpperCase()}`;
    const rows = await db.prepare(
      `SELECT o.*, t.name as table_name
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       ${whereClause}
       ORDER BY ${orderClause}
       LIMIT ? OFFSET ?`
    ).bind(...params, limit, offset).all();

    // For each order, fetch items and payments
    const orders = await Promise.all(rows.results.map(async (_order) => {
      const { items, payments } = await fetchOrderItemsAndPayments(db, _order.id as string);
      return projectForActor(scope, _order, items, formatOrder, formatCustomerOrder, payments);
    }));

    return c.json({
      success: true,
      data: { orders, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } },
    });
  });

  // GET /api/orders/:id - Get order by ID
  app.openapi(OrderRoutes.get, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const { id } = c.req.valid('param');
    const scope = resolveCustomerScope(c);

    let whereClause = 'WHERE o.id = ?';
    const params: (string | number)[] = [id];

    if (scope.allowAll) {
      // staff can see any order
    } else if (scope.owner) {
      whereClause += ' AND o.customer_id = ?';
      params.push(scope.owner);
    } else {
      whereClause += ' AND 1=0';
    }

    const order = await db.prepare(
      `SELECT o.*, t.name as table_name
       FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       ${whereClause}`
    ).bind(...params).first();

    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    const { items, payments } = await fetchOrderItemsAndPayments(db, id);

    return c.json({
      success: true,
      data: projectForActor(scope, order, items, formatOrder, formatCustomerOrder, payments),
    });
  });

  // GET /api/orders/summary - Get order summary statistics
  app.openapi(OrderRoutes.summary, async (c: Context<{ Bindings: Env }>) => {
    const db = c.env.AURA_DB;
    const query = c.req.valid('query');
    const { locationId, dateFrom, dateTo } = query;

    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];

    if (locationId) {
      whereClause += ' AND location_id = ?';
      params.push(locationId);
    }
    if (dateFrom) {
      whereClause += ' AND date(created_at) >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      whereClause += ' AND date(created_at) <= ?';
      params.push(dateTo);
    }

    const [totalResult, revenueResult, statusResult, paymentResult] = await Promise.all([
      db.prepare(`SELECT COUNT(*) as total FROM orders ${whereClause}`).bind(...params).first(),
      db.prepare(`SELECT SUM(total_amount) as revenue FROM orders ${whereClause} AND status != 'cancelled'`).bind(...params).first(),
      db.prepare(`SELECT status, COUNT(*) as count FROM orders ${whereClause} GROUP BY status`).bind(...params).all(),
      db.prepare(`SELECT source, COUNT(*) as count FROM orders ${whereClause} GROUP BY source`).bind(...params).all(),
    ]);

    const statusCounts: Record<string, number> = {};
    statusResult.results.forEach(row => { statusCounts[row.status] = row.count; });

    const paymentCounts: Record<string, number> = {};
    paymentResult.results.forEach(row => { paymentCounts[row.source] = row.count; });

    return c.json({
      success: true,
      data: {
        totalOrders: totalResult?.total || 0,
        totalRevenue: revenueResult?.revenue || 0,
        averageOrderValue: totalResult?.total ? Math.round((revenueResult?.revenue || 0) / totalResult.total) : 0,
        ordersByStatus: statusCounts,
        ordersByPaymentMethod: paymentCounts,
      },
    });
  });
}
