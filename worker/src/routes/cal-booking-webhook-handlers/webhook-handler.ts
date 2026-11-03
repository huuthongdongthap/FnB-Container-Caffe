import type { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { createReservationFromBooking } from '../../tree/cal-booking/process-booking';
import { parseBookingTime } from '../../tree/cal-booking/time-parser';
import { calBookingPayloadSchema, type CalBookingPayloadInput } from './types';
import { computeHmacSha256, timingSafeEqual } from '@aura/domain-security';
import { createLogger } from '../../middleware/logger';
import { matchesTenantRow, resolvePilotStore } from '../../middleware/tenant';

const log = createLogger({ route: 'cal-booking-webhook' });

async function verifyCalWebhookSignature(
  sig: string | undefined | null,
  secret: string | undefined,
  rawBody: string,
): Promise<boolean> {
  if (!sig || !secret) return false;
  if (await timingSafeEqual(sig, secret)) {
    return true;
  }
  const hmacHex = await computeHmacSha256(rawBody, secret);
  const normalizedSig = sig.replace(/^sha256=/i, '').trim().toLowerCase();
  return timingSafeEqual(normalizedSig, hmacHex.toLowerCase());
}

function resolveWebhookTenant(
  payload: CalBookingPayloadInput['payload'],
  headerTenant: string | undefined | null,
  env: Env,
): string {
  const meta = (payload?.metadata || {}) as Record<string, unknown>;
  const metaTenant = typeof meta.tenant_id === 'string' && meta.tenant_id.trim() ? meta.tenant_id.trim() : '';
  if (metaTenant && metaTenant !== '*') return metaTenant;
  const trimmedHeader = (headerTenant || '').trim();
  if (trimmedHeader && trimmedHeader !== '*') return trimmedHeader;
  try {
    return resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]);
  } catch {
    return 'default';
  }
}

async function canMutateReservationByUid(
  db: D1Database,
  uid: string,
  activeTenant: string,
): Promise<boolean> {
  if (activeTenant === '*') return true;
  try {
    const scopedRow = await db
      .prepare(
        "SELECT id, tenant_id FROM reservations WHERE cal_booking_uid = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1"
      )
      .bind(uid, activeTenant, activeTenant)
      .first<{ id: string; tenant_id?: string | null }>();
    if (scopedRow) {
      return matchesTenantRow(scopedRow as unknown as Record<string, unknown>, activeTenant);
    }
    const anyRow = await db
      .prepare('SELECT id, tenant_id FROM reservations WHERE cal_booking_uid = ? LIMIT 1')
      .bind(uid)
      .first<{ id: string; tenant_id?: string | null }>();
    if (!anyRow) return true;
    return matchesTenantRow(anyRow as unknown as Record<string, unknown>, activeTenant);
  } catch {
    try {
      const row = await db
        .prepare('SELECT id, tenant_id FROM reservations WHERE cal_booking_uid = ? LIMIT 1')
        .bind(uid)
        .first<{ id: string; tenant_id?: string | null }>();
      if (!row) return true;
      return matchesTenantRow(row as unknown as Record<string, unknown>, activeTenant);
    } catch {
      return activeTenant === 'default';
    }
  }
}

function rowMatchesBookingTenant(
  row: { cal_uid: string; tenant_id?: string | null; metadata?: string | null },
  activeTenant: string,
): boolean {
  if ('tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null && String(row.tenant_id).trim() !== '') {
    return String(row.tenant_id).trim() === activeTenant;
  }
  if (row.metadata) {
    try {
      const parsed = JSON.parse(row.metadata) as { tenant_id?: unknown };
      if (typeof parsed?.tenant_id === 'string' && parsed.tenant_id.trim()) {
        return parsed.tenant_id.trim() === activeTenant;
      }
    } catch {
      // ignore malformed metadata JSON
    }
  }
  return activeTenant === 'default';
}

async function canMutateBookingByUid(
  db: D1Database,
  uid: string,
  activeTenant: string,
): Promise<boolean> {
  if (activeTenant === '*') return true;
  try {
    const scopedRow = await db
      .prepare(
        "SELECT cal_uid, tenant_id, metadata FROM bookings WHERE cal_uid = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1"
      )
      .bind(uid, activeTenant, activeTenant)
      .first<{ cal_uid: string; tenant_id?: string | null; metadata?: string | null }>();
    if (scopedRow) {
      return rowMatchesBookingTenant(scopedRow, activeTenant);
    }
    const row = await db
      .prepare('SELECT cal_uid, tenant_id, metadata FROM bookings WHERE cal_uid = ? LIMIT 1')
      .bind(uid)
      .first<{ cal_uid: string; tenant_id?: string | null; metadata?: string | null }>();
    if (!row) return true;
    return rowMatchesBookingTenant(row, activeTenant);
  } catch {
    try {
      const row = await db
        .prepare('SELECT cal_uid, metadata FROM bookings WHERE cal_uid = ? LIMIT 1')
        .bind(uid)
        .first<{ cal_uid: string; metadata?: string | null }>();
      if (!row) return true;
      return rowMatchesBookingTenant(row, activeTenant);
    } catch {
      return activeTenant === 'default';
    }
  }
}

