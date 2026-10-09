/**
 * Canonical Table Availability & Validation Policies
 */
import type { D1Database } from '@cloudflare/workers-types';
import type {
  CanonicalTable,
  AvailabilityQuery,
} from '../model/table-reservation-types';

export async function validateOrderTable(
  db: D1Database,
  tableId: string
): Promise<{ ok: boolean; table?: CanonicalTable; error?: string }> {
  if (!tableId || typeof tableId !== 'string') {
    return { ok: false, error: 'table_id_required' };
  }
  let table = await db.prepare(
    'SELECT * FROM cafe_tables WHERE id = ? LIMIT 1'
  ).bind(tableId).first<CanonicalTable>();

  if (!table) {
    table = await db.prepare(
      'SELECT * FROM cafe_tables WHERE table_number = ? LIMIT 1'
    ).bind(tableId).first<CanonicalTable>();
  }

  if (!table) {
    return { ok: false, error: 'table_not_found' };
  }
  return { ok: true, table };
}

export async function checkTableAvailability(
  db: D1Database,
  query: AvailabilityQuery
): Promise<{ ok: boolean; tables: (CanonicalTable & { available: boolean })[] }> {
  let sql = 'SELECT * FROM cafe_tables WHERE 1=1';
  const params: unknown[] = [];
  if (query.zone) {
    sql += ' AND zone = ?';
    params.push(query.zone);
  }
  if (query.guestCount) {
    sql += ' AND capacity >= ?';
    params.push(query.guestCount);
  }
  sql += ' ORDER BY zone ASC, table_number ASC';

  const stmt = params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);
  const { results: tables } = await stmt.all<CanonicalTable>();

  const rsvStmt = db.prepare(
    `SELECT table_id, time FROM reservations
     WHERE date = ? AND status IN ('confirmed', 'pending', 'seated')`
  ).bind(query.date);
  const { results: rsvs } = await rsvStmt.all<{ table_id: string; time: string }>();

  const reservedMap = new Set(
    (rsvs || [])
      .filter((r) => !query.time || r.time === query.time)
      .map((r) => r.table_id)
  );

  const mapped = (tables || []).map((t) => {
    const isPhysicalAvailable = t.status === 'Available';
    const isNotReserved = !reservedMap.has(t.id) && !reservedMap.has(String(t.table_number));
    return {
      ...t,
      available: isPhysicalAvailable && isNotReserved,
    };
  });

  return { ok: true, tables: mapped };
}
