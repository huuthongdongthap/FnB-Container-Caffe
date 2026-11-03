// Invoice handlers extracted from routes/subscriptions.ts
// Patched: payInvoice now routes through NowPayments when configured (Phase 04).

import type { Context } from 'hono';
import type { Env } from '../../types/env';
import type { InvoiceRecord, SubscriptionRecord, JwtPayload } from './types';
import { requireAdmin } from './middleware';
import { generateId, today, nowStr, addMonths } from './helpers';
import { payInvoiceSchema } from '../../lib/validators';
import { createNowPaymentsInvoice } from './nowpayments';
import { getTenantId, matchesTenantRow } from '../../lib/db';
import { verifyJWT } from '../../lib/jwt';

export async function listInvoices(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const status = c.req.query('status');
  const subId = c.req.query('subscription_id');

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

  const isSelfServiceCaller = callerRole === 'customer' || callerRole === 'vendor';
  if (isSelfServiceCaller && subId) {
    const subOwner = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(subId).first<SubscriptionRecord>().catch(() => null);
    if (!subOwner || !matchesTenantRow(subOwner as unknown as Record<string, unknown>, tenantId)) {
      return c.json({ success: true, data: [] });
    }
    const subCustId = subOwner.customer_id ? String(subOwner.customer_id) : '';
    const subEmail = subOwner.customer_email ? String(subOwner.customer_email).toLowerCase() : '';
    const ownsById = Boolean(callerId && subCustId && subCustId === callerId);
    const ownsByEmail = Boolean(!subCustId && callerEmail && subEmail && subEmail === callerEmail.toLowerCase());
    if (!ownsById && !ownsByEmail) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
  }

  let query = 'SELECT i.*, s.customer_id as sub_customer_id, s.customer_email as sub_customer_email, s.customer_name, s.tenant_id as sub_tenant_id, p.name as plan_name FROM subscription_invoices i LEFT JOIN subscriptions s ON i.subscription_id = s.id LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE 1=1';
  const params: unknown[] = [];
  if (status) {
    query += ' AND i.status = ?';
    params.push(status);
  }
  if (subId) {
    query += ' AND i.subscription_id = ?';
    params.push(subId);
  }
  const tenantScopedQuery = `${query} AND (? = '*' OR COALESCE(NULLIF(TRIM(COALESCE(s.tenant_id, i.tenant_id)), ''), 'default') = ?) ORDER BY i.created_at DESC LIMIT 500`;
  query += ' ORDER BY i.created_at DESC LIMIT 500';

  let rows: any[] = [];
  let usedFallback = false;
  try {
    const invoices = await db.prepare(tenantScopedQuery).bind(...params, tenantId, tenantId).all<InvoiceRecord>();
    rows = invoices.results || [];
  } catch {
    try {
      const invoices = await db.prepare(query).bind(...params).all<InvoiceRecord>();
      rows = invoices.results || [];
    } catch {
      usedFallback = true;
      const fallbackQuery = query
        .replace(', s.customer_id as sub_customer_id, s.customer_email as sub_customer_email', '')
        .replace(', s.tenant_id as sub_tenant_id', '');
      const invoices = await db.prepare(fallbackQuery).bind(...params).all<InvoiceRecord>();
      rows = invoices.results || [];
    }
  }
  const filtered = rows.filter((r) => {
    const subTenant = typeof r.sub_tenant_id === 'string' && r.sub_tenant_id.trim() ? r.sub_tenant_id.trim() : undefined;
    const invTenant = typeof r.tenant_id === 'string' && r.tenant_id.trim() ? r.tenant_id.trim() : undefined;
    const hasExplicitTenant = subTenant !== undefined || invTenant !== undefined || ('tenant_id' in r && r.tenant_id !== undefined);
    if (usedFallback && tenantId !== '*' && !hasExplicitTenant) {
      return tenantId === 'default' && !isSelfServiceCaller;
    }
    const effectiveTenant = subTenant ?? invTenant ?? r.sub_tenant_id ?? r.tenant_id;
    if (!matchesTenantRow({ tenant_id: effectiveTenant }, tenantId)) return false;
    if (isSelfServiceCaller) {
      const rowCustId = String(r.sub_customer_id || r.customer_id || '');
      const rowEmail = String(r.sub_customer_email || r.customer_email || '').toLowerCase();
      const ownsById = Boolean(callerId && rowCustId && rowCustId === callerId);
      const ownsByEmail = Boolean(!rowCustId && callerEmail && rowEmail && rowEmail === callerEmail.toLowerCase());
      if (!ownsById && !ownsByEmail) return false;
    }
    return true;
  }).slice(0, 100);
  return c.json({ success: true, data: filtered });
}

