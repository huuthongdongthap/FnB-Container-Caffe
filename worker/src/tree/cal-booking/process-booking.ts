import type { D1Database } from '@cloudflare/workers-types';
import { parseBookingTime } from './time-parser';

interface CafeTableRow {
  id: string;
  capacity: number;
  zone: string;
  status: string;
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
  payload: CalBookingPayload
): Promise<{ table_id: string; guest_count: number; zone: string; status: string } | { error: string }> {
  // Check for duplicate
  const existing = await db.prepare(
    'SELECT id FROM reservations WHERE cal_booking_uid = ?'
  ).bind(payload.uid).first();

  if (existing) {
    return { table_id: '', guest_count: 0, zone: '', status: 'idempotent' };
  }

  const metadata = payload.metadata || {};
  const attendeeCount = payload.attendees?.length || 1;
  const guestCount = (metadata.guest_count as number) || attendeeCount;
  const zone = (metadata.zone as string) || null;

  // Find available tables
  let table: CafeTableRow | null = null;
  if (zone) {
    const { results: zoneResults } = await db.prepare(
      "SELECT * FROM cafe_tables WHERE capacity >= ? AND status = 'Available'"
    ).bind(guestCount).all();
    const available = (zoneResults || []) as unknown as CafeTableRow[];
    table = available.find((t: CafeTableRow) => t.zone === zone) || available.sort((a: CafeTableRow, b: CafeTableRow) => a.capacity - b.capacity)[0] || null;
  } else {
    const { results: anyResults } = await db.prepare(
      "SELECT * FROM cafe_tables WHERE capacity >= ? AND status = 'Available'"
    ).bind(guestCount).all();
    const available = (anyResults || []) as unknown as CafeTableRow[];
    available.sort((a: CafeTableRow, b: CafeTableRow) => a.capacity - b.capacity);
    table = available[0] || null;
  }

  if (!table) {
    return { error: 'No tables available' };
  }

  // Create reservation
  const attendee = (payload.attendees?.[0] || { name: '', email: '', phone: '' }) as Record<string, string>;
  const { date, time } = parseBookingTime(payload.startTime || '');

  const reservationId = 'rsv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  await db.prepare(
    `INSERT INTO reservations (id, table_id, customer_name, customer_phone, guest_count, date, time, zone, notes, cal_booking_uid, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`
  ).bind(
    reservationId, table.id, attendee.name || '', attendee.phone || '', guestCount,
    date, time, table.zone || '', '', payload.uid
  ).run();

  return {
    table_id: table.id,
    guest_count: guestCount,
    zone: table.zone,
    status: 'confirmed',
  };
}
