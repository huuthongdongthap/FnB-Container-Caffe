export interface BroadcastCustomer {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
}

/**
 * Build SQL query for each predefined segment.
 */
export function segmentSQL(segment: string): { sql: string; params?: string[] } {
  switch (segment) {
  case 'all':
    return { sql: 'SELECT id, name, phone, email FROM customers' };
  case 'loyalty_bronze':
    return { sql: 'SELECT id, name, phone, email FROM customers WHERE tier = \'bronze\'' };
  case 'loyalty_silver':
    return { sql: 'SELECT id, name, phone, email FROM customers WHERE tier = \'silver\'' };
  case 'loyalty_gold':
    return { sql: 'SELECT id, name, phone, email FROM customers WHERE tier = \'gold\'' };
  case 'loyalty_platinum':
    return { sql: 'SELECT id, name, phone, email FROM customers WHERE tier = \'platinum\'' };
  case 'active_30d':
    return {
      sql: `SELECT DISTINCT c.id, c.name, c.phone, c.email
              FROM customers c
              INNER JOIN orders o ON o.customer_phone = c.phone
              WHERE o.created_at >= datetime('now', '-30 days')`
    };
  case 'inactive_90d':
    return {
      sql: `SELECT id, name, phone, email FROM customers
              WHERE phone NOT IN (
                SELECT DISTINCT customer_phone FROM orders
                WHERE created_at >= datetime('now', '-90 days')
              ) AND phone IS NOT NULL`
    };
  case 'birthday_this_month': {
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    return {
      sql: 'SELECT id, name, phone, email FROM customers WHERE birthday IS NOT NULL AND substr(birthday, 6, 2) = ?',
      params: [month]
    };
  }
  default:
    return { sql: 'SELECT id, name, phone, email FROM customers' };
  }
}
