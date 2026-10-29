import type { Context } from 'hono';
import { getTenantId } from '../../middleware/tenant';
import type { Env } from '../../types/env';
import {
  claimReconcileJob,
  reconcilePayOSPayment,
  releaseReconcileJob,
} from '../../../../packages/domain/payment/commands/payos-reconcile';
import { computeNextAttemptAtMs } from '../cron-handlers/payment-reconcile';

export async function manualReconcilePayment(c: Context<{ Bindings: Env }>): Promise<Response> {
  const db = c.env.AURA_DB;
  const kv = c.env.AUTH_KV ?? null;
  const paymentId = String(c.req.param('id') ?? '').trim();
  if (!paymentId) {
    return c.json({ outcome: 'not_found' }, 404);
  }

  const user = c.get('user' as never) as { tenantId?: string } | undefined;
  const rawTenant = user?.tenantId || getTenantId(c);
  const tenantId = !rawTenant || rawTenant === '*' ? 'default' : rawTenant;
  const existing = await db.prepare(
    `SELECT p.id, p.order_id, p.transaction_id, o.tenant_id
     FROM payments p
     JOIN orders o ON o.id = p.order_id
     WHERE p.id = ?`
  ).bind(paymentId).first<{ id: string; order_id: string; transaction_id: string | null; tenant_id: string | null }>();

  if (!existing || (existing.tenant_id || 'default') !== tenantId) {
    return c.json({ outcome: 'not_found' }, 404);
  }

  const clientId = String(c.env.PAYOS_CLIENT_ID ?? '');
  const apiKey = String(c.env.PAYOS_API_KEY ?? '');
  const checksumKey = String(c.env.PAYOS_CHECKSUM_KEY ?? '');
  if (!clientId || !apiKey || !checksumKey) {
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
    const nextMs = computeNextAttemptAtMs('provider_error', 1, nowMs);
    await releaseReconcileJob(db, existing.id, leaseOwner, 'provider_error', nextMs, nowMs).catch(() => {});
    return c.json({
      paymentId: existing.id,
      orderId: existing.order_id,
      orderCode: existing.transaction_id,
      outcome: 'provider_error',
    }, 502);
  }
}
