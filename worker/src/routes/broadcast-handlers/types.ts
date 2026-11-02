export interface BroadcastCustomer {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  tenant_id?: string | null;
}

/**
 * Build SQL query for each predefined segment.
 */
export function segmentSQL(segment: string, tenantId?: string): { sql: string; params?: string[] } {
  const scopedTenant = tenantId && tenantId !== '*' ? tenantId : undefined;
  switch (segment) {
  case 'all':
    return { sql: 'SELECT id, name, phone, email FROM customers' };
  case 'loyalty_bronze':
    return { sql: "SELECT id, name, phone, email FROM customers WHERE (loyalty_tier = 'bronze' OR LOWER(loyalty_tier) = 'bronze')" };
  case 'loyalty_silver':
    return { sql: "SELECT id, name, phone, email FROM customers WHERE (loyalty_tier = 'silver' OR LOWER(loyalty_tier) = 'silver')" };
  case 'loyalty_gold':
    return { sql: "SELECT id, name, phone, email FROM customers WHERE (loyalty_tier = 'gold' OR LOWER(loyalty_tier) = 'gold')" };
  case 'loyalty_platinum':
    return { sql: "SELECT id, name, phone, email FROM customers WHERE (loyalty_tier = 'platinum' OR LOWER(loyalty_tier) = 'platinum')" };
  case 'active_30d':
    if (scopedTenant) {
      return {
        sql: `SELECT DISTINCT c.id, c.name, c.phone, c.email
              FROM customers c
              INNER JOIN orders o ON o.customer_phone = c.phone
                AND COALESCE(NULLIF(o.tenant_id, ''), 'default') = COALESCE(NULLIF(c.tenant_id, ''), 'default')
              WHERE o.created_at >= datetime('now', '-30 days')`
      };
    }
    return {
      sql: `SELECT DISTINCT c.id, c.name, c.phone, c.email
              FROM customers c
              INNER JOIN orders o ON o.customer_phone = c.phone
              WHERE o.created_at >= datetime('now', '-30 days')`
    };
  case 'inactive_90d':
    if (scopedTenant) {
      return {
        sql: `SELECT id, name, phone, email FROM customers
              WHERE phone NOT IN (
                SELECT DISTINCT customer_phone FROM orders
                WHERE customer_phone IS NOT NULL
                  AND created_at >= datetime('now', '-90 days')
                  AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?
              ) AND phone IS NOT NULL`,
        params: [scopedTenant]
      };
    }
    return {
      sql: `SELECT id, name, phone, email FROM customers
              WHERE phone NOT IN (
                SELECT DISTINCT customer_phone FROM orders
                WHERE customer_phone IS NOT NULL
                  AND created_at >= datetime('now', '-90 days')
              ) AND phone IS NOT NULL`
    };
  case 'birthday_this_month': {
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    return {
      sql: 'SELECT id, name, phone, email FROM customers WHERE date_of_birth IS NOT NULL AND substr(date_of_birth, 6, 2) = ?',
      params: [month]
    };
  }
  default:
    return { sql: 'SELECT id, name, phone, email FROM customers' };
  }
}
