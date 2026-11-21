import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { buildPayOSSignature, generateOrderCode, PAYOS_API } from './payos-helpers';
import { verifyPayOSSignature } from '../policies/payos-signature';
import { buildCheckoutUrl, extractPayOSLinkId, verifyPayOSPaymentRequest } from './payos-provider-verify';
import { reconcilePayOSPayment } from './payos-reconcile';
import { resolveMerchantPaymentConfig } from '../../../../worker/src/lib/merchant-payment';
import type { Env } from 'worker/src/types/env';

export interface PayOSAttempt {
  id: string; order_id: string; amount: number; transaction_id: string;
  payment_url: string | null; status: string; tenant_id?: string | null; created_at: string; updated_at: string;
}
interface AttemptInput {
  db: D1Database; kv?: KVNamespace | null; env?: Record<string, unknown> | null; orderId: string; amount: number; clientId: string; apiKey: string;
  checksumKey: string; description: string; returnUrl: string; cancelUrl: string; buyerName?: string; tenantId?: string;
}
type AttemptResult = { ok: true; payment: PayOSAttempt; cached: boolean }
  | { ok: false; status: 202 | 409 | 502; code?: string; orderId?: string; error: string; payment?: PayOSAttempt };
const LEASE_MS = 30_000;

/** A deterministic primary key plus a conditional INSERT serializes ALL local callers. */
async function reserveAttempt(input: AttemptInput): Promise<{ payment: PayOSAttempt; owned: boolean } | null> {
  const { db, orderId, amount } = input;
  const rawInputTenant = input.tenantId && input.tenantId.trim() ? input.tenantId.trim() : '';
  let orderTenant =
    rawInputTenant && rawInputTenant !== '*' && rawInputTenant.toLowerCase() !== 'hq'
      ? rawInputTenant
      : '';
  if (!orderTenant) {
    const ordRow = await db.prepare('SELECT tenant_id FROM orders WHERE id = ?').bind(orderId).first<{ tenant_id?: string | null }>().catch(() => null);
    const rawOrdTenant = ordRow?.tenant_id && String(ordRow.tenant_id).trim() ? String(ordRow.tenant_id).trim() : '';
    orderTenant = rawOrdTenant && rawOrdTenant !== '*' && rawOrdTenant.toLowerCase() !== 'hq' ? rawOrdTenant : 'default';
  }
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await db.prepare(
      "SELECT * FROM payments WHERE order_id = ? AND method = 'payos' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at ASC LIMIT 2"
    ).bind(orderId, orderTenant).all<PayOSAttempt>().catch(() =>
      orderTenant === 'default'
        ? db.prepare(
            "SELECT * FROM payments WHERE order_id = ? AND method = 'payos' ORDER BY created_at ASC LIMIT 2"
          ).bind(orderId).all<PayOSAttempt>()
        : Promise.resolve({ results: [] as PayOSAttempt[] } as any)
    );
    // Historical duplicate invoices need reconciliation; never guess which is payable.
    if (existing.results.length > 1) return null;
    const prior = existing.results[0];
    if (prior && prior.status === 'expired') {
      // An expired provider link on an unpaid order is replaced in place with a fresh order code,
      // keeping exactly one payable PayOS row per order. The CAS makes concurrent retries pick one winner.
      const refreshedAt = new Date().toISOString();
      const freshCode = String(generateOrderCode());
      const rotated = await db.prepare(`
        UPDATE payments SET status = 'pending', transaction_id = ?, payment_url = NULL, amount = ?, updated_at = ?
        WHERE id = ? AND status = ? AND transaction_id = ?
        AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND LOWER(COALESCE(NULLIF(TRIM(payment_status), ''), 'unpaid')) IN ('unpaid', 'pending'))
      `).bind(freshCode, amount, refreshedAt, prior.id, prior.status, prior.transaction_id, orderId).run().catch(() => null);
      if ((rotated?.meta?.changes ?? 0) > 0) {
        return { payment: { ...prior, status: 'pending', transaction_id: freshCode, payment_url: null, amount,
          updated_at: refreshedAt }, owned: true };
      }
      // Lost the race or the order is settled: re-read before deciding.
      const reread = await db.prepare('SELECT * FROM payments WHERE id = ?').bind(prior.id).first<PayOSAttempt>().catch(() => null);
      return { payment: reread ?? prior, owned: false };
    }
    if (prior) return { payment: prior, owned: false };
    const now = new Date().toISOString();
    const orderCode = String(generateOrderCode());
    const id = `payos:${orderId}`;
    let result: any;
    try {
      result = await db.prepare(`
        INSERT OR IGNORE INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, tenant_id, created_at, updated_at)
        SELECT ?, ?, 'payos', ?, 'pending', ?, NULL, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM payments WHERE order_id = ? AND method = 'payos' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
      `).bind(id, orderId, amount, orderCode, orderTenant, now, now, orderId, orderTenant).run();
    } catch (err) {
      if (orderTenant === 'default') {
        result = await db.prepare(`
          INSERT OR IGNORE INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, created_at, updated_at)
          SELECT ?, ?, 'payos', ?, 'pending', ?, NULL, ?, ?
          WHERE NOT EXISTS (SELECT 1 FROM payments WHERE order_id = ? AND method = 'payos')
        `).bind(id, orderId, amount, orderCode, now, now, orderId).run();
      } else {
        throw err;
      }
    }
    if ((result.meta?.changes ?? 0) > 0) {
      return { payment: { id, order_id: orderId, amount, transaction_id: orderCode,
        status: 'pending', payment_url: null, tenant_id: orderTenant, created_at: now, updated_at: now }, owned: true };
    }
    // A transaction-code collision is retried BEFORE any provider request.
  }
  return null;
}

