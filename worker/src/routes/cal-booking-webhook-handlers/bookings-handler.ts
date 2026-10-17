import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { createLogger } from '../../middleware/logger';
import { type BookingRecord } from './types';

const log = createLogger({ route: 'cal-booking-webhook' });

export function registerBookingsHandler(router: Hono<{ Bindings: Env }>): void {
  // GET /api/cal-booking-webhook/bookings — list bookings (staff/manager/owner only)
  router.get('/bookings', requireAuth(['owner', 'manager', 'staff']), async (c) => {
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
    } catch (e: unknown) {
      log.error('Bookings list error:', { message: e instanceof Error ? e.message : String(e) });
      return c.json({ success: false, error: 'Failed to list bookings' }, 500);
    }
  });
}
