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
  DB?: import('@cloudflare/workers-types').D1Database;
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
  tenant_id?: string | null;
}

export function matchesFrigateTenant(
  row: Record<string, unknown> | null | undefined,
  tenantId?: string
): boolean {
  if (!row) return false;
  if (!tenantId || tenantId === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null && String(row.tenant_id).trim() !== '') {
    return String(row.tenant_id).trim() === tenantId;
  }
  return tenantId === 'default';
}

/**
 * Poll Frigate for recent events and persist them into frigate_events.
 */
export async function syncFrigateEvents(
  env: FrigateSyncEnv,
  opts?: { camera?: string; limit?: number; tenantId?: string },
  ctx?: ExecutionContext
): Promise<{ ok: boolean; mock?: boolean; synced?: number; reason?: string }> {
  const client = createFrigateClient(env);

  if (!client) {
    return { ok: true, mock: false, synced: 0, reason: 'disabled' };
  }

  const limit = Math.min(opts?.limit ?? 50, 500);
  const camera = opts?.camera;
  const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database | undefined;

  const promise = (async() => {
    try {
      if (!db) {
        throw new Error('AURA_DB missing');
      }
      const { events } = await client.getRecentEvents(camera, limit);

      let persisted = 0;
      for (const evt of events) {
        const effectiveTenant = opts?.tenantId && opts.tenantId !== '*' ? opts.tenantId : 'default';
        try {
          await db
            .prepare(
              `INSERT OR IGNORE INTO frigate_events
               (id, camera, label, start_time, end_time, score, payload, received_at, tenant_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`
            )
            .bind(
              evt.id,
              evt.camera,
              evt.label,
              Number(evt.start_time),
              evt.end_time ?? null,
              evt.score ?? null,
              evt.data ? JSON.stringify(evt.data) : null,
              effectiveTenant
            )
            .run();
        } catch {
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
        }

        if (opts?.tenantId && opts.tenantId !== 'default' && opts.tenantId !== '*') {
          await db
            .prepare("UPDATE frigate_events SET tenant_id = ? WHERE id = ? AND (tenant_id IS NULL OR TRIM(tenant_id) = '')")
            .bind(opts.tenantId, evt.id)
            .run()
            .catch(() => {});
        }

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
  opts?: { camera?: string; since?: string; limit?: number; tenantId?: string }
): Promise<{ events: FrigateEventRow[] }> {
  const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database | undefined;

  if (!db) {
    return { events: [] };
  }

  const limit = Math.min(Math.max(1, opts?.limit ?? 100), 500);
  const camera = opts?.camera;
  const since = opts?.since;

  let sql = 'SELECT id, camera, label, start_time, end_time, score, payload, received_at FROM frigate_events WHERE 1=1';
  const binds: unknown[] = [];

  if (camera) {
    sql += ' AND camera = ?';
    binds.push(camera);
  }
  if (since !== undefined && since !== '') {
    const parsedSince = Number(since);
    if (Number.isFinite(parsedSince) && parsedSince >= 0) {
      sql += ' AND start_time >= ?';
      binds.push(parsedSince);
    }
  }

  sql += ' ORDER BY start_time DESC LIMIT ?';
  binds.push(limit);

  let rows: { results?: FrigateEventRow[] };
  try {
    const tenantSql = sql.replace(
      'SELECT id, camera, label, start_time, end_time, score, payload, received_at FROM frigate_events',
      'SELECT id, camera, label, start_time, end_time, score, payload, received_at, tenant_id FROM frigate_events'
    );
    rows = await db.prepare(tenantSql).bind(...binds).all<FrigateEventRow>();
  } catch {
    rows = await db.prepare(sql).bind(...binds).all<FrigateEventRow>();
  }
  const rawEvents = rows.results ?? [];
  const filtered = rawEvents.filter((r) =>
    matchesFrigateTenant(r as unknown as Record<string, unknown>, opts?.tenantId)
  );
  return { events: filtered };
}
