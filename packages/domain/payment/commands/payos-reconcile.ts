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

const TERMINAL_NON_PAYABLE_ORDER_STATUSES = ['cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded'];

export async function reconcilePayOSPayment(input: ReconcilePayOSInput): Promise<ReconcilePayOSResult> {
  let row: PaymentOrderRow | null = null;
  try {
    row = await input.db.prepare(
      `SELECT p.id, p.order_id, p.method, p.amount, p.status, p.transaction_id, p.payment_url, p.refund_status,
              COALESCE(o.total, o.total_amount) AS order_total, o.payment_status AS order_payment_status, o.payment_method AS order_payment_method,
              o.status AS order_status, o.tenant_id AS order_tenant_id
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE p.id = ?`
    ).bind(input.paymentId).first<PaymentOrderRow>();
  } catch {
    try {
      row = await input.db.prepare(
        `SELECT p.id, p.order_id, p.method, p.amount, p.status, p.transaction_id, p.payment_url, p.refund_status,
                o.total AS order_total, o.payment_status AS order_payment_status, o.payment_method AS order_payment_method,
                o.status AS order_status, o.tenant_id AS order_tenant_id
         FROM payments p
         JOIN orders o ON o.id = p.order_id
         WHERE p.id = ?`
      ).bind(input.paymentId).first<PaymentOrderRow>();
    } catch {
      try {
        row = await input.db.prepare(
          `SELECT p.id, p.order_id, p.method, p.amount, p.status, p.transaction_id, p.payment_url, p.refund_status,
                  o.total_amount AS order_total, o.payment_status AS order_payment_status, o.payment_method AS order_payment_method,
                  o.status AS order_status, o.tenant_id AS order_tenant_id
           FROM payments p
           JOIN orders o ON o.id = p.order_id
           WHERE p.id = ?`
        ).bind(input.paymentId).first<PaymentOrderRow>();
      } catch {
        try {
          row = await input.db.prepare(
            `SELECT p.id, p.order_id, p.method, p.amount, p.status, p.transaction_id, p.payment_url, NULL AS refund_status,
                    COALESCE(o.total, o.total_amount) AS order_total, o.payment_status AS order_payment_status, o.payment_method AS order_payment_method,
                    o.status AS order_status, o.tenant_id AS order_tenant_id
             FROM payments p
             JOIN orders o ON o.id = p.order_id
             WHERE p.id = ?`
          ).bind(input.paymentId).first<PaymentOrderRow>();
        } catch {
          row = await input.db.prepare(
            `SELECT p.id, p.order_id, p.method, p.amount, p.status, p.transaction_id, p.payment_url, NULL AS refund_status,
                    o.total AS order_total, o.payment_status AS order_payment_status, o.payment_method AS order_payment_method,
                    o.status AS order_status, NULL AS order_tenant_id
             FROM payments p
             JOIN orders o ON o.id = p.order_id
             WHERE p.id = ?`
          ).bind(input.paymentId).first<PaymentOrderRow>();
        }
      }
    }
  }

  const rawRowTenant = row?.order_tenant_id ? String(row.order_tenant_id).trim() : '';
  const rowTenant = rawRowTenant && rawRowTenant !== '*' && rawRowTenant.toLowerCase() !== 'hq' ? rawRowTenant : 'default';
  const rawInputTenant = input.tenantId ? input.tenantId.trim() : '';
  const normInputTenant = rawInputTenant.toLowerCase() === 'hq' ? '*' : rawInputTenant;
  if (!row || (normInputTenant && normInputTenant !== '*' && rowTenant !== normInputTenant)) {
    return { ok: false, status: 404, outcome: 'not_found', error: 'Payment not found' };
  }

  const baseIds = { paymentId: row.id, orderId: row.order_id, orderCode: row.transaction_id };
  const initialOrderStatus = String(row.order_status || '').trim().toLowerCase();
  if (
    row.status === 'refunded' ||
    row.refund_status === 'completed' ||
    row.order_payment_status === 'refunded' ||
    row.order_payment_status === 'paid' ||
    (row.status === 'completed' && TERMINAL_NON_PAYABLE_ORDER_STATUSES.includes(initialOrderStatus))
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

  let fresh: { status: string; refund_status: string | null; payment_status: string; order_status: string } | null = null;
  try {
    fresh = await input.db.prepare(
      `SELECT p.status, p.refund_status, o.payment_status, o.status AS order_status
       FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = ?`
    ).bind(row.id).first<{ status: string; refund_status: string | null; payment_status: string; order_status: string }>();
  } catch {
    fresh = await input.db.prepare(
      `SELECT p.status, NULL AS refund_status, o.payment_status, o.status AS order_status
       FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.id = ?`
    ).bind(row.id).first<{ status: string; refund_status: string | null; payment_status: string; order_status: string }>();
  }

  if (!fresh) {
    return { ok: false, status: 404, outcome: 'not_found', error: 'Payment not found' };
  }
  const freshOrderStatus = String(fresh.order_status || '').trim().toLowerCase();
  if (
    fresh.status === 'refunded' ||
    fresh.refund_status === 'completed' ||
    fresh.payment_status === 'refunded' ||
    fresh.payment_status === 'paid' ||
    (fresh.status === 'completed' && TERMINAL_NON_PAYABLE_ORDER_STATUSES.includes(freshOrderStatus))
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

    const afterOrderStatus = String(after?.order_status ?? fresh.order_status ?? '').trim().toLowerCase();
    const isTerminalNonPayable =
      TERMINAL_NON_PAYABLE_ORDER_STATUSES.includes(afterOrderStatus) ||
      TERMINAL_NON_PAYABLE_ORDER_STATUSES.includes(freshOrderStatus);

    if (!paymentChanged && (after?.status !== 'completed' || (!isTerminalNonPayable && after?.payment_status !== 'paid'))) {
      await writePaymentReviewMarker(input.kv, { ...baseIds, source: input.source, stage: 'settlement_cas', errorCode: 'CAS_REJECTED' });
      return { ok: false, status: 409, outcome: 'requires_review', error: 'Payment requires reconciliation', ...baseIds };
    }

    if (paymentChanged) {
      await input.db.prepare('INSERT INTO _metrics (name, value, tags, created_at) VALUES (?, 1, ?, ?)')
        .bind('payment_success', JSON.stringify({ method: 'payos', source: input.source, tenant_id: rowTenant }), nowIso)
        .run().catch(() => {});
      if (input.kv && !isTerminalNonPayable) {
        await input.kv.put(
          `payment_event:${row.order_id}`,
          JSON.stringify({ type: 'payment_confirmed', orderId: row.order_id, amount: expectedAmount, reference: '', tenant_id: rowTenant, tenantId: rowTenant, timestamp: nowIso }),
          { expirationTtl: 300 }
        ).catch(() => {});
        await input.kv.put(
          `order_event:${row.order_id}`,
          JSON.stringify({ orderId: row.order_id, status: after?.order_status ?? fresh.order_status, payment_status: 'paid', tenant_id: rowTenant, tenantId: rowTenant, timestamp: nowIso }),
          { expirationTtl: 60 }
        ).catch(() => {});
      }
      if (!isTerminalNonPayable) {
        try {
          const { creditLoyaltyIfEligible, sanitizeCustomerIdentity } = await import('../../order/policies/loyalty-trigger');
          const envForLoyalty: Record<string, unknown> = input.kv ? { AUTH_KV: input.kv } : {};
          await creditLoyaltyIfEligible(input.db, envForLoyalty, row.order_id).catch(() => {});

          const ordRow = await input.db
            .prepare('SELECT COALESCE(total, total_amount) AS total, customer_id, customer_email, customer_phone, tenant_id FROM orders WHERE id = ?')
            .bind(row.order_id)
            .first<{ total?: number | null; customer_id?: string | null; customer_email?: string | null; customer_phone?: string | null; tenant_id?: string | null }>()
            .catch(() =>
              input.db
                .prepare('SELECT total, customer_id, customer_email, customer_phone, tenant_id FROM orders WHERE id = ?')
                .bind(row.order_id)
                .first<{ total?: number | null; customer_id?: string | null; customer_email?: string | null; customer_phone?: string | null; tenant_id?: string | null }>()
                .catch(() => null)
            );
          const totalVnd = Number(ordRow?.total ?? expectedOrderTotal ?? 0);
          if (ordRow && totalVnd >= 20000) {
            const rawOrdTenant = ordRow.tenant_id ? String(ordRow.tenant_id).trim() : '';
            const cleanOrdTenant = rawOrdTenant && rawOrdTenant !== '*' && rawOrdTenant.toLowerCase() !== 'hq' ? rawOrdTenant : '';
            let resolvedCustId = ordRow.customer_id ? String(ordRow.customer_id).trim() || null : null;
            if (!resolvedCustId) {
              const { normalizedPhone, email: sanitizedEmail } = sanitizeCustomerIdentity(
                ordRow.customer_phone ?? null,
                ordRow.customer_email ?? null,
              );
              if (normalizedPhone || sanitizedEmail) {
                const effectiveTenant = cleanOrdTenant || rowTenant || 'default';
                const cust = await input.db
                  .prepare(
                    "SELECT id FROM customers WHERE ((email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL)) AND (? = '*' OR COALESCE(NULLIF(tenant_id, ''), 'default') = ? OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?4) LIMIT 1",
                  )
                  .bind(sanitizedEmail, normalizedPhone, effectiveTenant, effectiveTenant)
                  .first<{ id: string }>()
                  .catch(() =>
                    !effectiveTenant || effectiveTenant === 'default'
                      ? input.db
                          .prepare('SELECT id FROM customers WHERE (email = ? AND email IS NOT NULL) OR (phone = ? AND phone IS NOT NULL) LIMIT 1')
                          .bind(sanitizedEmail, normalizedPhone)
                          .first<{ id: string }>()
                          .catch(() => null)
                      : null,
                  );
                resolvedCustId = cust?.id ?? null;
              }
            }
            if (resolvedCustId) {
              const { rewardReferralOnFirstOrder, resolveReferralPolicy, DEFAULT_REFERRAL_POLICY } = await import('@aura/domain-crm');
              const refTenant = cleanOrdTenant || (rowTenant !== '*' && rowTenant.toLowerCase() !== 'hq' ? rowTenant : undefined);
              const refPolicy = await resolveReferralPolicy(input.kv as any, refTenant).catch(() => DEFAULT_REFERRAL_POLICY);
              await rewardReferralOnFirstOrder(input.db, resolvedCustId, row.order_id, totalVnd, refPolicy, refTenant).catch(() => {});
            }
          }
        } catch {
          // Non-blocking loyalty/referral side effects after payment settlement
        }
      }
    }

    if (isTerminalNonPayable) {
      const reviewTag = '[PAID_ON_CANCELLED_ORDER_REQUIRES_REVIEW]';
      const paidStatusSet =
        afterOrderStatus === 'cancelled' || afterOrderStatus === 'canceled'
          ? "payment_status = 'paid',\n             "
          : '';
      try {
        await input.db
          .prepare(
            `UPDATE orders
             SET ${paidStatusSet}notes = CASE
               WHEN notes IS NULL OR TRIM(notes) = '' THEN ?
               WHEN INSTR(notes, ?) > 0 THEN notes
               ELSE notes || ' ' || ?
             END,
             updated_at = ?
             WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
          )
          .bind(reviewTag, reviewTag, reviewTag, nowIso, row.order_id, rowTenant)
          .run();
      } catch {
        if (rowTenant === 'default') {
          await input.db
            .prepare(
              `UPDATE orders
               SET ${paidStatusSet}notes = CASE
                 WHEN notes IS NULL OR TRIM(notes) = '' THEN ?
                 WHEN INSTR(notes, ?) > 0 THEN notes
                 ELSE notes || ' ' || ?
               END,
               updated_at = ?
               WHERE id = ?`
            )
            .bind(reviewTag, reviewTag, reviewTag, nowIso, row.order_id)
            .run()
            .catch(() => {});
        }
      }
      await writePaymentReviewMarker(input.kv, { ...baseIds, source: input.source, stage: 'cancelled_order_paid', errorCode: 'PAID_ON_CANCELLED_ORDER' });
    }

    return { ok: true, status: 200, outcome: paymentChanged ? 'settled' : 'already_settled', ...baseIds, paymentChanged };
  }

  await writePaymentReviewMarker(input.kv, { ...baseIds, source: input.source, stage: 'provider_verify', errorCode: 'UNKNOWN_PROVIDER_STATUS' });
  return { ok: false, status: 409, outcome: 'requires_review', error: 'Unrecognized provider payment status', ...baseIds };
}
