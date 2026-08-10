// payments-nowpayments.ts — IPN webhook for NowPayments

import { jsonResponse } from '../middleware/cors';
import { createLogger } from '../middleware/logger';
import type { Env } from '../types/env';

const log = createLogger({ route: 'nowpayments-ipn' });

async function computeHMAC(body: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(body);

  const key = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
  );
  const digest = await crypto.subtle.sign('HMAC', key, msgData);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function nowPaymentsIPN(request: Request, env: Record<string, unknown>) {
  try {
    const typedEnv = env as unknown as Env;
    const secret = env.NOWPAYMENTS_IPN_SECRET as string | undefined;

    // Read body upfront (single read)
    const bodyText = await request.text().catch(() => '{}');
    const body = JSON.parse(bodyText) as Record<string, unknown>;
    log.debug('IPN payload received', { paymentId: body.payment_id, status: body.payment_status });

    // Signature verification
    if (!secret) {
      log.warn('NOWPAYMENTS_IPN_SECRET not configured — accepting without verification (dev mode)');
    } else {
      const signature = request.headers.get('x-nowpayments-signature');
      if (!signature) {
        log.warn('IPN missing signature header');
        return new Response('Missing signature', { status: 401 });
      }
      const expected = await computeHMAC(bodyText, secret);
      if (expected !== signature) {
        log.warn('IPN signature verification failed');
        return new Response('Invalid signature', { status: 401 });
      }
    }

    const paymentId = String(body.payment_id || '');
    const paymentStatus = String(body.payment_status || '');

    if (!paymentId) {
      return jsonResponse({ ok: true }); // ack anyway to prevent retries
    }

    const db = env.AURA_DB as unknown as { prepare(sql: string): { bind(...a: unknown[]): { run(): Promise<{ rowCount: number }>; first<T = Record<string, unknown>>(): Promise<T | null> } } };

    // Find invoice by payment_ref (stored during payInvoice)
    const row = await db
      .prepare('SELECT id, subscription_id, status FROM subscription_invoices WHERE payment_ref = ? LIMIT 1')
      .bind(paymentId)
      .first<{ id: string; subscription_id: string; status: string }>();

    if (!row) {
      log.warn('IPN: invoice not found for payment', { paymentId });
      return jsonResponse({ ok: true });
    }

    if (paymentStatus === 'finished' || paymentStatus === 'confirmed') {
      await db.prepare("UPDATE subscription_invoices SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), new Date().toISOString(), row.id)
        .run();

      // Extend subscription period by +1 month (reuse existing subscription logic if available)
      if (row.subscription_id) {
        try {
          await db.prepare(
            "UPDATE subscriptions SET current_period_end = datetime(current_period_end, '+1 month'), updated_at = ? WHERE id = ?"
          ).bind(new Date().toISOString(), row.subscription_id).run();
        } catch {
          log.warn('IPN: subscription period extension failed', { subscriptionId: row.subscription_id });
        }
      }

      log.info('IPN: invoice marked paid', { invoiceId: row.id, paymentId });
    } else if (paymentStatus === 'failed' || paymentStatus === 'expired') {
      await db.prepare("UPDATE subscription_invoices SET status = 'failed', updated_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), row.id)
        .run();
      log.warn('IPN: invoice payment failed', { invoiceId: row.id, paymentId, status: paymentStatus });
    } else if (paymentStatus === 'refunded') {
      await db.prepare("UPDATE subscription_invoices SET status = 'refunded', updated_at = ? WHERE id = ?")
        .bind(new Date().toISOString(), row.id)
        .run();
    }

    return jsonResponse({ ok: true });
  } catch (error) {
    log.error('IPN error:', { message: (error as Error).message });
    return jsonResponse({ ok: true }, 200); // always ack to prevent NowPayments retry storms
  }
}
