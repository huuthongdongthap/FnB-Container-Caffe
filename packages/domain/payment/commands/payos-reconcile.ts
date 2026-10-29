import type { D1Database, KVNamespace } from '@cloudflare/workers-types';
import { settlePayOS } from '../../../../worker/src/routes/webhooks-handlers/payos-settlement';
import { extractPayOSLinkId, verifyPayOSPaymentRequest, type VerifyFailureReason, type VerifyPayOSResult } from './payos-provider-verify';
import { RECONCILE_LEASE_MS, claimReconcileJob, releaseReconcileJob, writePaymentReviewMarker, type ReconcileOutcome, type ReviewMarkerInput } from './payos-reconcile-lease';

export { RECONCILE_LEASE_MS, claimReconcileJob, releaseReconcileJob, writePaymentReviewMarker, type ReconcileOutcome, type ReviewMarkerInput };

export interface ReconcilePayOSInput {
  db: D1Database;
  kv?: KVNamespace | null;
  paymentId: string;
  tenantId?: string | null;
  clientId: string;
  apiKey: string;
  checksumKey: string;
  source: 'cron' | 'manual' | 'create_link';
  timeoutMs?: number;
  preVerified?: VerifyPayOSResult;
}

export interface ReconcilePayOSResult {
  ok: boolean;
  status: 200 | 404 | 409 | 502;
  outcome: ReconcileOutcome;
  reason?: VerifyFailureReason;
  error?: string;
  paymentId?: string;
  orderId?: string;
  orderCode?: string | null;
  paymentChanged?: boolean;
}

interface PaymentOrderRow {
  id: string;
  order_id: string;
  method: string | null;
  amount: number;
  status: string;
  transaction_id: string | null;
  payment_url: string | null;
  refund_status: string | null;
  order_total: number;
  order_payment_status: string;
  order_payment_method: string | null;
  order_status: string;
  order_tenant_id: string | null;
}

