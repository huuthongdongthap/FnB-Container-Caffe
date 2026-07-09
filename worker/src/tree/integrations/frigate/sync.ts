/**
 * Frigate — NVR event sync (tree/integrations layer)
 *
 * Pulls camera/motion events from Frigate and surfaces them through the
 * api/integrations/frigate gateway. When enabled, a background poller runs
 * via the cron path and the /events endpoint exposes human-readable data.
 *
 * Follows ERPNext sync pattern: env-gated, mock-friendly.
 */

import { createLogger } from '../../../middleware/logger';
import { createFrigateClient } from '../../../clients/frigate-client';

const log = createLogger({ route: 'frigate-sync' });

export interface FrigateSyncEnv {
  FRIGATE_URL?: string;
  FRIGATE_API_KEY?: string;
  FRIGATE_SYNC_ENABLED?: string;
  AURA_DB?: import('@cloudflare/workers-types').D1Database;
}

interface FrigateEventRow {
  id: string;
  camera: string;
  label: string;
  start_time: number;
  end_time: number | null;
  score: number | null;
  payload: string | null;
  received_at: string;
}

/**
 * Poll Frigate for recent events and persist them into frigate_events.
 */
export async function syncFrigateEvents(
  env: FrigateSyncEnv,
  opts?: { camera?: string; limit?: number },
  ctx?: ExecutionContext
): Promise<{ ok: boolean; mock?: boolean; synced?: number; reason?: string }> {
  const client = createFrigateClient(env);

  if (!client) {
    return { ok: true, mock: false, synced: 0, reason: 'disabled' };
  }

  const limit = Math.min(opts?.limit ?? 50, 500);
  const camera = opts?.camera;
  const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database | undefined;

  const promise = (async() => {
    try {
      if (!db) {
        throw new Error('AURA_DB missing');
      }
      const { events } = await client.getRecentEvents(camera, limit);

      let persisted = 0;
      for (const evt of events) {
        await db
          .prepare(
            `INSERT OR IGNORE INTO frigate_events
             (id, camera, label, start_time, end_time, score, payload, received_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
          )
          .bind(
            evt.id,
            evt.camera,
            evt.label,
            Number(evt.start_time),
            evt.end_time ?? null,
            evt.score ?? null,
            evt.data ? JSON.stringify(evt.data) : null
          )
          .run();

        persisted++;
      }

      log.info('frigate_events_synced', { persisted, camera });
      return { ok: true, mock: false, synced: persisted };
    } catch (err) {
      log.error('frigate_sync_error', { error: (err as Error).message });
      return { ok: false, mock: false, reason: (err as Error).message };
    }
  })();

  if (ctx) {
    ctx.waitUntil(promise);
  }
  return promise;
}

/**
 * Retrieve stored events, optionally filtered by camera, with limit.
 */
export async function getFrigateEvents(
  env: FrigateSyncEnv,
  opts?: { camera?: string; since?: string; limit?: number }
): Promise<{ events: FrigateEventRow[] }> {
  const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database | undefined;

  if (!db) {
    return { events: [] };
  }

  const limit = Math.min(opts?.limit ?? 100, 500);
  const camera = opts?.camera;
  const since = opts?.since;

  let sql = 'SELECT id, camera, label, start_time, end_time, score, payload, received_at FROM frigate_events WHERE 1=1';
  const binds: unknown[] = [];

  if (camera) {
    sql += ' AND camera = ?';
    binds.push(camera);
  }
  if (since) {
    sql += ' AND start_time >= ?';
    binds.push(Number(since));
  }

  sql += ' ORDER BY start_time DESC LIMIT ?';
  binds.push(limit);

  const rows = await db.prepare(sql).bind(...binds).all<FrigateEventRow>();
  return { events: (rows as { results: FrigateEventRow[] }).results ?? [] };
}