export async function payInvoice(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) {
    return adminErr;
  }

  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';
  const invoiceId = c.req.param('id')!;
  const rawBody = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const parsed = payInvoiceSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
  }
  const body = parsed.data;

  const invoice = await db.prepare(
    'SELECT * FROM subscription_invoices WHERE id = ?'
  ).bind(invoiceId).first<InvoiceRecord>();

  if (!invoice) {
    return c.json({ success: false, error: 'Invoice not found' }, 404);
  }
  const parentSub = await db.prepare('SELECT * FROM subscriptions WHERE id = ?').bind(invoice.subscription_id).first<SubscriptionRecord>();
  const parentSubMap = parentSub as unknown as Record<string, unknown> | null;
  if (parentSubMap && 'tenant_id' in parentSubMap && parentSubMap.tenant_id !== undefined) {
    if (!matchesTenantRow(parentSubMap, tenantId)) {
      return c.json({ success: false, error: 'Invoice not found' }, 404);
    }
  } else if (!matchesTenantRow(invoice as unknown as Record<string, unknown>, tenantId)) {
    return c.json({ success: false, error: 'Invoice not found' }, 404);
  }
  const normalizedStatus = String(invoice.status || '').trim().toLowerCase();
  if (['paid', 'manual', 'cancelled'].includes(normalizedStatus)) {
    return c.json({ success: false, error: normalizedStatus === 'cancelled' ? 'Invoice is cancelled' : 'Already paid' }, 400);
  }

  // Try NowPayments if configured
  const npResult = await createNowPaymentsInvoice(c.env as any, invoiceId, Number(invoice.amount_vnd)).catch(() => null);

  if (npResult) {
    // Store payment_ref (NowPayments invoice id) and set status=processing
    const updatedAt = nowStr();
    try {
      await db.prepare(
        'UPDATE subscription_invoices SET status = \'processing\', payment_method = \'nowpayments\', payment_ref = ?, updated_at = ? WHERE id = ? AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
      ).bind(npResult.paymentRef, updatedAt, invoiceId, tenantId, tenantId).run();
    } catch {
      await db.prepare(
        'UPDATE subscription_invoices SET status = \'processing\', payment_method = \'nowpayments\', payment_ref = ?, updated_at = ? WHERE id = ?'
      ).bind(npResult.paymentRef, updatedAt, invoiceId).run();
    }

    return c.json({
      success: true,
      message: 'Redirecting to payment gateway',
      checkout_url: npResult.checkoutUrl,
      payment_ref: npResult.paymentRef,
    });
  }

  // Fallback: mark manual (no gateway configured)
  const paidAt = nowStr();
  try {
    await db.prepare(
      'UPDATE subscription_invoices SET status = \'manual\', payment_method = ?, payment_ref = ?, paid_at = ?, updated_at = ? WHERE id = ? AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
    ).bind(body.payment_method || 'bank_transfer', body.payment_ref || '', paidAt, paidAt, invoiceId, tenantId, tenantId).run();
  } catch {
    await db.prepare(
      'UPDATE subscription_invoices SET status = \'manual\', payment_method = ?, payment_ref = ?, paid_at = ?, updated_at = ? WHERE id = ?'
    ).bind(body.payment_method || 'bank_transfer', body.payment_ref || '', paidAt, paidAt, invoiceId).run();
  }

  if (tenantId && tenantId !== '*') {
    await db.prepare(
      `UPDATE subscriptions SET current_period_start = current_period_end,
       current_period_end = date(current_period_end, '+1 month'),
       next_billing_date = date(current_period_end, '+1 month'),
       updated_at = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
    ).bind(nowStr(), invoice.subscription_id, tenantId).run().catch(() =>
      db.prepare(
        `UPDATE subscriptions SET current_period_start = current_period_end,
         current_period_end = date(current_period_end, '+1 month'),
         next_billing_date = date(current_period_end, '+1 month'),
         updated_at = ? WHERE id = ?`
      ).bind(nowStr(), invoice.subscription_id).run()
    );
  } else {
    await db.prepare(
      `UPDATE subscriptions SET current_period_start = current_period_end,
       current_period_end = date(current_period_end, '+1 month'),
       next_billing_date = date(current_period_end, '+1 month'),
       updated_at = ? WHERE id = ?`
    ).bind(nowStr(), invoice.subscription_id).run();
  }

  return c.json({ success: true, message: 'Invoice marked as paid (manual)', data: { id: invoiceId, status: 'manual' } });
}

export async function generateInvoices(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) {
    return adminErr;
  }

  const db = c.env.AURA_DB;
  const tenantId = getTenantId(c).trim() || 'default';

  const todayDate = today();
  let due: { results?: SubscriptionRecord[] };
  try {
    due = await db.prepare(
      `SELECT * FROM subscriptions WHERE status = 'active' AND next_billing_date <= ?
       AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
       AND NOT EXISTS (
         SELECT 1 FROM subscription_invoices i
         WHERE i.subscription_id = subscriptions.id AND i.period_start = ? AND i.status != 'cancelled'
       )`
    ).bind(todayDate, tenantId, tenantId, todayDate).all<SubscriptionRecord>();
  } catch {
    try {
      due = await db.prepare(
        `SELECT * FROM subscriptions WHERE status = 'active' AND next_billing_date <= ?
         AND NOT EXISTS (
           SELECT 1 FROM subscription_invoices i
           WHERE i.subscription_id = subscriptions.id AND i.period_start = ? AND i.status != 'cancelled'
         )`
      ).bind(todayDate, todayDate).all<SubscriptionRecord>();
    } catch {
      due = await db.prepare(
        'SELECT * FROM subscriptions WHERE status = \'active\' AND next_billing_date <= ?'
      ).bind(todayDate).all<SubscriptionRecord>();
    }
  }

  const scopedSubs = (due.results || []).filter((sub) =>
    matchesTenantRow(sub as unknown as Record<string, unknown>, tenantId)
  );

  let generated = 0;
  for (const sub of scopedSubs) {
    const invoiceId = generateId('inv_');
    const periodEnd = addMonths(todayDate, sub.billing_cycle === 'quarterly' ? 3 : sub.billing_cycle === 'yearly' ? 12 : 1);
    const subTenantId = (sub as unknown as { tenant_id?: string | null }).tenant_id?.trim() || (tenantId === '*' ? 'default' : tenantId);
    const invoiceNumber = `INV-${sub.container_number || sub.id.slice(-4).toUpperCase()}-${todayDate.replace(/-/g, '')}`;
    const createdAt = nowStr();

    try {
      await db.prepare(
        `INSERT INTO subscription_invoices (id, subscription_id, amount_vnd, status, period_start, period_end, invoice_number, tenant_id, created_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?)`
      ).bind(
        invoiceId, sub.id, sub.amount_vnd, todayDate, periodEnd,
        invoiceNumber, subTenantId, createdAt
      ).run();
    } catch {
      await db.prepare(
        `INSERT INTO subscription_invoices (id, subscription_id, amount_vnd, status, period_start, period_end, invoice_number, created_at)
         VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`
      ).bind(
        invoiceId, sub.id, sub.amount_vnd, todayDate, periodEnd,
        invoiceNumber, createdAt
      ).run();
    }

    try {
      await db.prepare(
        'UPDATE subscriptions SET next_billing_date = ?, updated_at = ? WHERE id = ? AND (? = \'*\' OR COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ?)'
      ).bind(periodEnd, createdAt, sub.id, tenantId, tenantId).run();
    } catch {
      await db.prepare(
        'UPDATE subscriptions SET next_billing_date = ?, updated_at = ? WHERE id = ?'
      ).bind(periodEnd, createdAt, sub.id).run().catch(() => null);
    }

    generated++;
  }

  return c.json({ success: true, message: `Generated ${generated} invoices`, generated_count: generated });
}
