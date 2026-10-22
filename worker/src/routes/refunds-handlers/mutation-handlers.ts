import type { Hono, Context } from 'hono';
import { requireAuth } from '../../middleware/auth';
import { audit } from '../../middleware/audit-log';
import { canAccessPaymentOrder, FINANCIAL_ROLES, hasFinancialRole } from '../../../../packages/domain/payment/policies/payment-access';
import type { Env } from '../../types/env';
import { log, refundRequestSchema, ERRORS } from './helpers';

export async function handleRefund(c: Context<{ Bindings: Env }>, openApi = false): Promise<Response> {
  if (!hasFinancialRole(c)) return c.json({ success: false, error: 'Forbidden' }, 403);
  const db = c.env.AURA_DB;
  try {
    const body = await c.req.json() as Record<string, unknown>;
    if (!body.paymentId) return c.json({ success: false, error: 'Missing paymentId' }, 400);
    const payment = await db.prepare(`SELECT p.*, o.tenant_id, o.customer_id
      FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = ?`)
      .bind(String(body.paymentId)).first<{ id: string; order_id: string; method: string; amount: number;
        status: string; transaction_id: string; refund_status: string | null; tenant_id: string | null; customer_id: string | null }>();
    if (!payment || !canAccessPaymentOrder(c, payment)) return c.json(ERRORS.PAYMENT_NOT_FOUND, 404);
    const parsed = refundRequestSchema.safeParse(openApi ? { ...body, amount: body.amount ?? payment.amount, reason: body.reason || 'Staff refund' } : body);
    if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    const { amount } = parsed.data;
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
