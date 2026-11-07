import type { Hono, Context } from 'hono';
import { requireAuth } from '../../middleware/auth';
import { audit } from '../../middleware/audit-log';
import {
  canAccessPaymentOrder,
  FINANCIAL_ROLES,
  hasFinancialRole,
  resolvePaymentTenantScope,
} from '../../../../packages/domain/payment/policies/payment-access';
import type { Env } from '../../types/env';
import { log, refundRequestSchema, ERRORS } from './helpers';

export async function handleRefund(c: Context<{ Bindings: Env }>, openApi = false): Promise<Response> {
  if (!hasFinancialRole(c)) return c.json({ success: false, error: 'Forbidden' }, 403);
  const scope = resolvePaymentTenantScope(c, false);
  if (!scope) return c.json({ success: false, error: 'Forbidden' }, 403);
  const tenantId = scope.wildcard ? '*' : scope.tenantId;
  // Parse request JSON before the refund settlement error boundary so malformed payloads
  // return a 400 client error rather than a 500 reconciliation alert.
  let body: Record<string, unknown>;
  try {
    const raw = await c.req.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400);
    }
    body = raw as Record<string, unknown>;
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }
  const db = c.env.AURA_DB;
  try {
    const rawPaymentId = body.paymentId !== undefined && body.paymentId !== null ? String(body.paymentId).trim() : '';
    const rawOrderId = body.orderId !== undefined && body.orderId !== null ? String(body.orderId).trim() : '';
    if (!rawPaymentId && !rawOrderId) return c.json({ success: false, error: 'Missing paymentId' }, 400);
    const preParsed = refundRequestSchema.safeParse(
      openApi
        ? {
            ...body,
            amount: body.amount ?? 1,
            reason: body.reason === undefined ? 'Staff refund' : body.reason,
          }
        : body
    );
    if (!preParsed.success) return c.json({ success: false, error: preParsed.error.issues[0].message }, 400);
    const lookupColumn = rawPaymentId ? 'p.id' : 'p.order_id';
    const lookupValue = rawPaymentId || rawOrderId;
    const orderByClause = rawPaymentId
      ? ''
      : " ORDER BY CASE WHEN LOWER(COALESCE(p.status, '')) IN ('paid', 'completed') THEN 0 ELSE 1 END, p.created_at DESC LIMIT 1";
    type RefundPaymentRow = {
      id: string;
      order_id: string;
      method: string;
      amount: number;
      status: string;
      transaction_id: string;
      refund_status: string | null;
      tenant_id: string | null;
      customer_id: string | null;
      order_token?: string | null;
    };
    let payment: RefundPaymentRow | null = null;
    try {
      payment = await db
        .prepare(
          `SELECT p.*, o.tenant_id, o.customer_id, o.order_token
           FROM payments p JOIN orders o ON o.id = p.order_id
           WHERE ${lookupColumn} = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)${orderByClause}`
        )
        .bind(lookupValue, tenantId, tenantId)
        .first<RefundPaymentRow>();
    } catch {
      try {
        payment = await db
          .prepare(
            `SELECT p.*, o.tenant_id, o.customer_id
             FROM payments p JOIN orders o ON o.id = p.order_id
             WHERE ${lookupColumn} = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)${orderByClause}`
          )
          .bind(lookupValue, tenantId, tenantId)
          .first<RefundPaymentRow>();
      } catch {
        if (tenantId === 'default' || tenantId === '*') {
          payment = await db
            .prepare(
              `SELECT p.*, o.tenant_id, o.customer_id
               FROM payments p JOIN orders o ON o.id = p.order_id
               WHERE ${lookupColumn} = ?${orderByClause}`
            )
            .bind(lookupValue)
            .first<RefundPaymentRow>()
            .catch(() => null);
        }
      }
    }
    if (!payment || !canAccessPaymentOrder(c, payment)) return c.json(ERRORS.PAYMENT_NOT_FOUND, 404);
    if (rawPaymentId && rawOrderId && String(payment.order_id) !== rawOrderId) {
      return c.json({ success: false, error: 'paymentId does not belong to the specified orderId' }, 400);
    }
    const parsed = refundRequestSchema.safeParse(openApi ? { ...body, amount: body.amount ?? payment.amount, reason: body.reason === undefined ? 'Staff refund' : body.reason } : body);
    if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    const amount = parsed.data.amount ?? Number(payment.amount);
    if (!['paid', 'completed'].includes(payment.status)) return c.json(ERRORS.PAYMENT_NOT_PAID, 400);
    if (payment.refund_status) return c.json({ ...ERRORS.PAYMENT_ALREADY_REFUNDED,
      error: 'Refund already submitted or pending reconciliation' }, 409);
    if (amount > Number(payment.amount)) return c.json(ERRORS.AMOUNT_EXCEEDS_PAYMENT, 400);
    if (payment.method !== 'payos' || !/^\d+$/.test(payment.transaction_id || '')) {
      return c.json({ success: false, error: 'Only verified PayOS payments support this refund operation' }, 409);
    }
    // The published PayOS payment-link API documents create/get/cancel, not refunds.
    // Never invent a provider transfer or mark paid funds refunded without evidence.
    return c.json({ success: false, code: 'REFUND_PROVIDER_UNAVAILABLE',
      error: 'Automatic PayOS refund is unavailable; reconcile with the payment provider',
      retryable: false, reconciliationRequired: true }, 422);
  } catch (err) {
    log.error('Refund error', { message: (err as Error).message });
    return c.json({ success: false, error: 'Refund result unknown; reconciliation required', retryable: false }, 500);
  }
}

export function registerRefundMutationHandlers(router: Hono<{ Bindings: Env }>): void {
  router.post('/refund', requireAuth(FINANCIAL_ROLES), audit('refund_create'), (c) => handleRefund(c));
}
