import { createLogger } from '../../middleware/logger';
import { resolvePilotStore } from '../../middleware/tenant';
import { syncOrderToERPNext } from '../../tree/erpnext/sync.js';
import { createErpnextProductClient } from '../../clients/erpnext-product-client';

const MAX_RETRIES = 3;
const log = createLogger({ route: 'cron:erpnext' });

function matchesQueueTenant(row: Record<string, unknown>, activeTenant: string): boolean {
  if (activeTenant === '*') return true;
  const directTenant = typeof row.tenant_id === 'string' && row.tenant_id.trim() ? row.tenant_id.trim() : undefined;
  const orderTenant = typeof row.order_tenant_id === 'string' && row.order_tenant_id.trim() ? row.order_tenant_id.trim() : undefined;
  let payloadTenant: string | undefined;
  if (row.payload) {
    try {
      const parsed = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      if (parsed && typeof parsed === 'object' && typeof (parsed as { tenant_id?: unknown }).tenant_id === 'string') {
        const pt = (parsed as { tenant_id: string }).tenant_id.trim();
        if (pt) payloadTenant = pt;
      }
    } catch {
      // ignore malformed payload JSON
    }
  }
  const hasTenantInfo = 'tenant_id' in row || 'order_tenant_id' in row || payloadTenant !== undefined;
  if (!hasTenantInfo) {
    return activeTenant === 'default';
  }
  const resolved = directTenant || orderTenant || payloadTenant || 'default';
  return resolved === activeTenant;
}

export async function processErpnextRetryQueue(
  env: Record<string, unknown>,
  tenantId?: string,
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const erpEnv = env as { ERPNEXT_URL: string; ERPNEXT_API_KEY: string; ERPNEXT_API_SECRET: string };
  const { ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET } = erpEnv;

  if (!ERPNEXT_URL || !ERPNEXT_API_KEY || !ERPNEXT_API_SECRET) {
    log.info('ERPNext not configured, skipping retry queue');
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database | undefined;
  if (!db) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let activeTenant = tenantId && tenantId.trim() ? tenantId.trim() : '';
  if (!activeTenant) {
    try {
      activeTenant = resolvePilotStore(env as unknown as Parameters<typeof resolvePilotStore>[0]);
    } catch {
      activeTenant = 'default';
    }
  }

  let pending: Array<Record<string, unknown>> = [];
  try {
    if (activeTenant !== '*') {
      try {
        const res = await db
          .prepare(
            `SELECT q.id, q.entity_type, q.entity_id, q.action, q.payload, q.attempts, q.next_retry_at,
                    q.tenant_id, o.tenant_id AS order_tenant_id
             FROM erpnext_sync_queue q
             LEFT JOIN orders o ON q.entity_type = 'order' AND o.id = q.entity_id
             WHERE q.status = 'pending'
               AND (q.next_retry_at IS NULL OR q.next_retry_at <= datetime('now'))
               AND COALESCE(NULLIF(TRIM(q.tenant_id), ''), COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')) = ?
             ORDER BY q.created_at ASC
             LIMIT 50`
          )
          .bind(activeTenant)
          .all<Record<string, unknown>>();
        pending = (res.results || []).filter((r) => matchesQueueTenant(r, activeTenant));
      } catch {
        const res = await db
          .prepare(
            `SELECT id, entity_type, entity_id, action, payload, attempts, next_retry_at
             FROM erpnext_sync_queue
             WHERE status = 'pending'
               AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
             ORDER BY created_at ASC
             LIMIT 50`
          )
          .all<Record<string, unknown>>();
        pending = (res.results || []).filter((r) => matchesQueueTenant(r, activeTenant));
      }
    } else {
      const res = await db
        .prepare(
          `SELECT id, entity_type, entity_id, action, payload, attempts, next_retry_at
           FROM erpnext_sync_queue
           WHERE status = 'pending'
             AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
           ORDER BY created_at ASC
           LIMIT 50`
        )
        .all<Record<string, unknown>>();
      pending = res.results || [];
    }
  } catch (err) {
    log.error('erpnext_sync_queue_query_error', { error: (err as Error)?.message });
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  if (!pending.length) {
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  let succeeded = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const row of pending as Array<Record<string, unknown>>) {
    const attempts = Number(row.attempts ?? 0) + 1;

    try {
      if (row.entity_type === 'order') {
        const payload =
          typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
        await syncOrderToERPNext(erpEnv, String(row.entity_id), payload);
      }

      await db
        .prepare(
          `UPDATE erpnext_sync_queue
           SET status = 'completed', updated_at = ?
           WHERE id = ?`
        )
        .bind(now, row.id)
        .run();
      succeeded++;
    } catch (err) {
      const attemptsLeft = MAX_RETRIES - attempts;
      const nextRetry = attemptsLeft > 0
        ? new Date(Date.now() + Math.min(5 * 60, 2 ** attempts * 30) * 1000).toISOString()
        : null;

      await db
        .prepare(
          `UPDATE erpnext_sync_queue
           SET status = ?, error_message = ?, attempts = ?, next_retry_at = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(
          nextRetry ? 'pending' : 'failed',
          (err as Error)?.message ?? String(err),
          attempts,
          nextRetry,
          now,
          row.id
        )
        .run();

      if (!nextRetry) {
        failed++;
        log.error('erpnext_sync_queue_failed', {
          id: row.id,
          entity: `${row.entity_type}:${row.entity_id}`,
          attempts,
          error: (err as Error)?.message
        });
      }
    }
  }

  return { processed: pending.length, succeeded, failed };
}

export async function processErpnextProductSync(
  env: Record<string, unknown>
): Promise<{ synced: number; errors: number }> {
  const client = createErpnextProductClient(env);

  if (!client) {
    log.info('ERPNext not configured, skipping product sync');
    return { synced: 0, errors: 0 };
  }

  try {
    const result: { synced: number; errors: number } = { synced: 0, errors: 0 };
    return result;
  } catch (err) {
    log.error('erpnext_product_sync_error', {
      error: (err as Error)?.message
    });
    return { synced: 0, errors: 1 };
  }
}
