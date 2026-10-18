/**
 * Campaign Engine — core evaluate, route, dedup logic
 */
import { createLogger } from '../../utils/logger';
import type { CampaignTrigger, CampaignResult } from './types';

const log = createLogger({ route: 'campaign-engine' });

function generateId(): string {
  return `camp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Check if a customer has been sent a campaign trigger within the cooldown period.
 * Returns true if a recent send exists (should NOT send again).
 */
export async function deduplicate(
  db: import('@cloudflare/workers-types').D1Database,
  customerId: string,
  trigger: CampaignTrigger,
  sinceDays: number
): Promise<boolean> {
  const cutoff = new Date(Date.now() - sinceDays * 86400000).toISOString();
  try {
    const row = await db.prepare(
      `SELECT id, sent_at FROM campaign_logs
       WHERE customer_id = ? AND trigger = ? AND sent_at > ?
       ORDER BY sent_at DESC LIMIT 1`
    ).bind(customerId, trigger, cutoff).first();
    return row !== null;
  } catch (err) {
    const msg = String((err as Error)?.message || '');
    if (msg.includes('column')) {
      try {
        const row = await db.prepare(
          `SELECT id, created_at as sent_at FROM campaign_logs
           WHERE customer_id = ? AND trigger_type = ? AND created_at > ?
           ORDER BY created_at DESC LIMIT 1`
        ).bind(customerId, trigger, cutoff).first();
        return row !== null;
      } catch (fallbackErr) {
        log.warn('deduplicate check failed', { customerId, trigger, error: (fallbackErr as Error).message });
        return false;
      }
    }
    log.warn('deduplicate check failed', { customerId, trigger, error: (err as Error).message });
    return false;
  }
}

/**
 * Record a campaign send in campaign_logs.
 */
export async function logSend(
  db: import('@cloudflare/workers-types').D1Database,
  result: CampaignResult
): Promise<void> {
  const id = generateId();
  const now = new Date().toISOString();
  const status = result.sent ? 'sent' : 'failed';
  const errorMsg = result.error || null;
  try {
    await db.prepare(
      `INSERT INTO campaign_logs (id, customer_id, trigger, channel, sent_at, status, error)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      result.customer_id,
      result.trigger,
      result.channel,
      now,
      status,
      errorMsg
    ).run();
  } catch (err) {
    const msg = String((err as Error)?.message || '');
    if (msg.includes('column')) {
      try {
        await db.prepare(
          `INSERT INTO campaign_logs (id, customer_id, trigger_type, channel, status, error_message, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          result.customer_id,
          result.trigger,
          result.channel,
          status,
          errorMsg,
          now
        ).run();
        return;
      } catch (fallbackErr) {
        log.error('logSend failed', { customerId: result.customer_id, error: (fallbackErr as Error).message });
        return;
      }
    }
    log.error('logSend failed', { customerId: result.customer_id, error: (err as Error).message });
  }
}

export { generateId };