function checkoutUrl(data: Record<string, unknown>, recovery: boolean): string | null {
  const linkId = recovery ? data.id : data.paymentLinkId;
  if (typeof linkId !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(linkId)) return null;
  const url = `https://pay.payos.vn/web/${linkId}`;
  return recovery || data.checkoutUrl === url ? url : null;
}

export async function getOrCreatePayOSAttempt(input: AttemptInput): Promise<AttemptResult> {
  const reserved = await reserveAttempt(input);
  if (!reserved) return { ok: false, status: 409, error: 'Payment attempts require reconciliation' };
  const { payment } = reserved;
  if (payment.status !== 'pending' || !/^\d+$/.test(payment.transaction_id)
    || Number(payment.amount) !== input.amount) {
    if (payment.status === 'completed') {
      return { ok: false, status: 409, code: 'ORDER_ALREADY_PAID', orderId: input.orderId, error: 'Payment attempt is already completed', payment };
    }
    return { ok: false, status: 409, error: 'Payment attempt is closed or requires reconciliation', payment };
  }
  if (payment.payment_url) return { ok: true, payment, cached: true };
  const headers = { 'Content-Type': 'application/json', 'x-client-id': input.clientId, 'x-api-key': input.apiKey };
  const saveUrl = async (url: string): Promise<AttemptResult> => {
    const saved = await input.db.prepare(
      "UPDATE payments SET payment_url = ?, updated_at = ? WHERE id = ? AND transaction_id = ? AND status = 'pending'"
    ).bind(url, new Date().toISOString(), payment.id, payment.transaction_id).run();
    if (!((saved.meta?.changes ?? 0) > 0)) return { ok: false, status: 409, error: 'Payment state changed; refresh the order', payment };
    return { ok: true, payment: { ...payment, payment_url: url }, cached: !reserved.owned };
  };
  const recover = async (): Promise<AttemptResult | null> => {
    const verified = await verifyPayOSPaymentRequest({
      transactionId: payment.transaction_id,
      expectedAmount: input.amount,
      checksumKey: input.checksumKey,
      clientId: input.clientId,
      apiKey: input.apiKey,
    });
    if (!verified.ok) {
      if (verified.reason === 'bad_signature') {
        return { ok: false, status: 502, error: 'Invalid provider payment signature', payment };
      }
      if (verified.reason === 'mismatch') {
        return { ok: false, status: 409, error: 'Provider payment requires reconciliation', payment };
      }
      return null;
    }
    if (verified.status === 'PAID') {
      const reconciled = await reconcilePayOSPayment({
        db: input.db,
        kv: input.kv,
        env: input.env ?? null,
        paymentId: payment.id,
        clientId: input.clientId,
        apiKey: input.apiKey,
        checksumKey: input.checksumKey,
        source: 'create_link',
        preVerified: verified,
        tenantId: (payment.tenant_id && String(payment.tenant_id).trim()) || undefined,
      });
      if (reconciled.ok && (reconciled.outcome === 'settled' || reconciled.outcome === 'already_settled')) {
        return {
          ok: false,
          status: 409,
          code: 'ORDER_ALREADY_PAID',
          orderId: input.orderId,
          error: 'Provider payment is already paid; refresh the order',
          payment: { ...payment, status: 'completed' },
        };
      }
      return { ok: false, status: 409, error: reconciled.error || 'Provider payment requires reconciliation', payment };
    }
    if (verified.status !== 'PENDING') {
      return { ok: false, status: 409, error: 'Provider payment is no longer payable; refresh the order', payment };
    }
    const url = verified.checkoutUrl ?? buildCheckoutUrl({ id: verified.linkId }, true);
    return url ? saveUrl(url) : { ok: false, status: 502, error: 'Invalid provider checkout link', payment };
  };
  try {
    if (!reserved.owned) {
      const recovered = await recover();
      if (recovered) return recovered;
      const stamp = payment.updated_at || payment.created_at;
      const stampMs = Date.parse(stamp.includes('T') ? stamp : `${stamp.replace(' ', 'T')}Z`);
      if (!Number.isFinite(stampMs) || Date.now() - stampMs < LEASE_MS) {
        return { ok: false, status: 202, error: 'Payment creation in progress; retry shortly', payment };
      }
      const claim = await input.db.prepare(`
        UPDATE payments SET updated_at = ? WHERE id = ? AND status = 'pending'
        AND (payment_url IS NULL OR payment_url = '') AND COALESCE(updated_at, created_at) = ?
      `).bind(new Date().toISOString(), payment.id, stamp).run();
      if (!((claim.meta?.changes ?? 0) > 0)) return { ok: false, status: 202, error: 'Payment creation in progress; retry shortly', payment };
    }
    const orderCode = Number(payment.transaction_id);
    const { amount, cancelUrl, description, returnUrl } = input;
    const signature = await buildPayOSSignature({ amount, cancelUrl, description, orderCode, returnUrl }, input.checksumKey);
    const res = await fetch(PAYOS_API, { method: 'POST', headers, body: JSON.stringify({
      amount, cancelUrl, description, orderCode, returnUrl, signature, buyerName: input.buyerName, items: [],
    }) });
    const result = await res.json() as { code?: string; desc?: string; signature?: string; data?: Record<string, unknown> };
    if (res.ok && result.code === '00' && result.data) {
      if (!await verifyPayOSSignature(result.data, result.signature, input.checksumKey)
        || String(result.data.orderCode) !== payment.transaction_id || Number(result.data.amount) !== input.amount
        || String(result.data.status).toUpperCase() !== 'PENDING') {
        return { ok: false, status: 502, error: 'Invalid provider payment response', payment };
      }
      const url = checkoutUrl(result.data, false);
      if (!url) return { ok: false, status: 502, error: 'Invalid provider checkout link', payment };
      return await saveUrl(url);
    }
    // Duplicate/ambiguous POST results are resolved by the SAME persisted code.
    const recovered = await recover();
    if (recovered) return recovered;
    return { ok: false, status: 502, error: 'Payment provider unavailable; retry the same order', payment };
  } catch {
    // Never delete the reservation or generate a new code after an unknown result.
    return { ok: false, status: 502, error: 'Payment result pending; retry the same order', payment };
  }
}

