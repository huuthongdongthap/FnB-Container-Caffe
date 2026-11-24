import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { log } from './helpers';

export type RefundLoyaltyOutcome = {
  status: 'reversed' | 'skipped' | 'failed';
  customerId?: string;
  pointsDeducted?: number;
  reason?: string;
  candidates?: string[];
  retryable?: boolean;
};

/** Settlement has already persisted the work; failed processing stays pending. */
export async function processRefundLoyalty(db: D1Database, env: Env, input: {
  tenantId: string; reference: string; paymentId: string; orderId: string;
  customerId: string | null; amount: number; reason: string;
}): Promise<RefundLoyaltyOutcome> {
  try {
    const { loadPolicy, reverseRefundTranche, resolveAccrualRecipient } = await import('@aura/domain-crm');
    const recipient = await resolveAccrualRecipient(db, input.orderId, input.tenantId, true);
    if (recipient.ambiguous) return { status: 'failed', reason: 'ambiguous_accrual_recipient', candidates: recipient.candidates, retryable: true };
    const owner = input.customerId?.trim();
    const customerId = recipient.customerId ?? (owner && owner !== 'guest' ? owner : null);
    if (!customerId) {
      // Only zero-accrual orders may complete without a recipient. Missing ledger
      // evidence for a nonzero accrual must remain actionable, never silently skip.
      const result = await db.prepare(`UPDATE refund_loyalty_work SET status = 'completed', completed_at = ?
        WHERE tenant_id = ? AND reversal_key = ? AND status = 'pending'
          AND EXISTS (SELECT 1 FROM orders WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
            AND COALESCE(points_earned, 0) = 0 AND COALESCE(cashback_earned, 0) = 0)`)
        .bind(new Date().toISOString(), input.tenantId, input.reference, input.orderId, input.tenantId).run();
      return result.meta.changes > 0 ? { status: 'skipped', reason: 'no_points_to_reverse' }
        : { status: 'failed', reason: 'accrual_recipient_missing', retryable: true };
    }
    const policy = await loadPolicy(db, env.AUTH_KV, new Date(), input.tenantId);
    const result = await reverseRefundTranche(db, policy, {
      orderId: input.orderId, customerId, tenantId: input.tenantId,
      refundAmountVnd: input.amount, reversalKey: input.reference, reason: input.reason,
      verifiedLedgerRecipient: recipient.fromLedger,
    });
    if (result.ok) return { status: 'reversed', customerId, pointsDeducted: result.pointsDeducted };
    if (result.reason === 'already_reversed') return { status: 'skipped', customerId, reason: result.reason };
    return { status: 'failed', customerId, reason: result.reason, retryable: true };
  } catch (error) {
    return { status: 'failed', reason: error instanceof Error ? error.message : 'reversal_exception', retryable: true };
  }
}

interface PendingLoyaltyWorkRow {
  tenant_id: string;
  reversal_key: string;
  payment_id: string | null;
  order_id: string;
  customer_id: string | null;
  amount: number;
}

/** Scheduled retry worker for pending refund_loyalty_work rows. */
export async function retryPendingRefundLoyaltyWork(
  env: Env,
  limit = 25,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const db = env.AURA_DB;
  if (!db) return { processed: 0, succeeded: 0, failed: 0 };

  let rows: PendingLoyaltyWorkRow[] = [];
  try {
    const res = await db
      .prepare(
        `SELECT tenant_id, reversal_key, payment_id, order_id, customer_id, amount
         FROM refund_loyalty_work
         WHERE status = 'pending'
         ORDER BY COALESCE(completed_at, created_at) ASC, created_at ASC
         LIMIT ?`,
      )
      .bind(limit)
      .all<PendingLoyaltyWorkRow>();
    rows = res.results ?? [];
  } catch (err) {
    log.error('[refund-loyalty-work] failed to query pending work', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;
  for (const row of rows) {
    const outcome = await processRefundLoyalty(db, env, {
      tenantId: row.tenant_id,
      reference: row.reversal_key,
      paymentId: row.payment_id ?? '',
      orderId: row.order_id,
      customerId: row.customer_id,
      amount: Number(row.amount),
      reason: 'Scheduled loyalty reversal retry',
    });
    if (outcome.status === 'reversed' || outcome.status === 'skipped') {
      succeeded += 1;
    } else {
      failed += 1;
      log.error('[refund-loyalty-work] retry failed', {
        tenantId: row.tenant_id,
        orderId: row.order_id,
        reversalKey: row.reversal_key,
        reason: outcome.reason ?? 'unknown',
      });
      // Push failed row to back of retry queue by bumping completed_at (only used as retry timestamp while status='pending')
      try {
        await db
          .prepare(
            `UPDATE refund_loyalty_work
             SET completed_at = ?
             WHERE tenant_id = ? AND reversal_key = ? AND status = 'pending'`,
          )
          .bind(new Date().toISOString(), row.tenant_id, row.reversal_key)
          .run();
      } catch (bumpErr) {
        log.error('[refund-loyalty-work] failed to bump retry timestamp', {
          tenantId: row.tenant_id,
          reversalKey: row.reversal_key,
          error: bumpErr instanceof Error ? bumpErr.message : String(bumpErr),
        });
      }
    }
  }

  return { processed: rows.length, succeeded, failed };
}
