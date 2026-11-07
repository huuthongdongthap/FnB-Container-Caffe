/**
 * Canonical Table Availability & Validation Policies
 */
import type { D1Database } from '@cloudflare/workers-types';
import type {
  CanonicalTable,
  AvailabilityQuery,
} from '../model/table-reservation-types';

const UNAVAILABLE_TABLE_STATUSES = new Set(['maintenance', 'outoforder', 'out_of_order', 'disabled']);

export function isTableUnavailableForService(status: unknown): boolean {
  if (status === undefined || status === null) return false;
  return UNAVAILABLE_TABLE_STATUSES.has(String(status).trim().toLowerCase());
}

export function matchesOperatingUnit(
  row: Record<string, unknown> | null | undefined,
  operatingUnitId?: string
): boolean {
  const normUnit = operatingUnitId ? operatingUnitId.trim() : '';
  if (!normUnit || normUnit === '*' || normUnit.toLowerCase() === 'hq') return true;
  if (!row) return false;
  const hasUnitColumn = 'operating_unit_id' in row || 'tenant_id' in row;
  if (!hasUnitColumn) return true;
  const rawUnit =
    ('operating_unit_id' in row && row.operating_unit_id !== undefined && row.operating_unit_id !== null
      ? String(row.operating_unit_id).trim()
      : '') ||
    ('tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null
      ? String(row.tenant_id).trim()
      : '');
  return (rawUnit || 'default') === normUnit;
}

export async function validateOrderTable(
  db: D1Database,
  tableIdOrInput:
    | string
    | { tableId?: string; operatingUnitId?: string; orderType?: string; partySize?: number },
  operatingUnitIdArg?: string
): Promise<{ ok: boolean; table?: CanonicalTable; error?: string }> {
  const tableId =
    typeof tableIdOrInput === 'string'
      ? tableIdOrInput
      : typeof tableIdOrInput?.tableId === 'string'
        ? tableIdOrInput.tableId
        : '';
  const operatingUnitId =
    typeof tableIdOrInput === 'object' && tableIdOrInput !== null
      ? tableIdOrInput.operatingUnitId ?? operatingUnitIdArg
      : operatingUnitIdArg;
  const partySize =
    typeof tableIdOrInput === 'object' && tableIdOrInput !== null
      ? tableIdOrInput.partySize
      : undefined;

  if (!tableId || typeof tableId !== 'string' || !tableId.trim()) {
    return { ok: false, error: 'table_id_required' };
  }
  const normalizedTableId = tableId.trim();
  const byId = await db.prepare(
    'SELECT * FROM cafe_tables WHERE id = ? LIMIT 1'
  ).bind(normalizedTableId).first<CanonicalTable>();

  if (byId && matchesOperatingUnit(byId as unknown as Record<string, unknown>, operatingUnitId)) {
    if (isTableUnavailableForService(byId.status)) {
      return { ok: false, error: 'table_unavailable' };
    }
    if (
      typeof partySize === 'number' &&
      typeof byId.capacity === 'number' &&
      byId.capacity > 0 &&
      partySize > byId.capacity
    ) {
      return { ok: false, error: 'capacity_exceeded' };
    }
    return { ok: true, table: byId };
  }

  let candidates: CanonicalTable[] = [];
  const byNumStmt = db.prepare(
    'SELECT * FROM cafe_tables WHERE table_number = ?'
  ).bind(normalizedTableId);
  if (typeof byNumStmt.all === 'function') {
    try {
      const res = await byNumStmt.all<CanonicalTable>();
      if (Array.isArray(res?.results) && res.results.length > 0) {
        candidates = res.results.filter(
          (row) =>
            !('table_number' in row) ||
            row.table_number === undefined ||
            String(row.table_number) === normalizedTableId ||
            String(row.id) === normalizedTableId
        );
      }
    } catch {
      candidates = [];
    }
  }
  if (candidates.length === 0 && typeof byNumStmt.first === 'function') {
    const single = await byNumStmt.first<CanonicalTable>().catch(() => null);
    if (single) {
      candidates = [single];
    }
  }

  const matched = candidates.find((row) =>
    matchesOperatingUnit(row as unknown as Record<string, unknown>, operatingUnitId)
  );
  if (matched) {
    if (isTableUnavailableForService(matched.status)) {
      return { ok: false, error: 'table_unavailable' };
    }
    if (
      typeof partySize === 'number' &&
      typeof matched.capacity === 'number' &&
      matched.capacity > 0 &&
      partySize > matched.capacity
    ) {
      return { ok: false, error: 'capacity_exceeded' };
    }
    return { ok: true, table: matched };
  }
  if (byId || candidates.length > 0) {
    return { ok: false, error: 'cross_operating_unit_mismatch' };
  }
  return { ok: false, error: 'table_not_found' };
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
  const { results: rawTables } = await stmt.all<CanonicalTable>();
  const tables = (rawTables || []).filter((t) =>
    matchesOperatingUnit(t as unknown as Record<string, unknown>, query.operatingUnitId)
  );

  let rsvs: Array<{ table_id: string; time: string; tenant_id?: string | null; operating_unit_id?: string | null }> = [];
  try {
    const rsvStmt = db.prepare(
      `SELECT * FROM reservations
       WHERE date = ? AND status IN ('confirmed', 'pending', 'seated')`
    ).bind(query.date);
    const res = await rsvStmt.all<{ table_id: string; time: string; tenant_id?: string | null; operating_unit_id?: string | null }>();
    rsvs = res.results || [];
  } catch {
    const rsvStmt = db.prepare(
      `SELECT *, reservation_time as time FROM reservations
       WHERE reservation_date = ? AND status IN ('confirmed', 'pending', 'seated')`
    ).bind(query.date);
    const res = await rsvStmt.all<{ table_id: string; time: string; tenant_id?: string | null; operating_unit_id?: string | null }>();
    rsvs = res.results || [];
  }

  const timeMatchedRsvs = (rsvs || [])
    .filter((r) => matchesOperatingUnit(r as unknown as Record<string, unknown>, query.operatingUnitId))
    .filter((r) => !query.time || r.time === query.time);

  const mapped = (tables || []).map((t) => {
    const isPhysicalAvailable = String(t.status).toLowerCase() === 'available';
    const tableUnit =
      (t.operating_unit_id && String(t.operating_unit_id).trim()) ||
      (t.tenant_id && String(t.tenant_id).trim()) ||
      (query.operatingUnitId &&
      query.operatingUnitId.trim() !== '*' &&
      query.operatingUnitId.trim().toLowerCase() !== 'hq'
        ? query.operatingUnitId.trim()
        : '');
    const isReservedForTable = timeMatchedRsvs.some((r) => {
      if (r.table_id !== t.id && r.table_id !== String(t.table_number)) {
        return false;
      }
      return tableUnit
        ? matchesOperatingUnit(r as unknown as Record<string, unknown>, tableUnit)
        : true;
    });
    return {
      ...t,
      available: isPhysicalAvailable && !isReservedForTable,
    };
  });

  return { ok: true, tables: mapped };
}
