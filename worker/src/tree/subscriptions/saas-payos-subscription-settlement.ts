/**
 * Platform SaaS PayOS settlement for merchant-facing subscription invoices.
 *
 * `subscription_invoices` are the invoices generated for a tenant's own
 * container subscription (cron + `POST /api/subscriptions/:id/pay`). They are
 * settled with the *platform* PayOS credentials (`SAAS_PAYOS_*`) and identified
 * by `payment_ref = 'payos:<orderCode>'`. `tenant_invoices` cover platform
 * tier upgrades and are handled separately in `saas-commercial`.
 *
 * Without this branch a PayOS-paid subscription invoice stays `processing`
 * forever: the merchant webhook looks only at `payments`, and the SaaS webhook
 * looked only at `tenant_invoices`.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { addMonths } from './helpers';

type BoundResult = { meta?: { changes?: number } };

type InvoiceRow = {
  id: string;
  subscription_id: string;
  status: string;
  amount_vnd: number | string | null;
  payment_ref: string | null;
  period_start: string | null;
  period_end: string | null;
  tenant_id: string | null;
};

type SubscriptionRow = {
  id: string;
  status: string;
  billing_cycle: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  tenant_id: string | null;
};

export type SubscriptionSettlementResult = {
  handled: boolean;
  message: string;
  subscriptionAdvanced?: boolean;
  /** Tenant that owns the settled invoice, so callers need not re-query for it. */
  tenantId?: string;
  /** Structured flag: the webhook must answer 409 so PayOS keeps retrying. */
  amountMismatch?: boolean;
};

const isDateLike = (value: unknown): value is string =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value);

const toDay = (value: unknown): string => (isDateLike(value) ? value.slice(0, 10) : '');

function cycleMonths(billingCycle: string | null): number {
  const cycle = String(billingCycle ?? 'monthly').trim().toLowerCase();
  if (cycle === 'quarterly') return 3;
  if (cycle === 'annual' || cycle === 'yearly') return 12;
  return 1;
}

const normalizeTenant = (value: unknown): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed || 'default';
};

/**
 * Settle a subscription invoice from a verified platform PayOS webhook.
 * Returns `handled: false` when no subscription invoice carries this code, so
 * the caller can continue with the platform `tenant_invoices` lookup.
 */
