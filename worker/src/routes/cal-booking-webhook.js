/**
 * Cal.com Booking Webhook Receiver
 *
 * Receives Cal.com webhook events (booking.created, booking.cancelled)
 * and syncs to local D1 reservations table.
 *
 * POST /api/webhooks/cal-booking
 * Header: x-cal-webhook-secret
 */

import { createLogger } from '../utils/logger.js';

const log = createLogger({ route: 'cal-booking-webhook' });

/**
 * @param {Request} request
 * @param {Object} env — CF Worker env (AURA_DB, CAL_WEBHOOK_SECRET, AUTH_KV)
 * @returns {Response}
 */
export async function handleCalBookingWebhook(request, env) {
  // ═══════════════════════════════════════════════════════════════════
  // 1. Validate webhook secret
  // ═══════════════════════════════════════════════════════════════════
  const secret = request.headers.get('x-cal-webhook-secret');
  if (!secret || secret !== env.CAL_WEBHOOK_SECRET) {
    log.warn('cal_webhook_unauthorized', { hasSecret: !!secret });
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 2. Parse payload
  // ═══════════════════════════════════════════════════════════════════
  let body;
  try {
    body = await request.json();
  } catch {
    return json(400, { success: false, error: 'Invalid JSON body' });
  }

  const { triggerEvent, payload } = body;
  if (!triggerEvent || !payload) {
    return json(400, { success: false, error: 'Missing triggerEvent or payload' });
  }

  const db = env.AURA_DB;

  // ═══════════════════════════════════════════════════════════════════
  // 3. Route by event type
  // ═══════════════════════════════════════════════════════════════════
  try {
    switch (triggerEvent) {
    case 'BOOKING_CREATED':
      return await handleBookingCreated(db, payload);
    case 'BOOKING_CANCELLED':
      return await handleBookingCancelled(db, payload);
    case 'BOOKING_RESCHEDULED':
      return await handleBookingRescheduled(db, payload);
    default:
      // No-op for other events (MEETING_ENDED, etc.)
      return json(200, { success: true, skipped: true, event: triggerEvent });
    }
  } catch (err) {
    log.error('cal_webhook_error', { event: triggerEvent, error: err.message });
    return json(500, { success: false, error: 'Internal server error' });
  }
}

// ═══════════════════════════════════════════════════════════════════
// BOOKING_CREATED
// ═══════════════════════════════════════════════════════════════════

async function handleBookingCreated(db, payload) {
  const { uid, startTime, attendees = [], metadata = {} } = payload;

  if (!uid || !startTime) {
    return json(400, { success: false, error: 'Missing uid or startTime' });
  }

  // ── Idempotency check ──
  const existing = await db.prepare(
    'SELECT id FROM reservations WHERE cal_booking_uid = ? LIMIT 1'
  ).bind(uid).first();

  if (existing) {
    log.info('cal_webhook_duplicate', { uid });
    return json(200, { success: true, idempotent: true, reservation: existing });
  }

  // ── Extract booking details ──
  const primaryAttendee = attendees[0] || {};
  const customerName = primaryAttendee.name || metadata.name || 'Khách đặt bàn';
  const customerPhone = primaryAttendee.phone || metadata.phone || '';
  // Validate guest count: clamp 1–20, fallback to attendees.length or 2
  const guestCount = (() => {
    const raw = Number(metadata.guest_count);
    if (Number.isFinite(raw) && raw >= 1 && raw <= 20) { return raw; }
    return (attendees && attendees.length) || 2;
  })();
  const zonePreference = (typeof metadata.zone === 'string' && metadata.zone.trim()) || null;

  // Extract date + time directly from ISO string (avoids CF Worker UTC timezone issues)
  const date = startTime.slice(0, 10); // "2026-07-01"
  const time = startTime.slice(11, 16); // "18:00"

  // ── Find available table ──
  const tables = await db.prepare(
    'SELECT * FROM cafe_tables WHERE capacity >= ? AND status = ? ORDER BY zone ASC, capacity ASC'
  ).bind(guestCount, 'Available').all();

  const availableTables = tables.results || [];

  if (availableTables.length === 0) {
    return json(409, { success: false, error: 'Không còn bàn trống phù hợp' });
  }

  // Prefer zone match if specified
  let assignedTable;
  if (zonePreference) {
    assignedTable = availableTables.find(t => t.zone === zonePreference);
  }

  // Fallback: first available table
  if (!assignedTable) {
    assignedTable = availableTables[0];
  }

  // ── Conflict check: ensure table not already booked for this date+time ──
  const conflict = await db.prepare(
    'SELECT id FROM reservations WHERE table_id = ? AND date = ? AND time = ? AND status = ?'
  ).bind(assignedTable.id, date, time, 'confirmed').first();

  if (conflict) {
    // Try next available table
    const nextTable = availableTables.find(t => t.id !== assignedTable.id);
    if (!nextTable) {
      return json(409, { success: false, error: 'Bàn đã được đặt cho khung giờ này' });
    }
    assignedTable = nextTable;
  }

  // ── Insert reservation ──
  const reservationId = `rsv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const notes = metadata.notes ? String(metadata.notes).slice(0, 500) : '';

  await db.prepare(
    'INSERT INTO reservations (id, table_id, customer_name, customer_phone, guest_count, date, time, zone, notes, cal_booking_uid, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, \'confirmed\', ?, ?)'
  ).bind(
    reservationId, assignedTable.id, customerName, customerPhone,
    guestCount, date, time, assignedTable.zone, notes, uid, now, now
  ).run();

  // ── Mark table as Reserved ──
  await db.prepare(
    'UPDATE cafe_tables SET status = ? WHERE id = ?'
  ).bind('Reserved', assignedTable.id).run();

  log.info('cal_booking_created', { uid, reservationId, table: assignedTable.id });

  return json(201, {
    success: true,
    reservation: {
      id: reservationId,
      table_id: assignedTable.id,
      table_number: assignedTable.table_number,
      zone: assignedTable.zone,
      date,
      time,
      guest_count: guestCount,
      customer_name: customerName,
      status: 'confirmed',
    },
  });
}

// ═══════════════════════════════════════════════════════════════════
// BOOKING_CANCELLED
// ═══════════════════════════════════════════════════════════════════

async function handleBookingCancelled(db, payload) {
  const { uid } = payload;
  if (!uid) {
    return json(400, { success: false, error: 'Missing uid' });
  }

  const rsv = await db.prepare(
    'SELECT * FROM reservations WHERE cal_booking_uid = ? AND status = ? LIMIT 1'
  ).bind(uid, 'confirmed').first();

  if (!rsv) {
    return json(200, { success: true, skipped: true, message: 'No active reservation found' });
  }

  await db.prepare(
    'UPDATE reservations SET status = ?, updated_at = ? WHERE id = ?'
  ).bind('cancelled', new Date().toISOString(), rsv.id).run();

  // Free the table
  await db.prepare(
    'UPDATE cafe_tables SET status = ? WHERE id = ?'
  ).bind('Available', rsv.table_id).run();

  log.info('cal_booking_cancelled', { uid, reservationId: rsv.id, table: rsv.table_id });

  return json(200, { success: true, cancelled: true, reservation_id: rsv.id });
}

// ═══════════════════════════════════════════════════════════════════
// BOOKING_RESCHEDULED
// ═══════════════════════════════════════════════════════════════════

async function handleBookingRescheduled(db, payload) {
  const { uid, startTime } = payload;
  if (!uid || !startTime) {
    return json(400, { success: false, error: 'Missing uid or startTime' });
  }

  const rsv = await db.prepare(
    'SELECT * FROM reservations WHERE cal_booking_uid = ? AND status = ? LIMIT 1'
  ).bind(uid, 'confirmed').first();

  if (!rsv) {
    return json(404, { success: false, error: 'Reservation not found' });
  }

  // Extract date + time directly from ISO string (avoids CF Worker UTC timezone issues)
  const newDate = startTime.slice(0, 10);
  const newTime = startTime.slice(11, 16);

  // Conflict check: ensure table is still available at new date+time
  const conflict = await db.prepare(
    'SELECT id FROM reservations WHERE table_id = ? AND date = ? AND time = ? AND status = ? AND id != ?'
  ).bind(rsv.table_id, newDate, newTime, 'confirmed', rsv.id).first();

  if (conflict) {
    return json(409, { success: false, error: 'Bàn đã được đặt cho khung giờ mới này' });
  }

  await db.prepare(
    'UPDATE reservations SET date = ?, time = ?, updated_at = ? WHERE id = ?'
  ).bind(newDate, newTime, new Date().toISOString(), rsv.id).run();

  log.info('cal_booking_rescheduled', { uid, reservationId: rsv.id, newDate, newTime });

  return json(200, { success: true, rescheduled: true, reservation_id: rsv.id, date: newDate, time: newTime });
}

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
