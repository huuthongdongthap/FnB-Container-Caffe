import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';

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