export async function reconcilePayOSPayment(input: ReconcilePayOSInput): Promise<ReconcilePayOSResult> {
  const row = await input.db.prepare(
    `SELECT p.id, p.order_id, p.method, p.amount, p.status, p.transaction_id, p.payment_url, p.refund_status,
            o.total AS order_total, o.payment_status AS order_payment_status, o.payment_method AS order_payment_method,
            o.status AS order_status, o.tenant_id AS order_tenant_id
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE p.id = ?`
  ).bind(input.paymentId).first<PaymentOrderRow>();

  if (!row || (input.tenantId && (row.order_tenant_id || 'default') !== input.tenantId)) {
    return { ok: false, status: 404, outcome: 'not_found', error: 'Payment not found' };
  }

  const baseIds = { paymentId: row.id, orderId: row.order_id, orderCode: row.transaction_id };
  if (
    row.status === 'refunded' ||
    row.refund_status === 'completed' ||
    row.order_payment_status === 'refunded' ||
    row.order_payment_status === 'paid'
  ) {
    return { ok: true, status: 200, outcome: 'already_settled', ...baseIds, paymentChanged: false };
  }

  if (row.method !== 'payos' || (row.order_payment_method && row.order_payment_method !== 'payos')) {
    await writePaymentReviewMarker(input.kv, { ...baseIds, source: input.source, stage: 'method_check', errorCode: 'METHOD_MISMATCH' });
    return { ok: false, status: 409, outcome: 'requires_review', error: 'Payment method requires review', ...baseIds };
  }

  if (!row.transaction_id || !/^\d+$/.test(String(row.transaction_id))) {
    await writePaymentReviewMarker(input.kv, { ...baseIds, source: input.source, stage: 'pre_verify', errorCode: 'INVALID_TRANSACTION_ID' });
    return { ok: false, status: 409, outcome: 'requires_review', error: 'Invalid provider transaction code', ...baseIds };
  }

  const expectedAmount = Number(row.amount);
  const expectedOrderTotal = Number(row.order_total);
  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0 || expectedAmount !== expectedOrderTotal) {
    await writePaymentReviewMarker(input.kv, { ...baseIds, source: input.source, stage: 'amount_check', errorCode: 'LOCAL_AMOUNT_MISMATCH' });
    return { ok: false, status: 409, outcome: 'requires_review', error: 'Local payment and order total mismatch', ...baseIds };
  }

  const verified = input.preVerified ?? await verifyPayOSPaymentRequest({
    transactionId: row.transaction_id,
    expectedAmount,
    expectedLinkId: extractPayOSLinkId(row.payment_url),
    checksumKey: input.checksumKey,
    clientId: input.clientId,
    apiKey: input.apiKey,
    timeoutMs: input.timeoutMs,
  });

  const fresh = await input.db.prepare(
    `SELECT p.status, p.refund_status, o.payment_status, o.status AS order_status
     FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = ?`
  ).bind(row.id).first<{ status: string; refund_status: string | null; payment_status: string; order_status: string }>();

  if (!fresh) {
    return { ok: false, status: 404, outcome: 'not_found', error: 'Payment not found' };
  }
  if (
    fresh.status === 'refunded' ||
    fresh.refund_status === 'completed' ||
    fresh.payment_status === 'refunded' ||
    fresh.payment_status === 'paid'
  ) {
    return { ok: true, status: 200, outcome: 'already_settled', ...baseIds, paymentChanged: false };
  }

  if (!verified.ok) {
    if (verified.reason === 'mismatch') {
      await writePaymentReviewMarker(input.kv, { ...baseIds, source: input.source, stage: 'provider_verify', errorCode: 'PROVIDER_MISMATCH' });
      return { ok: false, status: 409, outcome: 'requires_review', reason: 'mismatch', error: 'Provider payment mismatch', ...baseIds };
    }
    if (verified.reason === 'bad_signature') {
      await writePaymentReviewMarker(input.kv, { ...baseIds, source: input.source, stage: 'provider_verify', errorCode: 'INVALID_SIGNATURE' });
    }
    return { ok: false, status: 502, outcome: 'provider_error', reason: verified.reason, error: 'Provider verification failed', ...baseIds };
  }

  if (verified.status === 'PENDING') {
    return { ok: true, status: 200, outcome: 'pending', ...baseIds, paymentChanged: false };
  }

  if (verified.status === 'CANCELLED' || verified.status === 'EXPIRED') {
    const target = verified.status === 'CANCELLED' ? 'cancelled' : 'expired';
    if (fresh.status === 'completed' || fresh.status === target) {
      return { ok: true, status: 200, outcome: 'already_settled', ...baseIds, paymentChanged: false };
    }
    const { paymentChanged } = await settlePayOS(input.db, { id: row.id, order_id: row.order_id, amount: expectedAmount, status: fresh.status, method: row.method }, false, target, new Date().toISOString());
    return { ok: true, status: 200, outcome: paymentChanged ? 'settled' : 'already_settled', ...baseIds, paymentChanged };
  }

  if (verified.status === 'PAID') {
    if (verified.amountPaid !== expectedAmount || verified.amountPaid !== expectedOrderTotal || verified.amountRemaining !== 0) {
      await writePaymentReviewMarker(input.kv, {
        ...baseIds,
        source: input.source,
        stage: 'amount_check',
        errorCode: verified.amountRemaining > 0 ? 'PARTIAL_PAYMENT' : 'OVERPAID_OR_MISMATCH',
      });
      return { ok: false, status: 409, outcome: 'requires_review', error: 'Provider paid amount mismatch', ...baseIds };
    }

    const nowIso = new Date().toISOString();
    const { paymentChanged } = await settlePayOS(input.db, { id: row.id, order_id: row.order_id, amount: expectedAmount, status: fresh.status, method: row.method }, true, 'completed', nowIso);
    const after = await input.db.prepare(
      'SELECT p.status, o.payment_status, o.status AS order_status FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = ?'
    ).bind(row.id).first<{ status: string; payment_status: string; order_status: string }>();

    if (!paymentChanged && (after?.status !== 'completed' || after?.payment_status !== 'paid')) {
      await writePaymentReviewMarker(input.kv, { ...baseIds, source: input.source, stage: 'settlement_cas', errorCode: 'CAS_REJECTED' });
      return { ok: false, status: 409, outcome: 'requires_review', error: 'Payment requires reconciliation', ...baseIds };
    }

    if (paymentChanged) {
      await input.db.prepare('INSERT INTO _metrics (name, value, tags, created_at) VALUES (?, 1, ?, ?)')
        .bind('payment_success', JSON.stringify({ method: 'payos', source: input.source }), nowIso)
        .run().catch(() => {});
      if (input.kv) {
        await input.kv.put(
          `payment_event:${row.order_id}`,
          JSON.stringify({ type: 'payment_confirmed', orderId: row.order_id, amount: expectedAmount, reference: '', timestamp: nowIso }),
          { expirationTtl: 300 }
        ).catch(() => {});
      }
    }

    if (fresh.order_status === 'cancelled' || after?.order_status === 'cancelled') {
      await writePaymentReviewMarker(input.kv, { ...baseIds, source: input.source, stage: 'cancelled_order_paid', errorCode: 'PAID_ON_CANCELLED_ORDER' });
    }

    return { ok: true, status: 200, outcome: paymentChanged ? 'settled' : 'already_settled', ...baseIds, paymentChanged };
  }

  await writePaymentReviewMarker(input.kv, { ...baseIds, source: input.source, stage: 'provider_verify', errorCode: 'UNKNOWN_PROVIDER_STATUS' });
  return { ok: false, status: 409, outcome: 'requires_review', error: 'Unrecognized provider payment status', ...baseIds };
}
