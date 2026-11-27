import type { Hono, Context } from 'hono';
import {
  fanOutOrderBroadcast,
  normalizeBroadcastTotal,
  parseBroadcastItems,
  parseBroadcastTimestamp,
  publishOrderEvent,
} from '@aura/domain-order';
import { getDatabase } from '../../lib/db';
import { payosWebhookSchema } from '../../lib/validators';
import { createMetricsCollector } from '../../lib/metrics-collector';
import type { Env } from '../../types/env';
import { log, verifySignature } from './helpers';
import { sendKdsReleasePushNotification, sendOrderPaidNotifications } from './notifications';
import { isEnrolledSaasTenant, resolveMerchantPaymentConfig } from '../../lib/merchant-payment';
import { settlePayOS, type SettlementPayment } from './payos-settlement';
import { writePaymentReviewMarker } from '../../../../packages/domain/payment/commands/payos-reconcile-lease';
import { extractPayOSLinkId } from '../../../../packages/domain/payment/commands/payos-provider-verify';

const normalizeTenantId = (value: unknown): string => {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  return trimmed && trimmed !== '*' && trimmed.toLowerCase() !== 'hq' ? trimmed : 'default';
};

/** PayOS dashboard registration sends a signed synthetic payload with this fixed order code. */
const PAYOS_PROBE_ORDER_CODE = 123;

function safeWaitUntil(c: any, promise: Promise<any>): void {
  promise.catch(() => {});
  try { c.executionCtx?.waitUntil(promise); } catch { /* Local/sub-request context. */ }
}