export function registerWebhookHandler(router: Hono<{ Bindings: Env }>): void {
  // POST /api/cal-booking-webhook — requires x-cal-signature-256 or x-cal-webhook-secret
  router.post('/', async (c) => {
    const sig = c.req.header('x-cal-signature-256') || c.req.header('x-cal-webhook-secret');
    if (!c.env.CAL_WEBHOOK_SECRET) {
      return c.json({ success: false, error: 'Server misconfigured: CAL_WEBHOOK_SECRET not set' }, 500);
    }
    const rawBody = await c.req.text().catch(() => '');
    const isValid = await verifyCalWebhookSignature(sig, c.env.CAL_WEBHOOK_SECRET, rawBody);
    if (!isValid) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    const db = c.env.AURA_DB;

    let raw: unknown;
    try {
      raw = JSON.parse(rawBody);
    } catch {
      return c.json({ success: false, error: 'Invalid JSON' }, 400);
    }
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
    const activeTenant = resolveWebhookTenant(
      payload,
      c.req.header('X-Tenant-ID') || c.req.header('x-tenant-id'),
      c.env,
    );

    try {
      switch (triggerEvent) {
      case 'BOOKING_CREATED': {
        const attendee = payload.attendees?.[0] || { name: '', email: '' };
        const effectiveTenant = !activeTenant || activeTenant === '*' ? 'default' : activeTenant;
        const metaWithTenant = {
          ...(payload.metadata || {}),
          tenant_id: effectiveTenant,
        };
        const insertLegacyBooking = async () => {
          try {
            await db.prepare(
              `INSERT INTO bookings (cal_uid, title, start_time, end_time, attendee_name, attendee_email, status, metadata, tenant_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)`
            ).bind(
              payload.uid, payload.title, payload.startTime, payload.endTime,
              attendee.name, attendee.email,
              JSON.stringify(metaWithTenant), effectiveTenant, now, now
            ).run();
            return;
          } catch {
            // fallback to legacy schema without tenant_id column
          }
          await db.prepare(
            `INSERT INTO bookings (cal_uid, title, start_time, end_time, attendee_name, attendee_email, status, metadata, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)`
          ).bind(
            payload.uid, payload.title, payload.startTime, payload.endTime,
            attendee.name, attendee.email,
            JSON.stringify(metaWithTenant), now, now
          ).run();
        };
        try {
          const result = await createReservationFromBooking(db, payload, activeTenant);
          if ('error' in result) {
            const totalTables = await db
              .prepare("SELECT COUNT(*) as total FROM cafe_tables WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
              .bind(activeTenant, activeTenant)
              .first<{ total: number }>()
              .catch(() =>
                db.prepare('SELECT COUNT(*) as total FROM cafe_tables').first<{ total: number }>().catch(() => null)
              );
            if (!totalTables || totalTables.total === 0) {
              await insertLegacyBooking();
            } else {
              return c.json({ success: false, error: result.error }, 409);
            }
          }
        } catch {
          await insertLegacyBooking();
        }
        break;
      }

      case 'BOOKING_CANCELLED': {
        const allowRes = await canMutateReservationByUid(db, payload.uid, activeTenant);
        const allowBooking = await canMutateBookingByUid(db, payload.uid, activeTenant);
        if (!allowRes || !allowBooking) {
          return c.json({ success: false, error: 'Booking not found for this store' }, 404);
        }
        const cancelLegacyBooking = async () => {
          try {
            await db.prepare(
              'UPDATE bookings SET status = \'cancelled\', cancellation_reason = ?, updated_at = ? WHERE (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?) AND cal_uid = ?'
            ).bind(payload.cancellationReason || '', now, activeTenant, activeTenant, payload.uid).run();
          } catch {
            await db.prepare(
              'UPDATE bookings SET status = \'cancelled\', cancellation_reason = ?, updated_at = ? WHERE cal_uid = ?'
            ).bind(payload.cancellationReason || '', now, payload.uid).run();
          }
        };
        try {
          let res: unknown;
          try {
            res = await db.prepare(
              'UPDATE reservations SET status = \'cancelled\', updated_at = ? WHERE (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?) AND cal_booking_uid = ?'
            ).bind(now, activeTenant, activeTenant, payload.uid).run();
          } catch {
            res = await db.prepare(
              'UPDATE reservations SET status = \'cancelled\', updated_at = ? WHERE cal_booking_uid = ?'
            ).bind(now, payload.uid).run();
          }
          if ((res as { meta?: { changes?: number } })?.meta?.changes === 0) {
            await cancelLegacyBooking().catch(() => {});
          }
        } catch {
          await cancelLegacyBooking();
        }
        break;
      }

      case 'BOOKING_RESCHEDULED': {
        const targetUid = payload.rescheduleUid || payload.uid;
        const allowRes = await canMutateReservationByUid(db, targetUid, activeTenant);
        const allowBooking = await canMutateBookingByUid(db, targetUid, activeTenant);
        if (!allowRes || !allowBooking) {
          return c.json({ success: false, error: 'Booking not found for this store' }, 404);
        }
        const { date, time } = parseBookingTime(payload.startTime || '');
        try {
          let res: unknown;
          try {
            res = await db.prepare(
              'UPDATE reservations SET date = ?, time = ?, reservation_time = ?, cal_booking_uid = ?, status = \'confirmed\', updated_at = ? WHERE (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?) AND cal_booking_uid = ?'
            ).bind(date, time, payload.startTime || `${date}T${time}`, payload.uid, now, activeTenant, activeTenant, targetUid).run();
          } catch {
            res = await db.prepare(
              'UPDATE reservations SET date = ?, time = ?, reservation_time = ?, cal_booking_uid = ?, status = \'confirmed\', updated_at = ? WHERE cal_booking_uid = ?'
            ).bind(date, time, payload.startTime || `${date}T${time}`, payload.uid, now, targetUid).run();
          }
          if ((res as { meta?: { changes?: number } })?.meta?.changes === 0) {
            try {
              await db.prepare(
                'UPDATE bookings SET cal_uid = ?, start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?) AND cal_uid = ?'
              ).bind(payload.uid, payload.startTime, payload.endTime, now, activeTenant, activeTenant, targetUid).run();
            } catch {
              await db.prepare(
                'UPDATE bookings SET cal_uid = ?, start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE cal_uid = ?'
              ).bind(payload.uid, payload.startTime, payload.endTime, now, targetUid).run().catch(() => {});
            }
          }
        } catch {
          try {
            await db.prepare(
              'UPDATE bookings SET start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?) AND cal_uid = ?'
            ).bind(payload.startTime, payload.endTime, now, activeTenant, activeTenant, targetUid).run();
          } catch {
            await db.prepare(
              'UPDATE bookings SET start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE cal_uid = ?'
            ).bind(payload.startTime, payload.endTime, now, targetUid).run();
          }
        }
        break;
      }

      default:
        return c.json({ success: false, error: `Unknown event: ${triggerEvent}` }, 400);
      }

      return c.json({ success: true, message: `${triggerEvent} processed` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      log.error('Cal booking webhook processing error:', { message: msg, triggerEvent });
      return c.json({ success: false, error: 'Failed to process booking webhook' }, 500);
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

  // Auth & Parse body
  const sig = request.headers.get('x-cal-signature-256') || request.headers.get('x-cal-webhook-secret');
  if (!sig || !env.CAL_WEBHOOK_SECRET) {
    return json({ success: false, error: 'Unauthorized' }, 401);
  }

  let body: CalBookingPayloadInput;
  if (typeof request.text === 'function') {
    const rawBody = await request.text().catch(() => '');
    const isValid = await verifyCalWebhookSignature(sig, env.CAL_WEBHOOK_SECRET, rawBody);
    if (!isValid) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }
    try {
      body = JSON.parse(rawBody) as CalBookingPayloadInput;
    } catch {
      return json({ success: false, error: 'Invalid JSON' }, 400);
    }
  } else {
    try {
      body = await request.json() as CalBookingPayloadInput;
    } catch {
      const directMatch = await timingSafeEqual(sig, env.CAL_WEBHOOK_SECRET);
      if (!directMatch) {
        return json({ success: false, error: 'Unauthorized' }, 401);
      }
      return json({ success: false, error: 'Invalid JSON' }, 400);
    }
    const rawBody = JSON.stringify(body ?? {});
    const isValid = await verifyCalWebhookSignature(sig, env.CAL_WEBHOOK_SECRET, rawBody);
    if (!isValid) {
      return json({ success: false, error: 'Unauthorized' }, 401);
    }
  }

  const { triggerEvent, payload } = body || {};
  if (!triggerEvent || !payload?.uid) {
    return json({ success: false, error: 'Invalid webhook payload' }, 400);
  }

  const db = env.AURA_DB;
  const activeTenant = resolveWebhookTenant(
    payload,
    request.headers.get('X-Tenant-ID') || request.headers.get('x-tenant-id'),
    env,
  );

  switch (triggerEvent) {
  case 'BOOKING_CREATED': {
    const existingRow = await db
      .prepare(
        "SELECT id, tenant_id FROM reservations WHERE cal_booking_uid = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1"
      )
      .bind(payload.uid, activeTenant, activeTenant)
      .first<{ id: string; tenant_id?: string | null }>()
      .catch(() =>
        db
          .prepare('SELECT id, tenant_id FROM reservations WHERE cal_booking_uid = ? LIMIT 1')
          .bind(payload.uid)
          .first<{ id: string; tenant_id?: string | null }>()
          .catch(() => null)
      );
    if (existingRow && matchesTenantRow(existingRow as unknown as Record<string, unknown>, activeTenant)) {
      return json({ success: true, idempotent: true });
    }
    const result = await createReservationFromBooking(db, payload, activeTenant);
    if ('error' in result) {
      return json({ success: false, error: result.error }, 409);
    }
    if (result.status === 'idempotent') {
      return json({ success: true, idempotent: true });
    }
    return json({ success: true, reservation: result }, 201);
  }

  case 'BOOKING_CANCELLED': {
    const allowRes = await canMutateReservationByUid(db, payload.uid, activeTenant);
    if (!allowRes) {
      return json({ success: false, error: 'Booking not found for this store' }, 404);
    }
    try {
      await db.prepare(
        'UPDATE reservations SET status = \'cancelled\' WHERE (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?) AND cal_booking_uid = ?'
      ).bind(activeTenant, activeTenant, payload.uid).run();
    } catch {
      await db.prepare(
        'UPDATE reservations SET status = \'cancelled\' WHERE cal_booking_uid = ?'
      ).bind(payload.uid).run();
    }

    return json({ success: true, cancelled: true });
  }

  case 'BOOKING_RESCHEDULED': {
    const targetUid = payload.rescheduleUid || payload.uid;
    const allowRes = await canMutateReservationByUid(db, targetUid, activeTenant);
    const allowBooking = await canMutateBookingByUid(db, targetUid, activeTenant);
    if (!allowRes || !allowBooking) {
      return json({ success: false, error: 'Booking not found for this store' }, 404);
    }
    const now = new Date().toISOString();
    const { date, time } = parseBookingTime(payload.startTime || '');
    try {
      let res: unknown;
      try {
        res = await db.prepare(
          'UPDATE reservations SET date = ?, time = ?, reservation_time = ?, cal_booking_uid = ?, status = \'confirmed\', updated_at = ? WHERE (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?) AND cal_booking_uid = ?'
        ).bind(date, time, payload.startTime || `${date}T${time}`, payload.uid, now, activeTenant, activeTenant, targetUid).run();
      } catch {
        res = await db.prepare(
          'UPDATE reservations SET date = ?, time = ?, reservation_time = ?, cal_booking_uid = ?, status = \'confirmed\', updated_at = ? WHERE cal_booking_uid = ?'
        ).bind(date, time, payload.startTime || `${date}T${time}`, payload.uid, now, targetUid).run();
      }
      if ((res as { meta?: { changes?: number } })?.meta?.changes === 0) {
        try {
          await db.prepare(
            'UPDATE bookings SET cal_uid = ?, start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?) AND cal_uid = ?'
          ).bind(payload.uid, payload.startTime, payload.endTime, now, activeTenant, activeTenant, targetUid).run();
        } catch {
          await db.prepare(
            'UPDATE bookings SET cal_uid = ?, start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE cal_uid = ?'
          ).bind(payload.uid, payload.startTime, payload.endTime, now, targetUid).run().catch(() => {});
        }
      }
    } catch {
      try {
        await db.prepare(
          'UPDATE bookings SET start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?) AND cal_uid = ?'
        ).bind(payload.startTime, payload.endTime, now, activeTenant, activeTenant, targetUid).run();
      } catch {
        await db.prepare(
          'UPDATE bookings SET start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE cal_uid = ?'
        ).bind(payload.startTime, payload.endTime, now, targetUid).run();
      }
    }

    return json({ success: true, rescheduled: true });
  }

  default:
    return json({ success: false, error: `Unknown event: ${triggerEvent}` }, 400);
  }
}
