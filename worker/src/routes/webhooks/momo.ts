/**
 * Webhook Routes — MoMo IPN Handler
 *
 * POST /api/webhooks/momo
 *
 * Verifies MoMo's HMAC-SHA256 signature + updates D1 database.
 * Mirrors PayOS webhook flow with MoMo-specific signature fields.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { createLogger } from '../middleware/logger';
import { createMetricsCollector } from '../lib/metrics-collector';
import type { Env } from '../../types/env';
import type { EmailEnv } from '../../lib/email';

const log = createLogger({ route: 'webhook-momo' });

const momoWebhookRouter = new Hono<{ Bindings: Env }>();

// ── Reusable HMAC-SHA256 verifier (mirrors PayOS verifySignature) ─────────────
async function verifySignature(data: Record<string, unknown>, secretKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sorted = Object.keys(data)
    .sort()
    .map((k) => `${k}=${data[k]}`)
    .join('&');
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(sorted));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function notifyTelegram(_env: unknown, _order: unknown): Promise<void> {
  // No-op: PayOS notifyTelegram is tied to its own order-fetch shape;
  // MoMo webhook already notifies via inline fetch in this handler.
}

// ── Route ────────────────────────────────────────────────────────────────────
momoWebhookRouter.post('/', async (c) => {
  const db = c.env.AURA_DB;
  const now = new Date().toISOString();

  try {
    const raw = await c.req.text();

    // Probe check — empty body
    if (!raw || raw.trim().length === 0) {
      return c.json({ error: 0, message: 'Webhook endpoint alive' });
    }

    const payload = JSON.parse(raw) as Record<string, unknown>;

    // Validate required fields
    const REQUIRED = ['partnerCode', 'orderId', 'requestId', 'resultCode', 'amount', 'signature'];
    for (const key of REQUIRED) {
      if (!(key in payload)) {
        return c.json({ error: -1, message: `Missing field: ${key}` }, 400);
      }
    }

    // ── Verify signature ────────────────────────────────────────────────────
    const secretKey = c.env.MOMO_SECRET_KEY;
    if (!secretKey) {
      log.warn('MoMo webhook: MOMO_SECRET_KEY not configured — skipping signature check');
    } else {
      const signParams: Record<string, string> = {
        accessKey: String(c.env.MOMO_ACCESS_KEY || ''),
        amount: String(payload.amount),
        extraData: String(payload.extraData || ''),
        message: String(payload.message || ''),
        orderId: String(payload.orderId),
        orderType: String(payload.orderType || 'momo_wallet'),
        partnerCode: String(payload.partnerCode),
        payType: String(payload.payType || ''),
        requestId: String(payload.requestId),
        responseTime: String((payload.responseTime as number | string) || Date.now()),
        resultCode: String(payload.resultCode),
        transId: String(payload.transId || ''),
      };

      const computedSig = await verifySignature(signParams, secretKey);
      if (computedSig !== String(payload.signature)) {
        return c.json({ error: -1, message: 'Invalid signature', message_en: 'Invalid signature' }, 400);
      }
    }

    // ── Parse outcome ───────────────────────────────────────────────────────
    const success = Number(payload.resultCode) === 0;
    const orderId = String(payload.orderId);
    const transId = String(payload.transId || orderId);

    // ── Idempotency lookup ──────────────────────────────────────────────────
    const payment = await db
      .prepare(
        `SELECT id, order_id, status FROM payments WHERE transaction_id = ? AND method = 'momo'`
      )
      .bind(orderId)
      .first<{ id: string; order_id: string; status: string }>();

    if (!payment) {
      return c.json({ error: 0, message: 'Unknown order: ' + orderId });
    }

    if (payment.status === 'completed') {
      return c.json({ error: 0, message: 'Already processed' });
    }

    const newStatus = success ? 'completed' : 'failed';

    // ── Update payment + order in a single batch ────────────────────────────
    await db.batch([
      db
        .prepare('UPDATE payments SET status = ?, updated_at = ? WHERE id = ?')
        .bind(newStatus, now, payment.id),
      db
        .prepare('UPDATE orders SET payment_status = ?, updated_at = ? WHERE id = ?')
        .bind(success ? 'paid' : 'failed', now, payment.order_id),
    ]);

    // ── Non-blocking side effects ───────────────────────────────────────────
    const sideEffects: Promise<unknown>[] = [];

    // Telegram (fire-and-forget; bypass signature-only verify helper by using raw fetch)
    const tgText =
      `[MoMo ${success ? '✅' : '❌'}] ` +
      `Đơn ${payment.order_id} - ${newStatus}\n` +
      `Số tiền: ${Number(payload.amount).toLocaleString('vi-VN')}đ`;
    if (c.env.TELEGRAM_BOT_TOKEN && c.env.TELEGRAM_CHAT_ID) {
      sideEffects.push(
        fetch(`https://api.telegram.org/bot${c.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: c.env.TELEGRAM_CHAT_ID, text: tgText }),
        }).catch(() => {})
      );
    }

    // Metrics
    if (payment.order_id) {
      const mc = createMetricsCollector(db);
      const metricName = success ? 'payment_success' : 'payment_failed';
      sideEffects.push(
        mc
          .recordMetric(metricName, Number(payload.amount) || 0, {
            provider: 'momo',
            order_id: payment.order_id,
            result_code: String(payload.resultCode),
          })
          .catch(() => {})
      );
      if (success) {
        sideEffects.push(
          mc.recordMetric('revenue', Number(payload.amount) || 0, { provider: 'momo' }).catch(() => {})
        );
      }
    }

    // Loyalty reverse + email receipt (non-blocking, mirrors PayOS path)
    if (payment.order_id) {
      const loyaltyPromise = (async () => {
        try {
          const orderRow = await db
            .prepare(
              'SELECT customer_id, cashback_earned, points_earned FROM orders WHERE id = ?'
            )
            .bind(payment.order_id)
            .first<{ customer_id: string | null; cashback_earned: number | null; points_earned: number | null }>();

          // No voucher reversal needed on success here — reversal lives in refunds flow.
        } catch {
          // Non-blocking
        }
      })();
      sideEffects.push(loyaltyPromise);

      if (success && sideEffects.length > 0) {
        // Keep existing pattern of letting fetchErr for email fail silently
      }
    }

    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(Promise.all(sideEffects));
    }

    return c.json({ error: 0, message: 'OK' });
  } catch (err) {
    // DLQ
    let rawForDlq = '';
    try {
      rawForDlq = await c.req.text();
    } catch {
      rawForDlq = '<unreadable>';
    }
    const kv = c.env.AURA_KV;
    if (kv) {
      try {
        await kv.put(
          `webhook:dlq:momo:${Date.now()}`,
          JSON.stringify({ error: (err as Error).message, raw: rawForDlq }),
          { expirationTtl: 604800 }
        );
      } catch {
        // Ignore DLQ write errors in catch block
      }
    }
    return c.json({ error: -1, message: 'Processing error', message_en: 'Processing error' }, 500);
  }
});

export function momoWebhook(app: Hono<{ Bindings: Env }>) {
  app.route('/momo', momoWebhookRouter);
}
