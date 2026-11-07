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

const SAFE_WEBHOOK_TENANT_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function getConfiguredCalWebhookTenant(env: Env | undefined): string {
  const envRecord = (env || {}) as unknown as Record<string, unknown>;
  const calTenant = typeof envRecord.CAL_WEBHOOK_TENANT === 'string' ? envRecord.CAL_WEBHOOK_TENANT.trim() : '';
  if (calTenant && calTenant !== '*' && calTenant.toLowerCase() !== 'hq' && SAFE_WEBHOOK_TENANT_RE.test(calTenant)) {
    return calTenant;
  }
  const pilotTenant = typeof envRecord.PILOT_TENANT_ID === 'string' ? envRecord.PILOT_TENANT_ID.trim() : '';
  if (
    pilotTenant &&
    pilotTenant !== '*' &&
    pilotTenant.toLowerCase() !== 'hq' &&
    pilotTenant !== 'default' &&
    SAFE_WEBHOOK_TENANT_RE.test(pilotTenant)
  ) {
    return pilotTenant;
  }
  return '';
}

function hasConflictingWebhookTenant(
  payload: CalBookingPayloadInput['payload'],
  headerTenant: string | undefined | null,
): boolean {
  const meta = (payload?.metadata || {}) as Record<string, unknown>;
  const metaTenant = typeof meta.tenant_id === 'string' ? meta.tenant_id.trim() : '';
  const trimmedHeader = (headerTenant || '').trim();
  if (metaTenant && (metaTenant === '*' || metaTenant.toLowerCase() === 'hq' || !SAFE_WEBHOOK_TENANT_RE.test(metaTenant))) {
    return true;
  }
  if (trimmedHeader && (trimmedHeader === '*' || trimmedHeader.toLowerCase() === 'hq' || !SAFE_WEBHOOK_TENANT_RE.test(trimmedHeader))) {
    return true;
  }
  if (metaTenant && trimmedHeader && metaTenant !== trimmedHeader) {
    return true;
  }
  return false;
}

function hasConfiguredCalTenantMismatch(
  payload: CalBookingPayloadInput['payload'],
  headerTenant: string | undefined | null,
  env: Env,
): boolean {
  const configuredTenant = getConfiguredCalWebhookTenant(env);
  if (!configuredTenant) return false;
  const meta = (payload?.metadata || {}) as Record<string, unknown>;
  const metaTenant = typeof meta.tenant_id === 'string' ? meta.tenant_id.trim() : '';
  const trimmedHeader = (headerTenant || '').trim();
  if (metaTenant && metaTenant !== configuredTenant) {
    return true;
  }
  if (trimmedHeader && trimmedHeader !== configuredTenant) {
    return true;
  }
  return false;
}

function resolveWebhookTenant(
  payload: CalBookingPayloadInput['payload'],
  headerTenant: string | undefined | null,
  env: Env,
): string {
  const configuredTenant = getConfiguredCalWebhookTenant(env);
  if (configuredTenant) return configuredTenant;
  const meta = (payload?.metadata || {}) as Record<string, unknown>;
  const metaTenant = typeof meta.tenant_id === 'string' && meta.tenant_id.trim() ? meta.tenant_id.trim() : '';
  if (metaTenant && metaTenant !== '*' && metaTenant.toLowerCase() !== 'hq' && SAFE_WEBHOOK_TENANT_RE.test(metaTenant)) {
    return metaTenant;
  }
  try {
    const pilotStore = resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]);
    if (pilotStore && pilotStore !== '*' && pilotStore !== 'default') {
      return pilotStore;
    }
  } catch {
    // fall through to header or default
  }
  const trimmedHeader = (headerTenant || '').trim();
  if (trimmedHeader && trimmedHeader !== '*' && trimmedHeader.toLowerCase() !== 'hq' && SAFE_WEBHOOK_TENANT_RE.test(trimmedHeader)) {
    return trimmedHeader;
  }
  return 'default';
}