export async function settleSubscriptionInvoiceByPayOS(
  db: D1Database,
  input: { orderCode: string; amountPaid: number; isPaid: boolean; nowIso: string }
): Promise<SubscriptionSettlementResult> {
  const { orderCode, amountPaid, isPaid, nowIso } = input;
  const prefixedRef = `payos:${orderCode}`;

  let invoice: InvoiceRow | null;
  try {
    invoice = await db
      .prepare('SELECT * FROM subscription_invoices WHERE payment_ref IN (?, ?) LIMIT 1')
      .bind(prefixedRef, orderCode)
      .first<InvoiceRow>();
  } catch (err) {
    if (/no such table:\s*subscription_invoices/i.test(err instanceof Error ? err.message : String(err))) {
      return { handled: false, message: 'Subscription invoices table unavailable' };
    }
    throw err;
  }
  if (!invoice) {
    return { handled: false, message: 'Not a subscription invoice' };
  }

  const tenantId = normalizeTenant(invoice.tenant_id);

  const status = String(invoice.status ?? '').trim().toLowerCase();
  if (status === 'paid' || status === 'manual') {
    return { handled: true, message: 'Already processed', tenantId };
  }
  if (status === 'cancelled' || status === 'canceled') {
    return { handled: true, message: 'Invoice is cancelled', tenantId };
  }

  if (!isPaid) {
    // A cancelled/expired link leaves the invoice retryable. `payInvoice` only
    // refuses `paid`/`manual`/`cancelled`/`processing`, so `failed` reopens it
    // while `payment_ref` stays intact for a late success replay.
    await db
      .prepare(
        `UPDATE subscription_invoices SET status = 'failed', updated_at = ?
         WHERE id = ? AND status = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
      )
      .bind(nowIso, invoice.id, invoice.status, tenantId)
      .run();
    return { handled: true, message: 'Marked failed', tenantId };
  }

  const expectedAmount = Math.round(Number(invoice.amount_vnd));
  if (!Number.isFinite(amountPaid) || !Number.isFinite(expectedAmount) || amountPaid !== expectedAmount) {
    return {
      handled: true,
      message: `Amount mismatch: expected ${expectedAmount}, received ${amountPaid}`,
      tenantId,
      amountMismatch: true,
    };
  }

  const subscription = await db
    .prepare('SELECT id, status, billing_cycle, current_period_start, current_period_end, tenant_id FROM subscriptions WHERE id = ?')
    .bind(invoice.subscription_id)
    .first<SubscriptionRow>();
  if (!subscription || normalizeTenant(subscription.tenant_id) !== tenantId) {
    return { handled: true, message: 'Subscription unavailable for settlement', tenantId };
  }

  const months = cycleMonths(subscription.billing_cycle);
  const todayIso = nowIso.slice(0, 10);
  const invoiceStart = toDay(invoice.period_start);
  const invoiceEnd = toDay(invoice.period_end);
  const subscriptionStart = toDay(subscription.current_period_start);
  const subscriptionEnd = toDay(subscription.current_period_end);

  // The paid window only ever grows, mirroring the manual/NowPayments settlement
  // path. An invoice whose window the running period already covers — the initial
  // invoice billed up front, or a late payment for an earlier period — is marked
  // paid without moving the subscription.
  const invoiceCovered = Boolean(invoiceEnd) && Boolean(subscriptionEnd) && invoiceEnd <= subscriptionEnd;
  const newStart = (invoiceCovered ? subscriptionStart : subscriptionEnd || invoiceStart) || todayIso;
  const newEnd = invoiceCovered ? subscriptionEnd : addMonths(newStart, months);
  const subStatus = String(subscription.status ?? '').trim().toLowerCase();
  const needsInitialActivation = invoiceCovered && (subStatus === 'pending_payment' || subStatus === 'pending');

  const invoiceClaim = db
    .prepare(
      `UPDATE subscription_invoices
       SET status = 'paid', paid_at = ?, payment_method = 'payos', payment_ref = ?, updated_at = ?
       WHERE id = ? AND status = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
    )
    .bind(nowIso, prefixedRef, nowIso, invoice.id, invoice.status, tenantId);

  const advanceStatement = invoiceCovered
    ? (needsInitialActivation
        ? db
            .prepare(
              `UPDATE subscriptions
               SET status = 'active', updated_at = ?
               WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
                 AND status IN ('pending_payment', 'pending')
                 AND EXISTS (SELECT 1 FROM subscription_invoices WHERE id = ? AND status = 'paid')`
            )
            .bind(nowIso, invoice.subscription_id, tenantId, invoice.id)
        : null)
    : db
        .prepare(
          `UPDATE subscriptions
           SET status = 'active', current_period_start = ?, current_period_end = ?, next_billing_date = ?, updated_at = ?
           WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
             AND LOWER(TRIM(COALESCE(status, ''))) NOT IN ('cancelled', 'canceled')
             AND EXISTS (SELECT 1 FROM subscription_invoices WHERE id = ? AND status = 'paid')`
        )
        .bind(newStart, newEnd, newEnd, nowIso, invoice.subscription_id, tenantId, invoice.id);

  const results = await db.batch(advanceStatement ? [invoiceClaim, advanceStatement] : [invoiceClaim]);

  const claimed = Number((results[0] as BoundResult | undefined)?.meta?.changes ?? 0);
  if (claimed !== 1) {
    return { handled: true, message: 'Already processed', tenantId };
  }

  const subscriptionAdvanced = advanceStatement
    ? Number((results[1] as BoundResult | undefined)?.meta?.changes ?? 0) === 1
    : false;
  return {
    handled: true,
    message: subscriptionAdvanced
      ? (needsInitialActivation ? 'Subscription activated' : 'Subscription renewed')
      : 'Invoice paid, subscription not advanced',
    subscriptionAdvanced,
    tenantId,
  };
}
