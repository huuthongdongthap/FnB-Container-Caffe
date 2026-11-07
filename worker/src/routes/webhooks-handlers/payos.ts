import type { Hono, Context } from 'hono';
import { publishOrderEvent } from '@aura/domain-order';
import { payosWebhookSchema } from '../../lib/validators';
import { createMetricsCollector } from '../../lib/metrics-collector';
import type { Env } from '../../types/env';
import { log, verifySignature } from './helpers';
import { sendOrderPaidNotifications } from './notifications';
import { settlePayOS, type SettlementPayment } from './payos-settlement';
import { writePaymentReviewMarker } from '../../../../packages/domain/payment/commands/payos-reconcile-lease';

function safeWaitUntil(c: any, promise: Promise<any>): void {
  promise.catch(() => {});
  try { c.executionCtx?.waitUntil(promise); } catch { /* Local/sub-request context. */ }
}

/** Both public PayOS webhook URLs share validation, atomic settlement and replay repair. */
export async function handlePayosWebhook(c: Context<{ Bindings: Env }>, openApi = false): Promise<Response> {
  const db = c.env.AURA_DB;
  const now = new Date().toISOString();
  const ack = (message: string) => openApi
    ? c.json({ success: true, data: { received: true } })
    : c.json({ error: 0, message, data: null });
  try {
    const payload = await c.req.json() as Record<string, unknown>;
    if (!c.env.PAYOS_CHECKSUM_KEY) return c.json({ error: 1, message: 'Server misconfiguration' }, 500);
    if (!payload.data || typeof payload.data !== 'object' || !Object.keys(payload.data).length) return ack('Webhook endpoint alive');
    const signature = (payload.signature as string) || c.req.header('x-payos-signature');
    if (!signature) return c.json({ error: 1, message: 'Invalid signature' }, 401);
    const parsed = payosWebhookSchema.safeParse(payload);
    if (!parsed.success) return c.json({ error: 1, message: 'Invalid PayOS webhook payload' }, 400);
    const data = payload.data as Record<string, unknown>;
    if (!await verifySignature(data, signature, c.env.PAYOS_CHECKSUM_KEY)) {
      await writePaymentReviewMarker(c.env.AUTH_KV, {
        orderCode: String(data.orderCode ?? ''),
        source: 'webhook',
        stage: 'signature_verify',
        errorCode: 'INVALID_SIGNATURE',
        untrusted: true,
      });
      return c.json({ error: 1, message: 'Invalid signature' }, 401);
    }
    const orderCode = String(data.orderCode);
    let payment: (SettlementPayment & { tenant_id?: string | null }) | null = null;
    try {
      payment = await db.prepare('SELECT id, order_id, status, amount, method, tenant_id FROM payments WHERE transaction_id = ?')
        .bind(orderCode).first<SettlementPayment & { tenant_id?: string | null }>();
    } catch {
      payment = await db.prepare('SELECT id, order_id, status, amount, method FROM payments WHERE transaction_id = ?')
        .bind(orderCode).first<SettlementPayment & { tenant_id?: string | null }>();
    }
    if (!payment) {
      await writePaymentReviewMarker(c.env.AUTH_KV, {
        orderCode,
        source: 'webhook',
        stage: 'payment_lookup',
        errorCode: 'UNKNOWN_ORDER_CODE',
      });
      return ack('Unknown order, acknowledged');
    }
    if (payment.method !== 'payos') return c.json({ error: 1, message: 'Payment method mismatch' }, 409);
    const order = await db.prepare('SELECT * FROM orders WHERE id = ?')
      .bind(payment.order_id).first<{ id: string; payment_status: string; payment_method: string; total?: number | null; total_amount?: number | null; tenant_id?: string | null }>();
    if (!order || order.payment_method !== 'payos') return c.json({ error: 1, message: 'Payment method mismatch' }, 409);
    const rawPaymentTenant = typeof payment.tenant_id === 'string' ? payment.tenant_id.trim() : '';
    const rawOrderTenant =
      typeof (order as Record<string, unknown>).tenant_id === 'string' && String((order as Record<string, unknown>).tenant_id).trim()
        ? String((order as Record<string, unknown>).tenant_id).trim()
        : '';
    if (rawPaymentTenant && rawOrderTenant && rawPaymentTenant !== rawOrderTenant) {
      await writePaymentReviewMarker(c.env.AUTH_KV, {
        paymentId: payment.id,
        orderId: payment.order_id,
        orderCode,
        source: 'webhook',
        stage: 'tenant_check',
        errorCode: 'TENANT_MISMATCH',
      });
      return c.json({ error: 1, message: 'Payment tenant mismatch' }, 409);
    }
    const settledOrderTenant = rawOrderTenant || rawPaymentTenant || 'default';
    const rawStatus = String(data.status || '').toUpperCase();
    // The documented transaction result code is authoritative; a status label
    // cannot override a failed transfer code in a contradictory payload.
    const success = payload.success === true && data.code === '00';
    const amount = Number(data.amount);
    // Validate replays too: a completed row must never bypass amount validation.
    const orderAmount = Number(order.total ?? order.total_amount);
    if (success && (!Number.isSafeInteger(amount) || amount <= 0 || amount !== Number(payment.amount)
      || !Number.isSafeInteger(orderAmount) || orderAmount <= 0 || amount !== orderAmount)) {
      const stuckKey = settledOrderTenant === 'default' ? `payment:stuck:${payment.order_id}` : `payment:stuck:${settledOrderTenant}:${payment.order_id}`;
      if (c.env.AUTH_KV) await c.env.AUTH_KV.put(stuckKey, JSON.stringify({
        orderId: payment.order_id, orderCode, dbAmount: payment.amount, webhookAmount: amount, tenantId: settledOrderTenant, detectedAt: now,
      }), { expirationTtl: 86400 * 7 }).catch(() => {});
      await writePaymentReviewMarker(c.env.AUTH_KV, {
        paymentId: payment.id,
        orderId: payment.order_id,
        orderCode,
        source: 'webhook',
        stage: 'amount_check',
        errorCode: 'AMOUNT_MISMATCH',
      });
      return c.json({ error: 1, message: 'Amount mismatch' }, 400);
    }
    const initialOrderStatus = String((order as Record<string, unknown>).status || '').trim().toLowerCase();
    const isInitialTerminalOrder = ['cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded'].includes(initialOrderStatus);
    if (payment.status === 'refunded' || order.payment_status === 'refunded') return ack('Already processed');
    if (payment.status === 'completed' && (!success || order.payment_status === 'paid' || isInitialTerminalOrder)) return ack('Already processed');
    const status = success ? 'completed' : rawStatus === 'EXPIRED' ? 'expired' : rawStatus === 'CANCELLED' ? 'cancelled' : 'failed';
    const settled = await settlePayOS(db, payment, success, status, now);
    if (success && !settled.paymentChanged && payment.status !== 'completed') {
      const current = await db.prepare('SELECT status FROM payments WHERE id = ?').bind(payment.id).first<{ status: string }>();
      if (current?.status !== 'completed') return c.json({ error: 1, message: 'Payment requires reconciliation' }, 409);
    }
    if (settled.paymentChanged) {
      const metrics = createMetricsCollector(db);
      safeWaitUntil(c, metrics.recordMetric(success ? 'payment_success' : 'payment_failed', Number(payment.amount), { provider: 'payos', order_id: payment.order_id, tenant_id: settledOrderTenant }));
      if (success) safeWaitUntil(c, metrics.recordMetric('revenue', Number(payment.amount), { provider: 'payos', tenant_id: settledOrderTenant }));
    }
    if (success && (settled.orderChanged || settled.paymentChanged)) {
      const orderRecord = order as Record<string, unknown>;
      let details: Record<string, unknown> | null = null;
      try {
        details = await db.prepare("SELECT * FROM orders WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(payment.order_id, settledOrderTenant)
          .first<Record<string, unknown>>();
      } catch {
        if (settledOrderTenant === 'default') {
          details = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(payment.order_id).first<Record<string, unknown>>().catch(() => null);
        } else {
          details = null;
        }
      }
      const effectiveOrderRecord = details ?? orderRecord;
      const orderStatus = String(effectiveOrderRecord.status ?? orderRecord.status ?? '').trim().toLowerCase();
      const isCancelledOrFailedOrder = ['cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded'].includes(orderStatus);
      if (isCancelledOrFailedOrder) {
        const reviewTag = '[PAID_ON_CANCELLED_ORDER_REQUIRES_REVIEW]';
        try {
          await db
            .prepare(
              `UPDATE orders
               SET notes = CASE
                 WHEN notes IS NULL OR TRIM(notes) = '' THEN ?
                 WHEN INSTR(notes, ?) > 0 THEN notes
                 ELSE notes || ' ' || ?
               END,
               updated_at = ?
               WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            )
            .bind(reviewTag, reviewTag, reviewTag, now, payment.order_id, settledOrderTenant)
            .run();
        } catch {
          if (settledOrderTenant === 'default') {
            await db
              .prepare(
                `UPDATE orders
                 SET notes = CASE
                   WHEN notes IS NULL OR TRIM(notes) = '' THEN ?
                   WHEN INSTR(notes, ?) > 0 THEN notes
                   ELSE notes || ' ' || ?
                 END,
                 updated_at = ?
                 WHERE id = ?`
              )
              .bind(reviewTag, reviewTag, reviewTag, now, payment.order_id)
              .run()
              .catch(() => {});
          }
        }
        await writePaymentReviewMarker(c.env.AUTH_KV, {
          paymentId: payment.id,
          orderId: payment.order_id,
          orderCode,
          source: 'webhook',
          stage: 'cancelled_order_paid',
          errorCode: 'PAID_ON_CANCELLED_ORDER',
        });
      } else {
        const kv = c.env.AUTH_KV;
        if (kv) {
          const latestOrderKey = settledOrderTenant === 'default' ? 'latest_order_ts' : `latest_order_ts:${settledOrderTenant}`;
          const latestUpdatedKey = settledOrderTenant === 'default' ? 'orders:latest_updated_at' : `orders:latest_updated_at:${settledOrderTenant}`;
          await kv.put(latestOrderKey, now).catch(() => {});
          await kv.put(latestUpdatedKey, now).catch(() => {});
          await publishOrderEvent(kv, payment.order_id, 'paid').catch(() => {});
        }
        // One notification per successful payment transition; repair/replay cannot double-send.
        if (settled.paymentChanged && details) {
          try {
            await sendOrderPaidNotifications(c, { ...details, total: details.total ?? details.total_amount }, now);
          } catch (err) { log.error('Order notifications failed', { message: (err as Error).message }); }
        }
      }
      if (!isCancelledOrFailedOrder && (orderRecord.customer_id || orderRecord.customer_phone || orderRecord.customer_email)) {
        try {
          const { creditLoyaltyIfEligible } = await import('@aura/domain-order');
          await creditLoyaltyIfEligible(db, c.env as unknown as Record<string, unknown>, payment.order_id);
        } catch (err) { log.warn('PayOS loyalty credit error (non-blocking)', { message: (err as Error).message }); }
        try {
          const digits = String(orderRecord.customer_phone || '').replace(/\D/g, '');
          const normalizedPhone = digits.length >= 9 && digits.length <= 15 && !/^0+$/.test(digits) ? digits : null;
          const trimmedEmail = typeof orderRecord.customer_email === 'string' ? orderRecord.customer_email.trim() : '';
          const sanitizedEmail = trimmedEmail.length > 0 && trimmedEmail.includes('@') ? trimmedEmail : null;
          let refCustomerId = orderRecord.customer_id ? String(orderRecord.customer_id).trim() || null : null;
          if (!refCustomerId && (normalizedPhone || sanitizedEmail)) {
            const orderTenant = settledOrderTenant;
            let cust: { id: string } | null = null;
            try {
              cust = await db.prepare(
                "SELECT id FROM customers WHERE ((email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL)) AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 1"
              ).bind(sanitizedEmail, normalizedPhone, orderTenant, orderTenant).first<{ id: string }>();
            } catch {
              // Only fall back to unscoped customer lookup on legacy single-tenant ('default') schema;
              // non-default tenants fail closed to prevent cross-tenant referral attribution.
              if (!orderTenant || orderTenant === 'default') {
                cust = await db.prepare(
                  'SELECT id FROM customers WHERE (email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL) LIMIT 1'
                ).bind(sanitizedEmail, normalizedPhone).first<{ id: string }>().catch(() => null);
              } else {
                cust = null;
              }
            }
            refCustomerId = cust?.id ?? null;
          }
          if (refCustomerId && orderAmount >= 20000) {
            const { rewardReferralOnFirstOrder, resolveReferralPolicy, DEFAULT_REFERRAL_POLICY } = await import('@aura/domain-crm');
            const orderTenantForRef = settledOrderTenant;
            const refPolicy = await resolveReferralPolicy(c.env.AUTH_KV, orderTenantForRef).catch(() => DEFAULT_REFERRAL_POLICY);
            await rewardReferralOnFirstOrder(db, refCustomerId, payment.order_id, orderAmount, refPolicy, orderTenantForRef);
          }
        } catch (err) { log.warn('PayOS referral reward error (non-blocking)', { message: (err as Error).message }); }
      }
    }
    return ack(settled.paymentChanged ? 'Webhook processed' : 'Already processed');
  } catch (err) {
    log.error('PayOS webhook error', { message: (err as Error).message });
    await c.env.AUTH_KV?.put(`webhook:dlq:${Date.now()}`, JSON.stringify({
      error: 'PayOS settlement failed', timestamp: now,
    }), { expirationTtl: 86400 * 7 }).catch(() => {});
    return c.json({ error: 1, message: 'Internal error' }, 500);
  }
}

export function registerPayosWebhook(router: Hono<{ Bindings: Env }>): void {
  router.post('/payos', (c) => handlePayosWebhook(c));
}
