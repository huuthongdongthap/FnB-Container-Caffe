/**
 * Orders — Admin orders listing handler
 * Extracted from routes/orders.ts to tree/orders/.
 */

import { jsonResponse, errorResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import { isHeldOutOfKds } from '@aura/domain-kitchen';
import { sanitizeOrderNotes } from '../model/helpers';
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

/**
 * Response allowlist. Never expand this to `o.*`: the orders table holds guest/order
 * secrets (`guest_token_hash`, `order_token`, `guest_token`, `payment_secret`) that must
 * never reach an admin list payload, including on legacy-schema fallbacks.
 */
const ORDER_RESPONSE_FIELDS = [
  'id',
  'order_number',
  'table_id',
  'status',
  'total',
  'payment_status',
  'customer_name',
  'customer_phone',
  'created_at',
  'started_at',
  'ready_at',
  'served_at',
  'cancelled_at',
  'cancelled_reason',
  'assigned_shipper_id',
  'shipper_name',
  'failure_reason',
  'items',
  'shipping_fee',
  'discount',
  'order_type',
  'customer_address',
  'notes',
  'delivery_time',
  'payment_method',
  'is_cod',
  'table_number',
  'table_name',
  'table_zone',
  'payment_id',
  'payment_attempt_status',
  'payment_url',
  'refund_status',
  'refund_amount',
  'payment_amount',
  'payment_transaction_id',
] as const;

/**
 * Progressive column projections for databases created before the current canonical
 * schema. Each entry must stay an explicit allowlist so legacy rows cannot leak secrets.
 */
const LEGACY_ORDER_PROJECTIONS: ReadonlyArray<{ cols: string; hasPaymentMethod: boolean }> = [
  {
    cols: `o.id, o.order_number, o.table_id, o.status, o.total, o.payment_status, o.customer_name, o.customer_phone, o.created_at,
   o.started_at, o.ready_at, o.cancelled_at, o.failure_reason,
   o.items, o.shipping_fee, o.discount, o.order_type, o.customer_address, o.notes, o.delivery_time`,
    hasPaymentMethod: true,
  },
  {
    cols: `o.id, o.table_id, o.status, o.total, o.payment_status, o.customer_name, o.customer_phone, o.created_at,
   o.items, o.shipping_fee, o.discount, o.order_type, o.customer_address, o.notes, o.delivery_time`,
    hasPaymentMethod: true,
  },
  {
    cols: `o.id, o.table_id, o.status, o.total, o.payment_status, o.customer_name, o.customer_phone, o.created_at,
   o.items, o.shipping_fee, o.discount`,
    hasPaymentMethod: false,
  },
  {
    cols: `o.id, o.status, o.total, o.payment_status, o.customer_name, o.customer_phone, o.created_at, o.items`,
    hasPaymentMethod: false,
  },
  {
    cols: `o.id, o.status, o.total, o.payment_status, o.customer_name, o.customer_phone, o.created_at`,
    hasPaymentMethod: false,
  },
];

function pickOrderResponseFields(order: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const field of ORDER_RESPONSE_FIELDS) {
    picked[field] = order[field] ?? null;
  }
  return picked;
}

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
      if (includeTableJoin) {
        return {
          sql: ` AND (LOWER(o.id) LIKE ?${esc} OR LOWER(COALESCE(o.order_number, '')) LIKE ?${esc})`,
          params: [likeTerm, likeTerm],
        };
      }
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
          sql: ` AND (LOWER(o.id) LIKE ?${esc} OR LOWER(COALESCE(o.order_number, '')) LIKE ?${esc} OR LOWER(COALESCE(o.customer_name, '')) LIKE ?${esc} OR LOWER(COALESCE(o.customer_phone, '')) LIKE ?${esc} OR LOWER(CAST(COALESCE(o.table_id, '') AS TEXT)) LIKE ?${esc} OR LOWER(COALESCE(t.table_number, '')) LIKE ?${esc} OR LOWER(CAST(COALESCE(o.items, '') AS TEXT)) LIKE ?${esc} OR LOWER(COALESCE(o.customer_address, '')) LIKE ?${esc} OR LOWER(COALESCE(o.notes, '')) LIKE ?${esc})`,
          params: [likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm, likeTerm],
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
    let dateFilterClause = '';
    if (dateFrom) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
        dateFilterClause += " AND DATE(datetime(o.created_at, '+7 hours')) >= ?";
      } else {
        dateFilterClause += ' AND o.created_at >= ?';
      }
      extraParams.push(dateFrom);
    }
    if (dateTo) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
        dateFilterClause += " AND DATE(datetime(o.created_at, '+7 hours')) <= ?";
      } else {
        dateFilterClause += ' AND o.created_at <= ?';
      }
      extraParams.push(dateTo);
    }
    extraClause += dateFilterClause;

    const searchWithTable = search ? buildSearchClause(search, searchField, true) : { sql: '', params: [] };
    const searchNoTable = search ? buildSearchClause(search, searchField, false) : { sql: '', params: [] };

    const fullClause = baseClause + extraClause + searchWithTable.sql;
    const fullParams = [...baseParams, ...extraParams, ...searchWithTable.params];

    const fallbackClause = baseClause
      + (paymentMethod && paymentMethod !== 'all' ? ' AND o.payment_method = ?' : '')
      + dateFilterClause
      + searchNoTable.sql;
    const fallbackParams = [...baseParams, ...extraParams, ...searchNoTable.params];

    const tail = buildOrderTail({
      sort: sortParam,
      order,
      limit: clampedLimit,
      offset: clampedOffset,
      prefix: 'o.',
    });

    const mainQuery = `SELECT o.id, o.order_number, o.table_id, o.status, o.total, o.payment_status, o.customer_name, o.customer_phone, o.created_at,
       o.started_at, o.ready_at, o.served_at, o.cancelled_at, o.assigned_shipper_id, o.shipper_name, o.failure_reason, o.is_cod,
       o.items, o.shipping_fee, o.discount,
       o.order_type, o.customer_address, o.notes, o.delivery_time,
       COALESCE(o.payment_method, p.method) AS payment_method,
       COALESCE(NULLIF(TRIM(t.table_number), ''), NULLIF(TRIM(t.name), '')) AS table_number,
       t.zone AS table_zone,
       p.id AS payment_id, p.status AS payment_attempt_status, p.payment_url, p.refund_status, p.refund_amount, p.amount AS payment_amount, p.transaction_id AS payment_transaction_id
     FROM orders o
     LEFT JOIN cafe_tables t ON t.id = o.table_id
       AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
     LEFT JOIN payments p ON p.id = (
       SELECT p2.id FROM payments p2
       WHERE p2.order_id = o.id
         AND COALESCE(NULLIF(TRIM(p2.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
       ORDER BY
         CASE WHEN p2.status IN ('paid', 'completed', 'refunded', 'partially_refunded') THEN 0 ELSE 1 END ASC,
         p2.created_at DESC,
         p2.rowid DESC
       LIMIT 1
     )
     WHERE 1=1${fullClause}${tail}`;

    const midSchemaQuery = `SELECT o.id, o.table_id, o.status, o.total, o.payment_status, o.customer_name, o.customer_phone, o.created_at,
       o.items, o.shipping_fee, o.discount,
       o.order_type, o.customer_address, o.notes, o.delivery_time,
       COALESCE(o.payment_method, p.method) AS payment_method,
       t.table_number AS table_number, t.zone AS table_zone,
       p.id AS payment_id, p.status AS payment_attempt_status, p.payment_url, p.refund_status, p.refund_amount, p.amount AS payment_amount, p.transaction_id AS payment_transaction_id
     FROM orders o
     LEFT JOIN cafe_tables t ON t.id = o.table_id
       AND COALESCE(NULLIF(TRIM(t.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
     LEFT JOIN payments p ON p.id = (
       SELECT p2.id FROM payments p2
       WHERE p2.order_id = o.id
         AND COALESCE(NULLIF(TRIM(p2.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
       ORDER BY
         CASE WHEN p2.status IN ('paid', 'completed', 'refunded', 'partially_refunded') THEN 0 ELSE 1 END ASC,
         p2.created_at DESC,
         p2.rowid DESC
       LIMIT 1
     )
     WHERE 1=1${fallbackClause}${tail}`;

    let results: Record<string, unknown>[] = [];
    let usedTableJoin = true;
    try {
      const res = await db.prepare(mainQuery).bind(...fullParams).all<Record<string, unknown>>();
      results = res.results ?? [];
    } catch {
      try {
        const res = await db.prepare(midSchemaQuery).bind(...fallbackParams).all<Record<string, unknown>>();
        results = res.results ?? [];
        usedTableJoin = false;
      } catch {
        usedTableJoin = false;
      let loadedLegacy = false;
      for (const projection of LEGACY_ORDER_PROJECTIONS) {
        try {
          const paymentMethodSelect = projection.hasPaymentMethod
            ? 'COALESCE(o.payment_method, p.method) AS payment_method'
            : 'p.method AS payment_method';
          const legacyJoinQuery = `SELECT ${projection.cols},
             p.id AS payment_id, p.status AS payment_attempt_status, ${paymentMethodSelect}, p.refund_status, p.refund_amount, p.amount AS payment_amount
           FROM orders o
           LEFT JOIN payments p ON p.id = (
             SELECT p2.id FROM payments p2
             WHERE p2.order_id = o.id
               AND COALESCE(NULLIF(TRIM(p2.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
             ORDER BY
               CASE WHEN p2.status IN ('paid', 'completed', 'refunded', 'partially_refunded') THEN 0 ELSE 1 END ASC,
               p2.created_at DESC,
               p2.rowid DESC
             LIMIT 1
           )
           WHERE 1=1${fallbackClause}${tail}`;
          const res = await db.prepare(legacyJoinQuery).bind(...fallbackParams).all<Record<string, unknown>>();
          results = res.results ?? [];
          loadedLegacy = true;
          break;
        } catch {
          // Try narrower projection
        }
      }
      if (!loadedLegacy) {
        for (let idx = 0; idx < LEGACY_ORDER_PROJECTIONS.length; idx++) {
          const projection = LEGACY_ORDER_PROJECTIONS[idx]!;
          const selectCols = projection.hasPaymentMethod
            ? `${projection.cols}, o.payment_method`
            : projection.cols;
          const fallbackQuery = `SELECT ${selectCols} FROM orders o WHERE 1=1${fallbackClause}${tail}`;
          if (idx === LEGACY_ORDER_PROJECTIONS.length - 1) {
            const res = await db.prepare(fallbackQuery).bind(...fallbackParams).all<Record<string, unknown>>();
            results = res.results ?? [];
          } else {
            try {
              const res = await db.prepare(fallbackQuery).bind(...fallbackParams).all<Record<string, unknown>>();
              results = res.results ?? [];
              break;
            } catch {
              // Try narrower projection
            }
          }
        }
      }
      }
    }

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
              AND COALESCE(NULLIF(TRIM(p2.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
            ORDER BY
              CASE WHEN p2.status IN ('paid', 'completed', 'refunded', 'partially_refunded') THEN 0 ELSE 1 END ASC,
              p2.created_at DESC,
              p2.rowid DESC
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

    const pendingLoyaltyByOrder = new Map<string, { transferRef: string; amount: number | null }>();
    const orderIds = results.map((r) => String(r.id ?? '')).filter(Boolean);
    if (orderIds.length > 0) {
      const CHUNK_SIZE = 80;
      try {
        for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) {
          const chunk = orderIds.slice(i, i + CHUNK_SIZE);
          const placeholders = chunk.map(() => '?').join(', ');
          const tenantClause = resolvedTenant !== '*' ? ' AND tenant_id = ?' : '';
          const params = resolvedTenant !== '*' ? [...chunk, resolvedTenant] : chunk;
          const lwRes = await db
            .prepare(
              `SELECT order_id, reversal_key, amount
               FROM refund_loyalty_work
               WHERE status IN ('pending', 'failed')
                 AND order_id IN (${placeholders})${tenantClause}
               ORDER BY created_at DESC`,
            )
            .bind(...params)
            .all<{ order_id: string; reversal_key: string; amount?: number | null }>();
          for (const row of lwRes.results ?? []) {
            if (row.order_id && row.reversal_key && !pendingLoyaltyByOrder.has(row.order_id)) {
              const rawAmount = Number(row.amount);
              pendingLoyaltyByOrder.set(row.order_id, {
                transferRef: row.reversal_key,
                amount: Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : null,
              });
            }
          }
        }
      } catch {
        // Non-fatal if refund_loyalty_work table is absent in legacy test schemas
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
      const pendingLoyalty = pendingLoyaltyByOrder.get(String(order.id ?? '')) ?? null;
      const safeOrder = pickOrderResponseFields(order);
      const resolvedOrderType = order.order_type ? String(order.order_type) : (order.table_id ? 'dine_in' : 'takeaway');
      const failureReason = order.failure_reason ? String(order.failure_reason) : null;
      const cancelledReason =
        order.cancelled_reason
          ? String(order.cancelled_reason)
          : String(order.status ?? '').toLowerCase() === 'cancelled' && failureReason
            ? failureReason
            : null;
      const heldFromKds = isHeldOutOfKds({
        ...order,
        order_type: resolvedOrderType,
      });
      return {
        ...safeOrder,
        order_number: order.order_number ? String(order.order_number) : null,
        items: parsedItems,
        total: parseInt(order.total as string),
        payment_id: order.payment_id || null,
        payment_transaction_id: order.payment_transaction_id ? String(order.payment_transaction_id) : null,
        payment_amount: order.payment_amount ? Number(order.payment_amount) : null,
        refund_amount: order.refund_amount ? Number(order.refund_amount) : null,
        shipping_fee: parseInt(String(order.shipping_fee || 0)),
        discount: parseInt(String(order.discount || 0)),
        order_type: resolvedOrderType,
        customer_address: order.customer_address ? String(order.customer_address) : null,
        notes: sanitizeOrderNotes(order.notes),
        delivery_time: order.delivery_time ? String(order.delivery_time) : null,
        started_at: order.started_at ? String(order.started_at) : null,
        ready_at: order.ready_at ? String(order.ready_at) : null,
        served_at: order.served_at ? String(order.served_at) : null,
        cancelled_at: order.cancelled_at ? String(order.cancelled_at) : null,
        assigned_shipper_id: order.assigned_shipper_id ? String(order.assigned_shipper_id) : null,
        shipper_name: order.shipper_name ? String(order.shipper_name) : null,
        failure_reason: failureReason,
        cancelled_reason: cancelledReason,
        is_cod: order.is_cod !== undefined && order.is_cod !== null ? Number(order.is_cod) : 0,
        is_held_out_of_kds: heldFromKds,
        table_number: tableNumber,
        table_name: tableNumber ?? (order.table_id ? String(order.table_id) : null),
        pending_loyalty_reversal: Boolean(pendingLoyalty),
        pending_loyalty_transfer_ref: pendingLoyalty?.transferRef ?? null,
        pending_loyalty_refund_amount: pendingLoyalty?.amount ?? null,
      };
    });

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
