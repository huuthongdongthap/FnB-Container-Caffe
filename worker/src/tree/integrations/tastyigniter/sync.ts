/**
 * TastyIgniter — order bridge (tree/integrations layer)
 *
 * Provides high-level orchestration for: pulling menu cache, bridging orders
 * from local (F&B Worker) → TastyIgniter, and handling webhook callbacks.
 *
 * Follows the ERPNext sync pattern: fire-and-forget, env-gated.
 */

import { createLogger } from '../../middleware/logger';
import { createTastyIgniterClient } from '../../clients/tastyigniter-client';

const log = createLogger({ route: 'ti-sync' });

export interface TISyncEnv {
  TASTYIGNITER_URL?: string;
  TASTYIGNITER_API_KEY?: string;
  TASTYIGNITER_SYNC_ENABLED?: string;
  AURA_DB?: import('@cloudflare/workers-types').D1Database;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

interface MenuCacheRow {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  active: number;
  cached_at: string;
}

interface TIBridgeRow {
  id: string;
  local_order_id: string;
  ti_order_id: string | null;
  status: string;
  error: string | null;
  synced_at: string | null;
  created_at: string;
}

/**
 * Pull latest menu from TastyIgniter and cache locally (fire-and-forget).
 */
export async function syncTIToLocalMenu(
  env: TISyncEnv,
  ctx?: ExecutionContext,
): Promise<{ ok: boolean; mock?: boolean; synced: number; reason?: string }> {
  const client = createTastyIgniterClient(env);
  if (!client) {
    return { ok: true, synced: 0, reason: 'disabled' };
  }

  const promise = (async () => {
    try {
      const { menu } = await client.getMenu();
      const db = env.AURA_DB;
      if (!db) return { ok: false, reason: 'no-db' };

      let synced = 0;
      const items = Array.isArray(menu) ? menu : [];
      for (const item of items) {
        const anyItem = item as Record<string, unknown>;
        const id = String(anyItem.id ?? anyItem.menu_id ?? crypto.randomUUID());
        const sku = anyItem.sku as string | undefined;
        const price = parseFloat(String(anyItem.price ?? 0));
        const name = anyItem.name as string | undefined;
        const active = anyItem.is_active !== false ? 1 : 0;

        await db
          .prepare(
            `INSERT OR REPLACE INTO ti_menu_cache
             (id, name, sku, price, active, cached_at)
             VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          )
          .bind(id, name ?? '', sku ?? null, price, active)
          .run();

        synced++;
      }

      log.info('ti_menu_synced', { synced });
      return { ok: true, synced };
    } catch (err) {
      log.error('ti_menu_sync_error', { error: (err as Error).message });
      return { ok: false, reason: (err as Error).message };
    }
  })();

  // fire-and-forget from cron
  if (ctx) ctx.waitUntil(promise);
  return promise;
}

/**
 * Bridge a local order to TastyIgniter.
 */
export async function bridgeOrderToTI(
  env: TISyncEnv,
  localOrderId: string,
  orderData: {
    customer_name?: string;
    customer_phone?: string;
    table_id?: string | null;
    items: Array<Record<string, unknown>>;
    total: number;
    payment_method?: string;
    notes?: string;
  },
  ctx?: ExecutionContext,
): Promise<{ ok: string; reason?: string; mocked?: boolean }> {
  const { AURA_DB, TASTYIGNITER_SYNC_ENABLED, TASTYIGNITER_URL, TASTYIGNITER_API_KEY } = env as Record<string, unknown>;
  const enabled = (TASTYIGNITER_SYNC_ENABLED as string | undefined) === 'true';
  const db = AURA_DB as import('@cloudflare/workers-types').D1Database | undefined;

  if (!enabled || !TASTYIGNITER_URL || !TASTYIGNITER_API_KEY) {
    if (db) {
      await db
        .prepare(
          `INSERT INTO ti_order_bridge
           (id, local_order_id, ti_order_id, status, error, created_at)
           VALUES (?, ?, NULL, ?, ?, datetime('now'))`,
        )
        .bind(crypto.randomUUID(), localOrderId, 'skipped', 'disabled-or-no-credentials')
        .run();
    }
    return { ok: 'skipped', reason: 'disabled-or-no-credentials' };
  }

  const promise = (async () => {
    const client = createTastyIgniterClient(env as TISyncEnv);

    try {
      const payload: Record<string, unknown> = {
        customer: { name: orderData.customer_name, phone: orderData.customer_phone },
        table_id: orderData.table_id ?? null,
        items: orderData.items,
        total: orderData.total,
        payment_method: orderData.payment_method,
        notes: orderData.notes,
      };

      const { order, mock } = client ? await client.createOrder(payload) : { order: null, mock: true };

      const tiOrderId = order && typeof order === 'object' && 'id' in order
        ? String((order as Record<string, unknown>).id)
        : null;

      if (db) {
        if (tiOrderId) {
          await db
            .prepare(
              `UPDATE ti_order_bridge
               SET ti_order_id = ?, status = 'synced', error = NULL, synced_at = datetime('now')
               WHERE local_order_id = ? AND status != 'synced'`,
            )
            .bind(tiOrderId, localOrderId)
            .run();
        } else {
          await db
            .prepare(
              `INSERT INTO ti_order_bridge
               (id, local_order_id, ti_order_id, status, error, created_at)
               VALUES (?, ?, NULL, ?, ?, datetime('now'))`,
            )
            .bind(crypto.randomUUID(), localOrderId, 'failed', 'no-order-id')
            .run();
        }
      }

      log.info('ti_order_bridged', { localOrderId, tiOrderId, mocked: !!mock });
      return { ok: tiOrderId ? 'synced' : 'failed', reason: tiOrderId ? undefined : 'no-order-id', mocked: !!mock };
    } catch (err) {
      log.error('ti_bridge_order_error', { localOrderId, error: (err as Error).message });
      if (db) {
        await db
          .prepare(
            `INSERT INTO ti_order_bridge
             (id, local_order_id, ti_order_id, status, error, created_at)
             VALUES (?, ?, NULL, ?, ?, datetime('now'))`,
          )
          .bind(crypto.randomUUID(), localOrderId, 'error', (err as Error).message)
          .run();
      }
      return { ok: 'error', reason: (err as Error).message };
    }
  })();

  if (ctx) ctx.waitUntil(promise);
  return promise;
}

/**
 * Fetch local menu cache, falling back to live TI pull if too stale (> 6h).
 */
export async function getTiMenuCache(env: TISyncEnv): Promise<{ items: MenuCacheRow[] }> {
  const db = env.AURA_DB as import('@cloudflare/workers-types').D1Database | undefined;

  if (db) {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    const row = await db
      .prepare('SELECT COUNT(*) as cnt FROM ti_menu_cache WHERE cached_at > ?')
      .bind(sixHoursAgo)
      .first<{ cnt: number }>();

    if (row && row.cnt > 0) {
      const rows = await db
        .prepare('SELECT id, name, sku, price, active, cached_at FROM ti_menu_cache WHERE active = 1')
        .all<MenuCacheRow>();
      return { items: (rows as { results: MenuCacheRow[] }).results ?? [] };
    }
  }

  // cache stale or missing — pull live (best-effort, non-blocking)
  const result = await syncTIToLocalMenu(env);
  if (db && result.synced && result.synced > 0) {
    const rows = await db
      .prepare('SELECT id, name, sku, price, active, cached_at FROM ti_menu_cache WHERE active = 1')
      .all<MenuCacheRow>();
    return { items: (rows as { results: MenuCacheRow[] }).results ?? [] };
  }

  return { items: [] };
}
