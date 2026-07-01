/**
 * Cal.com Booking Webhook Routes — /api/cal-booking-webhook
 * Receives webhooks from Cal.com for booking lifecycle events.
 *
 * Actions: BOOKING_CREATED | BOOKING_CANCELLED | BOOKING_RESCHEDULED
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';

interface CalBookingPayload {
  triggerEvent: string;
  createdAt: string;
  payload: {
    uid: string;
    title: string;
    startTime: string;
    endTime: string;
    attendees: Array<{ name: string; email: string; timeZone: string }>;
    organizer: { name: string; email: string };
    location: string;
    metadata?: Record<string, unknown>;
    rescheduleUid?: string;
    cancellationReason?: string;
  };
}

interface BookingRecord {
  id: string;
  cal_uid: string;
  title: string;
  start_time: string;
  end_time: string;
  attendee_name: string;
  attendee_email: string;
  status: string;
  created_at: string;
}

export const calBookingWebhookRouter = new Hono<{ Bindings: Env }>();

// ── handleCalBookingWebhook (non-Hono handler for cron/test use) ──
export async function handleCalBookingWebhook(request: any, env: any): Promise<Response> {
  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  // Auth
  const secret = request.headers.get('x-cal-webhook-secret');
  if (!secret || secret !== env.CAL_WEBHOOK_SECRET) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }

  // Parse body
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const { triggerEvent, payload } = body || {};
  if (!triggerEvent || !payload?.uid) {
    return json({ success: false, error: 'Invalid webhook payload' }, 400);
  }

  const db = env.AURA_DB;

  switch (triggerEvent) {
    case 'BOOKING_CREATED': {
      // Check for duplicate
      const existing = await db.prepare(
        'SELECT id FROM reservations WHERE cal_booking_uid = ?'
      ).bind(payload.uid).first();

      if (existing) {
        return json({ success: true, idempotent: true });
      }

      const metadata = payload.metadata || {};
      const attendeeCount = payload.attendees?.length || 1;
      const guestCount = metadata.guest_count || attendeeCount;
      const zone = metadata.zone || null;

      // Find available tables — use all() so mock D1 filters correctly
      let table: any = null;
      if (zone) {
        const { results: zoneResults } = await db.prepare(
          "SELECT * FROM cafe_tables WHERE capacity >= ? AND status = 'Available'"
        ).bind(guestCount).all();
        const available = (zoneResults || []) as any[];
        // Prefer zone match, then sort by capacity
        table = available.find((t: any) => t.zone === zone) || available.sort((a: any, b: any) => a.capacity - b.capacity)[0] || null;
      } else {
        const { results: anyResults } = await db.prepare(
          "SELECT * FROM cafe_tables WHERE capacity >= ? AND status = 'Available'"
        ).bind(guestCount).all();
        const available = (anyResults || []) as any[];
        available.sort((a: any, b: any) => a.capacity - b.capacity);
        table = available[0] || null;
      }

      if (!table) {
        return json({ success: false, error: 'No tables available' }, 409);
      }

      // Create reservation
      const attendee = payload.attendees?.[0] || {} as any;
      const date = payload.startTime?.slice(0, 10) || new Date().toISOString().slice(0, 10);
      const time = payload.startTime?.slice(11, 16) || '00:00';

      const reservationId = 'rsv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      await db.prepare(
        `INSERT INTO reservations (id, table_id, customer_name, customer_phone, guest_count, date, time, zone, notes, cal_booking_uid, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')`
      ).bind(
        reservationId, table.id, attendee.name || '', attendee.phone || '', guestCount,
        date, time, table.zone || '', '', payload.uid
      ).run();

      return json({
        success: true,
        reservation: {
          table_id: table.id,
          guest_count: guestCount,
          zone: table.zone,
          status: 'confirmed',
        },
      }, 201);
    }

    case 'BOOKING_CANCELLED': {
      await db.prepare(
        "UPDATE reservations SET status = 'cancelled' WHERE cal_booking_uid = ?"
      ).bind(payload.uid).run();

      return json({ success: true, cancelled: true });
    }

    default:
      return json({ success: false, error: `Unknown event: ${triggerEvent}` }, 400);
  }
}

// POST /api/cal-booking-webhook
calBookingWebhookRouter.post('/', async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json<CalBookingPayload>();

  const { triggerEvent, payload } = body;
  if (!triggerEvent || !payload?.uid) {
    return c.json({ success: false, error: 'Invalid webhook payload' }, 400);
  }

  const now = new Date().toISOString();

  try {
    switch (triggerEvent) {
      case 'BOOKING_CREATED': {
        const attendee = payload.attendees?.[0] || { name: '', email: '' };
        await db.prepare(
          `INSERT INTO bookings (cal_uid, title, start_time, end_time, attendee_name, attendee_email, status, metadata, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)`
        ).bind(
          payload.uid,
          payload.title,
          payload.startTime,
          payload.endTime,
          attendee.name,
          attendee.email,
          JSON.stringify(payload.metadata || {}),
          now,
          now
        ).run();
        break;
      }

      case 'BOOKING_CANCELLED': {
        await db.prepare(
          "UPDATE bookings SET status = 'cancelled', cancellation_reason = ?, updated_at = ? WHERE cal_uid = ?"
        ).bind(payload.cancellationReason || '', now, payload.uid).run();
        break;
      }

      case 'BOOKING_RESCHEDULED': {
        await db.prepare(
          "UPDATE bookings SET start_time = ?, end_time = ?, status = 'rescheduled', updated_at = ? WHERE cal_uid = ?"
        ).bind(payload.startTime, payload.endTime, now, payload.rescheduleUid || payload.uid).run();
        break;
      }

      default:
        return c.json({ success: false, error: `Unknown event: ${triggerEvent}` }, 400);
    }

    return c.json({ success: true, message: `${triggerEvent} processed` });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return c.json({ success: false, error: msg }, 500);
  }
});

// GET /api/cal-booking-webhook/bookings — list bookings
calBookingWebhookRouter.get('/bookings', async (c) => {
  const db = c.env.AURA_DB;
  const status = c.req.query('status');
  const limit = parseInt(c.req.query('limit') || '50', 10);

  let query = 'SELECT * FROM bookings WHERE 1=1';
  const params: unknown[] = [];

  if (status) { query += ' AND status = ?'; params.push(status); }
  query += ' ORDER BY start_time DESC LIMIT ?';
  params.push(limit);

  const { results } = await db.prepare(query).bind(...params).all<BookingRecord>();
  return c.json({ success: true, data: results || [] });
});