/** Both public PayOS webhook URLs share validation, atomic settlement and replay repair. */
export async function handlePayosWebhook(
  c: Context<{ Bindings: Env }>,
  openApi = false,
  explicitTenantSlugOrId?: string
): Promise<Response> {
  const db = getDatabase(c as unknown as { env: Record<string, unknown> });
  const now = new Date().toISOString();
  const ack = (message: string) => openApi
    ? c.json({ success: true, data: { received: true } })
    : c.json({ error: 0, message, data: null });
  try {
    const payload = await c.req.json() as Record<string, unknown>;
    let targetTenantId = 'default';
    if (explicitTenantSlugOrId) {
      const tenantRow = await db
        .prepare('SELECT id FROM saas_tenants WHERE id = ? OR slug = ? LIMIT 1')
        .bind(explicitTenantSlugOrId, explicitTenantSlugOrId)
        .first<{ id: string }>()
        .catch(() => null);
      if (!tenantRow) {
        return c.json({ error: 1, message: 'Unknown tenant webhook endpoint' }, 404);
      }
      targetTenantId = tenantRow.id;
    }

    const merchantPayment = await resolveMerchantPaymentConfig(db, c.env, targetTenantId);
    const checksumKey =
      merchantPayment.payos?.checksumKey ||
      (!explicitTenantSlugOrId ? c.env.PAYOS_CHECKSUM_KEY : undefined);
    if (!checksumKey) {
      return c.json({ error: 1, message: 'Merchant PayOS checksum key not configured' }, explicitTenantSlugOrId ? 400 : 500);
    }

    if (!payload.data || typeof payload.data !== 'object' || !Object.keys(payload.data).length) return ack('Webhook endpoint alive');
    const signature = (payload.signature as string) || c.req.header('x-payos-signature');
    if (!signature) return c.json({ error: 1, message: 'Invalid signature' }, 401);
    const parsed = payosWebhookSchema.safeParse(payload);
    if (!parsed.success) return c.json({ error: 1, message: 'Invalid PayOS webhook payload' }, 400);
    const data = payload.data as Record<string, unknown>;
    if (!await verifySignature(data, signature, checksumKey)) {
      await writePaymentReviewMarker(c.env.AUTH_KV, {
        orderCode: String(data.orderCode ?? ''),
        source: 'webhook',
        stage: 'signature_verify',
        errorCode: 'INVALID_SIGNATURE',
        untrusted: true,
      });
      return c.json({ error: 1, message: 'Invalid signature' }, 401);
    }
    // Signed registration probe: acknowledged without touching any business table.
    if (Number(data.orderCode) === PAYOS_PROBE_ORDER_CODE) {
      return openApi
        ? c.json({ success: true, data: { received: true, probe: true } })
        : c.json({ error: 0, message: 'Probe acknowledged', data: { probe: true } });
    }
    const orderCode = String(data.orderCode);
    type WebhookPayment = SettlementPayment & { tenant_id?: string | null; payment_url?: string | null };
    let payment: WebhookPayment | null = null;
    try {
      payment = await db.prepare('SELECT id, order_id, status, amount, method, tenant_id, payment_url FROM payments WHERE transaction_id = ?')
        .bind(orderCode).first<WebhookPayment>();
    } catch {
      try {
        payment = await db.prepare('SELECT id, order_id, status, amount, method, tenant_id FROM payments WHERE transaction_id = ?')
          .bind(orderCode).first<WebhookPayment>();
      } catch {
        payment = await db.prepare('SELECT id, order_id, status, amount, method FROM payments WHERE transaction_id = ?')
          .bind(orderCode).first<WebhookPayment>();
      }
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
    const orderRow = order as Record<string, unknown>;
    // A missing tenant column means a legacy single-tenant schema; a present NULL/'' means 'default'.
    const rawPaymentTenant = 'tenant_id' in payment ? normalizeTenantId(payment.tenant_id) : '';
    const rawOrderTenant = 'tenant_id' in orderRow ? normalizeTenantId(orderRow.tenant_id) : '';
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
    const storedLinkId = extractPayOSLinkId(payment.payment_url);
    const webhookLinkId = typeof data.paymentLinkId === 'string' ? data.paymentLinkId.trim() : '';
    if (storedLinkId && webhookLinkId && storedLinkId !== webhookLinkId) {
      await writePaymentReviewMarker(c.env.AUTH_KV, {
        paymentId: payment.id,
        orderId: payment.order_id,
        orderCode,
        source: 'webhook',
        stage: 'link_check',
        errorCode: 'PAYMENT_LINK_MISMATCH',
      });
      return c.json({ error: 1, message: 'Payment link mismatch' }, 400);
    }
    const settledOrderTenant = rawOrderTenant || rawPaymentTenant || 'default';
    if (explicitTenantSlugOrId && settledOrderTenant !== targetTenantId) {
      await writePaymentReviewMarker(c.env.AUTH_KV, {
        paymentId: payment.id,
        orderId: payment.order_id,
        orderCode,
        source: 'webhook',
        stage: 'tenant_webhook_isolation',
        errorCode: 'CROSS_TENANT_WEBHOOK',
      });
      return c.json({ error: 1, message: 'Cross-tenant webhook order mismatch' }, 403);
    }
    if (!explicitTenantSlugOrId && settledOrderTenant !== 'default') {
      const enrolledSaas = await isEnrolledSaasTenant(db, settledOrderTenant);
      if (enrolledSaas) {
        return c.json({ error: 1, message: 'Tenant must use its dedicated PayOS webhook endpoint' }, 403);
      }
    }
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
    const normalizedInitialOrderPayStatus = String(order.payment_status || '').trim().toLowerCase();
    if (payment.status === 'refunded' || normalizedInitialOrderPayStatus === 'refunded') return ack('Already processed');
    if (
      payment.status === 'completed' &&
      (!success ||
        ['paid', 'partially_refunded', 'completed'].includes(normalizedInitialOrderPayStatus) ||
        isInitialTerminalOrder)
    ) {
      return ack('Already processed');
    }
    const status = success ? 'completed' : rawStatus === 'EXPIRED' ? 'expired' : rawStatus === 'CANCELLED' ? 'cancelled' : 'failed';
    const providerReference = typeof data.reference === 'string' ? data.reference.trim() : '';
    let settled: Awaited<ReturnType<typeof settlePayOS>>;
    try {
      settled = await settlePayOS(db, payment, success, status, now, providerReference || null);
    } catch (err) {
      if (/UNIQUE constraint failed:.*provider_reference/i.test(String(err))) {
        await writePaymentReviewMarker(c.env.AUTH_KV, {
          paymentId: payment.id,
          orderId: payment.order_id,
          orderCode,
          source: 'webhook',
          stage: 'provider_reference_check',
          errorCode: 'DUPLICATE_PROVIDER_REFERENCE',
        });
        return c.json({ error: 1, message: 'Duplicate provider reference' }, 409);
      }
      throw err;
    }
    if (success && !settled.paymentChanged && payment.status !== 'completed') {
      const current = await db.prepare('SELECT status FROM payments WHERE id = ?').bind(payment.id).first<{ status: string }>();
      if (current?.status !== 'completed') return c.json({ error: 1, message: 'Payment requires reconciliation' }, 409);
    }
    if (settled.paymentChanged) {
      const metrics = createMetricsCollector(db);
      safeWaitUntil(c, metrics.recordMetric(success ? 'payment_success' : 'payment_failed', Number(payment.amount), { provider: 'payos', order_id: payment.order_id, tenant_id: settledOrderTenant }));
      if (success && !isInitialTerminalOrder) {
        safeWaitUntil(c, metrics.recordMetric('revenue', Number(payment.amount), { provider: 'payos', tenant_id: settledOrderTenant }));
      }
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
          await publishOrderEvent(
            kv,
            payment.order_id,
            String(effectiveOrderRecord.status || 'pending'),
            {
              tenantId: settledOrderTenant,
              paymentStatus: 'paid',
            },
          ).catch(() => {});
        }
        if (c.env.ORDER_BROADCASTER) {
          try {
            const eventPayload = {
              orderId: payment.order_id,
              status: String(effectiveOrderRecord.status || 'pending'),
              payment_status: 'paid',
              items: parseBroadcastItems(effectiveOrderRecord.items),
              total: normalizeBroadcastTotal(effectiveOrderRecord.total ?? effectiveOrderRecord.total_amount ?? payment.amount ?? 0),
              customer_name: String(effectiveOrderRecord.customer_name ?? ''),
              customer_phone: String(effectiveOrderRecord.customer_phone ?? ''),
              table_id: effectiveOrderRecord.table_id ? String(effectiveOrderRecord.table_id) : null,
              ...(settledOrderTenant !== 'default' ? { tenant_id: settledOrderTenant } : {}),
              createdAt: parseBroadcastTimestamp(effectiveOrderRecord.created_at),
              updatedAt: Date.now(),
            };
            safeWaitUntil(
              c,
              fanOutOrderBroadcast(c.env.ORDER_BROADCASTER, payment.order_id, settledOrderTenant, eventPayload),
            );
          } catch {
            /* Non-blocking realtime broadcast */
          }
        }
        // One notification per successful payment transition; repair/replay cannot double-send.
        if (settled.paymentChanged) {
          await sendKdsReleasePushNotification(c, effectiveOrderRecord, settledOrderTenant);
          if (details) {
            try {
              await sendOrderPaidNotifications(c, { ...details, total: details.total ?? details.total_amount }, now);
            } catch (err) { log.error('Order notifications failed', { message: (err as Error).message }); }
          }
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
  router.post('/payos/:tenantSlug', (c) => handlePayosWebhook(c, false, c.req.param('tenantSlug')));
}