async function resolveCancelCredentials(
  db: D1Database,
  env: Record<string, unknown>,
  tenant: string,
): Promise<{ clientId: string; apiKey: string } | null> {
  if (tenant === 'default') {
    const merchant = await resolveMerchantPaymentConfig(db, env as unknown as Env, 'default').catch(() => null);
    if (merchant?.provider === 'payos' && merchant.payos?.clientId && merchant.payos?.apiKey) {
      return { clientId: merchant.payos.clientId, apiKey: merchant.payos.apiKey };
    }
    const clientId = typeof env.PAYOS_CLIENT_ID === 'string' ? env.PAYOS_CLIENT_ID.trim() : '';
    const apiKey = typeof env.PAYOS_API_KEY === 'string' ? env.PAYOS_API_KEY.trim() : '';
    return clientId && apiKey ? { clientId, apiKey } : null;
  }

  // Non-default tenants must authenticate upstream cancels strictly with their own decrypted
  // merchant credentials and never fall back to flagship PAYOS_* or platform SAAS_PAYOS_*.
  try {
    const merchant = await resolveMerchantPaymentConfig(db, env as unknown as Env, tenant);
    if (merchant.provider === 'payos' && merchant.payos?.clientId && merchant.payos?.apiKey) {
      return { clientId: merchant.payos.clientId, apiKey: merchant.payos.apiKey };
    }
  } catch {
    // Missing TENANT_SECRETS_KEY or decryption failure: local row stays closed; skip upstream cancel.
  }
  return null;
}

