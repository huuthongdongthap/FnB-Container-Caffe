import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { getTenantId } from '../../middleware/tenant';
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

export function registerBookingsHandler(router: Hono<{ Bindings: Env }>): void {
  // GET /api/cal-booking-webhook/bookings — list bookings (staff/manager/supervisor/owner only)
  router.get('/bookings', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin', 'waiter']), async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = (getTenantId(c) || '').trim() || 'default';
    const status = c.req.query('status');
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10) || 50, 1), 200);

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params: unknown[] = [];
    let scopedBookingsQuery = "SELECT * FROM bookings WHERE 1=1 AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)";
    const scopedBookingsParams: unknown[] = [tenantId, tenantId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
      scopedBookingsQuery += ' AND status = ?';
      scopedBookingsParams.push(status);
    }
    query += ' ORDER BY start_time DESC LIMIT ?';
    params.push(limit);
    scopedBookingsQuery += ' ORDER BY start_time DESC LIMIT ?';
    scopedBookingsParams.push(limit);

    try {
      let canonicalQuery =
        "SELECT id, cal_booking_uid AS cal_uid, customer_name AS attendee_name, customer_email AS attendee_email, COALESCE(reservation_time, date || 'T' || time) AS start_time, COALESCE(reservation_time, date || 'T' || time) AS end_time, status, special_requests AS metadata, tenant_id, created_at, updated_at FROM reservations WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)";
      const canonicalParams: unknown[] = [tenantId, tenantId];
      if (status) {
        canonicalQuery += ' AND status = ?';
        canonicalParams.push(status);
      }
      canonicalQuery += ' ORDER BY created_at DESC LIMIT ?';
      canonicalParams.push(limit);
      const { results } = await db.prepare(canonicalQuery).bind(...canonicalParams).all<BookingRecord>();
      const filtered = (results || []).filter((r) => matchesBookingTenant(r, tenantId));
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
        const filtered = (results || []).filter((r) => matchesBookingTenant(r, tenantId));
        return c.json({ success: true, data: filtered });
      } catch {
        try {
          let results: BookingRecord[] = [];
          try {
            const res = await db.prepare(scopedBookingsQuery).bind(...scopedBookingsParams).all<BookingRecord>();
            results = res.results || [];
          } catch {
            const res = await db.prepare(query).bind(...params).all<BookingRecord>();
            results = res.results || [];
          }
          const filtered = results.filter((r) => matchesBookingTenant(r, tenantId));
          return c.json({ success: true, data: filtered });
        } catch (e: unknown) {
          log.error('Bookings list error:', { message: e instanceof Error ? e.message : String(e) });
          return c.json({ success: false, error: 'Failed to list bookings' }, 500);
        }
      }
    }
  });
}
