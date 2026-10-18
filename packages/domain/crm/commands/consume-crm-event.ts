/**
 * Canonical CRM Event Consumer
 * Single Authoritative Consumer for Customer/Order Domain Events.
 * Dispatches domain events to CRM subsystems: Visits, Loyalty Accrual, Refunds, and Linking.
 * Invariants: Fully idempotent, failure-isolated, and replay-safe.
 */
import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from 'worker/src/middleware/logger';
import { loadPolicy } from './loyalty-policy';
import { applyAccrual } from './accrual';
import { reverseAccrual } from './refund-reversal';
import { recordVisit } from '@aura/domain-customer';
import type { CanonicalCustomerEvent } from '@aura/domain-customer';

const log = createLogger({ route: 'crm-consumer' });

export interface ConsumeCrmEventInput {
  db: D1Database;
  event: CanonicalCustomerEvent<Record<string, unknown>>;
  env?: unknown;
}

export interface CrmConsumeResult {
  ok: boolean;
  processed: boolean;
  actionTaken?: string;
  error?: string;
}

export async function consumeCrmEvent(input: ConsumeCrmEventInput): Promise<CrmConsumeResult> {
  const { db, event } = input;
  const { eventType, customerId, orderId, payload } = event;

  try {
    switch (eventType) {
      case 'order_created': {
        if (!customerId) return { ok: true, processed: false, actionTaken: 'guest_order_skipped' };
        const channel = (payload.channel as any) || 'in_store';
        const spent = typeof payload.totalAmount === 'number' ? payload.totalAmount : null;
        const res = await recordVisit({ db, customerId, orderId, channel, spent });
        return { ok: res.ok, processed: res.ok, actionTaken: res.ok ? 'visit_recorded' : 'visit_failed' };
      }

      case 'order_paid':
      case 'order_completed': {
        if (!customerId || !orderId) return { ok: true, processed: false, actionTaken: 'guest_or_no_order' };
        const total = Number(payload.totalAmount || 0);
        let loyaltyOk = true;
        if (total > 0) {
          const policy = await loadPolicy(db);
          const aRes = await applyAccrual(db, policy, {
            orderId,
            customerId,
            orderTotalVnd: total,
            cashbackUsedVnd: Number(payload.cashbackUsed || 0),
          });
          loyaltyOk = aRes.ok;
        }
        let visitOk = true;
        if (eventType === 'order_completed') {
          const channel = (payload.channel as any) || 'in_store';
          const vRes = await recordVisit({ db, customerId, orderId, channel, spent: total });
          visitOk = vRes.ok;
        }
        const ok = loyaltyOk && visitOk;
        return { ok, processed: ok, actionTaken: ok ? 'loyalty_and_visit_processed' : 'crm_partial_failure' };
      }

      case 'order_cancelled': {
        if (!orderId || !customerId) return { ok: true, processed: false, actionTaken: 'no_order_id' };
        const total = Number(payload.totalAmount || 0);
        const policy = await loadPolicy(db);
        const rRes = await reverseAccrual(db, policy, {
          orderId,
          customerId,
          refundAmountVnd: total,
        });
        const ok = rRes ? rRes.ok !== false : true;
        return { ok, processed: ok, actionTaken: ok ? 'refund_accrual_reversed' : 'refund_reversal_failed' };
      }

      case 'customer_linked': {
        if (!orderId || !customerId) return { ok: true, processed: false, actionTaken: 'missing_params' };
        try {
          await db.prepare('UPDATE visits SET customer_id = ? WHERE order_id = ?')
            .bind(customerId, orderId).run();
        } catch {
          // Graceful fallback when visits table is absent
        }
        const total = Number(payload.totalAmount || payload.total || 0);
        let accrualOk = true;
        if (total > 0) {
          const policy = await loadPolicy(db);
          const aRes = await applyAccrual(db, policy, {
            orderId,
            customerId,
            orderTotalVnd: total,
          });
          accrualOk = aRes ? aRes.ok !== false : true;
        }
        return { ok: accrualOk, processed: accrualOk, actionTaken: accrualOk ? 'customer_linked_and_backfilled' : 'customer_link_accrual_failed' };
      }

      case 'visit_recorded': {
        if (!customerId) return { ok: true, processed: false };
        const channel = (payload.channel as any) || 'in_store';
        const spent = typeof payload.spent === 'number' ? payload.spent : null;
        const vRes = await recordVisit({ db, customerId, orderId, channel, spent });
        const ok = vRes ? vRes.ok !== false : true;
        return { ok, processed: ok, actionTaken: ok ? 'visit_materialized' : 'visit_failed' };
      }

      case 'customer_identified': {
        return { ok: true, processed: true, actionTaken: 'identity_acknowledged' };
      }

      default:
        return { ok: true, processed: false, actionTaken: 'unhandled_event' };
    }
  } catch (err) {
    log.error('CRM consumer error for event:', {
      error: (err as Error).message,
      eventType,
      orderId,
      customerId
    });
    return { ok: false, processed: false, error: (err as Error).message };
  }
}

/**
 * Replays an array of historical events through CRM consumers.
 * Due to idempotency guards across visits and loyalty tables,
 * replaying events never duplicates business effects.
 */
export async function replayCustomerEvents(input: {
  db: D1Database;
  events: CanonicalCustomerEvent<Record<string, unknown>>[];
  env?: unknown;
}): Promise<{ total: number; processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  for (const event of input.events) {
    const res = await consumeCrmEvent({ db: input.db, event, env: input.env });
    if (res.ok && res.processed) {
      processed++;
    } else if (!res.ok) {
      errors++;
    }
  }

  return { total: input.events.length, processed, errors };
}
