/**
 * Campaign Dedup + Logging — prevents re-send within cooldown window.
 * Thin D1 wrapper: env-agnostic, returns boolean for flow control.
 */
import type { D1Database } from '@cloudflare/workers-types';
import type { CampaignResult, CampaignTrigger } from './types';

function normalizeDedupTenant(tenantId?: string | null): string | undefined {
  if (!tenantId || !tenantId.trim()) return undefined;
  const trimmed = tenantId.trim();
  return trimmed === '*' || trimmed.toLowerCase() === 'hq' ? '*' : trimmed;
}

/**
 * Check if a customer has been sent a campaign trigger within the cooldown period.
 * Returns true if a recent send exists (should NOT send again).
 */
export async function deduplicate(
  db: D1Database,
  customerId: string,
  trigger: CampaignTrigger,
  sinceDays: number,
  tenantId?: string,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const normTenant = normalizeDedupTenant(tenantId);
  const scoped = Boolean(normTenant && normTenant !== '*');
  if (scoped && normTenant) {
    try {
      const row = await db.prepare(
        `SELECT id, tenant_id FROM campaign_logs
         WHERE customer_id = ? AND trigger = ? AND sent_at > ?
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
         ORDER BY sent_at DESC LIMIT 1`
      ).bind(customerId, trigger, cutoff, normTenant).first<{ id?: string; tenant_id?: string | null }>();
      if (!row) return false;
      if ('tenant_id' in row) {
        const rowTenant = typeof row.tenant_id === 'string' && row.tenant_id.trim() ? row.tenant_id.trim() : 'default';
        return rowTenant === normTenant;
      }
      return true;
    } catch {
      // Fallback if tenant_id column is absent
    }
  }
  const row = await db.prepare(
    `SELECT id FROM campaign_logs
     WHERE customer_id = ? AND trigger = ? AND sent_at > ?
     ORDER BY sent_at DESC LIMIT 1`
  ).bind(customerId, trigger, cutoff).first<{ id?: string; tenant_id?: string | null }>();
  if (!row) return false;
  if (scoped && normTenant && 'tenant_id' in row) {
    const rowTenant = typeof row.tenant_id === 'string' && row.tenant_id.trim() ? row.tenant_id.trim() : 'default';
    return rowTenant === normTenant;
  }
  return true;
}

/**
 * Record a campaign send result in campaign_logs.
 */
export async function logSend(
  db: D1Database,
  result: CampaignResult,
  tenantId?: string,
): Promise<void> {
  const id = `camp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const normTenant = normalizeDedupTenant(tenantId);
  const normResultTenant = normalizeDedupTenant(result.tenant_id);
  let effectiveTenant =
    (normTenant && normTenant !== '*' ? normTenant : undefined) ||
    (normResultTenant && normResultTenant !== '*' ? normResultTenant : undefined);
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
  if (!effectiveTenant && result.customer_id) {
    try {
      const custRow = await db
        .prepare('SELECT tenant_id FROM customers WHERE id = ? LIMIT 1')
        .bind(result.customer_id)
        .first<{ tenant_id?: string | null }>()
        .catch(() => null);
      const custTenant = normalizeDedupTenant(custRow?.tenant_id ?? undefined);
      if (custTenant && custTenant !== '*') {
        effectiveTenant = custTenant;
      }
    } catch {
      // Fallback to default
    }
  }
  effectiveTenant = effectiveTenant || 'default';
  if (effectiveTenant && effectiveTenant !== '*') {
    await db.prepare('UPDATE campaign_logs SET tenant_id = ? WHERE id = ?')
      .bind(effectiveTenant, id).run().catch(() => null);
  }
}
