// Subscription lifecycle handlers extracted from routes/subscriptions.ts

import type { Context } from 'hono';
import type { Env } from '../../types/env';
import type { PlanRecord, SubscriptionRecord, InvoiceRecord, JwtPayload } from './types';
import { requireAdmin } from './middleware';
import { generateId, today, nowStr, addMonths } from './helpers';
import { updateMRRSnapshot } from './mrr-calculator';
import { verifyJWT } from '../../lib/jwt';
import { createSubscriptionSchema, cancelSubscriptionSchema, updateSubscriptionSchema } from '../../lib/validators';
import { getTenantId, matchesTenantRow } from '../../lib/db';

export async function listSubscriptions(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const authHeader = c.req.header('Authorization');
  const statusFilter = c.req.query('status');
  const zoneFilter = c.req.query('zone');

  let vendorId: string | null = null;
  let vendorEmail: string | null = null;
  const ctxUser = (c as unknown as { get?: (k: string) => { id?: string; sub?: string; customerId?: string; email?: string; role?: string } | undefined }).get?.('user');
  if (ctxUser && ['vendor', 'customer'].includes(ctxUser.role || '')) {
    vendorId = ctxUser.customerId || ctxUser.sub || ctxUser.id || null;
    vendorEmail = ctxUser.email || null;
  } else if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const revoked = typeof c.env.AUTH_KV?.get === 'function' ? await c.env.AUTH_KV.get(`revoked:${token}`) : null;
    if (revoked) {
      return c.json({ success: false, error: 'Token đã bị thu hồi' }, 401);
    }
    const payload = await verifyJWT(token, c.env.JWT_SECRET) as JwtPayload | null;
    if (payload && ['vendor', 'customer'].includes(payload.role || '')) {
      vendorId = payload.customerId || payload.sub || payload.id || null;
      vendorEmail = typeof (payload as unknown as Record<string, unknown>).email === 'string'
        ? String((payload as unknown as Record<string, unknown>).email)
        : null;
    }
  }

  let query = 'SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.container_size, p.monthly_price_vnd as plan_price, p.features FROM subscriptions s LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE 1=1';
  const params: unknown[] = [];

  if (vendorId) {
    query += ' AND s.customer_id = ?'; params.push(vendorId);
  } else if (vendorEmail) {
    query += ' AND LOWER(s.customer_email) = LOWER(?)'; params.push(vendorEmail);
  }
  if (statusFilter) {
    query += ' AND s.status = ?'; params.push(statusFilter);
  }
  if (zoneFilter) {
    query += ' AND s.zone = ?'; params.push(zoneFilter);
  }
  query += ' ORDER BY s.created_at DESC';

  try {
    const subs = await db.prepare(query).bind(...params).all<SubscriptionRecord>();
    const results = (subs.results || [])
      .filter(s => matchesTenantRow(s as unknown as Record<string, unknown>, tenantId))
      .map(s => ({
        ...s,
        plan_features: s.features ? JSON.parse(s.features) : []
      }));

    return c.json({ success: true, data: results });
  } catch {
    return c.json({ success: true, data: [] });
  }
}

