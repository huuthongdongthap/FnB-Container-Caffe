// Subscription lifecycle handlers extracted from routes/subscriptions.ts

import type { Context } from 'hono';
import type { Env } from '../../types/env';
import type { PlanRecord, SubscriptionRecord, InvoiceRecord, JwtPayload } from './types';
import { requireAdmin } from './middleware';
import { generateId, today, nowStr, addMonths } from './helpers';
import { updateMRRSnapshot } from './mrr-calculator';
import { verifyJWT } from '../../lib/jwt';
import { createSubscriptionSchema, cancelSubscriptionSchema } from '../../lib/validators';

export async function listSubscriptions(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const authHeader = c.req.header('Authorization');
  const statusFilter = c.req.query('status');
  const zoneFilter = c.req.query('zone');

  let vendorId: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const payload = await verifyJWT(authHeader.substring(7), c.env.JWT_SECRET) as JwtPayload | null;
    if (payload && ['vendor', 'customer'].includes(payload.role || '')) {
      vendorId = payload.customerId || payload.sub || payload.id || null;
    }
  }

  let query = 'SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.container_size, p.monthly_price_vnd as plan_price, p.features FROM subscriptions s LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE 1=1';
  const params: unknown[] = [];

  if (vendorId) { query += ' AND s.customer_id = ?'; params.push(vendorId); }
  if (statusFilter) { query += ' AND s.status = ?'; params.push(statusFilter); }
  if (zoneFilter) { query += ' AND s.zone = ?'; params.push(zoneFilter); }
  query += ' ORDER BY s.created_at DESC';

  const subs = await db.prepare(query).bind(...params).all<SubscriptionRecord>();
  const results = (subs.results || []).map(s => ({
    ...s,
    plan_features: s.features ? JSON.parse(s.features) : [],
  }));

  return c.json({ success: true, data: results });
}

export async function getStatsHandler(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;

  const activeResult = await db.prepare(
    "SELECT COALESCE(SUM(amount_vnd), 0) as mrr, COUNT(*) as count FROM subscriptions WHERE status = 'active'"
  ).first<{ mrr: number; count: number }>();

  const byZone = await db.prepare(
    "SELECT zone, COUNT(*) as count, COALESCE(SUM(amount_vnd), 0) as revenue FROM subscriptions WHERE status = 'active' GROUP BY zone ORDER BY revenue DESC"
  ).all<{ zone: string; count: number; revenue: number }>();

  const byPlan = await db.prepare(
    `SELECT p.name, p.slug, COUNT(s.id) as count, COALESCE(SUM(s.amount_vnd), 0) as revenue
     FROM subscriptions s JOIN subscription_plans p ON s.plan_id = p.id
     WHERE s.status = 'active' GROUP BY p.id ORDER BY revenue DESC`
  ).all<{ name: string; slug: string; count: number; revenue: number }>();

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

  const newThisMonth = await db.prepare(
    "SELECT COUNT(*) as count FROM subscriptions WHERE status = 'active' AND created_at >= ?"
  ).bind(monthStart.toISOString()).first<{ count: number }>();

  const churned = await db.prepare(
    "SELECT COUNT(*) as count FROM subscriptions WHERE status = 'cancelled' AND updated_at >= ?"
  ).bind(monthStart.toISOString()).first<{ count: number }>();

  const avgResult = await db.prepare(
    "SELECT COALESCE(AVG(amount_vnd), 0) as avg FROM subscriptions WHERE status = 'active'"
  ).first<{ avg: number }>();

  interface Bucket {
    under_1m: number; from_1m_to_3m: number; from_3m_to_5m: number; above_5m: number;
  }
  const bucketData = await db.prepare(`
    SELECT
      COUNT(CASE WHEN amount_vnd < 1000000 THEN 1 END) as under_1m,
      COUNT(CASE WHEN amount_vnd >= 1000000 AND amount_vnd < 3000000 THEN 1 END) as from_1m_to_3m,
      COUNT(CASE WHEN amount_vnd >= 3000000 AND amount_vnd < 5000000 THEN 1 END) as from_3m_to_5m,
      COUNT(CASE WHEN amount_vnd >= 5000000 THEN 1 END) as above_5m
    FROM subscriptions WHERE status = 'active'
  `).first<Bucket>();

  const pending = await db.prepare(
    "SELECT COUNT(*) as count FROM subscriptions WHERE status IN ('pending', 'paused')"
  ).first<{ count: number }>();

  const totalEver = await db.prepare('SELECT COUNT(*) as count FROM subscriptions').first<{ count: number }>();

  const mrr = activeResult?.mrr || 0;
  const activeCount = activeResult?.count || 0;

  return c.json({
    success: true,
    data: {
      mrr_vnd: mrr,
      arr_vnd: mrr * 12,
      active_subscriptions: activeCount,
      total_contracts: totalEver?.count || 0,
      new_this_month: newThisMonth?.count || 0,
      churned_this_month: churned?.count || 0,
      churn_rate_pct: activeCount > 0 ? Math.round((churned?.count || 0) / Math.max(activeCount + (churned?.count || 0), 1) * 1000) / 10 : 0,
      avg_contract_value_vnd: Math.round(avgResult?.avg || 0),
      pending_count: pending?.count || 0,
      by_zone: byZone?.results || [],
      by_plan: byPlan?.results || [],
      mrr_buckets: {
        under_1m: bucketData?.under_1m || 0,
        from_1m_to_3m: bucketData?.from_1m_to_3m || 0,
        from_3m_to_5m: bucketData?.from_3m_to_5m || 0,
        above_5m: bucketData?.above_5m || 0,
      },
    },
  });
}

