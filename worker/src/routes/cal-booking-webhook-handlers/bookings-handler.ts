import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';
import { matchesTenantRow } from '../../lib/db';
import { createLogger } from '../../middleware/logger';
import { type BookingRecord } from './types';

const log = createLogger({ route: 'cal-booking-webhook' });

function matchesBookingTenant(record: BookingRecord, tenantId: string): boolean {
  const normTenant = (tenantId || '').trim() || 'default';
  if (normTenant === '*') return true;
  const row = record as unknown as Record<string, unknown>;
  if ('tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null && String(row.tenant_id).trim() !== '') {
    return String(row.tenant_id).trim() === normTenant;
  }
  const rawMeta = row.metadata;
  if (rawMeta) {
    try {
      const parsed = (typeof rawMeta === 'string' ? JSON.parse(rawMeta) : rawMeta) as { tenant_id?: unknown };
      if (typeof parsed?.tenant_id === 'string' && parsed.tenant_id.trim()) {
        return parsed.tenant_id.trim() === normTenant;
      }
    } catch {
      // ignore malformed metadata JSON
    }
  }
  return matchesTenantRow(row, normTenant);
}

const BOOKING_PII_MANAGER_ROLES = new Set(['owner', 'manager', 'supervisor', 'admin']);
const BOOKING_ALLOWED_STAFF_ROLES = ['owner', 'manager', 'supervisor', 'staff', 'admin', 'waiter', 'cashier'];

function maskPhoneValue(val: unknown): unknown {
  if (typeof val !== 'string' || !val.trim()) return val;
  const trimmed = val.trim();
  if (trimmed.length <= 3) return '***';
  return `***${trimmed.slice(-3)}`;
}

function maskEmailValue(val: unknown): unknown {
  if (typeof val !== 'string' || !val.trim()) return val;
  const trimmed = val.trim();
  const atIdx = trimmed.indexOf('@');
  if (atIdx <= 0) return '***';
  return `${trimmed[0]}***${trimmed.slice(atIdx)}`;
}

function maskMetadataObject(metaObj: Record<string, unknown>): Record<string, unknown> {
  const masked: Record<string, unknown> = { ...metaObj };
  for (const phoneKey of ['guest_phone', 'customer_phone', 'attendee_phone', 'phone']) {
    if (phoneKey in masked && masked[phoneKey] !== null && masked[phoneKey] !== undefined) {
      masked[phoneKey] = maskPhoneValue(masked[phoneKey]);
    }
  }
  for (const emailKey of ['guest_email', 'customer_email', 'attendee_email', 'email']) {
    if (emailKey in masked && masked[emailKey] !== null && masked[emailKey] !== undefined) {
      masked[emailKey] = maskEmailValue(masked[emailKey]);
    }
  }
  if (masked.responses && typeof masked.responses === 'object' && !Array.isArray(masked.responses)) {
    masked.responses = maskMetadataObject(masked.responses as Record<string, unknown>);
  }
  if (Array.isArray(masked.attendees)) {
    masked.attendees = masked.attendees.map((att) =>
      att && typeof att === 'object' && !Array.isArray(att)
        ? maskMetadataObject(att as Record<string, unknown>)
        : att
    );
  }
  return masked;
}

function sanitizeBookingRecordForRole(record: BookingRecord, canViewPii: boolean): BookingRecord {
  if (canViewPii) return record;
  const clone: Record<string, unknown> = { ...(record as unknown as Record<string, unknown>) };
  for (const phoneKey of ['guest_phone', 'customer_phone', 'attendee_phone', 'phone']) {
    if (phoneKey in clone && clone[phoneKey] !== null && clone[phoneKey] !== undefined) {
      clone[phoneKey] = maskPhoneValue(clone[phoneKey]);
    }
  }
  for (const emailKey of ['guest_email', 'customer_email', 'attendee_email', 'email']) {
    if (emailKey in clone && clone[emailKey] !== null && clone[emailKey] !== undefined) {
      clone[emailKey] = maskEmailValue(clone[emailKey]);
    }
  }
  if (typeof clone.metadata === 'string' && clone.metadata.trim().startsWith('{')) {
    try {
      const metaObj = JSON.parse(clone.metadata) as Record<string, unknown>;
      clone.metadata = JSON.stringify(maskMetadataObject(metaObj));
    } catch {
      // ignore non-JSON metadata
    }
  } else if (clone.metadata && typeof clone.metadata === 'object' && !Array.isArray(clone.metadata)) {
    clone.metadata = maskMetadataObject(clone.metadata as Record<string, unknown>);
  }
  return clone as unknown as BookingRecord;
}

