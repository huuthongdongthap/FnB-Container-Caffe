/**
 * Orders — Admin orders listing handler
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import { buildOrderFilterClause, buildOrderTail, OrderSortColumn } from './shared-listing';

const log = createLogger({ route: 'orders' });

type AdminOrderSearchField = 'all' | 'id' | 'customer_name' | 'customer_phone' | 'table' | 'item' | 'address' | 'notes';
const ALLOWED_SEARCH_FIELDS: ReadonlySet<AdminOrderSearchField> = new Set([
  'all',
  'id',
  'customer_name',
  'customer_phone',
  'table',
  'item',
  'address',
  'notes',
]);
const ALLOWED_ORDER_TYPES: ReadonlySet<string> = new Set(['dine_in', 'takeaway', 'delivery']);

function escapeLike(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function buildSearchClause(
  search: string,
  field: AdminOrderSearchField,
  includeTableJoin: boolean,
): { sql: string; params: unknown[] } {
  const likeTerm = `%${escapeLike(search.toLowerCase())}%`;
  const esc = " ESCAPE '\\'";
  switch (field) {
    case 'id':
      return { sql: ` AND LOWER(o.id) LIKE ?${esc}`, params: [likeTerm] };
    case 'customer_name':
      return { sql: ` AND LOWER(COALESCE(o.customer_name, '')) LIKE ?${esc}`, params: [likeTerm] };
    case 'customer_phone':
      return { sql: ` AND LOWER(COALESCE(o.customer_phone, '')) LIKE ?${esc}`, params: [likeTerm] };
    case 'table':
      if (includeTableJoin) {
        return {
          sql: ` AND (LOWER(CAST(COALESCE(o.table_id, '') AS TEXT)) LIKE ?${esc} OR LOWER(COALESCE(t.table_number, '')) LIKE ?${esc})`,
          params: [likeTerm, likeTerm],
        };
      }
      return {
        sql: ` AND LOWER(CAST(COALESCE(o.table_id, '') AS TEXT)) LIKE ?${esc}`,
        params: [likeTerm],
      };
    case 'item':
      return { sql: ` AND LOWER(CAST(COALESCE(o.items, '') AS TEXT)) LIKE ?${esc}`, params: [likeTerm] };
    case 'address':
      return { sql: ` AND LOWER(COALESCE(o.customer_address, '')) LIKE ?${esc}`, params: [likeTerm] };
    case 'notes':
      return { sql: ` AND LOWER(COALESCE(o.notes, '')) LIKE ?${esc}`, params: [likeTerm] };
    case 'all':
    default: {
      if (includeTableJoin) {
        return {
          sql: ` AND (LOWER(o.id) LIKE ?${esc} OR LOWER(COALESCE(o.customer_name, '')) LIKE ?${esc} OR LOWER(COALESCE(o.customer_phone, '')) LIKE ?${esc} OR LOWER(CAST(COALESCE(o.table_id, '') AS TEXT)) LIKE ?${esc} OR LOWER(COALESCE(t.table_number, '')) LIKE ?${esc} OR LOWER(CAST(COALESCE(o.items, '') AS TEXT)) LIKE ?${esc} OR LOWER(COALESCE(o.customer_address, '')) LIKE ?${esc} OR LOWER(COALESCE(o.notes, '')) LIKE ?${esc})`,
          params: [likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm],
        };
      }
      return {
        sql: ` AND (LOWER(o.id) LIKE ?${esc} OR LOWER(COALESCE(o.customer_name, '')) LIKE ?${esc} OR LOWER(COALESCE(o.customer_phone, '')) LIKE ?${esc} OR LOWER(CAST(COALESCE(o.table_id, '') AS TEXT)) LIKE ?${esc} OR LOWER(CAST(COALESCE(o.items, '') AS TEXT)) LIKE ?${esc} OR LOWER(COALESCE(o.customer_address, '')) LIKE ?${esc} OR LOWER(COALESCE(o.notes, '')) LIKE ?${esc})`,
        params: [likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm],
      };
    }
  }
}

export async function getAdminOrders(request: Request, env: Record<string, unknown>, tenantId?: string) {
  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const paymentStatus = url.searchParams.get('payment_status');
    const paymentMethod = (url.searchParams.get('payment_method') || '').trim();
    const rawOrderType = (url.searchParams.get('order_type') || '').trim();
    const orderType = rawOrderType && rawOrderType !== 'all' && ALLOWED_ORDER_TYPES.has(rawOrderType) ? rawOrderType : '';
    const dateFrom = (url.searchParams.get('dateFrom') || url.searchParams.get('date_from') || '').trim();
    const dateTo = (url.searchParams.get('dateTo') || url.searchParams.get('date_to') || '').trim();
    const search = (url.searchParams.get('search') || '').trim();
    const rawSearchField = (url.searchParams.get('search_field') || url.searchParams.get('field') || 'all').trim().toLowerCase() as AdminOrderSearchField;
    const searchField: AdminOrderSearchField = ALLOWED_SEARCH_FIELDS.has(rawSearchField) ? rawSearchField : 'all';
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
    if (status && status !== 'all') filters.push(['o.status', status]);
    if (paymentStatus && paymentStatus !== 'all') filters.push(['o.payment_status', paymentStatus]);
    if (orderType) filters.push(['o.order_type', orderType]);

    const { clause: baseClause, params: baseParams } = buildOrderFilterClause({ tenantId: resolvedTenant, filters });
    let extraClause = '';
    const extraParams: unknown[] = [];
    if (paymentMethod && paymentMethod !== 'all') {
      extraClause += ' AND COALESCE(o.payment_method, p.method) = ?';
      extraParams.push(paymentMethod);
    }
    if (dateFrom) {
      extraClause += ' AND o.created_at >= ?';
      extraParams.push(dateFrom);
    }
    if (dateTo) {
      const normalizedDateTo = /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? `${dateTo} 23:59:59` : dateTo;
      extraClause += ' AND o.created_at <= ?';
      extraParams.push(normalizedDateTo);
    }

    const searchWithTable = search ? buildSearchClause(search, searchField, true) : { sql: '', params: [] };
    const searchNoTable = search ? buildSearchClause(search, searchField, false) : { sql: '', params: [] };

    const fullClause = baseClause + extraClause + searchWithTable.sql;
    const fullParams = [...baseParams, ...extraParams, ...searchWithTable.params];

    const fallbackClause = baseClause
      + (paymentMethod && paymentMethod !== 'all' ? ' AND o.payment_method = ?' : '')
      + (dateFrom ? ' AND o.created_at >= ?' : '')
      + (dateTo ? ' AND o.created_at <= ?' : '')
      + searchNoTable.sql;
    const fallbackParams = [...baseParams, ...extraParams, ...searchNoTable.params];

    const tail = buildOrderTail({
      sort: sortParam,
      order,
      limit: clampedLimit,
      offset: clampedOffset,
      prefix: 'o.',
    });

    const mainQuery = `SELECT o.id, o.table_id, o.status, o.total, o.payment_status, o.customer_name, o.customer_phone, o.created_at,
       o.items, o.shipping_fee, o.discount,
       o.order_type, o.customer_address, o.notes, o.delivery_time,
       COALESCE(o.payment_method, p.method) AS payment_method,
       t.table_number AS table_number, t.zone AS table_zone,
       p.id AS payment_id, p.refund_status, p.refund_amount, p.amount AS payment_amount, p.transaction_id AS payment_transaction_id
     FROM orders o
     LEFT JOIN cafe_tables t ON t.id = o.table_id
       AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
     LEFT JOIN payments p ON p.id = (
       SELECT p2.id FROM payments p2
       WHERE p2.order_id = o.id
         AND p2.status IN ('paid', 'completed', 'refunded', 'partially_refunded')
         AND COALESCE(NULLIF(TRIM(p2.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
       ORDER BY p2.created_at DESC, p2.rowid DESC
       LIMIT 1
     )
     WHERE 1=1${fullClause}${tail}`;

    let results: Record<string, unknown>[] = [];
    let usedTableJoin = true;
    try {
      const res = await db.prepare(mainQuery).bind(...fullParams).all<Record<string, unknown>>();
      results = res.results ?? [];
    } catch {
      usedTableJoin = false;
      try {
        const legacyJoinQuery = `SELECT o.id, o.table_id, o.status, o.total, o.payment_status, o.customer_name, o.customer_phone, o.created_at,
           o.items, o.shipping_fee, o.discount,
           p.id AS payment_id, p.method AS payment_method, p.refund_status, p.refund_amount, p.amount AS payment_amount
         FROM orders o
         LEFT JOIN payments p ON p.id = (
           SELECT p2.id FROM payments p2
           WHERE p2.order_id = o.id
             AND p2.status IN ('paid', 'completed', 'refunded', 'partially_refunded')
             AND COALESCE(NULLIF(TRIM(p2.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
           ORDER BY p2.created_at DESC, p2.rowid DESC
           LIMIT 1
         )
         WHERE 1=1${fallbackClause}${tail}`;
        const res = await db.prepare(legacyJoinQuery).bind(...fallbackParams).all<Record<string, unknown>>();
        results = res.results ?? [];
      } catch {
        const fallbackQuery = `SELECT o.* FROM orders o WHERE 1=1${fallbackClause}${tail}`;
        const res = await db.prepare(fallbackQuery).bind(...fallbackParams).all<Record<string, unknown>>();
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
      const tableNumber = order.table_number ? String(order.table_number) : null;
      return {
        ...order,
        items: parsedItems,
        total: parseInt(order.total as string),
        payment_id: order.payment_id || null,
        payment_transaction_id: order.payment_transaction_id ? String(order.payment_transaction_id) : null,
        payment_amount: order.payment_amount ? Number(order.payment_amount) : null,
        refund_amount: order.refund_amount ? Number(order.refund_amount) : null,
        shipping_fee: parseInt(String(order.shipping_fee || 0)),
        discount: parseInt(String(order.discount || 0)),
        order_type: order.order_type ? String(order.order_type) : (order.table_id ? 'dine_in' : 'takeaway'),
        customer_address: order.customer_address ? String(order.customer_address) : null,
        notes: order.notes ? String(order.notes) : null,
        delivery_time: order.delivery_time ? String(order.delivery_time) : null,
        table_number: tableNumber,
        table_name: tableNumber,
      };
    });

    const runCountQuery = async (sql: string, params: unknown[]): Promise<number> => {
      const stmt = db.prepare(sql).bind(...params) as unknown as {
        first?: <T>() => Promise<T | null>;
        all?: <T>() => Promise<{ results?: T[] }>;
      };
      if (typeof stmt.first === 'function') {
        const countRow = await stmt.first<{ total: number }>();
        return countRow?.total || 0;
      }
      const countRes = await stmt.all?.<{ total: number }>();
      return countRes?.results?.[0]?.total || 0;
    };

    let total = 0;
    try {
      if (usedTableJoin) {
        const countQuery = `SELECT COUNT(*) as total FROM orders o
          LEFT JOIN cafe_tables t ON t.id = o.table_id
            AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
          LEFT JOIN payments p ON p.id = (
            SELECT p2.id FROM payments p2
            WHERE p2.order_id = o.id
              AND p2.status IN ('paid', 'completed', 'refunded', 'partially_refunded')
              AND COALESCE(NULLIF(TRIM(p2.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
            ORDER BY p2.created_at DESC, p2.rowid DESC
            LIMIT 1
          )
          WHERE 1=1${fullClause}`;
        total = await runCountQuery(countQuery, fullParams);
      } else {
        const countQuery = `SELECT COUNT(*) as total FROM orders o WHERE 1=1${fallbackClause}`;
        total = await runCountQuery(countQuery, fallbackParams);
      }
    } catch {
      const countQuery = `SELECT COUNT(*) as total FROM orders o WHERE 1=1${fallbackClause}`;
      total = await runCountQuery(countQuery, fallbackParams);
    }

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
