/**
 * Campaign Engine — core evaluate, route, dedup logic
 */
import { createLogger } from '../../utils/logger';
import { matchesTenantRow } from '../../middleware/tenant';
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
  sinceDays: number,
  tenantId?: string
): Promise<boolean> {
  const cutoff = new Date(Date.now() - sinceDays * 86400000).toISOString();
  const scoped = Boolean(tenantId && tenantId !== '*');
  if (scoped && tenantId) {
    try {
      const row = await db.prepare(
        `SELECT id, sent_at, tenant_id FROM campaign_logs
         WHERE customer_id = ? AND trigger = ? AND sent_at > ?
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
         ORDER BY sent_at DESC LIMIT 1`
      ).bind(customerId, trigger, cutoff, tenantId).first<Record<string, unknown>>();
      if (!row) return false;
      return 'tenant_id' in row && row.tenant_id !== undefined ? matchesTenantRow(row, tenantId) : true;
    } catch {
      try {
        const row = await db.prepare(
          `SELECT id, created_at as sent_at, tenant_id FROM campaign_logs
           WHERE customer_id = ? AND trigger_type = ? AND created_at > ?
             AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
           ORDER BY created_at DESC LIMIT 1`
        ).bind(customerId, trigger, cutoff, tenantId).first<Record<string, unknown>>();
        if (!row) return false;
        return 'tenant_id' in row && row.tenant_id !== undefined ? matchesTenantRow(row, tenantId) : true;
      } catch {
        if (tenantId !== 'default') {
          return false;
        }
      }
    }
  }
  try {
    let row: Record<string, unknown> | null = null;
    try {
      row = await db.prepare(
        `SELECT id, sent_at, tenant_id FROM campaign_logs
         WHERE customer_id = ? AND trigger = ? AND sent_at > ?
         ORDER BY sent_at DESC LIMIT 1`
      ).bind(customerId, trigger, cutoff).first<Record<string, unknown>>();
    } catch (innerErr) {
      const innerMsg = String((innerErr as Error)?.message || '');
      if (innerMsg.includes('tenant_id')) {
        row = await db.prepare(
          `SELECT id, sent_at FROM campaign_logs
           WHERE customer_id = ? AND trigger = ? AND sent_at > ?
           ORDER BY sent_at DESC LIMIT 1`
        ).bind(customerId, trigger, cutoff).first<Record<string, unknown>>();
      } else {
        throw innerErr;
      }
    }
    return Boolean(row && (!scoped || !tenantId || matchesTenantRow(row, tenantId)));
  } catch (err) {
    const msg = String((err as Error)?.message || '');
    if (msg.includes('column')) {
      try {
        let row: Record<string, unknown> | null = null;
        try {
          row = await db.prepare(
            `SELECT id, created_at as sent_at, tenant_id FROM campaign_logs
             WHERE customer_id = ? AND trigger_type = ? AND created_at > ?
             ORDER BY created_at DESC LIMIT 1`
          ).bind(customerId, trigger, cutoff).first<Record<string, unknown>>();
        } catch {
          row = await db.prepare(
            `SELECT id, created_at as sent_at FROM campaign_logs
             WHERE customer_id = ? AND trigger_type = ? AND created_at > ?
             ORDER BY created_at DESC LIMIT 1`
          ).bind(customerId, trigger, cutoff).first<Record<string, unknown>>();
        }
        return Boolean(row && (!scoped || !tenantId || matchesTenantRow(row, tenantId)));
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
  result: CampaignResult,
  tenantId?: string
): Promise<void> {
  const id = generateId();
  const now = new Date().toISOString();
  const status = result.sent ? 'sent' : 'failed';
  const errorMsg = result.error || null;
  const effectiveTenant = tenantId || result.tenant_id || undefined;
  try {
    await db.prepare(
      `INSERT INTO campaign_logs (id, customer_id, trigger, channel, sent_at, status, error, trigger_type, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id,
      result.customer_id,
      result.trigger,
      result.channel,
      now,
      status,
      errorMsg,
      result.trigger,
      errorMsg,
      now
    ).run();
    if (effectiveTenant && effectiveTenant !== '*') {
      await db.prepare('UPDATE campaign_logs SET tenant_id = ? WHERE id = ?')
        .bind(effectiveTenant, id).run().catch(() => null);
    }
  } catch (err) {
    const msg = String((err as Error)?.message || '');
    if (msg.includes('column')) {
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
        if (effectiveTenant && effectiveTenant !== '*') {
          await db.prepare('UPDATE campaign_logs SET tenant_id = ? WHERE id = ?')
            .bind(effectiveTenant, id).run().catch(() => null);
        }
        return;
      } catch {
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
          if (effectiveTenant && effectiveTenant !== '*') {
            await db.prepare('UPDATE campaign_logs SET tenant_id = ? WHERE id = ?')
              .bind(effectiveTenant, id).run().catch(() => null);
          }
          return;
        } catch (fallbackErr) {
          log.error('logSend failed', { customerId: result.customer_id, error: (fallbackErr as Error).message });
          return;
        }
      }
    }
    log.error('logSend failed', { customerId: result.customer_id, error: (err as Error).message });
  }
}

export { generateId };