export async function getMRRTrend(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const days = parseInt(c.req.query('days') || '30', 10);

  const snapshots = await db.prepare(
    'SELECT * FROM mrr_snapshots ORDER BY snapshot_date DESC LIMIT ?'
  ).bind(days).all<{ snapshot_date: string; mrr_vnd: number; active_subscriptions: number }>();

  const results = snapshots.results || [];
  if (results.length === 0) {
    const live = await db.prepare(
      "SELECT COALESCE(SUM(amount_vnd), 0) as mrr, COUNT(*) as count FROM subscriptions WHERE status = 'active'"
    ).first<{ mrr: number; count: number }>();
    return c.json({
      success: true,
      data: { snapshots: [{ snapshot_date: today(), mrr_vnd: live?.mrr || 0, active_subscriptions: live?.count || 0 }], source: 'live' },
    });
  }

  return c.json({ success: true, data: { snapshots: results.reverse(), source: 'snapshots' } });
}

export async function getSubscription(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const sub = await db.prepare(
    'SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.container_size, p.features as plan_features FROM subscriptions s LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE s.id = ?'
  ).bind(c.req.param('id')).first<SubscriptionRecord>();

  if (!sub) return c.json({ success: false, error: 'Subscription not found' }, 404);

  const invoices = await db.prepare(
    'SELECT * FROM subscription_invoices WHERE subscription_id = ? ORDER BY created_at DESC LIMIT 5'
  ).bind(sub.id).all<InvoiceRecord>();

  return c.json({
    success: true,
    data: {
      ...sub,
      plan_features: sub.plan_features ? JSON.parse(sub.plan_features) : [],
      recent_invoices: invoices.results || [],
    },
  });
}

