import type { D1Database } from '@cloudflare/workers-types';
import { buildPayOSSignature, generateOrderCode, PAYOS_API } from './payos-helpers';
import { verifyPayOSSignature } from '../policies/payos-signature';

export interface PayOSAttempt {
  id: string; order_id: string; amount: number; transaction_id: string;
  payment_url: string | null; status: string; created_at: string; updated_at: string;
}
interface AttemptInput {
  db: D1Database; orderId: string; amount: number; clientId: string; apiKey: string;
  checksumKey: string; description: string; returnUrl: string; cancelUrl: string; buyerName?: string;
}
type AttemptResult = { ok: true; payment: PayOSAttempt; cached: boolean }
  | { ok: false; status: 202 | 409 | 502; error: string; payment?: PayOSAttempt };
const LEASE_MS = 30_000;

/** A deterministic primary key plus a conditional INSERT serializes ALL local callers. */
async function reserveAttempt(input: AttemptInput): Promise<{ payment: PayOSAttempt; owned: boolean } | null> {
  const { db, orderId, amount } = input;
  for (let attempt = 0; attempt < 3; attempt++) {
    const existing = await db.prepare(
      "SELECT * FROM payments WHERE order_id = ? AND method = 'payos' ORDER BY created_at ASC LIMIT 2"
    ).bind(orderId).all<PayOSAttempt>();
    // Historical duplicate invoices need reconciliation; never guess which is payable.
    if (existing.results.length > 1) return null;
    if (existing.results[0]) return { payment: existing.results[0], owned: false };
    const now = new Date().toISOString();
    const orderCode = String(generateOrderCode());
    const id = `payos:${orderId}`;
    const result = await db.prepare(`
      INSERT OR IGNORE INTO payments (id, order_id, method, amount, status, transaction_id, payment_url, created_at, updated_at)
      SELECT ?, ?, 'payos', ?, 'pending', ?, NULL, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM payments WHERE order_id = ? AND method = 'payos')
    `).bind(id, orderId, amount, orderCode, now, now, orderId).run();
    if ((result.meta?.changes ?? 0) > 0) {
      return { payment: { id, order_id: orderId, amount, transaction_id: orderCode,
        status: 'pending', payment_url: null, created_at: now, updated_at: now }, owned: true };
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
    const res = await fetch(`${PAYOS_API}/${payment.transaction_id}`, { headers });
    const result = await res.json() as { code?: string; signature?: string; data?: Record<string, unknown> };
    if (!res.ok || result.code !== '00' || !result.data) return null;
    if (!await verifyPayOSSignature(result.data, result.signature, input.checksumKey)) {
      return { ok: false, status: 502, error: 'Invalid provider payment signature', payment };
    }
    if (String(result.data.orderCode) !== payment.transaction_id || Number(result.data.amount) !== input.amount) {
      return { ok: false, status: 409, error: 'Provider payment requires reconciliation', payment };
    }
    if (String(result.data.status).toUpperCase() !== 'PENDING') {
      return { ok: false, status: 409, error: 'Provider payment is no longer payable; refresh the order', payment };
    }
    const url = checkoutUrl(result.data, true);
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
