/**
 * TastyIgniter — order bridge (tree/integrations layer)
 *
 * Provides high-level orchestration for: pulling menu cache, bridging orders
 * from local (F&B Worker) → TastyIgniter, and handling webhook callbacks.
 *
 * Follows the ERPNext sync pattern: fire-and-forget, env-gated.
 */

import { createLogger } from '../../../middleware/logger';
import { createTastyIgniterClient } from '../../../clients/tastyigniter-client';
import { matchesTenantRow } from '../../../lib/db';

const log = createLogger({ route: 'ti-sync' });

export interface TISyncEnv {
  TASTYIGNITER_URL?: string;
  TASTYIGNITER_API_KEY?: string;
  TASTYIGNITER_SYNC_ENABLED?: string;
  AURA_DB?: import('@cloudflare/workers-types').D1Database;
  DB?: import('@cloudflare/workers-types').D1Database;
}

interface MenuCacheRow {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  active: number;
  cached_at: string;
}

interface _TIBridgeRow {
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
  tenantId?: string,
): Promise<{ ok: boolean; mock?: boolean; synced?: number; reason?: string }> {
  const client = createTastyIgniterClient(env);
  if (!client) {
    return { ok: true, mock: false, synced: 0, reason: 'disabled' };
  }
  const rawTenant = (tenantId ?? 'default').trim();
  const effectiveTenant = rawTenant && rawTenant !== '*' && rawTenant.toLowerCase() !== 'hq' ? rawTenant : 'default';

  const promise = (async() => {
    try {
      const { menu } = await client.getMenu();
      const db = env.AURA_DB ?? env.DB;
      if (!db) {
        return { ok: false, mock: false, reason: 'no-db' };
      }

      let synced = 0;
      const items = Array.isArray(menu) ? menu : [];
      for (const item of items) {
        const anyItem = item as Record<string, unknown>;
        const id = String(anyItem.id ?? anyItem.menu_id ?? crypto.randomUUID());
        const sku = anyItem.sku as string | undefined;
        const price = parseFloat(String(anyItem.price ?? 0));
        const name = anyItem.name as string | undefined;
        const active = anyItem.is_active !== false ? 1 : 0;

        try {
          await db
            .prepare(
              `INSERT OR REPLACE INTO ti_menu_cache
               (id, name, sku, price, active, cached_at, tenant_id)
               VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`
            )
            .bind(id, name ?? '', sku ?? null, price, active, effectiveTenant)
            .run();
        } catch (insertErr) {
          if (effectiveTenant !== 'default') {
            throw insertErr;
          }
          await db
            .prepare(
              `INSERT OR REPLACE INTO ti_menu_cache
               (id, name, sku, price, active, cached_at)
               VALUES (?, ?, ?, ?, ?, datetime('now'))`
            )
            .bind(id, name ?? '', sku ?? null, price, active)
            .run();
        }

        synced++;
      }

      log.info('ti_menu_synced', { synced });
      return { ok: true, mock: false, synced };
    } catch (err) {
      log.error('ti_menu_sync_error', { error: (err as Error).message });
      return { ok: false, mock: false, reason: (err as Error).message };
    }
  })();

  // fire-and-forget from cron
  if (ctx) {
    ctx.waitUntil(promise);
  }
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
    tenant_id?: string;
  },
  ctxOrTenantId?: ExecutionContext | string,
  tenantIdArg?: string
): Promise<{ ok: string; reason?: string; mocked?: boolean }> {
  const ctx = typeof ctxOrTenantId === 'object' && ctxOrTenantId !== null ? ctxOrTenantId : undefined;
  const rawTenant = (
    (typeof ctxOrTenantId === 'string' ? ctxOrTenantId : tenantIdArg) ??
    orderData.tenant_id ??
    'default'
  ).trim();
  const { AURA_DB, DB, TASTYIGNITER_SYNC_ENABLED, TASTYIGNITER_URL, TASTYIGNITER_API_KEY } = env as Record<string, unknown>;
  const enabled = (TASTYIGNITER_SYNC_ENABLED as string | undefined) === 'true';
  const db = (AURA_DB ?? DB) as import('@cloudflare/workers-types').D1Database | undefined;
  let scopedTenant =
    !rawTenant || rawTenant === '*' || rawTenant.toLowerCase() === 'hq'
      ? (orderData.tenant_id &&
        orderData.tenant_id.trim() &&
        orderData.tenant_id.trim() !== '*' &&
        orderData.tenant_id.trim().toLowerCase() !== 'hq'
          ? orderData.tenant_id.trim()
          : '')
      : rawTenant;
  if (!scopedTenant && db && localOrderId) {
    try {
      const orderRow = await db
        .prepare('SELECT tenant_id FROM orders WHERE id = ? LIMIT 1')
        .bind(localOrderId)
        .first<{ tenant_id?: string | null }>();
      const rowTenant = typeof orderRow?.tenant_id === 'string' ? orderRow.tenant_id.trim() : '';
      if (rowTenant && rowTenant !== '*' && rowTenant.toLowerCase() !== 'hq') {
        scopedTenant = rowTenant;
      }
    } catch {
      // ignore lookup error; fall back to default
    }
  }
  if (!scopedTenant) {
    scopedTenant = 'default';
  }

  if (!enabled || !TASTYIGNITER_URL || !TASTYIGNITER_API_KEY) {
    if (db) {
      try {
        await db
          .prepare(
            `INSERT INTO ti_order_bridge
             (id, local_order_id, ti_order_id, status, error, created_at, tenant_id)
             VALUES (?, ?, NULL, ?, ?, datetime('now'), ?)`
          )
          .bind(crypto.randomUUID(), localOrderId, 'skipped', 'disabled-or-no-credentials', scopedTenant)
          .run();
      } catch (err) {
        const msg = String((err as Error)?.message || '');
        if (scopedTenant === 'default' && (msg.includes('no such column') || msg.includes('has no column named'))) {
          await db
            .prepare(
              `INSERT INTO ti_order_bridge
               (id, local_order_id, ti_order_id, status, error, created_at)
               VALUES (?, ?, NULL, ?, ?, datetime('now'))`
            )
            .bind(crypto.randomUUID(), localOrderId, 'skipped', 'disabled-or-no-credentials')
            .run();
        } else {
          throw err;
        }
      }
    }
    return { ok: 'skipped', reason: 'disabled-or-no-credentials' };
  }

  const promise = (async() => {
    const client = createTastyIgniterClient(env as TISyncEnv);

    try {
      const payload: Record<string, unknown> = {
        customer: { name: orderData.customer_name, phone: orderData.customer_phone },
        table_id: orderData.table_id ?? null,
        items: orderData.items,
        total: orderData.total,
        payment_method: orderData.payment_method,
        notes: orderData.notes,
        tenant_id: scopedTenant,
      };

      const { order, mock } = client ? await client.createOrder(payload) : { order: null, mock: true };

      const tiOrderId = order && typeof order === 'object' && 'id' in order
        ? String((order as Record<string, unknown>).id)
        : null;

      if (db) {
        if (tiOrderId) {
          let updateRes = await db
            .prepare(
              `UPDATE ti_order_bridge
               SET ti_order_id = ?, status = 'synced', error = NULL, synced_at = datetime('now'), tenant_id = ?
               WHERE local_order_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
            )
            .bind(tiOrderId, scopedTenant, localOrderId, scopedTenant)
            .run()
            .catch(() => null);
          if (!updateRes && scopedTenant === 'default') {
            updateRes = await db
              .prepare(
                `UPDATE ti_order_bridge
                 SET ti_order_id = ?, status = 'synced', error = NULL, synced_at = datetime('now')
                 WHERE local_order_id = ?`
              )
              .bind(tiOrderId, localOrderId)
              .run()
              .catch(() => null);
          }
          if (((updateRes as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0) === 0) {
            try {
              await db
                .prepare(
                  `INSERT INTO ti_order_bridge
                   (id, local_order_id, ti_order_id, status, synced_at, created_at, tenant_id)
                   VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), ?)`
                )
                .bind(crypto.randomUUID(), localOrderId, tiOrderId, 'synced', scopedTenant)
                .run();
            } catch {
              try {
                await db
                  .prepare(
                    `INSERT INTO ti_order_bridge
                     (id, local_order_id, ti_order_id, status, error, created_at, tenant_id)
                     VALUES (?, ?, ?, ?, NULL, datetime('now'), ?)`
                  )
                  .bind(crypto.randomUUID(), localOrderId, tiOrderId, 'synced', scopedTenant)
                  .run();
              } catch {
                if (scopedTenant === 'default') {
                  try {
                    await db
                      .prepare(
                        `INSERT INTO ti_order_bridge
                         (id, local_order_id, ti_order_id, status, synced_at, created_at)
                         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
                      )
                      .bind(crypto.randomUUID(), localOrderId, tiOrderId, 'synced')
                      .run();
                  } catch {
                    // Non-blocking persistence fallback
                  }
                }
              }
            }
          }
        } else {
          try {
            await db
              .prepare(
                `INSERT INTO ti_order_bridge
                 (id, local_order_id, ti_order_id, status, error, created_at, tenant_id)
                 VALUES (?, ?, NULL, ?, ?, datetime('now'), ?)`
              )
              .bind(crypto.randomUUID(), localOrderId, 'failed', 'no-order-id', scopedTenant)
              .run();
          } catch (err) {
            const msg = String((err as Error)?.message || '');
            if (scopedTenant === 'default' && (msg.includes('no such column') || msg.includes('has no column named'))) {
              await db
                .prepare(
                  `INSERT INTO ti_order_bridge
                   (id, local_order_id, ti_order_id, status, error, created_at)
                   VALUES (?, ?, NULL, ?, ?, datetime('now'))`
                )
                .bind(crypto.randomUUID(), localOrderId, 'failed', 'no-order-id')
                .run();
            } else {
              throw err;
            }
          }
        }
      }

      log.info('ti_order_bridged', { localOrderId, tiOrderId, mocked: !!mock });
      return { ok: tiOrderId ? 'synced' : 'failed', reason: tiOrderId ? undefined : 'no-order-id', mocked: !!mock };
    } catch (err) {
      log.error('ti_bridge_order_error', { localOrderId, error: (err as Error).message });
      if (db) {
        try {
          await db
            .prepare(
              `INSERT INTO ti_order_bridge
               (id, local_order_id, ti_order_id, status, error, created_at, tenant_id)
               VALUES (?, ?, NULL, ?, ?, datetime('now'), ?)`
            )
            .bind(crypto.randomUUID(), localOrderId, 'error', (err as Error).message, scopedTenant)
            .run();
        } catch {
          if (scopedTenant === 'default') {
            await db
              .prepare(
                `INSERT INTO ti_order_bridge
                 (id, local_order_id, ti_order_id, status, error, created_at)
                 VALUES (?, ?, NULL, ?, ?, datetime('now'))`
              )
              .bind(crypto.randomUUID(), localOrderId, 'error', (err as Error).message)
              .run();
          }
        }
      }
      return { ok: 'error', reason: (err as Error).message };
    }
  })();

  if (ctx) {
    ctx.waitUntil(promise);
  }
  return promise;
}

