import type { Hono, Context } from 'hono';
import { publishOrderEvent } from '@aura/domain-order';
import { payosWebhookSchema } from '../../lib/validators';
import { createMetricsCollector } from '../../lib/metrics-collector';
import type { Env } from '../../types/env';
import { log, verifySignature } from './helpers';
import { sendOrderPaidNotifications } from './notifications';
import { settlePayOS, type SettlementPayment } from './payos-settlement';

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
      return c.json({ error: 1, message: 'Invalid signature' }, 401);
    }
    const orderCode = String(data.orderCode);
    const payment = await db.prepare('SELECT id, order_id, status, amount, method FROM payments WHERE transaction_id = ?')
      .bind(orderCode).first<SettlementPayment>();
    if (!payment) return ack('Unknown order, acknowledged');
    if (payment.method !== 'payos') return c.json({ error: 1, message: 'Payment method mismatch' }, 409);
    const order = await db.prepare('SELECT * FROM orders WHERE id = ?')
      .bind(payment.order_id).first<{ id: string; payment_status: string; payment_method: string; total?: number | null; total_amount?: number | null }>();
    if (!order || order.payment_method !== 'payos') return c.json({ error: 1, message: 'Payment method mismatch' }, 409);
    const rawStatus = String(data.status || '').toUpperCase();
    // The documented transaction result code is authoritative; a status label
    // cannot override a failed transfer code in a contradictory payload.
    const success = payload.success === true && data.code === '00';
    const amount = Number(data.amount);
    // Validate replays too: a completed row must never bypass amount validation.
    const orderAmount = Number(order.total ?? order.total_amount);
    if (success && (!Number.isSafeInteger(amount) || amount <= 0 || amount !== Number(payment.amount)
      || !Number.isSafeInteger(orderAmount) || orderAmount <= 0 || amount !== orderAmount)) {
      if (c.env.AUTH_KV) await c.env.AUTH_KV.put(`payment:stuck:${payment.order_id}`, JSON.stringify({
        orderId: payment.order_id, orderCode, dbAmount: payment.amount, webhookAmount: amount, detectedAt: now,
      }), { expirationTtl: 86400 * 7 }).catch(() => {});
      return c.json({ error: 1, message: 'Amount mismatch' }, 400);
    }
    if (payment.status === 'refunded' || order.payment_status === 'refunded') return ack('Already processed');
    if (payment.status === 'completed' && (!success || order.payment_status === 'paid')) return ack('Already processed');
    const status = success ? 'completed' : rawStatus === 'EXPIRED' ? 'expired' : rawStatus === 'CANCELLED' ? 'cancelled' : 'failed';
    const settled = await settlePayOS(db, payment, success, status, now);
    if (success && !settled.paymentChanged && payment.status !== 'completed') {
      const current = await db.prepare('SELECT status FROM payments WHERE id = ?').bind(payment.id).first<{ status: string }>();
      if (current?.status !== 'completed') return c.json({ error: 1, message: 'Payment requires reconciliation' }, 409);
    }
    if (settled.paymentChanged) {
      const metrics = createMetricsCollector(db);
      safeWaitUntil(c, metrics.recordMetric(success ? 'payment_success' : 'payment_failed', Number(payment.amount), { provider: 'payos', order_id: payment.order_id }));
      if (success) safeWaitUntil(c, metrics.recordMetric('revenue', Number(payment.amount), { provider: 'payos' }));
    }
    if (success && (settled.orderChanged || settled.paymentChanged)) {
      const kv = c.env.AUTH_KV;
      if (kv) {
        await kv.put('latest_order_ts', now).catch(() => {});
        await kv.put('orders:latest_updated_at', now).catch(() => {});
        await publishOrderEvent(kv, payment.order_id, 'paid').catch(() => {});
      }
      // One notification per successful payment transition; repair/replay cannot double-send.
      if (settled.paymentChanged) {
        try {
          const details = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(payment.order_id).first<Record<string, unknown>>();
          if (details) await sendOrderPaidNotifications(c, { ...details, total: details.total ?? details.total_amount }, now);
        } catch (err) { log.error('Order notifications failed', { message: (err as Error).message }); }
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