export async function getStatsHandler(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';

  try {
    const activeResult = await db.prepare(
      'SELECT COALESCE(SUM(amount_vnd), 0) as mrr, COUNT(*) as count FROM subscriptions WHERE status = \'active\' AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
    ).bind(tenantId, tenantId).first<{ mrr: number; count: number }>();

    const byZone = await db.prepare(
      'SELECT zone, COUNT(*) as count, COALESCE(SUM(amount_vnd), 0) as revenue FROM subscriptions WHERE status = \'active\' AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?) GROUP BY zone ORDER BY revenue DESC'
    ).bind(tenantId, tenantId).all<{ zone: string; count: number; revenue: number }>();

    let byPlan: { results?: Array<{ name: string; slug: string; count: number; revenue: number }> };
    try {
      byPlan = await db.prepare(
        `SELECT p.name, p.slug, COUNT(s.id) as count, COALESCE(SUM(s.amount_vnd), 0) as revenue
         FROM subscriptions s JOIN subscription_plans p ON s.plan_id = p.id
         WHERE s.status = 'active'
           AND (? = '*' OR COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ?)
           AND (? = '*' OR COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') = ?)
         GROUP BY p.id ORDER BY revenue DESC`
      ).bind(tenantId, tenantId, tenantId, tenantId).all<{ name: string; slug: string; count: number; revenue: number }>();
    } catch {
      byPlan = await db.prepare(
        `SELECT p.name, p.slug, COUNT(s.id) as count, COALESCE(SUM(s.amount_vnd), 0) as revenue
         FROM subscriptions s JOIN subscription_plans p ON s.plan_id = p.id
         WHERE s.status = 'active' AND (? = '*' OR COALESCE(NULLIF(TRIM(s.tenant_id), ''), 'default') = ?) GROUP BY p.id ORDER BY revenue DESC`
      ).bind(tenantId, tenantId).all<{ name: string; slug: string; count: number; revenue: number }>();
    }

    const monthStart = new Date();
    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);

    const newThisMonth = await db.prepare(
      'SELECT COUNT(*) as count FROM subscriptions WHERE status = \'active\' AND created_at >= ? AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
    ).bind(monthStart.toISOString(), tenantId, tenantId).first<{ count: number }>();

    const churned = await db.prepare(
      'SELECT COUNT(*) as count FROM subscriptions WHERE status = \'cancelled\' AND updated_at >= ? AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
    ).bind(monthStart.toISOString(), tenantId, tenantId).first<{ count: number }>();

    const avgResult = await db.prepare(
      'SELECT COALESCE(AVG(amount_vnd), 0) as avg FROM subscriptions WHERE status = \'active\' AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
    ).bind(tenantId, tenantId).first<{ avg: number }>();

    interface Bucket {
      under_1m: number; from_1m_to_3m: number; from_3m_to_5m: number; above_5m: number;
    }
    const bucketData = await db.prepare(`
      SELECT
        COUNT(CASE WHEN amount_vnd < 1000000 THEN 1 END) as under_1m,
        COUNT(CASE WHEN amount_vnd >= 1000000 AND amount_vnd < 3000000 THEN 1 END) as from_1m_to_3m,
        COUNT(CASE WHEN amount_vnd >= 3000000 AND amount_vnd < 5000000 THEN 1 END) as from_3m_to_5m,
        COUNT(CASE WHEN amount_vnd >= 5000000 THEN 1 END) as above_5m
      FROM subscriptions WHERE status = 'active' AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
    `).bind(tenantId, tenantId).first<Bucket>();

    const pending = await db.prepare(
      'SELECT COUNT(*) as count FROM subscriptions WHERE status IN (\'pending\', \'paused\') AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
    ).bind(tenantId, tenantId).first<{ count: number }>();

    const totalEver = await db.prepare(
      'SELECT COUNT(*) as count FROM subscriptions WHERE (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
    ).bind(tenantId, tenantId).first<{ count: number }>();

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
          above_5m: bucketData?.above_5m || 0
        }
      }
    });
  } catch {
    return c.json({
      success: true,
      data: {
        mrr_vnd: 0,
        arr_vnd: 0,
        active_subscriptions: 0,
        total_contracts: 0,
        new_this_month: 0,
        churned_this_month: 0,
        churn_rate_pct: 0,
        avg_contract_value_vnd: 0,
        pending_count: 0,
        by_zone: [],
        by_plan: [],
        mrr_buckets: { under_1m: 0, from_1m_to_3m: 0, from_3m_to_5m: 0, above_5m: 0 }
      }
    });
  }
}

