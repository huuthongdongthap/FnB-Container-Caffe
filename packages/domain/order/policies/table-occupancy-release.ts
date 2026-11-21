/**
 * Table Occupancy Release Policy
 * Releases a dine-in table from 'Occupied' back to 'Available' once its last active order finishes
 * (cancelled or completed), provided no open table session or active same-day reservation holds it.
 */

export interface TableOccupancyDb {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      first<T = unknown>(): Promise<T | null>;
      run(): Promise<unknown>;
    };
  };
}

export async function releaseTableIfNoActiveOrders(
  db: TableOccupancyDb | null | undefined,
  tableId: string | null | undefined,
  tenantId?: string | null,
): Promise<boolean> {
  if (!db || typeof db.prepare !== 'function') return false;
  const rawTableId = typeof tableId === 'string' ? tableId.trim() : tableId != null ? String(tableId).trim() : '';
  if (!rawTableId) return false;

  const rawTenant = typeof tenantId === 'string' ? tenantId.trim() : '';
  const normTenant =
    rawTenant && rawTenant !== '*' && rawTenant.toLowerCase() !== 'hq' ? rawTenant : 'default';

  // Resolve just the table identity here. Eligibility must be evaluated in the write,
  // since a new order, session, or reservation can appear after this lookup.
  try {
    const table = await db.prepare(
      `SELECT id FROM cafe_tables
       WHERE (id = ? OR CAST(table_number AS TEXT) = ?)
         AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
       ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END, id LIMIT 1`,
    ).bind(rawTableId, rawTableId, normTenant, rawTableId).first<{ id: string }>();
    if (!table?.id) return false;

    const sameTable = `(table_id = cafe_tables.id OR CAST(table_id AS TEXT) = TRIM(CAST(cafe_tables.table_number AS TEXT)))`;
    const sameTenant = (alias: string) => `COALESCE(NULLIF(TRIM(${alias}.tenant_id), ''), 'default') = ?`;
    const release = (reservationDate: string) => db.prepare(
      `UPDATE cafe_tables SET status = 'Available'
       WHERE id = ? AND LOWER(TRIM(COALESCE(status, ''))) = 'occupied'
         AND ${sameTenant('cafe_tables')}
         AND NOT EXISTS (
           SELECT 1 FROM orders o WHERE ${sameTable} AND ${sameTenant('o')}
             AND LOWER(COALESCE(o.status, 'pending')) NOT IN ('completed', 'cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded')
         )
         AND NOT EXISTS (
           SELECT 1 FROM table_sessions s WHERE ${sameTable} AND ${sameTenant('s')}
             AND LOWER(COALESCE(s.status, 'active')) NOT IN ('closed', 'completed', 'no_show', 'abandoned', 'cancelled', 'canceled')
         )
         AND NOT EXISTS (
           SELECT 1 FROM reservations r WHERE ${sameTable} AND ${sameTenant('r')}
             AND ${reservationDate} = DATE('now', '+7 hours')
             AND LOWER(COALESCE(r.status, 'pending')) IN ('pending', 'confirmed', 'approved', 'seated')
         )`,
    ).bind(table.id, normTenant, normTenant, normTenant, normTenant).run();

    let result: unknown;
    try {
      result = await release("COALESCE(NULLIF(TRIM(r.date), ''), r.reservation_date)");
    } catch (error) {
      // Some schemas expose only one of the two date columns. Never remove guards.
      const message = String(error);
      if (/no such column:\s*r\.reservation_date\b/i.test(message)) result = await release('r.date');
      else if (/no such column:\s*r\.date\b/i.test(message)) result = await release('r.reservation_date');
      else throw error;
    }
    const write = result as { meta?: { changes?: number }; changes?: number } | null;
    return (write?.meta?.changes ?? write?.changes ?? 0) > 0;
  } catch {
    // Without a complete tenant-scoped eligibility check the table must stay occupied.
    return false;
  }
}
