// Invoice handlers extracted from routes/subscriptions.ts
// Patched: payInvoice now routes through NowPayments when configured (Phase 04).

import type { Context } from 'hono';
import type { Env } from '../../types/env';
import type { InvoiceRecord, SubscriptionRecord } from './types';
import { requireAdmin } from './middleware';
import { generateId, today, nowStr, addMonths } from './helpers';
import { payInvoiceSchema } from '../../lib/validators';
import { createNowPaymentsInvoice } from './nowpayments';

export async function listInvoices(c: Context<{ Bindings: Env }>) {
  const db = c.env.AURA_DB;
  const status = c.req.query('status');
  const subId = c.req.query('subscription_id');

  let query = 'SELECT i.*, s.customer_name, p.name as plan_name FROM subscription_invoices i LEFT JOIN subscriptions s ON i.subscription_id = s.id LEFT JOIN subscription_plans p ON s.plan_id = p.id WHERE 1=1';
  const params: unknown[] = [];
  if (status) {
    query += ' AND i.status = ?';
    params.push(status);
  }
  if (subId) {
    query += ' AND i.subscription_id = ?';
    params.push(subId);
  }
  query += ' ORDER BY i.created_at DESC LIMIT 100';

  const invoices = await db.prepare(query).bind(...params).all<InvoiceRecord>();
  return c.json({ success: true, data: invoices.results || [] });
}

export async function payInvoice(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) {
    return adminErr;
  }

  const db = c.env.AURA_DB;
  const invoiceId = c.req.param('id');
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
  if (invoice.status === 'paid') {
    return c.json({ success: false, error: 'Already paid' }, 400);
  }

  // Try NowPayments if configured
  const npResult = await createNowPaymentsInvoice(c.env as any, invoiceId, Number(invoice.amount_vnd)).catch(() => null);

  if (npResult) {
    // Store payment_ref (NowPayments invoice id) and set status=processing
    await db.prepare(
      "UPDATE subscription_invoices SET status = 'processing', payment_method = 'nowpayments', payment_ref = ?, updated_at = ? WHERE id = ?"
    ).bind(npResult.paymentRef, nowStr(), invoiceId).run();

    return c.json({
      success: true,
      message: 'Redirecting to payment gateway',
      checkout_url: npResult.checkoutUrl,
      payment_ref: npResult.paymentRef,
    });
  }

  // Fallback: mark manual (no gateway configured)
  await db.prepare(
    "UPDATE subscription_invoices SET status = 'manual', payment_method = ?, payment_ref = ?, paid_at = ?, updated_at = ? WHERE id = ?"
  ).bind(body.payment_method || 'bank_transfer', body.payment_ref || '', nowStr(), nowStr(), invoiceId).run();

  await db.prepare(
    `UPDATE subscriptions SET current_period_start = current_period_end,
     current_period_end = date(current_period_end, '+1 month'),
     next_billing_date = date(current_period_end, '+1 month'),
     updated_at = ? WHERE id = ?`
  ).bind(nowStr(), invoice.subscription_id).run();

  return c.json({ success: true, message: 'Invoice marked as paid (manual)', data: { id: invoiceId, status: 'manual' } });
}

export async function generateInvoices(c: Context<{ Bindings: Env }>) {
  const adminErr = await requireAdmin(c);
  if (adminErr) {
    return adminErr;
  }

  const db = c.env.AURA_DB;

  const due = await db.prepare(
    "SELECT * FROM subscriptions WHERE status = 'active' AND next_billing_date <= ?"
  ).bind(today()).all<SubscriptionRecord>();

  let generated = 0;
  for (const sub of due.results || []) {
    const invoiceId = generateId('inv_');
    const periodEnd = addMonths(today(), sub.billing_cycle === 'quarterly' ? 3 : sub.billing_cycle === 'yearly' ? 12 : 1);

    await db.prepare(
      `INSERT INTO subscription_invoices (id, subscription_id, amount_vnd, status, period_start, period_end, invoice_number, created_at)
       VALUES (?, ?, ?, 'pending', ?, ?, ?, ?)`
    ).bind(
      invoiceId, sub.id, sub.amount_vnd, today(), periodEnd,
      `INV-${sub.container_number || sub.id.slice(-4).toUpperCase()}-${today().replace(/-/g, '')}`,
      nowStr()
    ).run();

    generated++;
  }

  return c.json({ success: true, message: `Generated ${generated} invoices`, generated_count: generated });
}
