import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { createReservationFromBooking } from '../../tree/cal-booking/process-booking';
import { calBookingPayloadSchema, type CalBookingPayloadInput } from './types';

export function registerWebhookHandler(router: Hono<{ Bindings: Env }>): void {
  // POST /api/cal-booking-webhook — requires x-cal-webhook-secret
  router.post('/', async (c) => {
    const secret = c.req.header('x-cal-webhook-secret');
    if (!c.env.CAL_WEBHOOK_SECRET) {
      return c.json({ success: false, error: 'Server misconfigured: CAL_WEBHOOK_SECRET not set' }, 500);
    }
    if (!secret || secret !== c.env.CAL_WEBHOOK_SECRET) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    const db = c.env.AURA_DB;

    const raw = await c.req.json<unknown>();
    const parsed = calBookingPayloadSchema.safeParse(raw);
    if (!parsed.success) {
      return c.json(
        { success: false, error: parsed.error.issues[0].message },
        400
      );
    }

    const { triggerEvent, payload } = parsed.data as CalBookingPayloadInput;
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
          payload.uid, payload.title, payload.startTime, payload.endTime,
          attendee.name, attendee.email,
          JSON.stringify(payload.metadata || {}), now, now
        ).run();
        break;
      }

      case 'BOOKING_CANCELLED': {
        await db.prepare(
          'UPDATE bookings SET status = \'cancelled\', cancellation_reason = ?, updated_at = ? WHERE cal_uid = ?'
        ).bind(payload.cancellationReason || '', now, payload.uid).run();
        break;
      }

      case 'BOOKING_RESCHEDULED': {
        await db.prepare(
          'UPDATE bookings SET start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE cal_uid = ?'
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
}

// Non-Hono handler for cron/test use
export async function handleCalBookingWebhook(request: Request, env: Env): Promise<Response> {
  const json = (data: unknown, status = 200): Response =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'Content-Type': 'application/json' }
    });

  // Auth
  const secret = request.headers.get('x-cal-webhook-secret');
  if (!secret || secret !== env.CAL_WEBHOOK_SECRET) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }

  // Parse body
  let body: CalBookingPayloadInput;
  try {
    body = await request.json() as CalBookingPayloadInput;
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
    const result = await createReservationFromBooking(db, payload);
    if ('error' in result) {
      return json({ success: false, error: result.error }, 409);
    }
    if (result.status === 'idempotent') {
      return json({ success: true, idempotent: true });
    }
    return json({ success: true, reservation: result }, 201);
  }

  case 'BOOKING_CANCELLED': {
    await db.prepare(
      'UPDATE reservations SET status = \'cancelled\' WHERE cal_booking_uid = ?'
    ).bind(payload.uid).run();

    return json({ success: true, cancelled: true });
  }

  default:
    return json({ success: false, error: `Unknown event: ${triggerEvent}` }, 400);
  }
}