/**
 * Closes any still-payable PayOS attempt of an order that is being cancelled or replaced.
 * Local state is closed first (a late paid webhook can still settle a cancelled row), then the provider
 * link is cancelled best-effort; provider failures never block the caller.
 */
export async function cancelOpenPayOSAttemptForOrder(
  db: D1Database,
  env: Record<string, unknown>,
  orderId: string,
  tenantId?: string,
): Promise<{ cancelled: number; providerNotified: number }> {
  const rawTenant = tenantId && tenantId.trim() ? tenantId.trim() : '';
  const tenant = rawTenant && rawTenant !== '*' && rawTenant.toLowerCase() !== 'hq' ? rawTenant : 'default';
  type OpenRow = { id: string; transaction_id: string; payment_url: string | null; tenant_id?: string | null };
  let rows: OpenRow[] = [];
  try {
    const found = await db.prepare(
      "SELECT id, transaction_id, payment_url, tenant_id FROM payments WHERE order_id = ? AND method = 'payos' AND status = 'pending' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
    ).bind(orderId, tenant).all<OpenRow>();
    rows = found.results ?? [];
  } catch {
    if (tenant !== 'default') return { cancelled: 0, providerNotified: 0 };
    const found = await db.prepare(
      "SELECT id, transaction_id, payment_url FROM payments WHERE order_id = ? AND method = 'payos' AND status = 'pending'"
    ).bind(orderId).all<OpenRow>().catch(() => ({ results: [] as OpenRow[] }));
    rows = found.results ?? [];
  }
  const credsByTenant = new Map<string, { clientId: string; apiKey: string } | null>();
  let cancelled = 0;
  let providerNotified = 0;
  for (const row of rows) {
    const closed = await db.prepare(
      "UPDATE payments SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'pending'"
    ).bind(new Date().toISOString(), row.id).run().catch(() => null);
    if (!((closed?.meta?.changes ?? 0) > 0)) continue;
    cancelled += 1;

    const rawRowTenant = typeof row.tenant_id === 'string' ? row.tenant_id.trim() : '';
    const effectiveTenant =
      rawRowTenant && rawRowTenant !== '*' && rawRowTenant.toLowerCase() !== 'hq'
        ? rawRowTenant
        : tenant;
    if (!credsByTenant.has(effectiveTenant)) {
      credsByTenant.set(effectiveTenant, await resolveCancelCredentials(db, env, effectiveTenant));
    }
    const creds = credsByTenant.get(effectiveTenant);
    if (!creds) continue;

    const reference = extractPayOSLinkId(row.payment_url) ?? (/^\d+$/.test(row.transaction_id) ? row.transaction_id : null);
    if (!reference) continue;
    try {
      const res = await fetch(`${PAYOS_API}/${reference}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-client-id': creds.clientId, 'x-api-key': creds.apiKey },
        body: JSON.stringify({ cancellationReason: 'order_closed' }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) providerNotified += 1;
    } catch {
      // Best effort: the local row is already closed and the provider link expires on its own.
    }
  }
  return { cancelled, providerNotified };
}