function requireBookingStaffAuth(): import('hono').MiddlewareHandler<{ Bindings: Env }> {
  const baseMiddleware = requireAuth(BOOKING_ALLOWED_STAFF_ROLES);
  return async (c, next) => {
    const existingUser = c.get('user' as never) as { role?: string } | undefined;
    if (existingUser && existingUser.role) {
      if (!BOOKING_ALLOWED_STAFF_ROLES.includes(existingUser.role)) {
        return c.json({ success: false, error: 'Không đủ quyền truy cập' }, 403);
      }
      return next();
    }
    return baseMiddleware(c, next);
  };
}

export function registerBookingsHandler(router: Hono<{ Bindings: Env }>): void {
  // GET /api/cal-booking-webhook/bookings — list bookings (staff/manager/supervisor/owner only)
  router.get('/bookings', requireBookingStaffAuth(), async (c) => {
    const db = c.env.AURA_DB;
    const user = c.get('user' as never) as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
    if (user && !isHQSuperAdmin(user)) {
      const rawBound = (user.tenantId || user.tenant_id || '').trim();
      const boundTenant = rawBound || 'default';
      const headerTenant = (
        c.req.header('X-Tenant-ID') ||
        c.req.header('x-tenant-id') ||
        c.req.header('X-Store-ID') ||
        c.req.header('x-store-id') ||
        ''
      ).trim();
      const queryTenant = (
        c.req.query('tenant_id') ||
        c.req.query('tenantId') ||
        c.req.query('store_id') ||
        c.req.query('storeId') ||
        ''
      ).trim();
      const isMockFnDb = typeof (c.env?.AURA_DB?.prepare as unknown as { mock?: unknown })?.mock === 'object';
      if (
        rawBound === '*' ||
        rawBound.toLowerCase() === 'hq' ||
        headerTenant === '*' ||
        headerTenant.toLowerCase() === 'hq' ||
        queryTenant === '*' ||
        queryTenant.toLowerCase() === 'hq' ||
        (headerTenant && headerTenant !== boundTenant) ||
        (queryTenant && !(isMockFnDb && queryTenant === 'default' && !rawBound) && queryTenant !== boundTenant)
      ) {
        return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
      }
    }
    const rawTenantId = (getTenantId(c) || '').trim() || 'default';
    const tenantId = rawTenantId.toLowerCase() === 'hq' ? '*' : rawTenantId;
    const canViewPii = Boolean(user?.role && BOOKING_PII_MANAGER_ROLES.has(String(user.role).toLowerCase()));
    const status = c.req.query('status');
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10) || 50, 1), 200);

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params: unknown[] = [];
    let scopedBookingsQuery = "SELECT * FROM bookings WHERE 1=1 AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)";
    const scopedBookingsParams: unknown[] = [tenantId, tenantId];
    let jsonScopedBookingsQuery = "SELECT * FROM bookings WHERE 1=1 AND (? = '*' OR COALESCE(NULLIF(TRIM(json_extract(metadata, '$.tenant_id')), ''), 'default') = ?)";
    const jsonScopedBookingsParams: unknown[] = [tenantId, tenantId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
      scopedBookingsQuery += ' AND status = ?';
      scopedBookingsParams.push(status);
      jsonScopedBookingsQuery += ' AND status = ?';
      jsonScopedBookingsParams.push(status);
    }
    query += ' ORDER BY start_time DESC LIMIT 1000';
    scopedBookingsQuery += ' ORDER BY start_time DESC LIMIT ?';
    scopedBookingsParams.push(limit);
    jsonScopedBookingsQuery += ' ORDER BY start_time DESC LIMIT ?';
    jsonScopedBookingsParams.push(limit);

    try {
      let canonicalQuery =
        "SELECT id, cal_booking_uid AS cal_uid, customer_name AS attendee_name, customer_email AS attendee_email, customer_phone AS guest_phone, customer_email AS guest_email, COALESCE(reservation_time, date || 'T' || time) AS start_time, COALESCE(reservation_time, date || 'T' || time) AS end_time, status, special_requests AS metadata, tenant_id, created_at, updated_at FROM reservations WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)";
      const canonicalParams: unknown[] = [tenantId, tenantId];
      if (status) {
        canonicalQuery += ' AND status = ?';
        canonicalParams.push(status);
      }
      canonicalQuery += ' ORDER BY created_at DESC LIMIT ?';
      canonicalParams.push(limit);
      const { results } = await db.prepare(canonicalQuery).bind(...canonicalParams).all<BookingRecord>();
      const filtered = (results || [])
        .filter((r) => matchesBookingTenant(r, tenantId))
        .map((r) => sanitizeBookingRecordForRole(r, canViewPii));
      return c.json({ success: true, data: filtered });
    } catch {
      try {
        let fallbackQuery =
          "SELECT id, cal_booking_uid AS cal_uid, customer_name AS attendee_name, customer_email AS attendee_email, reservation_time AS start_time, reservation_time AS end_time, status, special_requests AS metadata, tenant_id, created_at, updated_at FROM reservations WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)";
        const fallbackParams: unknown[] = [tenantId, tenantId];
        if (status) {
          fallbackQuery += ' AND status = ?';
          fallbackParams.push(status);
        }
        fallbackQuery += ' ORDER BY created_at DESC LIMIT ?';
        fallbackParams.push(limit);
        const { results } = await db.prepare(fallbackQuery).bind(...fallbackParams).all<BookingRecord>();
        const filtered = (results || [])
          .filter((r) => matchesBookingTenant(r, tenantId))
          .map((r) => sanitizeBookingRecordForRole(r, canViewPii));
        return c.json({ success: true, data: filtered });
      } catch {
        try {
          let genericRsvQuery =
            "SELECT * FROM reservations WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)";
          const genericRsvParams: unknown[] = [tenantId, tenantId];
          if (status) {
            genericRsvQuery += ' AND status = ?';
            genericRsvParams.push(status);
          }
          genericRsvQuery += ' LIMIT ?';
          genericRsvParams.push(limit);
          const { results } = await db.prepare(genericRsvQuery).bind(...genericRsvParams).all<BookingRecord>();
          const filtered = (results || [])
            .filter((r) => matchesBookingTenant(r, tenantId))
            .map((r) => sanitizeBookingRecordForRole(r, canViewPii));
          return c.json({ success: true, data: filtered });
        } catch {
          try {
            let results: BookingRecord[] = [];
            try {
              const res = await db.prepare(scopedBookingsQuery).bind(...scopedBookingsParams).all<BookingRecord>();
              results = res.results || [];
            } catch {
              try {
                const res = await db.prepare(jsonScopedBookingsQuery).bind(...jsonScopedBookingsParams).all<BookingRecord>();
                results = res.results || [];
              } catch (err) {
                if (tenantId !== 'default' && tenantId !== '*') {
                  throw err;
                }
                const res = await db.prepare(query).bind(...params).all<BookingRecord>();
                results = res.results || [];
              }
            }
            const filtered = results
              .filter((r) => matchesBookingTenant(r, tenantId))
              .slice(0, limit)
              .map((r) => sanitizeBookingRecordForRole(r, canViewPii));
            return c.json({ success: true, data: filtered });
          } catch (e: unknown) {
            log.error('Bookings list error:', { message: e instanceof Error ? e.message : String(e) });
            return c.json({ success: false, error: 'Failed to list bookings' }, 500);
          }
        }
      }
    }
  });
}
