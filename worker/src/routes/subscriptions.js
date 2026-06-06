/**
 * /api/subscriptions — MRR Container Lease Subscription System
 * Model: Rent container units to F&B vendors on monthly recurring contracts
 *
 * Endpoints:
 *   GET    /api/subscriptions/plans              — List all active lease plans
 *   GET    /api/subscriptions/plans/:id          — Get single plan details
 *   POST   /api/subscriptions/plans              — Create plan (admin)
 *   PUT    /api/subscriptions/plans/:id          — Update plan (admin)
 *
 *   GET    /api/subscriptions                    — List all subscriptions
 *   GET    /api/subscriptions/stats              — MRR + churn KPIs
 *   GET    /api/subscriptions/mrr                — MRR trend (daily snapshots)
 *   GET    /api/subscriptions/:id                — Get subscription details
 *   POST   /api/subscriptions                    — Create new subscription (new vendor)
 *   PUT    /api/subscriptions/:id                — Update subscription
 *   POST   /api/subscriptions/:id/cancel         — Cancel subscription
 *   POST   /api/subscriptions/:id/pause          — Pause subscription
 *   POST   /api/subscriptions/:id/resume         — Resume subscription
 *   DELETE /api/subscriptions/:id                — Hard delete (admin only)
 *
 *   GET    /api/subscriptions/invoices           — List invoices
 *   POST   /api/subscriptions/invoices/:id/pay   — Mark invoice as paid
 *   POST   /api/subscriptions/invoices/generate  — Generate monthly invoices (cron)
 *
 * Auth: public for plans, requireAuth for vendor/admin actions
 */
import { Hono } from 'hono';
import { verifyJWT } from './auth.js';

export const subscriptionsRouter = new Hono();

// ═══════════════════════════════════════════════════════
// TYPES / HELPERS
// ═══════════════════════════════════════════════════════

function generateId(prefix, len = 8) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 2 + len);
}

function today() { return new Date().toISOString().slice(0, 10); }
function now() { return new Date().toISOString(); }
function addMonths(dateStr, months) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

async function requireAdmin(c) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const token = authHeader.substring(7);
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {return c.json({ success: false, error: 'Token không hợp lệ' }, 401);}
  if (!['owner', 'admin', 'staff'].includes(payload.role)) {
    return c.json({ success: false, error: 'Forbidden — admin only' }, 403);
  }
  return null; // no error
}

async function requireVendor(c) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const token = authHeader.substring(7);
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {return c.json({ success: false, error: 'Token không hợp lệ' }, 401);}
  if (!['owner', 'admin', 'vendor', 'customer'].includes(payload.role)) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  return null;
}

// ═══════════════════════════════════════════════════════
// SUBSCRIPTION PLANS — Container Lease Plans
// ═══════════════════════════════════════════════════════

// GET /api/subscriptions/plans — Public list
subscriptionsRouter.get('/plans', async (c) => {
  const db = c.env.AURA_DB;
  const includeInactive = c.req.query('all') === '1';

  let query = 'SELECT * FROM subscription_plans';
  if (!includeInactive) {query += ' WHERE is_active = 1';}
  query += ' ORDER BY sort_order ASC, monthly_price_vnd ASC';

  const plans = await db.prepare(query).all();
  const results = (plans.results || []).map(p => ({
    ...p,
    features: p.features ? JSON.parse(p.features) : [],
  }));
  return c.json({ success: true, data: results });
});

// GET /api/subscriptions/plans/:id
subscriptionsRouter.get('/plans/:id', async (c) => {
  const db = c.env.AURA_DB;
  const plan = await db.prepare(
    'SELECT * FROM subscription_plans WHERE id = ?'
  ).bind(c.req.param('id')).first();

  if (!plan) {return c.json({ success: false, error: 'Plan not found' }, 404);}

  return c.json({ success: true, data: { ...plan, features: plan.features ? JSON.parse(plan.features) : [] } });
});

