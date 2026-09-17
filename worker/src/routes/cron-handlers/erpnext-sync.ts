import { createLogger } from '../../middleware/logger';
import { syncOrderToERPNext } from '../../tree/erpnext/sync.js';
import { createErpnextProductClient } from '../../clients/erpnext-product-client';

const MAX_RETRIES = 3;
const log = createLogger({ route: 'cron:erpnext' });

export async function processErpnextRetryQueue(
  env: Record<string, unknown>
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const erpEnv = env as { ERPNEXT_URL: string; ERPNEXT_API_KEY: string; ERPNEXT_API_SECRET: string };
  const { ERPNEXT_URL, ERPNEXT_API_KEY, ERPNEXT_API_SECRET } = erpEnv;

  if (!ERPNEXT_URL || !ERPNEXT_API_KEY || !ERPNEXT_API_SECRET) {
    log.info('ERPNext not configured, skipping retry queue');
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database;

  // Pull pending entries that are due (next_retry_at is null or past)
  const { results: pending } = await db
    .prepare(
      `SELECT id, entity_type, entity_id, action, payload, attempts, next_retry_at
       FROM erpnext_sync_queue
       WHERE status = 'pending'
         AND (next_retry_at IS NULL OR next_retry_at <= datetime('now'))
       ORDER BY created_at ASC
       LIMIT 50`
    )
    .all<Record<string, unknown>>();

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
