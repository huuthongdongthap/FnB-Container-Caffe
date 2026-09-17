/**
 * Campaign Dedup + Logging — prevents re-send within cooldown window.
 * Thin D1 wrapper: env-agnostic, returns boolean for flow control.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { CampaignResult, CampaignTrigger } from './types';

/**
 * Check if a customer has been sent a campaign trigger within the cooldown period.
 * Returns true if a recent send exists (should NOT send again).
 */
export async function deduplicate(
  db: D1Database,
  customerId: string,
  trigger: CampaignTrigger,
  sinceDays: number,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const row = await db.prepare(
    `SELECT id FROM campaign_logs
     WHERE customer_id = ? AND trigger = ? AND sent_at > ?
     ORDER BY sent_at DESC LIMIT 1`
  ).bind(customerId, trigger, cutoff).first();
  return row !== null;
}

/**
 * Record a campaign send result in campaign_logs.
 */
export async function logSend(
  db: D1Database,
  result: CampaignResult,
): Promise<void> {
  const id = `camp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  await db.prepare(
    `INSERT INTO campaign_logs (id, customer_id, trigger, channel, sent_at, status, error)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    result.customer_id,
    result.trigger,
    result.channel,
    new Date().toISOString(),
    result.sent ? 'sent' : 'failed',
    result.error || null,
  ).run();
}
