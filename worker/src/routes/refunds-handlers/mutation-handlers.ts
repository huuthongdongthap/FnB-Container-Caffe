import type { Hono, Context } from 'hono';
import { requireAuth } from '../../middleware/auth';
import { audit } from '../../middleware/audit-log';
import {
  canAccessPaymentOrder,
  FINANCIAL_ROLES,
  hasFinancialRole,
  resolvePaymentTenantScope,
  verifyPaymentOrderToken,
} from '../../../../packages/domain/payment/policies/payment-access';
import { publishOrderEvent } from '../../../../packages/domain/order/policies/customer-order-payload';
import type { Env } from '../../types/env';
import { processRefundLoyalty } from './loyalty-work';
import { log, refundRequestSchema, ERRORS } from './helpers';

export async function handleRefund(c: Context<{ Bindings: Env }>, openApi = false): Promise<Response> {
  if (!hasFinancialRole(c)) return c.json({ success: false, error: 'Forbidden' }, 403);
  const scope = resolvePaymentTenantScope(c, false);
  if (!scope) return c.json({ success: false, error: 'Forbidden' }, 403);
  const tenantId = scope.wildcard ? '*' : scope.tenantId;
  // Parse request JSON before the refund settlement error boundary so malformed payloads
  // return a 400 client error rather than a 500 reconciliation alert.
  let body: Record<string, unknown>;
  try {
    const raw = await c.req.json();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400);
    }
    body = raw as Record<string, unknown>;
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }
  const db = c.env.AURA_DB;
  try {
    const rawPaymentId = body.paymentId !== undefined && body.paymentId !== null ? String(body.paymentId).trim() : '';
    const rawOrderId = body.orderId !== undefined && body.orderId !== null ? String(body.orderId).trim() : '';
    if (!rawPaymentId && !rawOrderId) return c.json({ success: false, error: 'Missing paymentId' }, 400);
    const preParsed = refundRequestSchema.safeParse(
      openApi
        ? {
            ...body,
            amount: body.amount ?? 1,
            reason: body.reason === undefined ? 'Staff refund' : body.reason,
          }
        : body
    );
    if (!preParsed.success) return c.json({ success: false, error: preParsed.error.issues[0].message }, 400);
    const manualTransferRef = typeof body.manual_transfer_ref === 'string'
      ? body.manual_transfer_ref.trim()
      : (typeof body.manualTransferRef === 'string' ? body.manualTransferRef.trim() : '');
    // An order may have multiple payment attempts. A settled reference identifies
    // its original payment even when another paid attempt now wins generic lookup.
    const referencedTransfer = !rawPaymentId && rawOrderId && manualTransferRef
      ? await db.prepare(`SELECT t.payment_id FROM payment_refund_transfers t
          JOIN payments p ON p.id = t.payment_id JOIN orders o ON o.id = p.order_id
          WHERE t.manual_transfer_ref = ? AND p.order_id = ?
            AND t.tenant_id = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')
            AND (? = '*' OR t.tenant_id = ?) LIMIT 1`)
          .bind(manualTransferRef, rawOrderId, tenantId, tenantId).first<{ payment_id: string }>()
      : null;
    const resolvedPaymentId = rawPaymentId || referencedTransfer?.payment_id || '';
    const lookupColumn = resolvedPaymentId ? 'p.id' : 'p.order_id';
    const lookupValue = resolvedPaymentId || rawOrderId;
    const orderByClause = resolvedPaymentId
      ? ''
      : " ORDER BY CASE WHEN LOWER(COALESCE(p.status, '')) IN ('paid', 'completed') THEN 0 ELSE 1 END, p.created_at DESC LIMIT 1";
    type RefundPaymentRow = {
      id: string;
      order_id: string;
      method: string;
      amount: number;
      status: string;
      transaction_id: string;
      refund_status: string | null;
      refund_amount?: number | null;
      tenant_id: string | null;
      customer_id: string | null;
      order_token?: string | null;
      guest_token_hash?: string | null;
      orderTokenVerified?: boolean;
    };
    let payment: RefundPaymentRow | null = null;
    try {
      payment = await db
        .prepare(
          `SELECT p.*, o.tenant_id, o.customer_id, o.guest_token_hash
           FROM payments p JOIN orders o ON o.id = p.order_id
           WHERE ${lookupColumn} = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)${orderByClause}`
        )
        .bind(lookupValue, tenantId, tenantId)
        .first<RefundPaymentRow>();
    } catch {
      try {
        payment = await db
          .prepare(
            `SELECT p.*, o.tenant_id, o.customer_id, o.order_token
             FROM payments p JOIN orders o ON o.id = p.order_id
             WHERE ${lookupColumn} = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)${orderByClause}`
          )
          .bind(lookupValue, tenantId, tenantId)
          .first<RefundPaymentRow>();
      } catch {
        payment = await db
          .prepare(
            `SELECT p.*, o.tenant_id, o.customer_id
             FROM payments p JOIN orders o ON o.id = p.order_id
             WHERE ${lookupColumn} = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)${orderByClause}`
          )
          .bind(lookupValue, tenantId, tenantId)
          .first<RefundPaymentRow>();
      }
    }
    if (payment) {
      payment.orderTokenVerified = await verifyPaymentOrderToken(c, payment);
    }
    if (!payment || !canAccessPaymentOrder(c, payment)) return c.json(ERRORS.PAYMENT_NOT_FOUND, 404);
    if (rawPaymentId && rawOrderId && String(payment.order_id) !== rawOrderId) {
      return c.json({ success: false, error: 'paymentId does not belong to the specified orderId' }, 400);
    }
    const user = c.get('user');
    const userRole = String(user?.role || '').trim().toLowerCase();
    const canManualRefund = ['owner', 'manager', 'admin'].includes(userRole);
    const effectivePaymentTenant = (payment.tenant_id && String(payment.tenant_id).trim()) || 'default';

    if (manualTransferRef) {
      if (!canManualRefund) {
        return c.json({ success: false, error: 'Only owner or manager can confirm manual bank-transfer refund' }, 403);
      }
      if (manualTransferRef.length > 200) {
        return c.json({ success: false, error: 'Transfer reference must be 200 characters or fewer' }, 400);
      }
      const ready = await db.prepare('SELECT tenant_id FROM refund_tenant_readiness WHERE tenant_id = ?')
        .bind(effectivePaymentTenant).first();
      if (!ready) return c.json({ success: false, code: 'REFUND_HISTORY_UNRECONCILED',
        error: 'Tenant refund history must be reconciled before manual refunds are enabled' }, 409);
      const existingTransfer = await db.prepare(
        `SELECT t.payment_id, t.amount, t.reason, w.status AS loyalty_status
         FROM payment_refund_transfers t LEFT JOIN refund_loyalty_work w
           ON w.tenant_id = t.tenant_id AND w.reversal_key = t.manual_transfer_ref
         WHERE t.tenant_id = ? AND t.manual_transfer_ref = ? LIMIT 1`
      ).bind(effectivePaymentTenant, manualTransferRef)
        .first<{ payment_id: string; amount: number; reason: string; loyalty_status: string | null }>();
      if (existingTransfer) {
        if (existingTransfer.payment_id !== payment.id || (body.amount !== undefined && body.amount !== existingTransfer.amount)
          || existingTransfer.loyalty_status !== 'pending') {
          return c.json({ success: false, error: 'Transfer reference already recorded' }, 409);
        }
        const loyalty = await processRefundLoyalty(db, c.env, { tenantId: effectivePaymentTenant,
          reference: manualTransferRef, paymentId: payment.id, orderId: payment.order_id,
          customerId: payment.customer_id, amount: existingTransfer.amount, reason: existingTransfer.reason });
        return c.json({ success: true, data: { paymentId: payment.id, orderId: payment.order_id,
          amount: existingTransfer.amount, refund_status: payment.refund_status,
          manual_transfer_ref: manualTransferRef, loyalty_reversal: loyalty } }, 200);
      }
    }

    // Partial refunds accumulate; each tranche is capped at the still-unrefunded balance.
    const priorRefunded = payment.refund_status === 'partial' ? Math.max(0, Number(payment.refund_amount) || 0) : 0;
    const refundableBalance = Math.max(0, Number(payment.amount) - priorRefunded);
    const parsed = refundRequestSchema.safeParse(openApi ? { ...body, amount: body.amount ?? refundableBalance, reason: body.reason === undefined ? 'Staff refund' : body.reason } : body);
    if (!parsed.success) return c.json({ success: false, error: parsed.error.issues[0].message }, 400);
    const amount = parsed.data.amount ?? refundableBalance;
    if (!['paid', 'completed'].includes(payment.status)) return c.json(ERRORS.PAYMENT_NOT_PAID, 400);
    const hasManualTransferRef = manualTransferRef.length > 0;
    // Only a manually settled bank transfer may add a tranche on top of an existing partial refund.
    if (payment.refund_status && !(payment.refund_status === 'partial' && hasManualTransferRef)) return c.json({ ...ERRORS.PAYMENT_ALREADY_REFUNDED,
      error: 'Refund already submitted or pending reconciliation' }, 409);
    if (amount > refundableBalance) return c.json(ERRORS.AMOUNT_EXCEEDS_PAYMENT, 400);
    if (payment.method !== 'payos' || !/^\d+$/.test(payment.transaction_id || '')) {
      return c.json({ success: false, error: 'Only verified PayOS payments support this refund operation' }, 409);
    }

    if (manualTransferRef) {
      const now = new Date().toISOString();
      const refundReason = parsed.data.reason || 'Manual bank-transfer refund';

      const cumulativeRefunded = priorRefunded + amount;
      const fullRefund = cumulativeRefunded >= Number(payment.amount);
      const refundStatus = fullRefund ? 'completed' : 'partial';
      const updatePayment = db.prepare(`UPDATE payments
        SET refund_status = ?, refund_amount = ?, refund_reason = ?, refunded_at = ?,
          status = CASE WHEN ? = 1 THEN 'refunded' ELSE status END, updated_at = ?
        WHERE id = ? AND order_id = ? AND amount = ? AND method = 'payos' AND transaction_id = ?
          AND status IN ('paid', 'completed')
          AND (refund_status IS NULL OR refund_status IN ('', 'partial'))
          AND COALESCE(refund_amount, 0) = ? AND ? <= amount
          AND EXISTS (SELECT 1 FROM orders o WHERE o.id = payments.order_id
            AND COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?)
          AND EXISTS (SELECT 1 FROM refund_tenant_readiness WHERE tenant_id = ?)`)
        .bind(refundStatus, cumulativeRefunded, refundReason, now, fullRefund ? 1 : 0, now,
          payment.id, payment.order_id, payment.amount, payment.transaction_id, priorRefunded, cumulativeRefunded,
          effectivePaymentTenant, effectivePaymentTenant);
      // The payment, durable transfer identity, retryable loyalty work, and full-refund
      // order transition commit together. CHECK assertions abort the whole D1 batch if
      // any CAS or tenant-scoped order update changes anything other than one row.
      const batch = [
        updatePayment,
        db.prepare(`INSERT INTO payment_refund_transfers
          (tenant_id, manual_transfer_ref, payment_id, amount, reason, actor_id, created_at)
          SELECT ?, ?, ?, ?, ?, ?, ? WHERE changes() = 1`)
          .bind(effectivePaymentTenant, manualTransferRef, payment.id, amount, refundReason, String(user?.id || 'system'), now),
        db.prepare(`INSERT INTO refund_mutation_guards (settlement_ok)
          VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)`),
        db.prepare(`INSERT INTO refund_loyalty_work (tenant_id, reversal_key, payment_id, order_id, amount)
          SELECT ?, ?, ?, ?, ? WHERE changes() = 1`)
          .bind(effectivePaymentTenant, manualTransferRef, payment.id, payment.order_id, amount),
        db.prepare(`INSERT INTO refund_mutation_guards (settlement_ok)
          VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)`),
        ...(fullRefund ? [db.prepare(`UPDATE orders SET payment_status = 'refunded', updated_at = ?
          WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
            AND LOWER(COALESCE(payment_status, '')) IN ('paid', 'completed')`)
          .bind(now, payment.order_id, effectivePaymentTenant),
          db.prepare(`INSERT INTO refund_mutation_guards (settlement_ok)
            VALUES (CASE WHEN changes() = 1 THEN 1 ELSE 0 END)`)] : []),
        db.prepare('DELETE FROM refund_mutation_guards'),
      ];
      try {
        await db.batch(batch);
      } catch (failure) {
        const message = String(failure);
        if (/UNIQUE constraint failed: payment_refund_transfers\./i.test(message)) {
          return c.json({ success: false, error: 'Transfer reference already recorded' }, 409);
        }
        if (/refund_settlement_conflict/.test(message)) {
          return c.json({ ...ERRORS.PAYMENT_ALREADY_REFUNDED,
            error: 'Refund state changed concurrently; retry with the same transfer reference' }, 409);
        }
        throw failure;
      }

      const postRefundOrder = await db
        .prepare('SELECT status, payment_status FROM orders WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), \'\'), \'default\') = ? LIMIT 1')
        .bind(payment.order_id, effectivePaymentTenant)
        .first<{ status?: string | null; payment_status?: string | null }>();
      const effectiveOrderStatus = String(postRefundOrder?.status || 'pending');
      const effectiveOrderPayStatus = String(postRefundOrder?.payment_status || 'paid');

      if (c.env?.AUTH_KV) {
        await Promise.all([
          c.env.AUTH_KV.delete('orders:active:all').catch(() => {}),
          c.env.AUTH_KV.delete(`orders:active:${effectivePaymentTenant}`).catch(() => {}),
          publishOrderEvent(c.env.AUTH_KV, payment.order_id, effectiveOrderStatus, {
            tenantId: effectivePaymentTenant,
            paymentStatus: effectiveOrderPayStatus,
          }).catch(() => {}),
        ]);
      }

      if (c.env?.ORDER_BROADCASTER) {
        try {
          const ns = c.env.ORDER_BROADCASTER;
          const doChannel = effectivePaymentTenant !== 'default'
            ? `${effectivePaymentTenant}:${payment.order_id}` : payment.order_id;
          const stub = ns.get(ns.idFromName(doChannel)) as unknown as {
            broadcast?: (msg: unknown) => Promise<void>;
            fetch?: (input: RequestInfo, init?: RequestInit) => Promise<Response>;
          };
          const payload = { orderId: payment.order_id, status: effectiveOrderStatus,
            payment_status: effectiveOrderPayStatus, refund_status: refundStatus,
            ...(effectivePaymentTenant !== 'default' ? { tenant_id: effectivePaymentTenant } : {}), updatedAt: Date.now() };
          if (typeof stub.broadcast === 'function') await stub.broadcast(payload);
          else if (typeof stub.fetch === 'function') await stub.fetch('https://do/broadcast', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
          });
        } catch { /* Non-blocking broadcaster notification */ }
      }

      try {
        await db.prepare(`INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, details, metadata, tenant_id, created_at)
          VALUES (?, ?, ?, 'manual_refund_settled', 'payment', ?, ?, ?, ?, ?)`)
          .bind(user?.id || 'system', user?.name || user?.email || 'manager', user?.id || null, payment.id,
            JSON.stringify({ manual_transfer_ref: manualTransferRef, amount, order_id: payment.order_id, reason: refundReason }),
            JSON.stringify({ manual_transfer_ref: manualTransferRef, amount }), effectivePaymentTenant, now).run();
      } catch { /* Audit detail is supplemental; financial settlement is committed. */ }

      const loyaltyReversal = await processRefundLoyalty(db, c.env, { tenantId: effectivePaymentTenant,
        reference: manualTransferRef, paymentId: payment.id, orderId: payment.order_id,
        customerId: payment.customer_id, amount, reason: refundReason });
      if (loyaltyReversal.status === 'failed') {
        try {
          await db.prepare(`INSERT INTO audit_logs (actor_id, actor_name, user_id, action, resource_type, resource_id, details, metadata, tenant_id, created_at)
            VALUES (?, ?, ?, 'loyalty_reversal_failed', 'payment', ?, ?, ?, ?, ?)`)
            .bind(user?.id || 'system', user?.name || user?.email || 'manager', user?.id || null, payment.id,
              JSON.stringify({ order_id: payment.order_id, customer_id: loyaltyReversal.customerId ?? null,
                refund_amount: amount, manual_transfer_ref: manualTransferRef, reason: loyaltyReversal.reason, candidates: loyaltyReversal.candidates, retryable: true }),
              JSON.stringify({ order_id: payment.order_id, customer_id: loyaltyReversal.customerId ?? null, retryable: true }),
              effectivePaymentTenant, now).run();
        } catch { /* Durable pending work remains the retry source. */ }
      }

      const { candidates: _auditCandidates, ...publicLoyaltyReversal } = loyaltyReversal;
      return c.json({ success: true, data: { paymentId: payment.id, orderId: payment.order_id,
        amount, refund_status: refundStatus, manual_transfer_ref: manualTransferRef,
        loyalty_reversal: publicLoyaltyReversal } }, 200);
    }

    // The published PayOS payment-link API documents create/get/cancel, not refunds.
    // Never invent a provider transfer or mark paid funds refunded without evidence.
    return c.json({ success: false, code: 'REFUND_PROVIDER_UNAVAILABLE',
      error: 'Automatic PayOS refund is unavailable; reconcile with the payment provider',
      retryable: false, reconciliationRequired: true }, 422);
  } catch (err) {
    log.error('Refund error', { message: (err as Error).message });
    return c.json({ success: false, error: 'Refund result unknown; reconciliation required', retryable: false }, 500);
  }
}

export function registerRefundMutationHandlers(router: Hono<{ Bindings: Env }>): void {
  router.post('/refund', requireAuth(FINANCIAL_ROLES), audit('refund_create'), (c) => handleRefund(c));
}
