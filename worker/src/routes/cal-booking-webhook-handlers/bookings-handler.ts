import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { type BookingRecord } from './types';

export function registerBookingsHandler(router: Hono<{ Bindings: Env }>): void {
  // GET /api/cal-booking-webhook/bookings — list bookings
  router.get('/bookings', async (c) => {
    const db = c.env.AURA_DB;
    const status = c.req.query('status');
    const limit = parseInt(c.req.query('limit') || '50', 10);

    let query = 'SELECT * FROM bookings WHERE 1=1';
    const params: unknown[] = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    query += ' ORDER BY start_time DESC LIMIT ?';
    params.push(limit);

    const { results } = await db.prepare(query).bind(...params).all<BookingRecord>();
    return c.json({ success: true, data: results || [] });
  });
}