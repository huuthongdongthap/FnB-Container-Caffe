/**
 * Canonical Table & Reservation Lifecycle Policy
 * Flow: TABLE → RESERVATION → SEATING → ORDER → CHECKOUT → TABLE RELEASE
 * Invariants: Server-authoritative table state; overlap prevention; order-table integrity;
 * idempotent seating/release; boundary isolation.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type {
  CanonicalTable,
  CanonicalReservation,
  CreateReservationPolicyInput,
  SeatTableInput,
  ReleaseTableInput,
  ReservationLifecycleStatus,
} from '../model/table-reservation-types';
import { validateOrderTable } from './table-availability-policy';

export async function createCanonicalReservation(
  db: D1Database,
  input: CreateReservationPolicyInput
): Promise<{ ok: boolean; reservation?: CanonicalReservation; error?: string }> {
  const tableCheck = await validateOrderTable(db, input.tableId);
  if (!tableCheck.ok || !tableCheck.table) {
    return { ok: false, error: 'table_not_found' };
  }
  const table = tableCheck.table;

  if (input.zone && table.zone && input.zone !== table.zone) {
    return { ok: false, error: 'cross_operating_unit_mismatch' };
  }

  const existingRsv = await db.prepare(
    `SELECT id FROM reservations
     WHERE (table_id = ? OR table_id = ?)
       AND date = ? AND time = ?
       AND status IN ('confirmed', 'pending', 'seated')
     LIMIT 1`
  ).bind(table.id, String(table.table_number), input.date, input.time).first<{ id: string }>();

  if (existingRsv) {
    return { ok: false, error: 'overlapping_reservation' };
  }

  const now = new Date().toISOString();
  const rsvId = `rsv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const reservation: CanonicalReservation = {
    id: rsvId,
    table_id: table.id,
    customer_name: input.customerName,
    customer_phone: input.customerPhone,
    guest_count: input.guestCount || 2,
    date: input.date,
    time: input.time,
    zone: table.zone || input.zone || 'Indoor',
    status: 'confirmed',
    notes: input.notes || null,
    created_at: now,
    updated_at: now,
  };

  await db.prepare(
    `INSERT INTO reservations (
      id, table_id, customer_name, customer_phone, guest_count,
      date, time, zone, status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    reservation.id, reservation.table_id, reservation.customer_name,
    reservation.customer_phone, reservation.guest_count, reservation.date,
    reservation.time, reservation.zone, reservation.status, reservation.notes,
    now, now
  ).run();

  return { ok: true, reservation };
}

export async function updateReservationStatus(
  db: D1Database,
  reservationId: string,
  targetStatus: ReservationLifecycleStatus,
  notes?: string
): Promise<{ ok: boolean; reservation?: CanonicalReservation; error?: string }> {
  const rsv = await db.prepare(
    'SELECT * FROM reservations WHERE id = ?'
  ).bind(reservationId).first<CanonicalReservation>();

  if (!rsv) return { ok: false, error: 'reservation_not_found' };

  const now = new Date().toISOString();
  await db.prepare(
    `UPDATE reservations
     SET status = ?, notes = COALESCE(?, notes), updated_at = ?
     WHERE id = ?`
  ).bind(targetStatus, notes || null, now, reservationId).run();

  if (targetStatus === 'cancelled') {
    await db.prepare(
      "UPDATE cafe_tables SET status = 'Available', updated_at = ? WHERE id = ? AND status = 'Reserved'"
    ).bind(now, rsv.table_id).run();
  }

  return { ok: true, reservation: { ...rsv, status: targetStatus, updated_at: now } };
}

export async function seatTable(
  db: D1Database,
  input: SeatTableInput
): Promise<{ ok: boolean; table?: CanonicalTable; reservation?: CanonicalReservation; error?: string }> {
  const tableCheck = await validateOrderTable(db, input.tableId);
  if (!tableCheck.ok || !tableCheck.table) {
    return { ok: false, error: 'table_not_found' };
  }
  const table = tableCheck.table;
  const now = new Date().toISOString();

  let rsv: CanonicalReservation | undefined;
  if (input.reservationId) {
    const foundRsv = await db.prepare(
      'SELECT * FROM reservations WHERE id = ?'
    ).bind(input.reservationId).first<CanonicalReservation>();

    if (!foundRsv) {
      return { ok: false, error: 'reservation_not_found' };
    }
    if (foundRsv.table_id !== table.id && foundRsv.table_id !== String(table.table_number)) {
      return { ok: false, error: 'table_reservation_mismatch' };
    }
    rsv = foundRsv;
    await db.prepare(
      "UPDATE reservations SET status = 'seated', updated_at = ? WHERE id = ?"
    ).bind(now, input.reservationId).run();
  }

  await db.prepare(
    "UPDATE cafe_tables SET status = 'Occupied', updated_at = ? WHERE id = ?"
  ).bind(now, table.id).run();

  return {
    ok: true,
    table: { ...table, status: 'Occupied', updated_at: now },
    reservation: rsv ? { ...rsv, status: 'seated', updated_at: now } : undefined,
  };
}

export async function releaseTable(
  db: D1Database,
  input: ReleaseTableInput
): Promise<{ ok: boolean; table?: CanonicalTable; alreadyReleased?: boolean; error?: string }> {
  const tableCheck = await validateOrderTable(db, input.tableId);
  if (!tableCheck.ok || !tableCheck.table) {
    return { ok: false, error: 'table_not_found' };
  }
  const table = tableCheck.table;
  const now = new Date().toISOString();

  if (table.status === 'Available') {
    return { ok: true, table, alreadyReleased: true };
  }

  await db.prepare(
    "UPDATE cafe_tables SET status = 'Available', updated_at = ? WHERE id = ?"
  ).bind(now, table.id).run();

  await db.prepare(
    "UPDATE reservations SET status = 'completed', updated_at = ? WHERE table_id = ? AND status = 'seated'"
  ).bind(now, table.id).run();

  return { ok: true, table: { ...table, status: 'Available', updated_at: now } };
}
