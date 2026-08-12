/**
 * loyalty-trigger.ts
 *
 * Extracted from update-order.ts: previously duplicated loyalty-credit
 * block (lines 103–112 and 120–128) to prevent double-earn bugs.
 *
 * Call once after the order UPDATE succeeds. Idempotent:
 * processOrderLoyalty exits early when cashback_transactions already
 * contains an `earn` row for this order_id.
 */

import type { D1Database } from '@cloudflare/workers-types';
import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'orders' });

export async function creditLoyaltyIfEligible(
  db: D1Database,
  env: Record<string, unknown>,
  orderId: string,
): Promise<void> {
  const existingEarn = await db.prepare(
    'SELECT id FROM cashback_transactions WHERE order_id = ? AND type = \'earn\' LIMIT 1'
  ).bind(orderId).first<{ id: string }>();

  if (existingEarn) {
    log.info('Loyalty credit skipped (already earned)', { orderId, existingId: existingEarn.id });
    return;
  }

  const { processOrderLoyalty } = await import('../../routes/loyalty');
  await processOrderLoyalty(orderId, env);
}