/**
 * Fetch local menu cache, falling back to live TI pull if too stale (> 6h).
 */
export async function getTiMenuCache(env: TISyncEnv, tenantId?: string): Promise<{ items: MenuCacheRow[] }> {
  const db = (env.AURA_DB ?? env.DB) as import('@cloudflare/workers-types').D1Database | undefined;
  const rawTenant = (tenantId ?? 'default').trim();
  const isWildcard = rawTenant === '*' || rawTenant.toLowerCase() === 'hq';
  const effectiveTenant = isWildcard ? '*' : (rawTenant || 'default');

  if (db) {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
    let row: { cnt: number } | null = null;
    if (isWildcard) {
      try {
        row = await db
          .prepare('SELECT COUNT(*) as cnt FROM ti_menu_cache WHERE cached_at > ?')
          .bind(sixHoursAgo)
          .first<{ cnt: number }>();
      } catch {
        row = null;
      }
    } else {
      try {
        row = await db
          .prepare("SELECT COUNT(*) as cnt FROM ti_menu_cache WHERE cached_at > ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(sixHoursAgo, effectiveTenant)
          .first<{ cnt: number }>();
      } catch {
        if (effectiveTenant === 'default') {
          row = await db
            .prepare('SELECT COUNT(*) as cnt FROM ti_menu_cache WHERE cached_at > ?')
            .bind(sixHoursAgo)
            .first<{ cnt: number }>();
        }
      }
    }

    if (row && row.cnt > 0) {
      if (isWildcard) {
        try {
          const rows = await db
            .prepare('SELECT id, name, sku, price, active, cached_at, tenant_id FROM ti_menu_cache WHERE active = 1')
            .all<MenuCacheRow & { tenant_id?: string | null }>();
          return { items: (rows as { results: Array<MenuCacheRow & { tenant_id?: string | null }> }).results ?? [] };
        } catch {
          const rows = await db
            .prepare('SELECT id, name, sku, price, active, cached_at FROM ti_menu_cache WHERE active = 1')
            .all<MenuCacheRow>();
          return { items: (rows as { results: MenuCacheRow[] }).results ?? [] };
        }
      }
      try {
        const rows = await db
          .prepare("SELECT id, name, sku, price, active, cached_at, tenant_id FROM ti_menu_cache WHERE active = 1 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
          .bind(effectiveTenant)
          .all<MenuCacheRow & { tenant_id?: string | null }>();
        const raw = (rows as { results: Array<MenuCacheRow & { tenant_id?: string | null }> }).results ?? [];
        return {
          items: raw.filter(
            (r) => !('tenant_id' in r) || r.tenant_id === undefined || matchesTenantRow(r as unknown as Record<string, unknown>, effectiveTenant)
          ),
        };
      } catch {
        if (effectiveTenant !== 'default') {
          return { items: [] };
        }
      }
      const rows = await db
        .prepare('SELECT id, name, sku, price, active, cached_at FROM ti_menu_cache WHERE active = 1')
        .all<MenuCacheRow>();
      const raw = (rows as { results: Array<MenuCacheRow & { tenant_id?: string | null }> }).results ?? [];
      return {
        items: raw.filter(
          (r) => matchesTenantRow(r as unknown as Record<string, unknown>, effectiveTenant)
        ),
      };
    }
  }

  // cache stale or missing — pull live (best-effort, non-blocking)
  const syncTargetTenant = isWildcard ? 'default' : effectiveTenant;
  const result = await syncTIToLocalMenu(env, undefined, syncTargetTenant);
  if (db && result.synced && result.synced > 0) {
    if (isWildcard) {
      try {
        const rows = await db
          .prepare('SELECT id, name, sku, price, active, cached_at, tenant_id FROM ti_menu_cache WHERE active = 1')
          .all<MenuCacheRow & { tenant_id?: string | null }>();
        return { items: (rows as { results: Array<MenuCacheRow & { tenant_id?: string | null }> }).results ?? [] };
      } catch {
        const rows = await db
          .prepare('SELECT id, name, sku, price, active, cached_at FROM ti_menu_cache WHERE active = 1')
          .all<MenuCacheRow>();
        return { items: (rows as { results: MenuCacheRow[] }).results ?? [] };
      }
    }
    try {
      const rows = await db
        .prepare("SELECT id, name, sku, price, active, cached_at, tenant_id FROM ti_menu_cache WHERE active = 1 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
        .bind(effectiveTenant)
        .all<MenuCacheRow & { tenant_id?: string | null }>();
      const raw = (rows as { results: Array<MenuCacheRow & { tenant_id?: string | null }> }).results ?? [];
      return {
        items: raw.filter(
          (r) => !('tenant_id' in r) || r.tenant_id === undefined || matchesTenantRow(r as unknown as Record<string, unknown>, effectiveTenant)
        ),
      };
    } catch {
      if (effectiveTenant !== 'default') {
        return { items: [] };
      }
    }
    const rows = await db
      .prepare('SELECT id, name, sku, price, active, cached_at FROM ti_menu_cache WHERE active = 1')
      .all<MenuCacheRow>();
    const raw = (rows as { results: Array<MenuCacheRow & { tenant_id?: string | null }> }).results ?? [];
    return {
      items: raw.filter(
        (r) => matchesTenantRow(r as unknown as Record<string, unknown>, effectiveTenant)
      ),
    };
  }

  return { items: [] };
}
