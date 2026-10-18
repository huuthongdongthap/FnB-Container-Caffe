import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { createLogger } from '../../middleware/logger';
import { type BookingRecord } from './types';

const log = createLogger({ route: 'cal-booking-webhook' });

export function registerBookingsHandler(router: Hono<{ Bindings: Env }>): void {
  // GET /api/cal-booking-webhook/bookings — list bookings (staff/manager/owner only)
  router.get('/bookings', requireAuth(['owner', 'manager', 'staff', 'admin', 'waiter']), async (c) => {
    const db = c.env.AURA_DB;
    const status = c.req.query('status');
    const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '50', 10) || 50, 1), 200);

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params: unknown[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    query += ' ORDER BY start_time DESC LIMIT ?';
    params.push(limit);

    try {
      const { results } = await db.prepare(query).bind(...params).all<BookingRecord>();
      return c.json({ success: true, data: results || [] });
    } catch {
      try {
        let fallbackQuery =
          'SELECT id, cal_booking_uid AS cal_uid, customer_name AS attendee_name, customer_email AS attendee_email, COALESCE(reservation_time, date || \'T\' || time) AS start_time, COALESCE(reservation_time, date || \'T\' || time) AS end_time, status, special_requests AS metadata, created_at, updated_at FROM reservations WHERE 1=1';
        const fallbackParams: unknown[] = [];
        if (status) {
          fallbackQuery += ' AND status = ?';
          fallbackParams.push(status);
        }
        fallbackQuery += ' ORDER BY created_at DESC LIMIT ?';
        fallbackParams.push(limit);
        const { results } = await db.prepare(fallbackQuery).bind(...fallbackParams).all<BookingRecord>();
        return c.json({ success: true, data: results || [] });
      } catch {
        try {
          let canonicalQuery =
            'SELECT id, cal_booking_uid AS cal_uid, customer_name AS attendee_name, customer_email AS attendee_email, reservation_time AS start_time, reservation_time AS end_time, status, special_requests AS metadata, created_at, updated_at FROM reservations WHERE 1=1';
          const canonicalParams: unknown[] = [];
          if (status) {
            canonicalQuery += ' AND status = ?';
            canonicalParams.push(status);
          }
          canonicalQuery += ' ORDER BY created_at DESC LIMIT ?';
          canonicalParams.push(limit);
          const { results } = await db.prepare(canonicalQuery).bind(...canonicalParams).all<BookingRecord>();
          return c.json({ success: true, data: results || [] });
        } catch (e: unknown) {
          log.error('Bookings list error:', { message: e instanceof Error ? e.message : String(e) });
          return c.json({ success: false, error: 'Failed to list bookings' }, 500);
        }
      }
    }
  });
}
