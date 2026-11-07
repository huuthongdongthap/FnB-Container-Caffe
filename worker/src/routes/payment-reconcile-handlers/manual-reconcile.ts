import type { Context } from 'hono';
import { getTenantId, matchesTenantRow } from '../../lib/db';
import { isHQSuperAdmin } from '../../middleware/tenant';
import type { Env } from '../../types/env';
import {
  claimReconcileJob,
  reconcilePayOSPayment,
  releaseReconcileJob,
} from '../../../../packages/domain/payment/commands/payos-reconcile';
import {
  extractRequestedPaymentTenant,
  hasFinancialRole,
  hasPaymentTenantMismatch,
} from '../../../../packages/domain/payment/policies/payment-access';
import { computeNextAttemptAtMs } from '../cron-handlers/payment-reconcile';

export async function manualReconcilePayment(c: Context<{ Bindings: Env }>): Promise<Response> {
  const user = c.get?.('user' as never) as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  if (!user || (!hasFinancialRole(c) && user.role !== 'supervisor')) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  if (hasPaymentTenantMismatch(c)) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }
  const explicitOverride = extractRequestedPaymentTenant(c);
  const rawUserTenant = String(user.tenantId ?? user.tenant_id ?? '').trim();
  const rawCtxTenant = String((c.get?.('tenantId' as never) as string | undefined) || '').trim();
  if (
    !isHQSuperAdmin(user) &&
    (explicitOverride === '*' ||
      explicitOverride.toLowerCase() === 'hq' ||
      (!rawUserTenant && explicitOverride && explicitOverride !== (rawCtxTenant || 'default')) ||
      (!rawUserTenant && rawCtxTenant && explicitOverride && explicitOverride !== rawCtxTenant))
  ) {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }

  const db = c.env.AURA_DB;
  const kv = c.env.AUTH_KV ?? null;
  const paymentId = String(c.req.param('id') ?? '').trim();
  if (!paymentId) {
    return c.json({ outcome: 'not_found' }, 404);
  }

  // Only HQ super-admins may reconcile across all tenants via wildcard '*'.
  let requestedTenant: string;
  if (isHQSuperAdmin(user)) {
    const cleanCtx = rawCtxTenant && rawCtxTenant !== '*' && rawCtxTenant.toLowerCase() !== 'hq' ? rawCtxTenant : '';
    const midTenant = getTenantId(c);
    const cleanMid = midTenant && midTenant !== '*' && midTenant.toLowerCase() !== 'hq' ? midTenant : '';
    const candidate =
      explicitOverride === '*' || explicitOverride.toLowerCase() === 'hq'
        ? '*'
        : explicitOverride || cleanCtx || cleanMid || rawUserTenant || '*';
    requestedTenant = candidate === '*' || candidate.toLowerCase() === 'hq' ? '*' : candidate;
  } else {
    requestedTenant =
      rawUserTenant && rawUserTenant !== '*' && rawUserTenant.toLowerCase() !== 'hq'
        ? rawUserTenant
        : rawCtxTenant && rawCtxTenant !== '*' && rawCtxTenant.toLowerCase() !== 'hq'
          ? rawCtxTenant
          : 'default';
  }

  type TargetPaymentRow = {
    id: string;
    order_id: string;
    transaction_id: string | null;
    tenant_id: string | null;
    status?: string | null;
    refund_status?: string | null;
    order_payment_status?: string | null;
    reconcile_attempts?: number | null;
    job_attempts?: number | null;
  };
  let existing = await db.prepare(
    `SELECT p.id, p.order_id, p.transaction_id, p.status, p.refund_status, p.reconcile_attempts, o.tenant_id, o.payment_status AS order_payment_status, j.attempts AS job_attempts
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     LEFT JOIN payment_reconciliation_jobs j ON j.payment_id = p.id
     WHERE p.id = ?`
  ).bind(paymentId).first<TargetPaymentRow>().catch(() => null);
  if (!existing) {
    existing = await db.prepare(
      `SELECT p.id, p.order_id, p.transaction_id, o.tenant_id, j.attempts AS job_attempts
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       LEFT JOIN payment_reconciliation_jobs j ON j.payment_id = p.id
       WHERE p.id = ?`
    ).bind(paymentId).first<TargetPaymentRow>().catch(() => null);
  }
  if (!existing) {
    existing = await db.prepare(
      `SELECT p.id, p.order_id, p.transaction_id, p.status, p.refund_status, o.tenant_id, o.payment_status AS order_payment_status
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE p.id = ?`
    ).bind(paymentId).first<TargetPaymentRow>().catch(() => null);
  }
  if (!existing) {
    existing = await db.prepare(
      `SELECT p.id, p.order_id, p.transaction_id, o.tenant_id
       FROM payments p
       JOIN orders o ON o.id = p.order_id
       WHERE p.id = ?`
    ).bind(paymentId).first<TargetPaymentRow>();
  }

  if (!existing || !matchesTenantRow(existing as unknown as Record<string, unknown>, requestedTenant)) {
    return c.json({ outcome: 'not_found' }, 404);
  }
  const tenantId = existing.tenant_id && String(existing.tenant_id).trim() ? String(existing.tenant_id).trim() : 'default';

  const isAlreadySettled =
    existing.status === 'paid' ||
    existing.status === 'completed' ||
    existing.status === 'refunded' ||
    existing.refund_status === 'completed' ||
    existing.order_payment_status === 'paid' ||
    existing.order_payment_status === 'refunded';

  const clientId = String(c.env.PAYOS_CLIENT_ID ?? '');
  const apiKey = String(c.env.PAYOS_API_KEY ?? '');
  const checksumKey = String(c.env.PAYOS_CHECKSUM_KEY ?? '');
  if (isAlreadySettled && (!clientId || !apiKey || !checksumKey)) {
    return c.json({
      paymentId: existing.id,
      orderId: existing.order_id,
      orderCode: existing.transaction_id,
      outcome: 'skipped_already_settled',
    }, 200);
  }
  if (!isAlreadySettled && (!clientId || !apiKey || !checksumKey)) {
    return c.json({
      paymentId: existing.id,
      orderId: existing.order_id,
      orderCode: existing.transaction_id,
      outcome: 'provider_error',
    }, 502);
  }

  const nowMs = Date.now();
  const leaseOwner = `manual:${crypto.randomUUID()}`;
  const claimed = await claimReconcileJob(db, existing.id, leaseOwner, nowMs, true);
  if (!claimed) {
    c.header('Retry-After', '2');
    return c.json({
      paymentId: existing.id,
      orderId: existing.order_id,
      orderCode: existing.transaction_id,
      outcome: 'lease_busy',
    }, 202);
  }

  try {
    const result = await reconcilePayOSPayment({
      db,
      kv,
      paymentId: existing.id,
      tenantId,
      clientId,
      apiKey,
      checksumKey,
      source: 'manual',
    });

    const jobRow = await db.prepare('SELECT attempts FROM payment_reconciliation_jobs WHERE payment_id = ?')
      .bind(existing.id).first<{ attempts: number }>();
    const attempts = Number(jobRow?.attempts ?? 1);
    const nextMs = computeNextAttemptAtMs(result.outcome, attempts, nowMs);
    await releaseReconcileJob(db, existing.id, leaseOwner, result.outcome, nextMs, nowMs);

    return c.json({
      paymentId: existing.id,
      orderId: existing.order_id,
      orderCode: existing.transaction_id,
      outcome: result.outcome,
    }, result.status);
  } catch {
    const priorAttempts = Number(existing.reconcile_attempts ?? existing.job_attempts) || 0;
    const jobRow = await db.prepare('SELECT attempts FROM payment_reconciliation_jobs WHERE payment_id = ?')
      .bind(existing.id).first<{ attempts: number }>().catch(() => null);
    const attempts = Math.max(1, priorAttempts + 1, Number(jobRow?.attempts) || 0);
    const nextMs = computeNextAttemptAtMs('provider_error', attempts, nowMs);
    await releaseReconcileJob(db, existing.id, leaseOwner, 'provider_error', nextMs, nowMs).catch(() => {});
    return c.json({
      paymentId: existing.id,
      orderId: existing.order_id,
      orderCode: existing.transaction_id,
      outcome: 'provider_error',
    }, 502);
  }
}
