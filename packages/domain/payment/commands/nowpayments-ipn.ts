// payments-nowpayments.ts — IPN webhook for NowPayments

import { jsonResponse } from 'worker/src/middleware/cors';
import { createLogger } from 'worker/src/middleware/logger';
import { addMonths } from 'worker/src/tree/subscriptions/helpers';
import { updateMRRSnapshot } from 'worker/src/tree/subscriptions/mrr-calculator';

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

function constantTimeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }
  return diff === 0;
}

type DbBinding = {
  prepare(_sql: string): {
    bind(..._a: unknown[]): {
      run(): Promise<{ rowCount?: number; meta?: { changes?: number } }>;
      first<T = Record<string, unknown>>(): Promise<T | null>;
    };
  };
};

type InvoiceRow = {
  id: string;
  subscription_id: string;
  status: string;
  amount_vnd?: number | null;
  payment_ref?: string | null;
  tenant_id?: string | null;
};

export async function processNowPaymentsIpn(
  dbOrEnv: unknown,
  bodyInput?: Record<string, unknown>
): Promise<{ ok: boolean; error?: string; status?: number; idempotent?: boolean }> {
  const firstObj = dbOrEnv as Record<string, unknown> | undefined;
  const secondObj = bodyInput as Record<string, unknown> | undefined;
  const firstIsDbOrEnv = Boolean(firstObj && (typeof firstObj.prepare === 'function' || firstObj.AURA_DB || firstObj.DB));
  const resolvedEnvOrDb = firstIsDbOrEnv ? firstObj : secondObj;
  const body = (firstIsDbOrEnv ? secondObj : firstObj) ?? {};

  const db = (resolvedEnvOrDb && typeof resolvedEnvOrDb.prepare === 'function'
    ? resolvedEnvOrDb
    : (resolvedEnvOrDb?.AURA_DB ?? resolvedEnvOrDb?.DB)) as unknown as DbBinding | undefined;

  const paymentId = String(body.payment_id || '');
  const paymentStatus = String(body.payment_status || '');
  const rawOrderId = typeof body.order_id === 'string' ? body.order_id.trim() : '';
  const explicitInvoiceId = typeof body.invoice_id === 'string' ? body.invoice_id.trim() : '';
  const lookupInvoiceId = explicitInvoiceId || rawOrderId.replace(/^invoice_/i, '');

  if (!paymentId && !lookupInvoiceId) {
    return { ok: true, status: 200 };
  }
  if (!db) {
    return { ok: true, status: 200 };
  }

  let inv: InvoiceRow | null = null;
  if (paymentId) {
    try {
      inv = await db
        .prepare('SELECT id, subscription_id, status, amount_vnd, payment_ref, tenant_id FROM subscription_invoices WHERE payment_ref = ? LIMIT 1')
        .bind(paymentId)
        .first<InvoiceRow>();
    } catch {
      try {
        inv = await db
          .prepare('SELECT id, subscription_id, status, amount_vnd FROM subscription_invoices WHERE payment_ref = ? LIMIT 1')
          .bind(paymentId)
          .first<InvoiceRow>();
      } catch {
        inv = await db
          .prepare('SELECT id, subscription_id, status FROM subscription_invoices WHERE payment_ref = ? LIMIT 1')
          .bind(paymentId)
          .first<InvoiceRow>()
          .catch(() => null);
      }
    }
  }
  if (!inv && lookupInvoiceId) {
    try {
      inv = await db
        .prepare('SELECT id, subscription_id, status, amount_vnd, payment_ref, tenant_id FROM subscription_invoices WHERE id = ? LIMIT 1')
        .bind(lookupInvoiceId)
        .first<InvoiceRow>();
    } catch {
      try {
        inv = await db
          .prepare('SELECT id, subscription_id, status, amount_vnd FROM subscription_invoices WHERE id = ? LIMIT 1')
          .bind(lookupInvoiceId)
          .first<InvoiceRow>();
      } catch {
        inv = await db
          .prepare('SELECT id, subscription_id, status FROM subscription_invoices WHERE id = ? LIMIT 1')
          .bind(lookupInvoiceId)
          .first<InvoiceRow>()
          .catch(() => null);
      }
    }
    if (inv && inv.payment_ref && paymentId && String(inv.payment_ref).trim() !== paymentId) {
      return { ok: false, error: 'Invoice already bound to another payment reference', status: 409 };
    }
  }

  if (!inv) {
    log.warn('IPN: invoice not found for payment', { paymentId, lookupInvoiceId });
    return { ok: true, status: 200 };
  }

  if (paymentStatus === 'finished' || paymentStatus === 'confirmed') {
    const expectedVnd = inv.amount_vnd !== undefined && inv.amount_vnd !== null ? Number(inv.amount_vnd) : 0;
    const priceCurrency = String(body.price_currency ?? 'vnd').toLowerCase().trim();
    if (expectedVnd > 0) {
      if (priceCurrency !== '' && priceCurrency !== 'vnd') {
        return { ok: false, error: 'Invoice currency mismatch', status: 400 };
      }
      if (
        body.price_amount === undefined ||
        body.price_amount === null ||
        !Number.isFinite(Number(body.price_amount)) ||
        Number(body.price_amount) < expectedVnd
      ) {
        return { ok: false, error: 'Invoice amount mismatch', status: 400 };
      }
    }

    if (inv.status === 'paid' || inv.status === 'cancelled') {
      return { ok: true, idempotent: true, status: 200 };
    }

    const now = new Date().toISOString();
    const paymentRef = paymentId || inv.payment_ref || '';
    let updateRes: { rowCount?: number; meta?: { changes?: number } } | undefined;
    try {
      updateRes = await db
        .prepare(
          "UPDATE subscription_invoices SET status = 'paid', paid_at = ?, payment_method = 'crypto', payment_ref = ? WHERE id = ? AND status NOT IN ('paid', 'cancelled')"
        )
        .bind(now, paymentRef, inv.id)
        .run();
    } catch {
      updateRes = await db
        .prepare(
          "UPDATE subscription_invoices SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ? AND status NOT IN ('paid', 'cancelled')"
        )
        .bind(now, now, inv.id)
        .run();
    }

    const changes = updateRes?.meta?.changes;
    const wasUpdated = inv.status !== 'paid' && (typeof changes === 'number' ? changes !== 0 : true);
    if (!wasUpdated) {
      return { ok: true, idempotent: true, status: 200 };
    }

    const invTenant = typeof inv.tenant_id === 'string' ? inv.tenant_id.trim() : '';
    let subTenant = '';
    if (inv.subscription_id) {
      try {
        const sub = await db
          .prepare('SELECT * FROM subscriptions WHERE id = ?')
          .bind(inv.subscription_id)
          .first<{ id: string; billing_cycle?: string; current_period_end?: string; tenant_id?: string | null }>()
          .catch(() => null);
        if (sub && typeof sub.tenant_id === 'string') {
          subTenant = sub.tenant_id.trim();
        }
        if (sub && sub.current_period_end && /^\d{4}-\d{2}-\d{2}/.test(sub.current_period_end)) {
          const months =
            sub.billing_cycle === 'quarterly'
              ? 3
              : sub.billing_cycle === 'annual' || sub.billing_cycle === 'yearly'
                ? 12
                : 1;
          const newEnd = addMonths(sub.current_period_end, months);
          try {
            await db
              .prepare(
                "UPDATE subscriptions SET status = 'active', current_period_start = ?, current_period_end = ?, next_billing_date = ?, updated_at = ? WHERE id = ?"
              )
              .bind(sub.current_period_end, newEnd, newEnd, now, inv.subscription_id)
              .run();
          } catch {
            await db
              .prepare('UPDATE subscriptions SET current_period_end = ?, updated_at = ? WHERE id = ?')
              .bind(newEnd, now, inv.subscription_id)
              .run();
          }
        } else {
          await db
            .prepare("UPDATE subscriptions SET current_period_end = datetime(current_period_end, '+1 month'), updated_at = ? WHERE id = ?")
            .bind(now, inv.subscription_id)
            .run();
        }
      } catch {
        log.warn('IPN: subscription period extension failed', { subscriptionId: inv.subscription_id });
      }
    }

    try {
      await updateMRRSnapshot(
        db as unknown as import('@cloudflare/workers-types').D1Database,
        subTenant || invTenant || 'default'
      );
    } catch {
      // Optional MRR snapshot table in minimal test environments
    }

    log.info('IPN: invoice marked paid', { invoiceId: inv.id, paymentId });
  } else if (paymentStatus === 'failed' || paymentStatus === 'expired') {
    if (inv.status !== 'paid' && inv.status !== 'cancelled') {
      const now = new Date().toISOString();
      try {
        await db
          .prepare("UPDATE subscription_invoices SET status = 'failed', updated_at = ? WHERE id = ? AND status NOT IN ('paid', 'cancelled')")
          .bind(now, inv.id)
          .run();
      } catch {
        await db
          .prepare("UPDATE subscription_invoices SET status = 'failed' WHERE id = ? AND status NOT IN ('paid', 'cancelled')")
          .bind(inv.id)
          .run();
      }
      log.warn('IPN: invoice payment failed', { invoiceId: inv.id, paymentId, status: paymentStatus });
    }
  } else if (paymentStatus === 'refunded') {
    const now = new Date().toISOString();
    await db
      .prepare("UPDATE subscription_invoices SET status = 'refunded', updated_at = ? WHERE id = ?")
      .bind(now, inv.id)
      .run();
    if (inv.subscription_id) {
      try {
        await db
          .prepare("UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'active'")
          .bind(now, inv.subscription_id)
          .run();
      } catch {
        // Optional subscriptions update in minimal test environments
      }
    }
    try {
      const refundTenant = typeof inv.tenant_id === 'string' && inv.tenant_id.trim() ? inv.tenant_id.trim() : 'default';
      await updateMRRSnapshot(db as unknown as import('@cloudflare/workers-types').D1Database, refundTenant);
    } catch {
      // Optional MRR snapshot table in minimal test environments
    }
  }

  return { ok: true, status: 200 };
}

