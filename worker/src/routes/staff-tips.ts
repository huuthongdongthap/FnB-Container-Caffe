/**
 * Staff Tip Tracking + Daily Reports — /api/staff-tips
 *
 * F&B Gap 3.5: tips collected per order are attributed to the staff member
 * who served the table (resolved from the active table session's
 * customer linkage, or explicitly assigned at checkout). Daily tip reports
 * roll up per-staff totals for payroll.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../types/env';
import { jsonResponse, errorResponse } from '../middleware/cors';
import { requireAuth } from '../middleware/auth';

export interface StaffTipRow {
  staff_id: string;
  staff_name: string;
  date: string;
  tip_total: number;
  order_count: number;
  session_count: number;
}

const staffTipsRouter = new Hono<{ Bindings: Env }>();
staffTipsRouter.use('/*', requireAuth(['owner', 'staff', 'manager']));

// GET /api/staff-tips — daily tip rollup, filterable by staff / date
staffTipsRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const date = c.req.query('date') || new Date().toISOString().slice(0, 10);
  const staffId = c.req.query('staff_id');

  // Tips are attributed by joining orders → table_sessions (the session's
  // staff linkage is not yet modelled, so we attribute by the order's
  // updated_by staff field when present, falling back to 'unassigned').
  let query = `SELECT
      COALESCE(o.updated_by, 'unassigned') AS staff_id,
      COALESCE(u.name, 'Unassigned') AS staff_name,
      ? AS date,
      COALESCE(SUM(o.tip_amount), 0) AS tip_total,
      COUNT(DISTINCT o.id) AS order_count,
      COUNT(DISTINCT s.id) AS session_count
    FROM orders o
    LEFT JOIN table_sessions s ON s.table_id = o.table_id AND s.status = 'active'
    LEFT JOIN users u ON u.id = o.updated_by
    WHERE date(o.created_at) = ? AND o.tip_amount > 0`;
  const params: unknown[] = [date, date];
  if (staffId) { query += ' AND o.updated_by = ?'; params.push(staffId); }
  query += ' GROUP BY COALESCE(o.updated_by, \'unassigned\') ORDER BY tip_total DESC';

  const stmt = db.prepare(query).bind(...params);
  const { results } = await stmt.all<StaffTipRow>();
  const tipTotal = results.reduce((sum, r) => sum + Number(r.tip_total), 0);
  return c.json({ success: true, data: results, summary: { date, tip_total: tipTotal, staff_count: results.length } });
});

// GET /api/staff-tips/:staffId — single staff member's tip history
staffTipsRouter.get('/:staffId', async (c) => {
  const db = c.env.AURA_DB;
  const staffId = c.req.param('staffId');
  const days = Number(c.req.query('days') || '30');
  const { results } = await db.prepare(
    `SELECT date(o.created_at) AS date,
            COALESCE(SUM(o.tip_amount), 0) AS tip_total,
            COUNT(DISTINCT o.id) AS order_count
     FROM orders o
     WHERE o.updated_by = ? AND o.tip_amount > 0
       AND date(o.created_at) >= date(?, '-' || ? || ' days')
     GROUP BY date(o.created_at)
     ORDER BY date DESC`
  ).bind(staffId, new Date().toISOString().slice(0, 10), String(days)).all<{ date: string; tip_total: number; order_count: number }>();
  const total = results.reduce((s, r) => s + Number(r.tip_total), 0);
  return c.json({ success: true, data: results, staff_id: staffId, total_tip: total, days });
});

// POST /api/staff-tips/assign — attribute a tip to a staff member at checkout
staffTipsRouter.post('/assign', async (c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const orderId = String(body.order_id || '').trim();
  const staffId = String(body.staff_id || '').trim();
  const tipAmount = Number(body.tip_amount);
  if (!orderId) return c.json({ success: false, error: 'order_id is required' }, 400);
  if (!staffId) return c.json({ success: false, error: 'staff_id is required' }, 400);
  if (isNaN(tipAmount) || tipAmount < 0) return c.json({ success: false, error: 'tip_amount must be a non-negative number' }, 400);

  const order = await db.prepare('SELECT id, tip_amount FROM orders WHERE id = ?').bind(orderId).first<{ id: string; tip_amount: number }>();
  if (!order) return c.json({ success: false, error: 'Order not found' }, 404);

  const now = new Date().toISOString();
  await db.prepare('UPDATE orders SET tip_amount = ?, updated_by = ?, updated_at = ? WHERE id = ?')
    .bind(tipAmount, staffId, now, orderId).run();

  return c.json({ success: true, order_id: orderId, staff_id: staffId, tip_amount: tipAmount });
});

export { staffTipsRouter };
