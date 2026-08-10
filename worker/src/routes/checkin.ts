/**
 * Checkin Routes — /api/checkin
 * Check-in rewards with staff approval flow.
 *
 * SOLO-OPC MODE: tenant isolation intentionally bypassed.
 * In single-tenant deployment there is no cross-tenant boundary — all
 * customers and checkins belong to the single OPC instance.
 * If multi-tenancy is later introduced, add a `tenant_id` column and
 * filter WHERE tenant_id = ? in every query below.
 */

import { Hono } from 'hono';
import { checkinSchema } from '../lib/validators';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';

/**
 * Solo-OPC marker — explicit single-tenant bypass.
 * Every route below intentionally skips tenant-id filtering.
 */
const SOLO_OPC = true;

/** CSPRNG-suffixed checkin ID — replaces Math.random() (predictable / collidable) */
function makeCheckinId(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const rand = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return (`ci_${Date.now().toString(36)}${rand}`);
}

interface CheckinRecord {
  id: string;
  customer_id: string;
  customer_name: string;
  checkin_date: string;
  checkin_time: string;
  reward_amount: number;
  status: 'pending' | 'approved' | 'rejected';
  staff_id: string | null;
  created_at: string;
}

interface CheckinInput {
  customer_id: string;
  customer_name?: string;
}

export const checkinRouter = new Hono<{ Bindings: Env }>();

// POST /api/checkin — customer checks in (creates pending reward)
// Solo-OPC: no tenant isolation (SOLO_OPC = true)
checkinRouter.post('/', async(c) => {
  const db = c.env.AURA_DB;
  const body = await c.req.json() as Record<string, unknown>;
  const parsed = checkinSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }
  const data = parsed.data;

  // Prevent duplicate check-in today
  const today = new Date().toISOString().slice(0, 10);
  const existing = await db.prepare(
    'SELECT id FROM checkins WHERE customer_id = ? AND checkin_date = ?'
  ).bind(data.customer_id, today).first<{ id: string }>();

  if (existing) {
    return c.json({ success: false, error: 'Already checked in today' }, 400);
  }

  const customer = await db.prepare(
    'SELECT id, name FROM customers WHERE id = ?'
  ).bind(data.customer_id).first<{ id: string; name: string }>();

  const id = makeCheckinId();
  const now = new Date().toISOString();

  await db.prepare(
    'INSERT INTO checkins (id, customer_id, customer_name, checkin_date, checkin_time, reward_amount, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id,
    data.customer_id,
    data.customer_name || customer?.name || 'Unknown',
    today,
    now,
    5000, // Default reward: 5,000 VND
    'pending',
    now
  ).run();

  const row = await db.prepare('SELECT * FROM checkins WHERE id = ?').bind(id).first<CheckinRecord>();
  return c.json({ success: true, data: row }, 201);
});

// PATCH /api/checkin/:id/approve — staff approves check-in reward
// Solo-OPC: no tenant isolation guard (SOLO_OPC = true)
checkinRouter.patch('/:id/approve', requireAuth(['owner', 'staff']), async(c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const checkin = await db.prepare('SELECT * FROM checkins WHERE id = ?').bind(id).first<CheckinRecord>();
  if (!checkin) {
    return c.json({ success: false, error: 'Checkin not found' }, 404);
  }
  if (checkin.status !== 'pending') {
    return c.json({ success: false, error: `Already ${checkin.status}` }, 400);
  }

  await db.prepare(
    'UPDATE checkins SET status = ? WHERE id = ?'
  ).bind('approved', id).run();

  // Add cashback reward
  await db.prepare(
    'UPDATE customers SET cashback_balance = COALESCE(cashback_balance, 0) + ? WHERE id = ?'
  ).bind(checkin.reward_amount, checkin.customer_id).run();

  const row = await db.prepare('SELECT * FROM checkins WHERE id = ?').bind(id).first<CheckinRecord>();
  return c.json({ success: true, data: row });
});

// PATCH /api/checkin/:id/reject — staff rejects check-in
// Solo-OPC: no tenant isolation guard (SOLO_OPC = true)
checkinRouter.patch('/:id/reject', requireAuth(['owner', 'staff']), async(c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const checkin = await db.prepare('SELECT * FROM checkins WHERE id = ?').bind(id).first<CheckinRecord>();
  if (!checkin) {
    return c.json({ success: false, error: 'Checkin not found' }, 404);
  }

  await db.prepare('UPDATE checkins SET status = ? WHERE id = ?').bind('rejected', id).run();

  const row = await db.prepare('SELECT * FROM checkins WHERE id = ?').bind(id).first<CheckinRecord>();
  return c.json({ success: true, data: row });
});

// GET /api/checkin — list checkins (filterable)
// Solo-OPC: no tenant isolation filter (SOLO_OPC = true)
checkinRouter.get('/', async(c) => {
  const db = c.env.AURA_DB;
  const status = c.req.query('status');
  const date = c.req.query('date');
  const customerId = c.req.query('customer_id');

  let query = 'SELECT * FROM checkins WHERE 1=1';
  const params: unknown[] = [];

  if (status) {
    query += ' AND status = ?'; params.push(status);
  }
  if (date) {
    query += ' AND checkin_date = ?'; params.push(date);
  }
  if (customerId) {
    query += ' AND customer_id = ?'; params.push(customerId);
  }
  query += ' ORDER BY created_at DESC LIMIT 100';

  const { results } = await db.prepare(query).bind(...params).all<CheckinRecord>();
  return c.json({ success: true, data: results || [] });
});
