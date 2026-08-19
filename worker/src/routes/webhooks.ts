/**
 * Webhook Routes — PayOS IPN Handler
 * Converted from routes/webhooks.js with TypeScript.
 * Verifies HMAC-SHA256 signature + updates D1 database.
 */

import { Hono } from 'hono';
import { notifyTelegram } from './orders';
import { payosWebhookSchema } from '../lib/validators';
import { createLogger } from '../middleware/logger';
import { createMetricsCollector } from '../lib/metrics-collector';
import { momoWebhook } from './webhooks/momo';
import { createErpnextClient } from '../clients/erpnext-client';
import type { Env } from '../types/env';
import type { EmailEnv } from '../lib/email';

const log = createLogger({ route: 'webhooks' });
export const webhookRouter = new Hono<{ Bindings: Env }>();

async function verifySignature(data: Record<string, unknown>, receivedSignature: string, checksumKey: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(checksumKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );

  const sortedData = Object.keys(data).sort().map((k) => `${k}=${data[k]}`).join('&');
  const computed = await crypto.subtle.sign('HMAC', key, encoder.encode(sortedData));
  const computedHex = Array.from(new Uint8Array(computed)).map((b) => b.toString(16).padStart(2, '0')).join('');

  // Constant-time comparison to prevent timing attacks
  const a = new TextEncoder().encode(computedHex);
  const b = new TextEncoder().encode(receivedSignature);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

webhookRouter.post('/payos', async(c) => {
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
      return c.json({ error: 0, message: 'Unknown order, acknowledged', data: null });
    }

    if (existingPayment.status === 'completed' || existingPayment.status === 'failed') {
      log.info('Already processed', { orderCode: String(orderCode), status: existingPayment.status });
      if (existingPayment.status === 'completed' && existingPayment.order_id) {
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
      return c.json({ error: 1, message: 'Amount mismatch' }, 400);
    }

    const newStatus = isSuccess ? 'completed' : 'failed';
    await db.prepare('UPDATE payments SET status = ? WHERE transaction_id = ? AND status = \'pending\'').bind(newStatus, String(orderCode)).run();

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

      let orderRow: Record<string, unknown> | null = null;
      try {
        orderRow = await db.prepare(
          'SELECT id, items, total, customer_name, customer_phone, customer_email, customer_address, payment_method, notes FROM orders WHERE id = ?'
        ).bind(existingPayment.order_id).first<Record<string, unknown>>();

        if (orderRow) {
          let parsedItems: Array<Record<string, unknown>> = [];
          try {
            parsedItems = JSON.parse((orderRow.items as string) || '[]');
          } catch { /* ignore */ }
          const tgPromise = notifyTelegram(c.env as unknown as Record<string, unknown>, {
            id: orderRow.id,
            items: parsedItems,
            total: orderRow.total,
            customer_name: orderRow.customer_name,
            customer_phone: orderRow.customer_phone,
            customer_address: orderRow.customer_address,
            payment_method: orderRow.payment_method,
            notes: orderRow.notes
          }).catch(e => log.error('Telegram webhook error:', { message: (e as Error).message }));
          if (c.executionCtx?.waitUntil) {
            c.executionCtx.waitUntil(tgPromise);
          } else {
            await tgPromise;
          }
        }
      } catch (tgErr) {
        log.error('Telegram webhook failed:', { message: (tgErr as Error).message });
      }

      if (isSuccess && orderRow?.customer_email) {
        try {
          const { sendEmail } = await import('../lib/email.js');
          const { renderReceipt } = await import('../templates/receipt.js');
          const paymentLabels: Record<string, string> = { cod: 'COD', payos: 'PayOS' };
          const emailPromise = sendEmail(c.env as unknown as EmailEnv, {
            to: orderRow.customer_email as string,
            subject: `Thanh toán thành công #${orderRow.id as string} — AURA CAFE`,
            html: renderReceipt({
              id: orderRow.id as string,
              total: orderRow.total as number,
              payment_method: paymentLabels[orderRow.payment_method as string] || (orderRow.payment_method as string),
              payment_time: now
            })
          }).catch(e => log.error('Email receipt error:', { message: (e as Error).message }));
          if (c.executionCtx?.waitUntil) {
            c.executionCtx.waitUntil(emailPromise);
          }
        } catch (emailErr) {
          log.error('Email receipt failed:', { message: (emailErr as Error).message });
        }
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

// MoMo webhook
momoWebhook(webhookRouter);