export async function getMRRTrend(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const days = parseInt(c.req.query('days') || '30', 10);

  if (tenantId !== 'default' && tenantId !== '*') {
    const live = await db.prepare(
      'SELECT COALESCE(SUM(amount_vnd), 0) as mrr, COUNT(*) as count FROM subscriptions WHERE status = \'active\' AND COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?'
    ).bind(tenantId).first<{ mrr: number; count: number }>();
    return c.json({
      success: true,
      data: { snapshots: [{ snapshot_date: today(), mrr_vnd: live?.mrr || 0, active_subscriptions: live?.count || 0 }], source: 'live' }
    });
  }

  const snapshots = await db.prepare(
    'SELECT * FROM mrr_snapshots ORDER BY snapshot_date DESC LIMIT ?'
  ).bind(days).all<{ snapshot_date: string; mrr_vnd: number; active_subscriptions: number }>();

  const results = snapshots.results || [];
  if (results.length === 0) {
    const live = await db.prepare(
      'SELECT COALESCE(SUM(amount_vnd), 0) as mrr, COUNT(*) as count FROM subscriptions WHERE status = \'active\' AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
    ).bind(tenantId, tenantId).first<{ mrr: number; count: number }>();
    return c.json({
      success: true,
      data: { snapshots: [{ snapshot_date: today(), mrr_vnd: live?.mrr || 0, active_subscriptions: live?.count || 0 }], source: 'live' }
    });
  }

  return c.json({ success: true, data: { snapshots: results.reverse(), source: 'snapshots' } });
}

export async function getSubscription(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const sub = await db.prepare(
    'SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.container_size, p.features as plan_features FROM subscriptions s LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE s.id = ?'
  ).bind(c.req.param('id')).first<SubscriptionRecord>();

  if (!sub || !matchesTenantRow(sub as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Subscription not found' }, 404);
  }

  let callerRole: string | undefined;
  let callerId: string | undefined;
  let callerEmail: string | undefined;
  const ctxUser = (c as unknown as { get?: (k: string) => { id?: string; sub?: string; customerId?: string; email?: string; role?: string } | undefined }).get?.('user');
  if (ctxUser?.role) {
    callerRole = ctxUser.role;
    callerId = ctxUser.customerId || ctxUser.id || ctxUser.sub;
    callerEmail = ctxUser.email;
  } else {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const payload = await verifyJWT(authHeader.substring(7), c.env.JWT_SECRET) as JwtPayload | null;
      if (payload) {
        callerRole = payload.role;
        callerId = payload.customerId || payload.id || payload.sub;
        callerEmail = typeof (payload as unknown as Record<string, unknown>).email === 'string'
          ? String((payload as unknown as Record<string, unknown>).email)
          : undefined;
      }
    }
  }
  if (callerRole === 'customer' || callerRole === 'vendor') {
    const subCustomerId = sub.customer_id ? String(sub.customer_id) : '';
    const subEmail = sub.customer_email ? String(sub.customer_email).toLowerCase() : '';
    const ownsById = Boolean(callerId && subCustomerId && subCustomerId === callerId);
    const ownsByEmail = Boolean(!subCustomerId && callerEmail && subEmail && subEmail === callerEmail.toLowerCase());
    if (!ownsById && !ownsByEmail) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
  }

  const invoices = await db.prepare(
    'SELECT * FROM subscription_invoices WHERE subscription_id = ? ORDER BY created_at DESC LIMIT 5'
  ).bind(sub.id).all<InvoiceRecord>();

  return c.json({
    success: true,
    data: {
      ...sub,
      plan_features: sub.plan_features ? JSON.parse(sub.plan_features) : [],
      recent_invoices: invoices.results || []
    }
  });
}

