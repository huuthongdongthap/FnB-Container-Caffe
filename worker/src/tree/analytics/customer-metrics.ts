/**
 * Customer Metrics — D1 query for customer analytics aggregate
 *
 * GET /api/analytics/customer-metrics
 * Returns: total_customers, new_30d, repeat_rate, avg_order_value
 */

import { buildTenantFilter } from './summary';

export interface CustomerMetrics {
  total_customers: number;
  new_30d: number;
  repeat_rate: number;
  avg_order_value: number;
}

/**
 * Get aggregate customer metrics from D1.
 * Runs four independent aggregation queries and combines results.
 */
export async function getCustomerMetrics(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId?: string
): Promise<CustomerMetrics> {
  const { clause: tenantWhere, binds: tenantBinds } = buildTenantFilter(tenantId, undefined, 'WHERE');
  const { clause: tenantAnd } = buildTenantFilter(tenantId, undefined, 'AND');
  const runFirst = <T>(sql: string) => {
    const stmt = db.prepare(sql);
    return tenantBinds.length > 0 ? stmt.bind(...tenantBinds).first<T>() : stmt.first<T>();
  };

  const runOrderMetric = async <T>(...sqls: string[]): Promise<T | null> => {
    for (let i = 0; i < sqls.length - 1; i++) {
      try {
        return await runFirst<T>(sqls[i]);
      } catch {
        // Fall through to schema-compatible query tier
      }
    }
    return await runFirst<T>(sqls[sqls.length - 1]);
  };

  const validOrderWhere = `status != 'cancelled'
          AND status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')
          AND LOWER(COALESCE(TRIM(status), '')) NOT IN ('cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired')
          AND COALESCE(payment_status, '') != 'refunded'
          AND LOWER(COALESCE(TRIM(payment_status), '')) NOT IN ('refunded', 'failed', 'cancelled', 'canceled')
          AND NOT (COALESCE(TRIM(notes), '') = 'Khách QR - cho don mon' AND COALESCE(TRIM(items), '[]') IN ('', '[]'))`;

  const noNotesOrderWhere = `status != 'cancelled'
          AND status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')
          AND LOWER(COALESCE(TRIM(status), '')) NOT IN ('cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired')
          AND COALESCE(payment_status, '') != 'refunded'
          AND LOWER(COALESCE(TRIM(payment_status), '')) NOT IN ('refunded', 'failed', 'cancelled', 'canceled')`;

  const minimalOrderWhere = `status != 'cancelled'
          AND status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')
          AND LOWER(COALESCE(TRIM(status), '')) NOT IN ('cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired')`;

  const [totalRow, newRow, repeatRow, avgRow] = await Promise.all([
    runFirst<{ total_customers: number }>(`SELECT COUNT(*) AS total_customers FROM customers${tenantWhere}`),
    runFirst<{ new_30d: number }>(
      `SELECT COUNT(*) AS new_30d FROM customers WHERE created_at >= datetime('now', '-30 days')${tenantAnd}`
    ),
    runOrderMetric<{ repeat_rate: number }>(
      `
      WITH customer_orders AS (
        SELECT TRIM(customer_phone) AS customer_phone, COUNT(*) AS cnt
        FROM orders
        WHERE ${validOrderWhere}
          AND customer_phone IS NOT NULL
          AND TRIM(COALESCE(customer_phone, '')) NOT IN ('', '0', '000000000', '0000000000', '00000000000', 'guest', 'walk-in', 'pos')${tenantAnd}
        GROUP BY TRIM(customer_phone), COALESCE(NULLIF(TRIM(tenant_id), ''), 'default')
      )
      SELECT
        CASE WHEN COUNT(*) > 0
          THEN CAST(SUM(CASE WHEN cnt > 1 THEN 1 ELSE 0 END) AS REAL) / CAST(COUNT(*) AS REAL)
          ELSE 0
        END AS repeat_rate
      FROM customer_orders
    `,
      `
      WITH customer_orders AS (
        SELECT TRIM(customer_phone) AS customer_phone, COUNT(*) AS cnt
        FROM orders
        WHERE ${noNotesOrderWhere}
          AND customer_phone IS NOT NULL
          AND TRIM(COALESCE(customer_phone, '')) NOT IN ('', '0', '000000000', '0000000000', '00000000000', 'guest', 'walk-in', 'pos')${tenantAnd}
        GROUP BY TRIM(customer_phone), COALESCE(NULLIF(TRIM(tenant_id), ''), 'default')
      )
      SELECT
        CASE WHEN COUNT(*) > 0
          THEN CAST(SUM(CASE WHEN cnt > 1 THEN 1 ELSE 0 END) AS REAL) / CAST(COUNT(*) AS REAL)
          ELSE 0
        END AS repeat_rate
      FROM customer_orders
    `,
      `
      WITH customer_orders AS (
        SELECT TRIM(customer_phone) AS customer_phone, COUNT(*) AS cnt
        FROM orders
        WHERE ${minimalOrderWhere}
          AND customer_phone IS NOT NULL
          AND TRIM(COALESCE(customer_phone, '')) NOT IN ('', '0', '000000000', '0000000000', '00000000000', 'guest', 'walk-in', 'pos')${tenantAnd}
        GROUP BY TRIM(customer_phone)${tenantId === '*' ? ", COALESCE(NULLIF(TRIM(tenant_id), ''), 'default')" : ''}
      )
      SELECT
        CASE WHEN COUNT(*) > 0
          THEN CAST(SUM(CASE WHEN cnt > 1 THEN 1 ELSE 0 END) AS REAL) / CAST(COUNT(*) AS REAL)
          ELSE 0
        END AS repeat_rate
      FROM customer_orders
    `
    ),
    runOrderMetric<{ avg_order_value: number }>(
      `SELECT AVG(total) AS avg_order_value FROM orders WHERE ${validOrderWhere}${tenantAnd}`,
      `SELECT AVG(total) AS avg_order_value FROM orders WHERE ${noNotesOrderWhere}${tenantAnd}`,
      `SELECT AVG(total) AS avg_order_value FROM orders WHERE ${minimalOrderWhere}${tenantAnd}`
    )
  ]);

  return {
    total_customers: totalRow?.total_customers ?? 0,
    new_30d: newRow?.new_30d ?? 0,
    repeat_rate: repeatRow?.repeat_rate ?? 0,
    avg_order_value: avgRow?.avg_order_value ?? 0
  };
}