export async function nowPaymentsIPN(request: Request, env: Record<string, unknown>) {
  try {
    const secret = env.NOWPAYMENTS_IPN_SECRET as string | undefined;

    // Read body upfront (single read)
    const bodyText = await request.text().catch(() => '{}');
    const body = JSON.parse(bodyText) as Record<string, unknown>;
    log.debug('IPN payload received', { paymentId: body.payment_id, status: body.payment_status });

    // Signature verification
    const isProd = env.ENVIRONMENT === 'production' || env.NODE_ENV === 'production';
    const allowUnsignedDev = !isProd && (
      env.ALLOW_UNSIGNED_NOWPAYMENTS_IPN === 'true' ||
      env.ENVIRONMENT === 'development' ||
      env.ENVIRONMENT === 'test'
    );
    if (!secret) {
      if (!allowUnsignedDev) {
        log.error('NOWPAYMENTS_IPN_SECRET not configured — rejecting IPN');
        return new Response('Server configuration error', { status: 500 });
      }
      log.warn('NOWPAYMENTS_IPN_SECRET not configured — accepting without verification (dev mode)');
    } else {
      const signature = request.headers.get('x-nowpayments-signature');
      if (!signature) {
        log.warn('IPN missing signature header');
        return new Response('Missing signature', { status: 401 });
      }
      const expected = await computeHMAC(bodyText, secret);
      if (!constantTimeEqual(expected, signature)) {
        log.warn('IPN signature verification failed');
        return new Response('Invalid signature', { status: 401 });
      }
    }

    const result = await processNowPaymentsIpn(env, body);
    if (!result.ok) {
      return jsonResponse(result, result.status || 400);
    }
    if (result.idempotent) {
      return jsonResponse({ ok: true, idempotent: true }, 200);
    }
    return jsonResponse({ ok: true }, 200);
  } catch (error) {
    log.error('IPN error:', { message: (error as Error).message });
    return jsonResponse({ ok: true }, 200); // always ack to prevent NowPayments retry storms
  }
}
