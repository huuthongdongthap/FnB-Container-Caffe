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

function getTodayVietnamDate(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
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

  let tbl: {
    id?: string | null;
    table_number?: string | number | null;
    status?: string | null;
  } | null = null;
  try {
    tbl = await db
      .prepare(
        "SELECT id, table_number, status FROM cafe_tables WHERE (id = ? OR CAST(table_number AS TEXT) = ?) AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1",
      )
      .bind(rawTableId, rawTableId, normTenant)
      .first();
  } catch {
    if (normTenant === 'default') {
      tbl = await db
        .prepare(
          'SELECT id, table_number, status FROM cafe_tables WHERE id = ? OR CAST(table_number AS TEXT) = ? LIMIT 1',
        )
        .bind(rawTableId, rawTableId)
        .first<{ id?: string | null; table_number?: string | number | null; status?: string | null }>()
        .catch(() => null);
    }
  }

  const canonicalId = typeof tbl?.id === 'string' ? tbl.id.trim() : '';
  if (!canonicalId) return false;
  if (String(tbl?.status ?? '').trim().toLowerCase() !== 'occupied') return false;

  const tableNumber =
    tbl?.table_number !== undefined && tbl?.table_number !== null && String(tbl.table_number).trim()
      ? String(tbl.table_number).trim()
      : canonicalId;

  let activeOrder: { id?: string | null } | null = null;
  try {
    activeOrder = await db
      .prepare(
        `SELECT id FROM orders
         WHERE (table_id = ? OR CAST(table_id AS TEXT) = ?)
           AND LOWER(COALESCE(status, 'pending')) NOT IN ('completed', 'cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded')
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
         LIMIT 1`,
      )
      .bind(canonicalId, tableNumber, normTenant)
      .first();
  } catch {
    if (normTenant === 'default') {
      activeOrder = await db
        .prepare(
          `SELECT id FROM orders
           WHERE (table_id = ? OR CAST(table_id AS TEXT) = ?)
             AND LOWER(COALESCE(status, 'pending')) NOT IN ('completed', 'cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded')
           LIMIT 1`,
        )
        .bind(canonicalId, tableNumber)
        .first<{ id?: string | null }>()
        .catch(() => null);
    }
  }
  if (activeOrder && typeof activeOrder.id === 'string' && activeOrder.id.trim()) return false;

  let openSession: { id?: string | null } | null = null;
  try {
    openSession = await db
      .prepare(
        `SELECT id FROM table_sessions
         WHERE (table_id = ? OR CAST(table_id AS TEXT) = ?)
           AND LOWER(COALESCE(status, 'active')) NOT IN ('closed', 'completed', 'no_show', 'abandoned', 'cancelled', 'canceled')
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
         LIMIT 1`,
      )
      .bind(canonicalId, tableNumber, normTenant)
      .first();
  } catch {
    if (normTenant === 'default') {
      openSession = await db
        .prepare(
          `SELECT id FROM table_sessions
           WHERE (table_id = ? OR CAST(table_id AS TEXT) = ?)
             AND LOWER(COALESCE(status, 'active')) NOT IN ('closed', 'completed', 'no_show', 'abandoned', 'cancelled', 'canceled')
           LIMIT 1`,
        )
        .bind(canonicalId, tableNumber)
        .first<{ id?: string | null }>()
        .catch(() => null);
    }
  }
  if (openSession && typeof openSession.id === 'string' && openSession.id.trim()) return false;

  const today = getTodayVietnamDate();
  let activeReservation: { id?: string | null } | null = null;
  try {
    activeReservation = await db
      .prepare(
        `SELECT id FROM reservations
         WHERE (table_id = ? OR CAST(table_id AS TEXT) = ?)
           AND date = ?
           AND LOWER(COALESCE(status, 'pending')) IN ('pending', 'confirmed', 'approved', 'seated')
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
         LIMIT 1`,
      )
      .bind(canonicalId, tableNumber, today, normTenant)
      .first();
  } catch {
    try {
      activeReservation = await db
        .prepare(
          `SELECT id FROM reservations
           WHERE (table_id = ? OR CAST(table_id AS TEXT) = ?)
             AND reservation_date = ?
             AND LOWER(COALESCE(status, 'pending')) IN ('pending', 'confirmed', 'approved', 'seated')
             AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
           LIMIT 1`,
        )
        .bind(canonicalId, tableNumber, today, normTenant)
        .first();
    } catch {
      if (normTenant === 'default') {
        activeReservation = await db
          .prepare(
            `SELECT id FROM reservations
             WHERE (table_id = ? OR CAST(table_id AS TEXT) = ?)
               AND date = ?
               AND LOWER(COALESCE(status, 'pending')) IN ('pending', 'confirmed', 'approved', 'seated')
             LIMIT 1`,
          )
          .bind(canonicalId, tableNumber, today)
          .first<{ id?: string | null }>()
          .catch(() =>
            db
              .prepare(
                `SELECT id FROM reservations
                 WHERE (table_id = ? OR CAST(table_id AS TEXT) = ?)
                   AND reservation_date = ?
                   AND LOWER(COALESCE(status, 'pending')) IN ('pending', 'confirmed', 'approved', 'seated')
                 LIMIT 1`,
              )
              .bind(canonicalId, tableNumber, today)
              .first<{ id?: string | null }>()
              .catch(() => null),
          );
      }
    }
  }
  if (activeReservation && typeof activeReservation.id === 'string' && activeReservation.id.trim()) {
    return false;
  }

  let released: unknown = null;
  try {
    released = await db
      .prepare(
        "UPDATE cafe_tables SET status = 'Available' WHERE id = ? AND LOWER(COALESCE(status, '')) = 'occupied' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?",
      )
      .bind(canonicalId, normTenant)
      .run();
  } catch {
    if (normTenant === 'default') {
      released = await db
        .prepare("UPDATE cafe_tables SET status = 'Available' WHERE id = ? AND LOWER(COALESCE(status, '')) = 'occupied'")
        .bind(canonicalId)
        .run()
        .catch(() => null);
    }
  }
  const changes =
    (released as { meta?: { changes?: number }; changes?: number } | null)?.meta?.changes ??
    (released as { changes?: number } | null)?.changes ??
    0;
  return Number(changes) > 0;
}
