/**
 * Orders — Admin orders listing handler
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import { buildOrderFilterClause, buildOrderTail, OrderSortColumn } from './shared-listing';

const log = createLogger({ route: 'orders' });

export async function getAdminOrders(request: Request, env: Record<string, unknown>, tenantId?: string) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const paymentStatus = url.searchParams.get('payment_status');
    const search = (url.searchParams.get('search') || '').trim();
    const queryTenant = url.searchParams.get('tenant_id');
    const effectiveTenantId = typeof tenantId === 'string' && tenantId.trim() ? tenantId.trim() : 'default';
    const cleanQueryTenant = queryTenant ? queryTenant.trim() : '';
    const resolvedTenant =
      effectiveTenantId === '*' || effectiveTenantId === 'hq'
        ? (cleanQueryTenant && cleanQueryTenant !== 'hq' ? cleanQueryTenant : '*')
        : effectiveTenantId;
    const rawLimit = parseInt(url.searchParams.get('limit') || url.searchParams.get('pageSize') || '50', 10);
    const clampedLimit = Number.isFinite(rawLimit) ? Math.min(200, Math.max(1, Math.floor(rawLimit))) : 50;
    const rawPage = parseInt(url.searchParams.get('page') || '', 10);
    const hasExplicitOffset = url.searchParams.has('offset');
    const computedOffset = hasExplicitOffset
      ? parseInt(url.searchParams.get('offset') || '0', 10)
      : Number.isFinite(rawPage) && rawPage > 1
        ? (Math.floor(rawPage) - 1) * clampedLimit
        : 0;
    const clampedOffset = Number.isFinite(computedOffset) ? Math.max(0, Math.floor(computedOffset)) : 0;
    const sortParam = (url.searchParams.get('sort') || 'created_at') as OrderSortColumn;
    const order = url.searchParams.get('order') === 'asc' ? 'ASC' as const : 'DESC' as const;

    const db = (env.AURA_DB ?? (env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

    const filters: Array<[string, string]> = [];
    if (status) filters.push(['o.status', status]);
    if (paymentStatus) filters.push(['o.payment_status', paymentStatus]);

    let query = `SELECT o.id, o.table_id, o.status, o.total, o.payment_status, o.customer_name, o.customer_phone, o.created_at,
       o.items, o.shipping_fee, o.discount,
       p.id AS payment_id, p.refund_status, p.refund_amount, p.amount AS payment_amount, p.method AS payment_method
     FROM orders o
     LEFT JOIN payments p ON p.id = (
       SELECT p2.id FROM payments p2
       WHERE p2.order_id = o.id
         AND p2.status IN ('paid', 'completed')
         AND COALESCE(NULLIF(TRIM(p2.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
       ORDER BY p2.created_at DESC, p2.rowid DESC
       LIMIT 1
     )
     WHERE 1=1`;
    const { clause: baseClause, params: baseParams } = buildOrderFilterClause({ tenantId: resolvedTenant, filters });
    let clause = baseClause;
    const params = [...baseParams];
    if (search) {
      const likeTerm = `%${search.toLowerCase()}%`;
      clause += ' AND (LOWER(o.id) LIKE ? OR LOWER(COALESCE(o.customer_name, \'\')) LIKE ? OR LOWER(COALESCE(o.customer_phone, \'\')) LIKE ? OR LOWER(CAST(COALESCE(o.table_id, \'\') AS TEXT)) LIKE ?)';
      params.push(likeTerm, likeTerm, likeTerm, likeTerm);
    }
    const tail = buildOrderTail({
      sort: sortParam,
      order,
      limit: clampedLimit,
      offset: clampedOffset,
      prefix: 'o.',
    });
    query += clause + tail;

    let results: Record<string, unknown>[] = [];
    try {
      const res = await db.prepare(query).bind(...params).all<Record<string, unknown>>();
      results = res.results ?? [];
    } catch {
      try {
        if (resolvedTenant === 'default') {
          const legacyJoinQuery = `SELECT o.id, o.table_id, o.status, o.total, o.payment_status, o.customer_name, o.customer_phone, o.created_at,
             o.items, o.shipping_fee, o.discount,
             p.id AS payment_id, p.refund_status, p.refund_amount, p.amount AS payment_amount, p.method AS payment_method
           FROM orders o
           LEFT JOIN payments p ON p.id = (
             SELECT p2.id FROM payments p2
             WHERE p2.order_id = o.id AND p2.status IN ('paid', 'completed')
             LIMIT 1
           )
           WHERE 1=1${clause}${tail}`;
          const res = await db.prepare(legacyJoinQuery).bind(...params).all<Record<string, unknown>>();
          results = res.results ?? [];
        } else {
          const fallbackQuery = `SELECT o.* FROM orders o WHERE 1=1${clause}${tail}`;
          const res = await db.prepare(fallbackQuery).bind(...params).all<Record<string, unknown>>();
          results = res.results ?? [];
        }
      } catch {
        const fallbackQuery = `SELECT o.* FROM orders o WHERE 1=1${clause}${tail}`;
        const res = await db.prepare(fallbackQuery).bind(...params).all<Record<string, unknown>>();
        results = res.results ?? [];
      }
    }

    const orders = results.map(order => {
      let parsedItems: unknown[] = [];
      if (Array.isArray(order.items)) {
        parsedItems = order.items;
      } else if (typeof order.items === 'string' && order.items) {
        try {
          parsedItems = JSON.parse(order.items);
        } catch {
          parsedItems = [];
        }
      }
      return {
        ...order,
        items: parsedItems,
        total: parseInt(order.total as string),
        payment_id: order.payment_id || null,
        payment_amount: order.payment_amount ? Number(order.payment_amount) : null,
        refund_amount: order.refund_amount ? Number(order.refund_amount) : null,
        shipping_fee: parseInt(String(order.shipping_fee || 0)),
        discount: parseInt(String(order.discount || 0))
      };
    });

    const countQuery = `SELECT COUNT(*) as total FROM orders WHERE 1=1${clause.replace(/o\./g, '')}`;
    const countParams = params;

    const { results: countResult } = await db.prepare(countQuery).bind(...countParams).all<{ total: number }>();
    const total = countResult[0]?.total || 0;

    return jsonResponse({
      success: true,
      orders,
      pagination: {
        total: parseInt(total as unknown as string) || 0,
        limit: clampedLimit,
        offset: clampedOffset,
        page: Math.floor(clampedOffset / clampedLimit) + 1,
        pageSize: clampedLimit,
      }
    });
  } catch (error) {
    log.error('GetAdminOrders error:', { message: (error as Error).message });
    return errorResponse('Failed to fetch orders', 500);
  }
}