// POST /api/subscriptions/plans — Create plan (admin)
subscriptionsRouter.post('/plans', async (c) => {
  const adminErr = await requireAdmin(c);
  if (adminErr) {return adminErr;}

  const db = c.env.AURA_DB;
  const body = await c.req.json();

  const id = generateId('plan_');
  const nowIso = now();

  await db.prepare(
    `INSERT INTO subscription_plans (id, name, slug, description, container_size,
     monthly_price_vnd, deposit_vnd, features, max_occupants, is_popular, is_active, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.name,
    body.slug,
    body.description || '',
    body.container_size || '20ft',
    body.monthly_price_vnd,
    body.deposit_vnd || 0,
    JSON.stringify(body.features || []),
    body.max_occupants || 1,
    body.is_popular ? 1 : 0,
    body.is_active !== undefined ? (body.is_active ? 1 : 0) : 1,
    body.sort_order || 0,
    nowIso, nowIso
  ).run();

  const plan = await db.prepare('SELECT * FROM subscription_plans WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: { ...plan, features: plan.features ? JSON.parse(plan.features) : [] } }, 201);
});

// PUT /api/subscriptions/plans/:id — Update plan (admin)
subscriptionsRouter.put('/plans/:id', async (c) => {
  const adminErr = await requireAdmin(c);
  if (adminErr) {return adminErr;}

  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const id = c.req.param('id');

  const existing = await db.prepare('SELECT * FROM subscription_plans WHERE id = ?').bind(id).first();
  if (!existing) {return c.json({ success: false, error: 'Plan not found' }, 404);}

  await db.prepare(
    `UPDATE subscription_plans SET name=?, slug=?, description=?, container_size=?,
     monthly_price_vnd=?, deposit_vnd=?, features=?, max_occupants=?, is_popular=?, is_active=?, sort_order=?, updated_at=?
     WHERE id = ?`
  ).bind(
    body.name ?? existing.name,
    body.slug ?? existing.slug,
    body.description ?? existing.description,
    body.container_size ?? existing.container_size,
    body.monthly_price_vnd ?? existing.monthly_price_vnd,
    body.deposit_vnd ?? existing.deposit_vnd,
    JSON.stringify(body.features ?? JSON.parse(existing.features || '[]')),
    body.max_occupants ?? existing.max_occupants,
    body.is_popular !== undefined ? (body.is_popular ? 1 : 0) : existing.is_popular,
    body.is_active !== undefined ? (body.is_active ? 1 : 0) : existing.is_active,
    body.sort_order ?? existing.sort_order,
    now(),
    id
  ).run();

  const plan = await db.prepare('SELECT * FROM subscription_plans WHERE id = ?').bind(id).first();
  return c.json({ success: true, data: { ...plan, features: plan.features ? JSON.parse(plan.features) : [] } });
});

// ═══════════════════════════════════════════════════════
// SUBSCRIPTIONS — Container Lease Contracts
// ═══════════════════════════════════════════════════════

// GET /api/subscriptions — List all (admin: all, vendor: own)
subscriptionsRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const authHeader = c.req.header('Authorization');
  const statusFilter = c.req.query('status');
  const zoneFilter = c.req.query('zone');

  // If authenticated, check role
  let vendorId = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const payload = await verifyJWT(authHeader.substring(7), c.env.JWT_SECRET);
    if (payload && ['vendor', 'customer'].includes(payload.role)) {
      vendorId = payload.customerId || payload.sub || payload.id;
    }
  }

  let query = 'SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.container_size, p.monthly_price_vnd as plan_price, p.features FROM subscriptions s LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE 1=1';
  const params = [];

  if (vendorId) {
    query += ' AND s.customer_id = ?';
    params.push(vendorId);
  }
  if (statusFilter) { query += ' AND s.status = ?'; params.push(statusFilter); }
  if (zoneFilter) { query += ' AND s.zone = ?'; params.push(zoneFilter); }
  query += ' ORDER BY s.created_at DESC';

  const subs = await db.prepare(query).bind(...params).all();
  const results = (subs.results || []).map(s => ({
    ...s,
    plan_features: s.features ? JSON.parse(s.features) : [],
  }));

  return c.json({ success: true, data: results });
});

// GET /api/subscriptions/stats — MRR + Churn KPIs
subscriptionsRouter.get('/stats', async (c) => {
  const db = c.env.AURA_DB;
  const period = c.req.query('period') || 'month'; // month, quarter, year

  // Active MRR
  const activeResult = await db.prepare(
    `SELECT COALESCE(SUM(amount_vnd), 0) as mrr, COUNT(*) as count
     FROM subscriptions WHERE status = 'active'`
  ).first();

  // By zone breakdown
  const byZone = await db.prepare(
    `SELECT zone, COUNT(*) as count, COALESCE(SUM(amount_vnd), 0) as revenue
     FROM subscriptions WHERE status = 'active' GROUP BY zone ORDER BY revenue DESC`
  ).all();

  // By plan breakdown
  const byPlan = await db.prepare(
    `SELECT p.name, p.slug, COUNT(s.id) as count, COALESCE(SUM(s.amount_vnd), 0) as revenue
     FROM subscriptions s JOIN subscription_plans p ON s.plan_id = p.id
     WHERE s.status = 'active' GROUP BY p.id ORDER BY revenue DESC`
  ).all();

  // New this month
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const newThisMonth = await db.prepare(
    'SELECT COUNT(*) as count FROM subscriptions WHERE status = \'active\' AND created_at >= ?'
  ).bind(monthStart.toISOString()).first();

  // Churn this month
  const churned = await db.prepare(
    'SELECT COUNT(*) as count FROM subscriptions WHERE status = \'cancelled\' AND updated_at >= ?'
  ).bind(monthStart.toISOString()).first();

  // Avg contract value
  const avgResult = await db.prepare(
    'SELECT COALESCE(AVG(amount_vnd), 0) as avg FROM subscriptions WHERE status = \'active\''
  ).first();

// M8: Real MRR bucket counts from actual subscription amounts
const bucketData = await db.prepare(`
SELECT
COUNT(CASE WHEN amount_vnd < 1000000 THEN 1 END) as under_1m,
COUNT(CASE WHEN amount_vnd >= 1000000 AND amount_vnd < 3000000 THEN 1 END) as from_1m_to_3m,
COUNT(CASE WHEN amount_vnd >= 3000000 AND amount_vnd < 5000000 THEN 1 END) as from_3m_to_5m,
COUNT(CASE WHEN amount_vnd >= 5000000 THEN 1 END) as above_5m
FROM subscriptions WHERE status = 'active'
`).first();

  // Pending / paused
  const pending = await db.prepare(
    'SELECT COUNT(*) as count FROM subscriptions WHERE status IN (\'pending\', \'paused\')'
  ).first();

  // Total contracts ever
  const totalEver = await db.prepare(
    'SELECT COUNT(*) as count FROM subscriptions'
  ).first();

  const mrr = activeResult?.mrr || 0;
  const activeCount = activeResult?.count || 0;

  return c.json({
    success: true,
    data: {
      period,
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
      // MRR bucket breakdown
  mrr_buckets: {
    under_1m: bucketData?.under_1m || 0,
    from_1m_to_3m: bucketData?.from_1m_to_3m || 0,
    from_3m_to_5m: bucketData?.from_3m_to_5m || 0,
    above_5m: bucketData?.above_5m || 0
  },
    }
  });
});

// GET /api/subscriptions/mrr — MRR trend from snapshots
subscriptionsRouter.get('/mrr', async (c) => {
  const db = c.env.AURA_DB;
  const days = parseInt(c.req.query('days')) || 30;

  const snapshots = await db.prepare(
    'SELECT * FROM mrr_snapshots ORDER BY snapshot_date DESC LIMIT ?'
  ).bind(days).all();

  // If no snapshots, compute live MRR as fallback
  const results = (snapshots.results || []);
  if (results.length === 0) {
    const live = await db.prepare(
      'SELECT COALESCE(SUM(amount_vnd), 0) as mrr, COUNT(*) as count FROM subscriptions WHERE status = \'active\''
    ).first();
    return c.json({
      success: true,
      data: {
        snapshots: [{ snapshot_date: today(), mrr_vnd: live?.mrr || 0, active_subscriptions: live?.count || 0 }],
        source: 'live',
      }
    });
  }

  return c.json({ success: true, data: { snapshots: results.reverse(), source: 'snapshots' } });
});

// GET /api/subscriptions/:id
subscriptionsRouter.get('/:id', async (c) => {
  const db = c.env.AURA_DB;
  const sub = await db.prepare(
    'SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.container_size, p.features as plan_features FROM subscriptions s LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE s.id = ?'
  ).bind(c.req.param('id')).first();

  if (!sub) {return c.json({ success: false, error: 'Subscription not found' }, 404);}

  // Get recent invoices
  const invoices = await db.prepare(
    'SELECT * FROM subscription_invoices WHERE subscription_id = ? ORDER BY created_at DESC LIMIT 5'
  ).bind(sub.id).all();

  return c.json({
    success: true,
    data: {
      ...sub,
      plan_features: sub.plan_features ? JSON.parse(sub.plan_features) : [],
      recent_invoices: invoices.results || [],
    }
  });
});

// POST /api/subscriptions — Create new subscription (new vendor lease)
subscriptionsRouter.post('/', async (c) => {
  let vendorErr;
  if (c.req.header('Authorization')) {
    vendorErr = await requireVendor(c);
    if (vendorErr) {return vendorErr;}
  }

  const db = c.env.AURA_DB;
  const body = await c.req.json();

  // Validate plan exists
  const plan = await db.prepare(
    'SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1'
  ).bind(body.plan_id).first();
  if (!plan) {return c.json({ success: false, error: 'Plan not found or inactive' }, 400);}

  // Validate customer (link to existing or create reference)
  const customerId = body.customer_id;
  if (customerId) {
    const customer = await db.prepare('SELECT id FROM customers WHERE id = ?').bind(customerId).first();
    if (!customer) {return c.json({ success: false, error: 'Customer not found' }, 400);}
  }

  const id = generateId('sub_');
  const periodStart = today();
  const periodEnd = addMonths(periodStart, body.billing_cycle === 'quarterly' ? 3 : body.billing_cycle === 'yearly' ? 12 : 1);
  const amount = body.amount_vnd || plan.monthly_price_vnd;

  await db.prepare(
    `INSERT INTO subscriptions (id, plan_id, customer_id, customer_name, customer_email, customer_phone,
     container_number, zone, status, billing_cycle, current_period_start, current_period_end,
     next_billing_date, amount_vnd, deposit_paid, deposit_vnd, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    body.plan_id,
    customerId || null,
    body.customer_name,
    body.customer_email || '',
    body.customer_phone,
    body.container_number || null,
    body.zone || 'Sky Deck',
    body.billing_cycle || 'monthly',
    periodStart,
    periodEnd,
    periodEnd,
    amount,
    body.deposit_paid ? 1 : 0,
    body.deposit_vnd || plan.deposit_vnd,
    body.notes || '',
    now(), now()
  ).run();

// Create first invoice
// H19: Idempotency — skip if invoice already exists for this period
const existingInv = await db.prepare(
  "SELECT id FROM subscription_invoices WHERE subscription_id = ? AND period_start = ?"
).bind(subId, periodStart).first();
if (existingInv) {
  return c.json({ success: true, data: existingInv, skipped: true });
}
const invoiceId = generateId('inv_');
await db.prepare(
  `INSERT INTO subscription_invoices (id, subscription_id, amount_vnd, status, period_start, period_end, invoice_number, created_at)
   VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`
).bind(invoiceId, id, amount, periodStart, periodEnd,
  `INV-${Date.now().toString(36).toUpperCase()}`, now()).run();

  // Update MRR snapshot
  await updateMRRSnapshot(db);

  const sub = await db.prepare(
    'SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.container_size FROM subscriptions s LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE s.id = ?'
  ).bind(id).first();

  return c.json({ success: true, data: sub }, 201);
});

// PUT /api/subscriptions/:id — Update subscription
subscriptionsRouter.put('/:id', async (c) => {
  const adminErr = await requireAdmin(c);
  if (adminErr) {return adminErr;}

  const db = c.env.AURA_DB;
  const body = await c.req.json();
  const id = c.req.param('id');

  const existing = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first();
  if (!existing) {return c.json({ success: false, error: 'Subscription not found' }, 404);}

  const updates = [];
  const params = [];

  const updatable = ['plan_id','customer_name','customer_phone','customer_email','container_number','zone','deposit_vnd','deposit_paid','notes'];
  for (const key of updatable) {
    if (body[key] !== undefined) { updates.push(`${key} = ?`); params.push(body[key]); }
  }
  if (body.notes !== undefined) { updates.push('notes = ?'); params.push(body.notes); }

  if (updates.length === 0) {return c.json({ success: false, error: 'No fields to update' }, 400);}

  updates.push('updated_at = ?');
  params.push(now());
  params.push(id);

  await db.prepare(`UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();

  const sub = await db.prepare(
    'SELECT s.*, p.name as plan_name, p.slug as plan_slug FROM subscriptions s LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE s.id = ?'
  ).bind(id).first();

  return c.json({ success: true, data: sub });
});

// POST /api/subscriptions/:id/cancel
subscriptionsRouter.post('/:id/cancel', async (c) => {
  const adminErr = await requireAdmin(c);
  if (adminErr) {return adminErr;}

  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const sub = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first();
  if (!sub) {return c.json({ success: false, error: 'Subscription not found' }, 404);}
  if (sub.status === 'cancelled') {return c.json({ success: false, error: 'Already cancelled' }, 400);}

  await db.prepare(
    'UPDATE subscriptions SET status = \'cancelled\', cancelled_at = ?, cancellation_reason = ?, updated_at = ? WHERE id = ?'
  ).bind(now(), body.reason || '', now(), id).run();

  await updateMRRSnapshot(db);

  return c.json({ success: true, message: 'Subscription cancelled' });
});

// POST /api/subscriptions/:id/pause
subscriptionsRouter.post('/:id/pause', async (c) => {
  const adminErr = await requireAdmin(c);
  if (adminErr) {return adminErr;}

  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const sub = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first();
  if (!sub) {return c.json({ success: false, error: 'Subscription not found' }, 404);}

  await db.prepare(
    'UPDATE subscriptions SET status = \'paused\', updated_at = ? WHERE id = ?'
  ).bind(now(), id).run();

  await updateMRRSnapshot(db);

  return c.json({ success: true, message: 'Subscription paused' });
});

// POST /api/subscriptions/:id/resume
subscriptionsRouter.post('/:id/resume', async (c) => {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const adminErr = await requireAdmin(c);
  if (adminErr) {return adminErr;}

  // H21: Extend by pause duration — no credit lost
  const sub = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first();
if (!sub) return c.json({ success: false, error: 'Subscription not found' }, 404);
if (sub.status !== 'paused') {
  return c.json({ success: false, error: 'Subscription is not paused' }, 400);
}
const pauseStart = sub.paused_at ? new Date(sub.paused_at) : new Date(sub.updated_at || sub.created_at);
const pauseDays = Math.max(0, Math.ceil((Date.now() - pauseStart.getTime()) / 86400000));
const remaining = pauseDays;
const currentEnd = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
const newEnd = new Date(currentEnd);  newEnd.setDate(newEnd.getDate() + remaining);
  const newPeriodEnd = newEnd.toISOString().slice(0, 10);

  await db.prepare(
    'UPDATE subscriptions SET status = \'active\', current_period_end = ?, next_billing_date = ?, updated_at = ? WHERE id = ?'
  ).bind(newPeriodEnd, newPeriodEnd, now(), id).run();
  await updateMRRSnapshot(db);
  return c.json({ success: true, message: 'Subscription resumed', new_period_end: newPeriodEnd });
});

// DELETE /api/subscriptions/:id
subscriptionsRouter.delete('/:id', async (c) => {
  const adminErr = await requireAdmin(c);
  if (adminErr) {return adminErr;}

  const db = c.env.AURA_DB;
  const id = c.req.param('id');

  const sub = await db.prepare('SELECT status FROM subscriptions WHERE id = ?').bind(id).first();
  if (!sub) {return c.json({ success: false, error: 'Subscription not found' }, 404);}

  // Don't allow deleting active contracts — cancel instead
  if (sub.status === 'active') {
    return c.json({ success: false, error: 'Cannot delete active subscription — use cancel endpoint' }, 400);
  }

  await db.prepare('DELETE FROM subscription_invoices WHERE subscription_id = ?').bind(id).run();
  await db.prepare('DELETE FROM subscriptions WHERE id = ?').bind(id).run();

  return c.json({ success: true, message: 'Subscription deleted' });
});

// ═══════════════════════════════════════════════════════
// INVOICES
// ═══════════════════════════════════════════════════════

// GET /api/subscriptions/invoices
subscriptionsRouter.get('/invoices/list', async (c) => {
  const db = c.env.AURA_DB;
  const status = c.req.query('status');
  const subId = c.req.query('subscription_id');

  let query = 'SELECT i.*, s.customer_name, p.name as plan_name FROM subscription_invoices i LEFT JOIN subscriptions s ON i.subscription_id = s.id LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE 1=1';
  const params = [];
  if (status) { query += ' AND i.status = ?'; params.push(status); }
  if (subId) { query += ' AND i.subscription_id = ?'; params.push(subId); }
  query += ' ORDER BY i.created_at DESC LIMIT 100';

  const invoices = await db.prepare(query).bind(...params).all();
  return c.json({ success: true, data: invoices.results || [] });
});

// POST /api/subscriptions/invoices/:id/pay
subscriptionsRouter.post('/invoices/:id/pay', async (c) => {
  const adminErr = await requireAdmin(c);
  if (adminErr) {return adminErr;}

  const db = c.env.AURA_DB;
  const invoiceId = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const invoice = await db.prepare(
    'SELECT * FROM subscription_invoices WHERE id = ?'
  ).bind(invoiceId).first();

  if (!invoice) {return c.json({ success: false, error: 'Invoice not found' }, 404);}
  if (invoice.status === 'paid') {return c.json({ success: false, error: 'Already paid' }, 400);}

  await db.prepare(
    'UPDATE subscription_invoices SET status = \'paid\', paid_at = ?, payment_method = ?, payment_ref = ? WHERE id = ?'
  ).bind(now(), body.payment_method || 'bank_transfer', body.payment_ref || '', invoiceId).run();

  // Extend subscription period
  await db.prepare(
    `UPDATE subscriptions SET current_period_start = current_period_end,
     current_period_end = date(current_period_end, '+1 month'),
     next_billing_date = date(current_period_end, '+1 month'),
     updated_at = ? WHERE id = ?`
  ).bind(now(), invoice.subscription_id).run();

  return c.json({ success: true, message: 'Invoice marked as paid', data: { id: invoiceId, status: 'paid' } });
});

// POST /api/subscriptions/invoices/generate — Monthly invoice generation (cron/admin)
subscriptionsRouter.post('/invoices/generate', async (c) => {
  const adminErr = await requireAdmin(c);
  if (adminErr) {return adminErr;}

  const db = c.env.AURA_DB;

  // Find all active subscriptions due for billing
  const due = await db.prepare(
    'SELECT * FROM subscriptions WHERE status = \'active\' AND next_billing_date <= ?'
  ).bind(today()).all();

  let generated = 0;
  for (const sub of (due.results || [])) {
    const invoiceId = generateId('inv_');
    const periodEnd = addMonths(today(), sub.billing_cycle === 'quarterly' ? 3 : sub.billing_cycle === 'yearly' ? 12 : 1);

    await db.prepare(
      `INSERT INTO subscription_invoices (id, subscription_id, amount_vnd, status, period_start, period_end, invoice_number, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`
    ).bind(
      invoiceId, sub.id, sub.amount_vnd, today(), periodEnd,
      `INV-${sub.container_number || sub.id.slice(-4).toUpperCase()}-${today().replace(/-/g,'')}`,
      now()
    ).run();

    generated++;
  }

  return c.json({ success: true, message: `Generated ${generated} invoices`, generated_count: generated });
});

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════

async function updateMRRSnapshot(db) {
  const date = today();
  const activeSubs = await db.prepare(
    'SELECT COUNT(*) as count, COALESCE(SUM(amount_vnd), 0) as mrr FROM subscriptions WHERE status = \'active\''
  ).first();

  // Monthly churn: cancelled this month
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const churned = await db.prepare(
    'SELECT COUNT(*) as count FROM subscriptions WHERE status = \'cancelled\' AND updated_at >= ?'
  ).bind(monthStart.toISOString()).first();

  // New this month
  const newSubs = await db.prepare(
    'SELECT COUNT(*) as count FROM subscriptions WHERE created_at >= ?'
  ).bind(monthStart.toISOString()).first();

  const mrr = activeSubs?.mrr || 0;
  const active = activeSubs?.count || 0;
  const churnCount = churned?.count || 0;
  const totalBase = active + churnCount;

  // Upsert snapshot
  await db.prepare(
    `INSERT INTO mrr_snapshots (id, snapshot_date, mrr_vnd, arr_vnd, active_subscriptions,
     new_subscriptions_month, churned_subscriptions_month, churn_rate_pct, avg_contract_value_vnd, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(snapshot_date) DO UPDATE SET
     mrr_vnd = excluded.mrr_vnd, arr_vnd = excluded.arr_vnd,
     active_subscriptions = excluded.active_subscriptions,
     new_subscriptions_month = excluded.new_subscriptions_month,
     churned_subscriptions_month = excluded.churned_subscriptions_month,
     churn_rate_pct = excluded.churn_rate_pct,
     avg_contract_value_vnd = excluded.avg_contract_value_vnd`
  ).bind(
    'snap_' + date.replace(/-/g, ''),
    date, mrr, mrr * 12, active,
    newSubs?.count || 0, churnCount,
    totalBase > 0 ? Math.round((churnCount / totalBase) * 1000) / 10 : 0,
    active > 0 ? Math.round(mrr / active) : 0,
    now()
  ).run();
}