export async function createSubscription(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const rawTenantId = getTenantId(c).trim() || 'default';
  const tenantId = rawTenantId === '*' ? 'default' : rawTenantId;
  const body = await c.req.json();
  const parsed = createSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }

  const plan = await db.prepare(
    'SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1'
  ).bind(body.plan_id).first<PlanRecord>();
  if (!plan) {
    return c.json({ success: false, error: 'Plan not found or inactive' }, 400);
  }
  const planRow = plan as unknown as Record<string, unknown>;
  if (
    'tenant_id' in planRow &&
    planRow.tenant_id !== undefined &&
    planRow.tenant_id !== null &&
    String(planRow.tenant_id).trim() !== '' &&
    !matchesTenantRow(planRow, rawTenantId)
  ) {
    return c.json({ success: false, error: 'Plan not found' }, 404);
  }

  let callerRole: string | undefined;
  let callerUserId: string | undefined;
  const ctxUser = (c as unknown as { get?: (k: string) => { id?: string; sub?: string; customerId?: string; role?: string } | undefined }).get?.('user');
  if (ctxUser?.role || ctxUser?.customerId || ctxUser?.id || ctxUser?.sub) {
    callerRole = ctxUser.role;
    callerUserId = ctxUser.customerId || ctxUser.id || ctxUser.sub;
  } else {
    const authHeader = c.req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const revoked = typeof c.env.AUTH_KV?.get === 'function' ? await c.env.AUTH_KV.get(`revoked:${token}`) : null;
      if (revoked) {
        return c.json({ success: false, error: 'Token đã bị thu hồi' }, 401);
      }
      const payload = await verifyJWT(token, c.env.JWT_SECRET) as JwtPayload | null;
      if (payload) {
        callerRole = payload.role;
        callerUserId = payload.customerId || payload.id || payload.sub || undefined;
      }
    }
  }

  const isSelfServiceCaller = callerRole === 'customer' || callerRole === 'vendor';
  const explicitCustomerId = body.customer_id as string | undefined;
  const cycleMonths = (body.billing_cycle as string) === 'quarterly' ? 3 : (body.billing_cycle as string) === 'yearly' ? 12 : 1;
  const cyclePlanAmount = Number(plan.monthly_price_vnd) * cycleMonths;
  if (isSelfServiceCaller) {
    if (explicitCustomerId && callerUserId && explicitCustomerId !== callerUserId) {
      return c.json({ success: false, error: 'Forbidden: cannot create subscription for another customer' }, 403);
    }
    if (body.amount_vnd !== undefined && Number(body.amount_vnd) < cyclePlanAmount) {
      return c.json({ success: false, error: 'Invalid subscription amount for selected plan' }, 400);
    }
    if (body.deposit_paid === true || (body.deposit_vnd !== undefined && Number(body.deposit_vnd) < Number(plan.deposit_vnd ?? 0))) {
      return c.json({ success: false, error: 'Forbidden: deposit status and amount are managed by staff' }, 403);
    }
  }

  let customerId: string | undefined = explicitCustomerId;
  if (explicitCustomerId) {
    const customer = await db.prepare('SELECT * FROM customers WHERE id = ?').bind(explicitCustomerId).first<Record<string, unknown>>();
    if (!customer || !matchesTenantRow(customer, rawTenantId)) {
      return c.json({ success: false, error: 'Customer not found' }, 400);
    }
  } else if (callerUserId) {
    customerId = callerUserId;
  }

  const id = generateId('sub_');
  const periodStart = today();
  const periodEnd = addMonths(periodStart, cycleMonths);
  const amount = isSelfServiceCaller ? cyclePlanAmount : ((body.amount_vnd as number) || cyclePlanAmount);
  const depositPaidFlag = isSelfServiceCaller ? 0 : (body.deposit_paid ? 1 : 0);
  const depositAmount = isSelfServiceCaller ? plan.deposit_vnd : (body.deposit_vnd || plan.deposit_vnd);

  try {
    await db.prepare(
      `INSERT INTO subscriptions (id, plan_id, customer_id, customer_name, customer_email, customer_phone,
       container_number, zone, status, billing_cycle, current_period_start, current_period_end,
       next_billing_date, amount_vnd, deposit_paid, deposit_vnd, notes, tenant_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, body.plan_id, customerId || null, body.customer_name, body.customer_email || '', body.customer_phone,
      body.container_number || null, body.zone || 'Sky Deck', body.billing_cycle || 'monthly',
      periodStart, periodEnd, periodEnd, amount,
      depositPaidFlag, depositAmount, body.notes || '', tenantId, nowStr(), nowStr()
    ).run();
  } catch {
    await db.prepare(
      `INSERT INTO subscriptions (id, plan_id, customer_id, customer_name, customer_email, customer_phone,
       container_number, zone, status, billing_cycle, current_period_start, current_period_end,
       next_billing_date, amount_vnd, deposit_paid, deposit_vnd, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, body.plan_id, customerId || null, body.customer_name, body.customer_email || '', body.customer_phone,
      body.container_number || null, body.zone || 'Sky Deck', body.billing_cycle || 'monthly',
      periodStart, periodEnd, periodEnd, amount,
      depositPaidFlag, depositAmount, body.notes || '', nowStr(), nowStr()
    ).run();
  }

  // Idempotency check for first invoice
  const existingInv = await db.prepare(
    'SELECT id FROM subscription_invoices WHERE subscription_id = ? AND period_start = ?'
  ).bind(id, periodStart).first<{ id: string }>();

  if (!existingInv) {
    const invoiceId = generateId('inv_');
    const invoiceNumber = `INV-${Date.now().toString(36).toUpperCase()}`;
    const createdAt = nowStr();
    try {
      await db.prepare(
        `INSERT INTO subscription_invoices (id, subscription_id, amount_vnd, status, period_start, period_end, invoice_number, tenant_id, created_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`
      ).bind(invoiceId, id, amount, periodStart, periodEnd, invoiceNumber, tenantId, createdAt).run();
    } catch {
      await db.prepare(
        `INSERT INTO subscription_invoices (id, subscription_id, amount_vnd, status, period_start, period_end, invoice_number, created_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`
      ).bind(invoiceId, id, amount, periodStart, periodEnd, invoiceNumber, createdAt).run();
    }
  }

  await updateMRRSnapshot(db);

  const sub = await db.prepare(
    'SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.container_size FROM subscriptions s LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE s.id = ?'
  ).bind(id).first<SubscriptionRecord>();

  return c.json({ success: true, data: sub }, 201);
}

