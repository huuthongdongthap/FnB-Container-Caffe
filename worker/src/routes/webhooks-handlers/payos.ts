import type { Hono } from 'hono';
import { payosWebhookSchema } from '../../lib/validators';
import { createMetricsCollector } from '../../lib/metrics-collector';
import type { Env } from '../../types/env';
import { log, verifySignature } from './helpers';
import { sendOrderPaidNotifications } from './notifications';

export function registerPayosWebhook(router: Hono<{ Bindings: Env }>): void {
  router.post('/payos', async (c) => {
    const db = c.env.AURA_DB;
    const now = new Date().toISOString();

    try {
      const payload = await c.req.json() as Record<string, unknown>;
      const signature = (payload.signature as string) || c.req.header('x-payos-signature');

      if (!c.env.PAYOS_CHECKSUM_KEY) {
        log.error('PAYOS_CHECKSUM_KEY not configured');
        return c.json({ error: 1, message: 'Server misconfiguration' }, 500);
      }

      if (!signature || !payload.data || typeof payload.data !== 'object' || Object.keys(payload.data as Record<string, unknown>).length === 0) {
        log.info('PayOS test probe / empty payload - ack 200');
        return c.json({ error: 0, message: 'Webhook endpoint alive', data: null });
      }

      const parsed = payosWebhookSchema.safeParse(payload);
      if (!parsed.success) {
        log.warn('PayOS webhook schema mismatch', { issues: parsed.error.issues });
        // Proceed with raw payload for compatibility
      }

      const isValid = await verifySignature(payload.data as Record<string, unknown>, signature, c.env.PAYOS_CHECKSUM_KEY);
      if (!isValid) {
        log.error('Invalid PayOS webhook signature');
        const mc = createMetricsCollector(db);
        c.executionCtx?.waitUntil(mc.recordMetric('webhook_rejected', 1, { provider: 'payos', reason: 'invalid_signature' }));
        return c.json({ error: 1, message: 'Invalid signature' }, 401);
      }

      const data = payload.data as Record<string, unknown>;
      const orderCode = data.orderCode as string | number;
      const amount = data.amount as number;
      const code = data.code as string;
      const isSuccess = payload.success === true || code === '00';

      log.info('PayOS webhook', { orderCode: String(orderCode), amount, success: isSuccess });

      if (!orderCode) {
        return c.json({ error: 0, message: 'No orderCode, skipped', data: null });
      }

      const existingPayment = await db.prepare(
        'SELECT id, order_id, status, amount FROM payments WHERE transaction_id = ?'
      ).bind(String(orderCode)).first<{ id: string; order_id: string; status: string; amount: number }>();

      if (!existingPayment) {
        log.warn('Unknown orderCode - no payment row', { orderCode: String(orderCode) });
        const mc = createMetricsCollector(db);
        c.executionCtx?.waitUntil(mc.recordMetric('webhook_rejected', 1, { provider: 'payos', reason: 'unknown_order' }));
        return c.json({ error: 0, message: 'Unknown order, acknowledged', data: null });
      }

      if (existingPayment.status === 'completed') {
        log.info('Already processed', { orderCode: String(orderCode), status: existingPayment.status });
        if (existingPayment.order_id) {
          const orderRow = await db.prepare('SELECT id, payment_status, payment_method FROM orders WHERE id = ?').bind(existingPayment.order_id).first<{ id: string; payment_status: string; payment_method: string }>();
          if (orderRow && orderRow.payment_status !== 'paid' && orderRow.payment_method === 'payos') {
            await db.prepare('UPDATE orders SET payment_status = \'paid\', updated_at = ? WHERE id = ?').bind(now, existingPayment.order_id).run();
            log.info('Self-healed order', { order_id: existingPayment.order_id });
          }
        }
        return c.json({ error: 0, message: 'Already processed', data: null });
      }

      if (isSuccess && amount && parseInt(String(amount), 10) !== parseInt(String(existingPayment.amount), 10)) {
        log.error('Amount mismatch', { orderCode: String(orderCode), db: existingPayment.amount, webhook: amount });
        const kv = c.env.AUTH_KV;
        if (kv) {
          await kv.put(
            `payment:stuck:${existingPayment.order_id}`,
            JSON.stringify({ orderId: existingPayment.order_id, orderCode, dbAmount: existingPayment.amount, webhookAmount: amount, detectedAt: now }),
            { expirationTtl: 86400 * 7 }
          );
        }
        const mc = createMetricsCollector(db);
        c.executionCtx?.waitUntil(mc.recordMetric('webhook_rejected', 1, { provider: 'payos', reason: 'amount_mismatch' }));
        return c.json({ error: 1, message: 'Amount mismatch' }, 400);
      }

      // Success may supersede a previous failure; failures may only transition from pending.
      const newStatus = isSuccess ? 'completed' : 'failed';
      const statusGuard = isSuccess ? 'status != \'completed\'' : 'status = \'pending\'';
      const transition = await db.prepare(
        `UPDATE payments SET status = ? WHERE transaction_id = ? AND ${statusGuard}`
      ).bind(newStatus, String(orderCode)).run();
      const transitionMeta = (transition as unknown as { meta?: { changes?: number } }).meta;
      const changedRows = transitionMeta?.changes ?? 0;
      if (changedRows === 0) {
        log.info('Already processed (race lost)', { orderCode: String(orderCode), status: existingPayment.status });
        return c.json({ error: 0, message: 'Already processed', data: null });
      }

      // Metrics: record payment outcome
      const amountNum = amount ? parseInt(String(amount), 10) : 0;
      const mc = createMetricsCollector(db);
      if (isSuccess) {
        c.executionCtx?.waitUntil(mc.recordMetric('payment_success', amountNum, {
          provider: 'payos',
          order_id: existingPayment.order_id || ''
        }));
        c.executionCtx?.waitUntil(mc.recordMetric('revenue', amountNum, {
          provider: 'payos'
        }));
      } else {
        c.executionCtx?.waitUntil(mc.recordMetric('payment_failed', amountNum, {
          provider: 'payos',
          order_id: existingPayment.order_id || '',
          reason: data.code ? String(data.code) : 'unknown'
        }));
      }

      if (isSuccess && existingPayment.order_id) {
        await db.prepare(
          'UPDATE orders SET payment_status = \'paid\', updated_at = ? WHERE id = ? AND payment_method = \'payos\''
        ).bind(now, existingPayment.order_id).run();

        const kv = c.env.AUTH_KV;
        if (kv) {
          await kv.put('latest_order_ts', now);
        }

        try {
          const orderRow = await db.prepare(
            'SELECT id, items, total, customer_name, customer_phone, customer_email, customer_address, payment_method, notes FROM orders WHERE id = ?'
          ).bind(existingPayment.order_id).first<Record<string, unknown>>();

          if (orderRow) {
            await sendOrderPaidNotifications(c, orderRow, now);
          }
        } catch (orderErr) {
          log.error('Order query/notifications failed:', { message: (orderErr as Error).message });
        }

        log.info('PayOS: Order paid + Telegram fired', { order_id: existingPayment.order_id });
      }

      return c.json({ error: 0, message: 'Webhook processed', data: null });
    } catch (err) {
      log.error('PayOS webhook error:', { message: (err as Error).message });
      const kv = c.env.AUTH_KV;
      if (kv) {
        const dlqKey = `webhook:dlq:${Date.now()}`;
        await kv.put(dlqKey, JSON.stringify({
          error: (err as Error).message,
          stack: (err as Error).stack,
          timestamp: new Date().toISOString()
        }), { expirationTtl: 86400 * 7 });
      }
      return c.json({ error: 1, message: 'Internal error' }, 500);
    }
  });
}
