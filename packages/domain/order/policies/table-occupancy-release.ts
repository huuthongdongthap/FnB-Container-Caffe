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
    const release = (reservationDate: string, reservationTime: string | null, clearCurrentSessionId = true) => {
      const timeGuard = reservationTime
        ? `AND (
                   ${reservationTime} IS NULL OR TRIM(${reservationTime}) = ''
                   OR (
                     (CAST(substr(TRIM(${reservationTime}), 1, instr(TRIM(${reservationTime}), ':') - 1) AS INTEGER) * 60 + CAST(substr(TRIM(${reservationTime}), instr(TRIM(${reservationTime}), ':') + 1, 2) AS INTEGER))
                     - (CAST(strftime('%H', 'now', '+7 hours') AS INTEGER) * 60 + CAST(strftime('%M', 'now', '+7 hours') AS INTEGER))
                   ) BETWEEN -30 AND 60
                 )`
        : '';
      const sessionReset = clearCurrentSessionId ? ', current_session_id = NULL' : '';
      return db.prepare(
        `UPDATE cafe_tables SET status = 'Available'${sessionReset}
       WHERE id = ? AND LOWER(TRIM(COALESCE(status, ''))) IN ('occupied', 'overdue')
         AND ${sameTenant('cafe_tables')}
         AND NOT EXISTS (
           SELECT 1 FROM orders o WHERE ${sameTable} AND ${sameTenant('o')}
             AND LOWER(COALESCE(o.status, 'pending')) NOT IN ('completed', 'cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded')
         )
         AND NOT EXISTS (
           SELECT 1 FROM table_sessions s WHERE ${sameTable} AND ${sameTenant('s')}
             AND LOWER(COALESCE(s.status, 'active')) NOT IN ('closed', 'completed', 'paid', 'no_show', 'abandoned', 'cancelled', 'canceled')
         )
         AND NOT EXISTS (
           SELECT 1 FROM reservations r WHERE ${sameTable} AND ${sameTenant('r')}
             AND LOWER(COALESCE(r.status, 'pending')) NOT IN ('cancelled', 'canceled', 'rejected', 'completed', 'no_show')
             AND (
               LOWER(COALESCE(r.status, '')) = 'seated'
               OR (
                 ${reservationDate} = DATE('now', '+7 hours')
                 ${timeGuard}
               )
             )
         )`,
      ).bind(table.id, normTenant, normTenant, normTenant, normTenant).run();
    };

    let dateExpr = "COALESCE(NULLIF(TRIM(r.date), ''), r.reservation_date)";
    let timeExpr: string | null = "COALESCE(NULLIF(TRIM(r.time), ''), r.reservation_time)";
    let clearCurrentSessionId = true;
    let result: unknown;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        result = await release(dateExpr, timeExpr, clearCurrentSessionId);
        break;
      } catch (error) {
        // Some schemas expose only one of the date/time columns (or omit time/current_session_id). Never remove guards.
        const message = String(error);
        if (/no such column:\s*(?:cafe_tables\.)?current_session_id\b/i.test(message) && clearCurrentSessionId) {
          clearCurrentSessionId = false;
        } else if (/no such column:\s*r\.reservation_date\b/i.test(message) && dateExpr.includes('r.reservation_date')) {
          dateExpr = 'r.date';
        } else if (/no such column:\s*r\.date\b/i.test(message) && dateExpr.includes('r.date')) {
          dateExpr = 'r.reservation_date';
        } else if (/no such column:\s*r\.reservation_time\b/i.test(message) && timeExpr?.includes('r.reservation_time')) {
          timeExpr = timeExpr.includes('r.time') ? 'r.time' : null;
        } else if (/no such column:\s*r\.time\b/i.test(message) && timeExpr?.includes('r.time')) {
          timeExpr = timeExpr.includes('r.reservation_time') ? 'r.reservation_time' : null;
        } else {
          throw error;
        }
      }
    }
    const write = result as { meta?: { changes?: number }; changes?: number } | null;
    return (write?.meta?.changes ?? write?.changes ?? 0) > 0;
  } catch {
    // Without a complete tenant-scoped eligibility check the table must stay occupied.
    return false;
  }
}
