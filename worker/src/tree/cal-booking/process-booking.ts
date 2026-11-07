import type { D1Database } from '@cloudflare/workers-types';
import { matchesTenantRow } from '../../middleware/tenant';
import { parseBookingTime } from './time-parser';

interface CafeTableRow {
  id: string;
  capacity?: number;
  seats?: number;
  zone: string;
  status: string;
  tenant_id?: string | null;
}

interface CalBookingPayload {
  uid: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  attendees?: Array<{ name: string; email: string; timeZone?: string; phone?: string }>;
  organizer?: { name: string; email: string };
  metadata?: Record<string, unknown>;
}

/**
 * Create a cafe reservation from a Cal.com booking payload.
 * Finds an available table matching guest count and zone preference.
 * Returns { reservation, table_id } on success, or throws on failure.
 */
export async function createReservationFromBooking(
  db: D1Database,
  payload: CalBookingPayload,
  tenantOverride?: string
): Promise<{ table_id: string; guest_count: number; zone: string; status: string } | { error: string }> {
  const metadata = payload.metadata || {};
  const rawMetaTenant = typeof metadata.tenant_id === 'string' ? metadata.tenant_id.trim() : '';
  const safeMetaTenant = rawMetaTenant && rawMetaTenant !== '*' ? rawMetaTenant : '';
  const safeOverride = tenantOverride && tenantOverride.trim() && tenantOverride.trim() !== '*'
    ? tenantOverride.trim()
    : '';
  const effectiveTenant = safeOverride || safeMetaTenant || 'default';

  // Check for duplicate within the same tenant
  let existingRows: Array<{ id: string; tenant_id?: string | null }> = [];
  try {
    const res = await db.prepare(
      'SELECT id, tenant_id FROM reservations WHERE cal_booking_uid = ?'
    ).bind(payload.uid).all<{ id: string; tenant_id?: string | null }>();
    existingRows = res.results || [];
  } catch {
    const single = await db.prepare(
      'SELECT id FROM reservations WHERE cal_booking_uid = ?'
    ).bind(payload.uid).first<{ id: string }>();
    if (single) existingRows = [single];
  }

  const existing = existingRows.find((r) =>
    matchesTenantRow(r as unknown as Record<string, unknown>, effectiveTenant)
  );
  if (existing) {
    return { table_id: '', guest_count: 0, zone: '', status: 'idempotent' };
  }
  if (existingRows.length > 0) {
    return { error: 'Booking UID already belongs to another store' };
  }

  const attendeeCount = payload.attendees?.length || 1;
  const guestCount = Math.max(1, Math.floor(Number(metadata.guest_count) || attendeeCount || 1));
  const zone = (metadata.zone as string) || null;
  const { date, time } = parseBookingTime(payload.startTime || '');

  const filterUnbookedTables = async (candidates: CafeTableRow[]): Promise<CafeTableRow[]> => {
    const unbooked: CafeTableRow[] = [];
    for (const candidate of candidates) {
      let hasConflict = false;
      try {
        let conflictRow: { id: string; status?: string; tenant_id?: string | null } | null = null;
        try {
          conflictRow = await db
            .prepare(
              "SELECT id, status, tenant_id FROM reservations WHERE table_id = ? AND date = ? AND time = ? AND status = 'confirmed' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            )
            .bind(candidate.id, date, time, effectiveTenant)
            .first<{ id: string; status?: string; tenant_id?: string | null }>();
          if (
            conflictRow &&
            !matchesTenantRow(conflictRow as unknown as Record<string, unknown>, effectiveTenant)
          ) {
            const allRes = await db
              .prepare(
                "SELECT id, status, tenant_id FROM reservations WHERE table_id = ? AND date = ? AND time = ? AND status = 'confirmed'"
              )
              .bind(candidate.id, date, time)
              .all<{ id: string; status?: string; tenant_id?: string | null }>()
              .catch(() => ({ results: [] as Array<{ id: string; status?: string; tenant_id?: string | null }> }));
            conflictRow =
              (allRes.results || []).find((row) =>
                matchesTenantRow(row as unknown as Record<string, unknown>, effectiveTenant)
              ) ?? null;
          }
        } catch {
          try {
            conflictRow = await db
              .prepare(
                "SELECT id, status, tenant_id FROM reservations WHERE table_id = ? AND date = ? AND time = ? AND status = 'confirmed'"
              )
              .bind(candidate.id, date, time)
              .first<{ id: string; status?: string; tenant_id?: string | null }>();
          } catch {
            conflictRow = await db
              .prepare(
                "SELECT id, status FROM reservations WHERE table_id = ? AND date = ? AND time = ? AND status = 'confirmed'"
              )
              .bind(candidate.id, date, time)
              .first<{ id: string; status?: string }>();
          }
        }
        if (
          conflictRow &&
          (!('status' in conflictRow) || String(conflictRow.status).toLowerCase() === 'confirmed') &&
          matchesTenantRow(conflictRow as unknown as Record<string, unknown>, effectiveTenant)
        ) {
          hasConflict = true;
        }
      } catch {
        hasConflict = false;
      }
      if (!hasConflict) {
        unbooked.push(candidate);
      }
    }
    return unbooked;
  };

  const fetchCandidateTables = async (): Promise<CafeTableRow[]> => {
    let rawTables: unknown[] = [];
    try {
      const { results } = await db.prepare(
        "SELECT * FROM cafe_tables WHERE COALESCE(capacity, seats, 2) >= ? AND LOWER(status) = 'available' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
      ).bind(guestCount, effectiveTenant).all();
      rawTables = results || [];
    } catch {
      const { results } = await db.prepare(
        "SELECT * FROM cafe_tables WHERE COALESCE(capacity, seats, 2) >= ? AND LOWER(status) = 'available'"
      ).bind(guestCount).all();
      rawTables = results || [];
    }
    return (rawTables as CafeTableRow[]).filter((t) =>
      matchesTenantRow(t as unknown as Record<string, unknown>, effectiveTenant)
    );
  };

  // Find available tables
  let table: CafeTableRow | null = null;
  if (zone) {
    const tenantFiltered = await fetchCandidateTables();
    const available = await filterUnbookedTables(tenantFiltered);
    table = available.find((t: CafeTableRow) => (t.zone || '').toLowerCase() === zone.toLowerCase()) || available.sort((a: CafeTableRow, b: CafeTableRow) => (a.capacity ?? a.seats ?? 2) - (b.capacity ?? b.seats ?? 2))[0] || null;
  } else {
    const tenantFiltered = await fetchCandidateTables();
    const available = await filterUnbookedTables(tenantFiltered);
    available.sort((a: CafeTableRow, b: CafeTableRow) => (a.capacity ?? a.seats ?? 2) - (b.capacity ?? b.seats ?? 2));
    table = available[0] || null;
  }

  if (!table) {
    return { error: 'No tables available' };
  }

  // Create reservation
  const attendee = (payload.attendees?.[0] || { name: '', email: '', phone: '' }) as Record<string, string>;

  const reservationId = `rsv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const tenantToStamp = !effectiveTenant || effectiveTenant === '*' ? 'default' : effectiveTenant;
  try {
    await db.prepare(
      `INSERT INTO reservations (id, table_id, customer_name, customer_phone, guest_count, date, time, zone, notes, cal_booking_uid, customer_email, reservation_time, special_requests, status, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?)`
    ).bind(
      reservationId, table.id, attendee.name || '', attendee.phone || '', guestCount,
      date, time, table.zone || '', JSON.stringify(metadata), payload.uid,
      attendee.email || null, payload.startTime || `${date}T${time}`, JSON.stringify(metadata),
      tenantToStamp
    ).run();
  } catch {
    await db.prepare(
      `INSERT INTO reservations (id, table_id, customer_name, customer_phone, guest_count, date, time, zone, notes, cal_booking_uid, customer_email, reservation_time, special_requests, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`
    ).bind(
      reservationId, table.id, attendee.name || '', attendee.phone || '', guestCount,
      date, time, table.zone || '', JSON.stringify(metadata), payload.uid,
      attendee.email || null, payload.startTime || `${date}T${time}`, JSON.stringify(metadata)
    ).run();
  }

  return {
    table_id: table.id,
    guest_count: guestCount,
    zone: table.zone,
    status: 'confirmed'
  };
}