async function validateRescheduleEligibility(
  db: D1Database,
  targetUid: string,
  newDate: string,
  newTime: string,
  activeTenant: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const TERMINAL_STATUSES = new Set(['completed', 'no_show', 'rejected', 'cancelled']);
  const ACTIVE_STATUSES = new Set(['confirmed', 'pending', 'approved', 'seated']);
  let targetRow: Record<string, unknown> | null = null;
  try {
    targetRow = await db
      .prepare(
        "SELECT id, table_id, status, tenant_id, cal_booking_uid FROM reservations WHERE cal_booking_uid = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1"
      )
      .bind(targetUid, activeTenant, activeTenant)
      .first<Record<string, unknown>>();
  } catch {
    if (activeTenant === 'default' || activeTenant === '*') {
      targetRow = await db
        .prepare('SELECT id, table_id, status, tenant_id, cal_booking_uid FROM reservations WHERE cal_booking_uid = ? LIMIT 1')
        .bind(targetUid)
        .first<Record<string, unknown>>()
        .catch(() => null);
    }
  }
  if (!targetRow) return { ok: true };
  const currentStatus = String(targetRow.status ?? '').trim().toLowerCase();
  if (TERMINAL_STATUSES.has(currentStatus)) {
    return { ok: false, error: `Cannot reschedule a ${currentStatus} reservation` };
  }
  const tableId = targetRow.table_id !== undefined && targetRow.table_id !== null ? String(targetRow.table_id).trim() : '';
  if (tableId && newDate && newTime) {
    const effectiveTenant =
      activeTenant !== '*'
        ? activeTenant
        : (typeof targetRow.tenant_id === 'string' && targetRow.tenant_id.trim() ? targetRow.tenant_id.trim() : 'default');
    let conflictRows: Record<string, unknown>[] = [];
    try {
      const res = await db
        .prepare(
          "SELECT id, table_id, date, time, status, tenant_id, cal_booking_uid FROM reservations WHERE table_id = ? AND date = ? AND time = ? AND status IN ('confirmed', 'pending', 'approved', 'seated')"
        )
        .bind(tableId, newDate, newTime)
        .all<Record<string, unknown>>();
      conflictRows = res?.results || [];
    } catch {
      conflictRows = [];
    }
    for (const row of conflictRows) {
      if (!row) continue;
      if (row.cal_booking_uid && String(row.cal_booking_uid) === targetUid) continue;
      if (targetRow.id && row.id && String(row.id) === String(targetRow.id)) continue;
      if (String(row.table_id ?? '').trim() !== tableId) continue;
      const rDate = String(row.date ?? row.reservation_date ?? '').trim();
      const rTime = String(row.time ?? row.reservation_time ?? '').trim();
      if (rDate !== newDate || rTime !== newTime) continue;
      const rStatus = String(row.status ?? '').trim().toLowerCase();
      if (!ACTIVE_STATUSES.has(rStatus)) continue;
      if (matchesTenantRow(row, effectiveTenant)) {
        return { ok: false, error: 'Table already reserved for this time slot' };
      }
    }
  }
  return { ok: true };
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
    } catch (err: unknown) {
      if (String(err instanceof Error ? err.message : err).toLowerCase().includes('no such table')) {
        return true;
      }
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
    const rawHeaderTenant = c.req.header('X-Tenant-ID') || c.req.header('x-tenant-id');
    if (hasConflictingWebhookTenant(payload, rawHeaderTenant)) {
      return c.json({ success: false, error: 'Conflicting tenant context between webhook header and metadata' }, 400);
    }
    if (hasConfiguredCalTenantMismatch(payload, rawHeaderTenant, c.env)) {
      return c.json({ success: false, error: 'Cross-tenant webhook target denied' }, 403);
    }
    const activeTenant = resolveWebhookTenant(
      payload,
      rawHeaderTenant,
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
        const insertLegacyBooking = async (): Promise<boolean> => {
          const allowBooking = await canMutateBookingByUid(db, payload.uid, effectiveTenant);
          if (!allowBooking) {
            return false;
          }
          try {
            await db.prepare(
              `INSERT INTO bookings (cal_uid, title, start_time, end_time, attendee_name, attendee_email, status, metadata, tenant_id, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)`
            ).bind(
              payload.uid, payload.title, payload.startTime, payload.endTime,
              attendee.name, attendee.email,
              JSON.stringify(metaWithTenant), effectiveTenant, now, now
            ).run();
            return true;
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
          return true;
        };
        try {
          const result = await createReservationFromBooking(db, payload, activeTenant);
          if ('error' in result) {
            if (result.error === 'Booking UID already belongs to another store') {
              return c.json({ success: false, error: result.error }, 409);
            }
            const totalTables = await db
              .prepare("SELECT COUNT(*) as total FROM cafe_tables WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)")
              .bind(activeTenant, activeTenant)
              .first<{ total: number }>()
              .catch(() =>
                activeTenant === 'default' || activeTenant === '*'
                  ? db.prepare('SELECT COUNT(*) as total FROM cafe_tables').first<{ total: number }>().catch(() => null)
                  : null
              );
            if (!totalTables || totalTables.total === 0) {
              const inserted = await insertLegacyBooking();
              if (!inserted) {
                return c.json({ success: false, error: 'Booking UID already belongs to another store' }, 409);
              }
            } else {
              return c.json({ success: false, error: result.error }, 409);
            }
          }
        } catch {
          const inserted = await insertLegacyBooking();
          if (!inserted) {
            return c.json({ success: false, error: 'Booking UID already belongs to another store' }, 409);
          }
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
            if (activeTenant === 'default' || activeTenant === '*') {
              await db.prepare(
                'UPDATE bookings SET status = \'cancelled\', cancellation_reason = ?, updated_at = ? WHERE cal_uid = ?'
              ).bind(payload.cancellationReason || '', now, payload.uid).run();
            }
          }
        };
        try {
          let res: unknown = { meta: { changes: 0 } };
          try {
            res = await db.prepare(
              'UPDATE reservations SET status = \'cancelled\', updated_at = ? WHERE (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?) AND cal_booking_uid = ?'
            ).bind(now, activeTenant, activeTenant, payload.uid).run();
          } catch {
            if (activeTenant === 'default' || activeTenant === '*') {
              res = await db.prepare(
                'UPDATE reservations SET status = \'cancelled\', updated_at = ? WHERE cal_booking_uid = ?'
              ).bind(now, payload.uid).run();
            }
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
        const eligibility = await validateRescheduleEligibility(db, targetUid, date, time, activeTenant);
        if (!eligibility.ok) {
          return c.json({ success: false, error: eligibility.error }, 409);
        }
        try {
          let res: unknown = { meta: { changes: 0 } };
          try {
            res = await db.prepare(
              "UPDATE reservations SET date = ?, time = ?, reservation_time = ?, cal_booking_uid = ?, status = 'confirmed', updated_at = ? WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) AND cal_booking_uid = ? AND LOWER(COALESCE(status, 'confirmed')) NOT IN ('completed', 'no_show', 'rejected', 'cancelled')"
            ).bind(date, time, payload.startTime || `${date}T${time}`, payload.uid, now, activeTenant, activeTenant, targetUid).run();
          } catch {
            if (activeTenant === 'default' || activeTenant === '*') {
              res = await db.prepare(
                "UPDATE reservations SET date = ?, time = ?, reservation_time = ?, cal_booking_uid = ?, status = 'confirmed', updated_at = ? WHERE cal_booking_uid = ? AND LOWER(COALESCE(status, 'confirmed')) NOT IN ('completed', 'no_show', 'rejected', 'cancelled')"
              ).bind(date, time, payload.startTime || `${date}T${time}`, payload.uid, now, targetUid).run();
            }
          }
          if ((res as { meta?: { changes?: number } })?.meta?.changes === 0) {
            try {
              await db.prepare(
                'UPDATE bookings SET cal_uid = ?, start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?) AND cal_uid = ?'
              ).bind(payload.uid, payload.startTime, payload.endTime, now, activeTenant, activeTenant, targetUid).run();
            } catch {
              if (activeTenant === 'default' || activeTenant === '*') {
                await db.prepare(
                  'UPDATE bookings SET cal_uid = ?, start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE cal_uid = ?'
                ).bind(payload.uid, payload.startTime, payload.endTime, now, targetUid).run().catch(() => {});
              }
            }
          }
        } catch {
          try {
            await db.prepare(
              'UPDATE bookings SET start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?) AND cal_uid = ?'
            ).bind(payload.startTime, payload.endTime, now, activeTenant, activeTenant, targetUid).run();
          } catch {
            if (activeTenant === 'default' || activeTenant === '*') {
              await db.prepare(
                'UPDATE bookings SET start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE cal_uid = ?'
              ).bind(payload.startTime, payload.endTime, now, targetUid).run();
            }
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
  const rawHeaderTenant = request.headers.get('X-Tenant-ID') || request.headers.get('x-tenant-id');
  if (hasConflictingWebhookTenant(payload, rawHeaderTenant)) {
    return json({ success: false, error: 'Conflicting tenant context between webhook header and metadata' }, 400);
  }
  if (hasConfiguredCalTenantMismatch(payload, rawHeaderTenant, env)) {
    return json({ success: false, error: 'Cross-tenant webhook target denied' }, 403);
  }
  const activeTenant = resolveWebhookTenant(
    payload,
    rawHeaderTenant,
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
        activeTenant === 'default' || activeTenant === '*'
          ? db
            .prepare('SELECT id, tenant_id FROM reservations WHERE cal_booking_uid = ? LIMIT 1')
            .bind(payload.uid)
            .first<{ id: string; tenant_id?: string | null }>()
            .catch(() => null)
          : null
      );
    if (existingRow) {
      if (!matchesTenantRow(existingRow as unknown as Record<string, unknown>, activeTenant)) {
        return json({ success: false, error: 'Booking UID already belongs to another store' }, 409);
      }
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
    const allowBooking = await canMutateBookingByUid(db, payload.uid, activeTenant);
    if (!allowRes || !allowBooking) {
      return json({ success: false, error: 'Booking not found for this store' }, 404);
    }
    try {
      await db.prepare(
        'UPDATE reservations SET status = \'cancelled\' WHERE (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?) AND cal_booking_uid = ?'
      ).bind(activeTenant, activeTenant, payload.uid).run();
    } catch {
      if (activeTenant === 'default' || activeTenant === '*') {
        await db.prepare(
          'UPDATE reservations SET status = \'cancelled\' WHERE cal_booking_uid = ?'
        ).bind(payload.uid).run();
      }
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
    const eligibility = await validateRescheduleEligibility(db, targetUid, date, time, activeTenant);
    if (!eligibility.ok) {
      return json({ success: false, error: eligibility.error }, 409);
    }
    try {
      let res: unknown = { meta: { changes: 0 } };
      try {
        res = await db.prepare(
          "UPDATE reservations SET date = ?, time = ?, reservation_time = ?, cal_booking_uid = ?, status = 'confirmed', updated_at = ? WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) AND cal_booking_uid = ? AND LOWER(COALESCE(status, 'confirmed')) NOT IN ('completed', 'no_show', 'rejected', 'cancelled')"
        ).bind(date, time, payload.startTime || `${date}T${time}`, payload.uid, now, activeTenant, activeTenant, targetUid).run();
      } catch {
        if (activeTenant === 'default' || activeTenant === '*') {
          res = await db.prepare(
            "UPDATE reservations SET date = ?, time = ?, reservation_time = ?, cal_booking_uid = ?, status = 'confirmed', updated_at = ? WHERE cal_booking_uid = ? AND LOWER(COALESCE(status, 'confirmed')) NOT IN ('completed', 'no_show', 'rejected', 'cancelled')"
          ).bind(date, time, payload.startTime || `${date}T${time}`, payload.uid, now, targetUid).run();
        }
      }
      if ((res as { meta?: { changes?: number } })?.meta?.changes === 0) {
        try {
          await db.prepare(
            'UPDATE bookings SET cal_uid = ?, start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?) AND cal_uid = ?'
          ).bind(payload.uid, payload.startTime, payload.endTime, now, activeTenant, activeTenant, targetUid).run();
        } catch {
          if (activeTenant === 'default' || activeTenant === '*') {
            await db.prepare(
              'UPDATE bookings SET cal_uid = ?, start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE cal_uid = ?'
            ).bind(payload.uid, payload.startTime, payload.endTime, now, targetUid).run().catch(() => {});
          }
        }
      }
    } catch {
      try {
        await db.prepare(
          'UPDATE bookings SET start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?) AND cal_uid = ?'
        ).bind(payload.startTime, payload.endTime, now, activeTenant, activeTenant, targetUid).run();
      } catch {
        if (activeTenant === 'default' || activeTenant === '*') {
          await db.prepare(
            'UPDATE bookings SET start_time = ?, end_time = ?, status = \'rescheduled\', updated_at = ? WHERE cal_uid = ?'
          ).bind(payload.startTime, payload.endTime, now, targetUid).run();
        }
      }
    }

    return json({ success: true, rescheduled: true });
  }

  default:
    return json({ success: false, error: `Unknown event: ${triggerEvent}` }, 400);
  }
}
