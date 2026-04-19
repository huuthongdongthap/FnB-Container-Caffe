/**
 * Staff Shifts Router — Chấm công
 * Yêu cầu auth: owner | staff
 */

import { Hono } from 'hono';
import { requireAuth } from '../middleware/admin-auth.js';

export const shiftsRouter = new Hono();

function detectShiftType(dt = new Date()) {
  const h = dt.getHours();
  if (h < 11) { return 'morning'; }
  if (h < 17) { return 'afternoon'; }
  return 'evening';
}

function generateId() {
  return 'SHF_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// POST /api/shifts/clock-in
shiftsRouter.post('/clock-in', requireAuth(['owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const user = c.get('user');
  try {
    // Check if already clocked in
    const open = await db.prepare(
      'SELECT id, clock_in FROM staff_shifts WHERE staff_email = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1'
    ).bind(user.email).first();
    if (open) {
      return c.json({ success: false, error: 'Đã chấm công, chưa clock-out', shift: open }, 409);
    }

    const id = generateId();
    const now = new Date();
    await db.prepare(
      'INSERT INTO staff_shifts (id, staff_email, clock_in, shift_type) VALUES (?, ?, ?, ?)'
    ).bind(id, user.email, now.toISOString(), detectShiftType(now)).run();

    return c.json({ success: true, shift_id: id, clock_in: now.toISOString() });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/shifts/clock-out
shiftsRouter.post('/clock-out', requireAuth(['owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const user = c.get('user');
  try {
    const body = await c.req.json().catch(() => ({}));
    const open = await db.prepare(
      'SELECT id, clock_in FROM staff_shifts WHERE staff_email = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1'
    ).bind(user.email).first();
    if (!open) {
      return c.json({ success: false, error: 'Chưa clock-in' }, 404);
    }
    const now = new Date().toISOString();
    await db.prepare(
      'UPDATE staff_shifts SET clock_out = ?, notes = ? WHERE id = ?'
    ).bind(now, body.notes || null, open.id).run();
    return c.json({ success: true, shift_id: open.id, clock_out: now });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET /api/shifts/current — trạng thái ca hiện tại
shiftsRouter.get('/current', requireAuth(['owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const user = c.get('user');
  try {
    const open = await db.prepare(
      'SELECT * FROM staff_shifts WHERE staff_email = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1'
    ).bind(user.email).first();
    return c.json({ success: true, shift: open || null });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET /api/shifts?from=&to=  — lịch sử (owner: all; staff: own)
shiftsRouter.get('/', requireAuth(['owner', 'staff']), async (c) => {
  const db = c.env.AURA_DB;
  const user = c.get('user');
  try {
    const url = new URL(c.req.url);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const staffEmail = url.searchParams.get('staff_email');

    let query = 'SELECT * FROM staff_shifts WHERE 1=1';
    const params = [];

    // Staff chỉ xem được của mình
    if (user.role === 'staff') {
      query += ' AND staff_email = ?';
      params.push(user.email);
    } else if (staffEmail) {
      query += ' AND staff_email = ?';
      params.push(staffEmail);
    }
    if (from) { query += ' AND clock_in >= ?'; params.push(from); }
    if (to) { query += ' AND clock_in <= ?'; params.push(to); }
    query += ' ORDER BY clock_in DESC LIMIT 200';

    const { results } = await db.prepare(query).bind(...params).all();
    return c.json({ success: true, shifts: results || [] });
  } catch (e) {
    return c.json({ success: false, error: e.message }, 500);
  }
});