export async function updateSubscription(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) {
    return adminErr;
  }

  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const rawBody = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const parsed = updateSubscriptionSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }
  const body = parsed.data;

  const existing = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first<SubscriptionRecord>();
  const rawTenantId = getTenantId(c).trim() || 'default';
  if (!existing || !matchesTenantRow(existing as unknown as Record<string, unknown>, rawTenantId)) {
    return c.json({ success: false, error: 'Subscription not found' }, 404);
  }

  const bodyAny = body as unknown as Record<string, unknown>;
  const requestedPlanId = bodyAny.plan_id ?? rawBody.plan_id;
  if (requestedPlanId !== undefined) {
    const plan = await db.prepare(
      'SELECT * FROM subscription_plans WHERE id = ? AND is_active = 1'
    ).bind(requestedPlanId).first<PlanRecord>();
    if (!plan) {
      return c.json({ success: false, error: 'Plan not found' }, 404);
    }
    const planRow = plan as unknown as Record<string, unknown>;
    if (
      'tenant_id' in planRow &&
      planRow.tenant_id !== undefined &&
      planRow.tenant_id !== null &&
      String(planRow.tenant_id).trim() !== '' &&
      !matchesTenantRow(planRow, rawTenantId)
    ) {
      return c.json({ success: false, error: 'Plan not found' }, 404);
    }
    bodyAny.plan_id = requestedPlanId;
  }

  const updates: string[] = [];
  const params: unknown[] = [];

  const updatable = ['plan_id', 'customer_name', 'customer_phone', 'customer_email', 'container_number', 'zone', 'deposit_vnd', 'deposit_paid', 'notes'];
  for (const key of updatable) {
    if (bodyAny[key] !== undefined) {
      updates.push(`${key} = ?`); params.push(bodyAny[key]);
    }
  }

  if (updates.length === 0) {
    return c.json({ success: false, error: 'No fields to update' }, 400);
  }

  updates.push('updated_at = ?');
  params.push(nowStr());
  params.push(id);

  try {
    await db.prepare(
      `UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`
    ).bind(...params, rawTenantId, rawTenantId).run();
  } catch {
    await db.prepare(`UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run();
  }

  const sub = await db.prepare(
    'SELECT s.*, p.name as plan_name, p.slug as plan_slug FROM subscriptions s LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE s.id = ?'
  ).bind(id).first<SubscriptionRecord>();

  return c.json({ success: true, data: sub });
}

export async function cancelSubscription(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  let callerUserId: string | null = null;
  if (adminErr) {
    const ctxUser = (c as unknown as { get?: (k: string) => { id?: string; sub?: string; customerId?: string } | undefined }).get?.('user');
    if (ctxUser?.customerId || ctxUser?.id || ctxUser?.sub) {
      callerUserId = ctxUser.customerId || ctxUser.id || ctxUser.sub || null;
    } else {
      const authHeader = c.req.header('Authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const revoked = typeof c.env.AUTH_KV?.get === 'function' ? await c.env.AUTH_KV.get(`revoked:${token}`) : null;
        if (!revoked) {
          const payload = await verifyJWT(token, c.env.JWT_SECRET) as JwtPayload | null;
          if (payload) {
            callerUserId = payload.customerId || payload.id || payload.sub || null;
          }
        }
      }
    }
    if (!callerUserId) {
      return adminErr;
    }
  }

  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const rawBody = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const parsed = cancelSubscriptionSchema.safeParse(rawBody);
  const data = parsed.success ? parsed.data : {};

  const sub = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first<SubscriptionRecord>();
  const tenantId = getTenantId(c).trim() || 'default';
  if (!sub || !matchesTenantRow(sub as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Subscription not found' }, 404);
  }
  if (adminErr && (!sub.customer_id || sub.customer_id !== callerUserId)) {
    return adminErr;
  }
  if (sub.status === 'cancelled') {
    return c.json({ success: false, error: 'Already cancelled' }, 400);
  }

  const cancelledAt = nowStr();
  try {
    await db.prepare(
      'UPDATE subscriptions SET status = \'cancelled\', cancelled_at = ?, cancellation_reason = ?, updated_at = ? WHERE id = ? AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
    ).bind(cancelledAt, data.reason || '', cancelledAt, id, tenantId, tenantId).run();
  } catch {
    await db.prepare(
      'UPDATE subscriptions SET status = \'cancelled\', cancelled_at = ?, cancellation_reason = ?, updated_at = ? WHERE id = ?'
    ).bind(cancelledAt, data.reason || '', cancelledAt, id).run();
  }

  await updateMRRSnapshot(db, tenantId);

  return c.json({ success: true, message: 'Subscription cancelled' });
}

export async function pauseSubscription(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) {
    return adminErr;
  }

  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const tenantId = getTenantId(c).trim() || 'default';

  const sub = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first<SubscriptionRecord>();
  if (!sub || !matchesTenantRow(sub as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Subscription not found' }, 404);
  }

  const pausedAt = nowStr();
  try {
    await db.prepare(
      'UPDATE subscriptions SET status = \'paused\', paused_at = ?, updated_at = ? WHERE id = ? AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
    ).bind(pausedAt, pausedAt, id, tenantId, tenantId).run();
  } catch {
    try {
      await db.prepare(
        'UPDATE subscriptions SET status = \'paused\', paused_at = ?, updated_at = ? WHERE id = ?'
      ).bind(pausedAt, pausedAt, id).run();
    } catch {
      await db.prepare(
        'UPDATE subscriptions SET status = \'paused\', updated_at = ? WHERE id = ?'
      ).bind(pausedAt, id).run();
    }
  }

  await updateMRRSnapshot(db, tenantId);
  return c.json({ success: true, message: 'Subscription paused' });
}

export async function resumeSubscription(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const adminErr = await requireAdmin(c);
  if (adminErr) {
    return adminErr;
  }

  const tenantId = getTenantId(c).trim() || 'default';
  const sub = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first<SubscriptionRecord>();
  if (!sub || !matchesTenantRow(sub as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Subscription not found' }, 404);
  }
  if (sub.status !== 'paused') {
    return c.json({ success: false, error: 'Subscription is not paused' }, 400);
  }

  const pauseStart = sub.paused_at ? new Date(sub.paused_at) : new Date(sub.updated_at || sub.created_at);
  const pauseDays = Math.max(0, Math.ceil((Date.now() - pauseStart.getTime()) / 86400000));
  const currentEnd = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
  const newEnd = new Date(currentEnd);
  newEnd.setDate(newEnd.getDate() + pauseDays);
  const newPeriodEnd = newEnd.toISOString().slice(0, 10);

  const resumedAt = nowStr();
  try {
    await db.prepare(
      'UPDATE subscriptions SET status = \'active\', current_period_end = ?, next_billing_date = ?, updated_at = ? WHERE id = ? AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
    ).bind(newPeriodEnd, newPeriodEnd, resumedAt, id, tenantId, tenantId).run();
  } catch {
    await db.prepare(
      'UPDATE subscriptions SET status = \'active\', current_period_end = ?, next_billing_date = ?, updated_at = ? WHERE id = ?'
    ).bind(newPeriodEnd, newPeriodEnd, resumedAt, id).run();
  }

  await updateMRRSnapshot(db, tenantId);
  return c.json({ success: true, message: 'Subscription resumed', new_period_end: newPeriodEnd });
}

export async function deleteSubscription(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) {
    return adminErr;
  }

  const db = c.env.AURA_DB;
  const id = c.req.param('id');
  const tenantId = getTenantId(c).trim() || 'default';

  const sub = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(id).first<SubscriptionRecord>();
  if (!sub || !matchesTenantRow(sub as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Subscription not found' }, 404);
  }
  if (sub.status === 'active') {
    return c.json({ success: false, error: 'Cannot delete active subscription — use cancel endpoint' }, 400);
  }

  try {
    await db.prepare(
      'DELETE FROM subscription_invoices WHERE subscription_id = ? AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
    ).bind(id, tenantId, tenantId).run();
  } catch {
    await db.prepare('DELETE FROM subscription_invoices WHERE subscription_id = ?').bind(id).run();
  }
  try {
    await db.prepare(
      'DELETE FROM subscriptions WHERE id = ? AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
    ).bind(id, tenantId, tenantId).run();
  } catch {
    await db.prepare('DELETE FROM subscriptions WHERE id = ?').bind(id).run();
  }

  return c.json({ success: true, message: 'Subscription deleted' });
}

export async function deletePlan(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) {
    return adminErr;
  }

  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const id = c.req.param('id');

  const existing = await db.prepare('SELECT * FROM subscription_plans WHERE id = ?').bind(id).first<Record<string, unknown>>();
  if (!existing || !matchesTenantRow(existing, tenantId)) {
    return c.json({ success: false, error: 'Plan not found' }, 404);
  }

  try {
    await db.prepare(
      'DELETE FROM subscription_plans WHERE id = ? AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
    ).bind(id, tenantId, tenantId).run();
  } catch {
    await db.prepare('DELETE FROM subscription_plans WHERE id = ?').bind(id).run();
  }
  return c.json({ success: true, message: 'Plan deleted' });
}

export const createSubscriptionHandler = createSubscription;
export const cancelSubscriptionHandler = cancelSubscription;