export async function createSubscription(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const parsed = createSubscriptionSchema.safeParse(body);
  if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);

  const plan = await db.prepare(
    'SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1'
  ).bind(body.plan_id).first<PlanRecord>();
  if (!plan) return c.json({ success: false, error: 'Plan not found or inactive' }, 400);

  const customerId = body.customer_id as string | undefined;
  if (customerId) {
    const customer = await db.prepare('SELECT id FROM customers WHERE id = ?').bind(customerId).first<{ id: string }>();
    if (!customer) return c.json({ success: false, error: 'Customer not found' }, 400);
  }

  const id = generateId('sub_');
  const periodStart = today();
  const periodEnd = addMonths(periodStart, (body.billing_cycle as string) === 'quarterly' ? 3 : (body.billing_cycle as string) === 'yearly' ? 12 : 1);
  const amount = (body.amount_vnd as number) || plan.monthly_price_vnd;

  await db.prepare(
    `INSERT INTO subscriptions (id, plan_id, customer_id, customer_name, customer_email, customer_phone,
     container_number, zone, status, billing_cycle, current_period_start, current_period_end,
     next_billing_date, amount_vnd, deposit_paid, deposit_vnd, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, body.plan_id, customerId || null, body.customer_name, body.customer_email || '', body.customer_phone,
    body.container_number || null, body.zone || 'Sky Deck', body.billing_cycle || 'monthly',
    periodStart, periodEnd, periodEnd, amount,
    body.deposit_paid ? 1 : 0, body.deposit_vnd || plan.deposit_vnd, body.notes || '', nowStr(), nowStr()
  ).run();

  // Idempotency check for first invoice
  const existingInv = await db.prepare(
    'SELECT id FROM subscription_invoices WHERE subscription_id = ? AND period_start = ?'
  ).bind(id, periodStart).first<{ id: string }>();

  if (!existingInv) {
    const invoiceId = generateId('inv_');
    await db.prepare(
      `INSERT INTO subscription_invoices (id, subscription_id, amount_vnd, status, period_start, period_end, invoice_number, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`
    ).bind(invoiceId, id, amount, periodStart, periodEnd, `INV-${Date.now().toString(36).toUpperCase()}`, nowStr()).run();
  }

  await updateMRRSnapshot(db);

  const sub = await db.prepare(
    'SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.container_size FROM subscriptions s LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE s.id = ?'
  ).bind(id).first<SubscriptionRecord>();

  return c.json({ success: true, data: sub }, 201);
}

export async function updateSubscription(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) return adminErr;

  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const id = c.req.param('id');

  const existing = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first<SubscriptionRecord>();
  if (!existing) return c.json({ success: false, error: 'Subscription not found' }, 404);

  const updates: string[] = [];
  const params: unknown[] = [];

  const updatable = ['plan_id', 'customer_name', 'customer_phone', 'customer_email', 'container_number', 'zone', 'deposit_vnd', 'deposit_paid', 'notes'];
  for (const key of updatable) {
    if (body[key] !== undefined) { updates.push(`${key} = ?`); params.push(body[key]); }
  }
  if (body.notes !== undefined) { updates.push('notes = ?'); params.push(body.notes); }

  if (updates.length === 0) return c.json({ success: false, error: 'No fields to update' }, 400);

  updates.push('updated_at = ?');
  params.push(nowStr());
  params.push(id);

  await db.prepare(`UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  const sub = await db.prepare(
    'SELECT s.*, p.name as plan_name, p.slug as plan_slug FROM subscriptions s LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE s.id = ?'
  ).bind(id).first<SubscriptionRecord>();

  return c.json({ success: true, data: sub });
}

export async function cancelSubscription(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) return adminErr;

  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const rawBody = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const parsed = cancelSubscriptionSchema.safeParse(rawBody);
  const data = parsed.success ? parsed.data : {};

  const sub = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first<SubscriptionRecord>();
  if (!sub) return c.json({ success: false, error: 'Subscription not found' }, 404);
  if (sub.status === 'cancelled') return c.json({ success: false, error: 'Already cancelled' }, 400);

  await db.prepare(
    "UPDATE subscriptions SET status = 'cancelled', cancelled_at = ?, cancellation_reason = ?, updated_at = ? WHERE id = ?"
  ).bind(nowStr(), data.reason || '', nowStr(), id).run();

  await updateMRRSnapshot(db);

  return c.json({ success: true, message: 'Subscription cancelled' });
}

export async function pauseSubscription(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) return adminErr;

  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const sub = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first<SubscriptionRecord>();
  if (!sub) return c.json({ success: false, error: 'Subscription not found' }, 404);

  await db.prepare(
    "UPDATE subscriptions SET status = 'paused', updated_at = ? WHERE id = ?"
  ).bind(nowStr(), id).run();

  await updateMRRSnapshot(db);
  return c.json({ success: true, message: 'Subscription paused' });
}

export async function resumeSubscription(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const adminErr = await requireAdmin(c);
  if (adminErr) return adminErr;

  const sub = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first<SubscriptionRecord>();
  if (!sub) return c.json({ success: false, error: 'Subscription not found' }, 404);
  if (sub.status !== 'paused') {
    return c.json({ success: false, error: 'Subscription is not paused' }, 400);
  }

  const pauseStart = sub.paused_at ? new Date(sub.paused_at) : new Date(sub.updated_at || sub.created_at);
  const pauseDays = Math.max(0, Math.ceil((Date.now() - pauseStart.getTime()) / 86400000));
  const currentEnd = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
  const newEnd = new Date(currentEnd);
  newEnd.setDate(newEnd.getDate() + pauseDays);
  const newPeriodEnd = newEnd.toISOString().slice(0, 10);

  await db.prepare(
    "UPDATE subscriptions SET status = 'active', current_period_end = ?, next_billing_date = ?, updated_at = ? WHERE id = ?"
  ).bind(newPeriodEnd, newPeriodEnd, nowStr(), id).run();

  await updateMRRSnapshot(db);
  return c.json({ success: true, message: 'Subscription resumed', new_period_end: newPeriodEnd });
}

export async function deleteSubscription(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) return adminErr;

  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const sub = await db.prepare('SELECT status FROM subscriptions WHERE id = ?').bind(id).first<{ status: string }>();
  if (!sub) return c.json({ success: false, error: 'Subscription not found' }, 404);
  if (sub.status === 'active') {
    return c.json({ success: false, error: 'Cannot delete active subscription — use cancel endpoint' }, 400);
  }

  await db.prepare('DELETE FROM subscription_invoices WHERE subscription_id = ?').bind(id).run();
  await db.prepare('DELETE FROM subscriptions WHERE id = ?').bind(id).run();

  return c.json({ success: true, message: 'Subscription deleted' });
}
