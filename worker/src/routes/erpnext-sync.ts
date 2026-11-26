/**
 * ERPNext Inventory Sync — /api/erpnext/sync/inventory
 * Pushes local inventory_transactions to ERPNext Bin doctype.
 * Fire-and-forget: failures are counted, never raised to the caller.
 *
 * Mock mode: when ERPNEXT_BASE_URL / keys are missing or ERPNEXT_SYNC_ENABLED=false,
 * createErpnextClient returns null → endpoint returns a stub response.
 */

import { createErpnextClient, createErpnextClientWithKv, type ErpnextClient } from '../clients/erpnext-client';
import { ErpnextProductClient } from '../clients/erpnext-product-client';
import { processErpnextRetryQueue } from './cron-handlers/erpnext-sync';
import { processErpnextWebhookLog } from './erpnext-pos';
import { syncOrderToERPNext } from '../tree/erpnext/sync.js';
import { requireAuth } from '../middleware/auth';
import { createLogger } from '../middleware/logger';
import { getTenantId, matchesTenantRow } from '../lib/db';
import { isHQSuperAdmin } from '../middleware/tenant';
import type { Env } from '../types/env';

const log = createLogger({ route: 'erpnext-sync' });

function sanitizeSyncError(raw: unknown): string {
  const str = String(raw ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/\b(?:token|bearer|basic)\s+[A-Za-z0-9._:/-]+/gi, '[redacted]')
    .replace(/\b(?:api_?key|api_?secret|secret|password|token)\s*[:=]\s*\S+/gi, '[redacted]')
    .replace(/\bat\s+\S+(?:\s*\([^)]*\))?/g, '')
    .replace(/\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^;]*/gi, '[sql]')
    .replace(/\/[\w./-]+\.(?:ts|js|mjs|cjs|sql):\d+(?::\d+)?/g, '[path]')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (!str) {
    return 'ERPNext sync error';
  }
  return str.length > 160 ? `${str.slice(0, 157)}...` : str;
}

export const FORBIDDEN_TENANT_SENTINEL = '__forbidden_tenant_override__';

export function resolveErpnextTenant(c: import('hono').Context<{ Bindings: Env }>): string {
  const headerCandidates = [
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  const queryCandidates = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  const allCandidates = [...headerCandidates, ...queryCandidates];
  if (new Set(allCandidates).size > 1) {
    return FORBIDDEN_TENANT_SENTINEL;
  }
  const user = (typeof c.get === 'function' ? c.get('user' as never) : undefined) as
    | { id?: string; role?: string; tenantId?: string; tenant_id?: string }
    | undefined;
  const reqOverride = allCandidates[0] || '';
  const ctxTenant = (typeof c.get === 'function' ? (c.get('tenantId' as never) as string | undefined) : undefined)?.trim() || '';
  if (user) {
    if (isHQSuperAdmin(user)) {
      const target = reqOverride || ctxTenant || getTenantId(c).trim() || '*';
      return target.toLowerCase() === 'hq' ? '*' : target;
    }
    const rawUserTenant = (user.tenantId ?? user.tenant_id ?? '').trim();
    if (rawUserTenant === '*' || rawUserTenant.toLowerCase() === 'hq') {
      return FORBIDDEN_TENANT_SENTINEL;
    }
    const userTenant = rawUserTenant || 'default';
    const resolvedTenant = getTenantId(c).trim() || 'default';
    if (
      (reqOverride && (reqOverride === '*' || reqOverride.toLowerCase() === 'hq' || reqOverride !== userTenant)) ||
      (ctxTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== userTenant)) ||
      resolvedTenant !== userTenant
    ) {
      return FORBIDDEN_TENANT_SENTINEL;
    }
    return userTenant;
  }
  const resolved = getTenantId(c).trim() || reqOverride || 'default';
  return resolved.toLowerCase() === 'hq' ? '*' : resolved;
}

interface InventoryTxnRow {
  item_id: string;
  sku: string | null;
  name: string | null;
  quantity: number;
  current_stock?: number | null;
  reference_type: string | null;
  created_at: string;
  tenant_id?: string | null;
}

async function writeSyncLog(
  db: import('@cloudflare/workers-types').D1Database | undefined,
  method: string,
  endpoint: string,
  requestBody: string,
  responseBody: string | null,
  error: string | null,
  tenantId?: string
): Promise<void> {
  if (!db) return;
  const id = crypto.randomUUID();
  const status = error ? 'failed' : 'synced';
  const effectiveTenant =
    tenantId && tenantId.trim() && tenantId.trim() !== '*' && tenantId.trim().toLowerCase() !== 'hq'
      ? tenantId.trim()
      : 'default';
  try {
    await db
      .prepare(
        `INSERT INTO erpnext_sync_logs (id, method, endpoint, request_body, response_body, error, tenant_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, method, endpoint, requestBody, responseBody, error, effectiveTenant)
      .run();
    return;
  } catch {
    // Fall through to legacy schema variants
  }
  try {
    await db
      .prepare(
        `INSERT INTO erpnext_sync_logs (id, method, endpoint, request_body, response_body, error)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, method, endpoint, requestBody, responseBody, error)
      .run();
  } catch {
    try {
      await db
        .prepare(
          `INSERT INTO erpnext_sync_logs (status, method, endpoint, request_body, response_body, error, error_message)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(status, method, endpoint, requestBody, responseBody, error, error)
        .run();
    } catch {
      try {
        await db
          .prepare(
            `INSERT INTO erpnext_sync_log (id, method, endpoint, request_body, response_body, error)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(id, method, endpoint, requestBody, responseBody, error)
          .run();
      } catch {
        // Non-blocking log write
      }
    }
  }
}

function matchesSyncLogTenant(row: Record<string, unknown> | null | undefined, tenantId: string): boolean {
  if (!row) return false;
  if (!tenantId || tenantId === '*') return true;
  if ('tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null && String(row.tenant_id).trim() !== '') {
    return String(row.tenant_id).trim() === tenantId;
  }
  if (typeof row.request_body === 'string' && row.request_body.startsWith('{')) {
    try {
      const parsed = JSON.parse(row.request_body) as { tenant_id?: string };
      if (parsed.tenant_id && String(parsed.tenant_id).trim()) {
        return String(parsed.tenant_id).trim() === tenantId;
      }
    } catch {
      // ignore malformed JSON
    }
  }
  return tenantId === 'default';
}

const allow = requireAuth(['owner', 'manager', 'supervisor', 'admin']);
const adminStatusAllow = requireAuth(['owner', 'manager', 'supervisor', 'admin']);
const adminTriggerAllow = requireAuth(['owner', 'manager', 'supervisor', 'admin']);

export function erpnextSyncRoutes(app: import('hono').Hono<{ Bindings: Env }>): void {
  const handleInventorySync = async(c: import('hono').Context<{ Bindings: Env }>) => {
    try {
      const tenantId = resolveErpnextTenant(c);
      if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
        return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
      }
      const db = c.env.AURA_DB;
      if (!db) {
        return c.json({ success: false, error: 'AURA_DB missing', mock: false }, 503);
      }

      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      let transactions: InventoryTxnRow[] = [];
      try {
        let res: { results?: InventoryTxnRow[] };
        if (tenantId !== '*') {
          try {
            res = await db
              .prepare(
                `SELECT it.item_id, ii.sku, ii.name, it.quantity, ii.current_stock, it.reference_type, it.created_at,
                        COALESCE(NULLIF(TRIM(it.tenant_id), ''), ii.tenant_id) AS tenant_id
                 FROM inventory_transactions it
                 JOIN inventory_items ii ON it.item_id = ii.id
                 WHERE it.created_at >= ?
                 AND it.reference_type != 'sync'
                 AND COALESCE(NULLIF(TRIM(it.tenant_id), ''), COALESCE(NULLIF(TRIM(ii.tenant_id), ''), 'default')) = ?
                 AND COALESCE(NULLIF(TRIM(it.tenant_id), ''), 'default') = ?
                 AND COALESCE(NULLIF(TRIM(ii.tenant_id), ''), 'default') = ?
                 ORDER BY it.created_at DESC
                 LIMIT 500`
              )
              .bind(cutoff, tenantId, tenantId, tenantId)
              .all<InventoryTxnRow>();
          } catch {
            try {
              res = await db
                .prepare(
                  `SELECT it.item_id, ii.sku, ii.name, it.quantity, ii.current_stock, it.reference_type, it.created_at, ii.tenant_id
                   FROM inventory_transactions it
                   JOIN inventory_items ii ON it.item_id = ii.id
                   WHERE it.created_at >= ?
                   AND it.reference_type != 'sync'
                   AND COALESCE(NULLIF(TRIM(ii.tenant_id), ''), 'default') = ?
                   ORDER BY it.created_at DESC
                   LIMIT 500`
                )
                .bind(cutoff, tenantId)
                .all<InventoryTxnRow>();
            } catch {
              if (tenantId === 'default') {
                res = await db
                  .prepare(
                    `SELECT it.item_id, ii.sku, ii.name, it.quantity, ii.current_stock, it.reference_type, it.created_at, ii.tenant_id
                     FROM inventory_transactions it
                     JOIN inventory_items ii ON it.item_id = ii.id
                     WHERE it.created_at >= ?
                     AND it.reference_type != 'sync'
                     ORDER BY it.created_at DESC
                     LIMIT 500`
                  )
                  .bind(cutoff)
                  .all<InventoryTxnRow>();
              } else {
                res = { results: [] };
              }
            }
          }
        } else {
          try {
            res = await db
              .prepare(
                `SELECT it.item_id, ii.sku, ii.name, it.quantity, ii.current_stock, it.reference_type, it.created_at, ii.tenant_id
                 FROM inventory_transactions it
                 JOIN inventory_items ii ON it.item_id = ii.id
                 WHERE it.created_at >= ?
                 AND it.reference_type != 'sync'
                 ORDER BY it.created_at DESC
                 LIMIT 500`
              )
              .bind(cutoff)
              .all<InventoryTxnRow>();
          } catch {
            res = await db
              .prepare(
                `SELECT it.item_id, ii.sku, ii.name, it.quantity, it.reference_type, it.created_at, ii.tenant_id
                 FROM inventory_transactions it
                 JOIN inventory_items ii ON it.item_id = ii.id
                 WHERE it.created_at >= ?
                 AND it.reference_type != 'sync'
                 ORDER BY it.created_at DESC
                 LIMIT 500`
              )
              .bind(cutoff)
              .all<InventoryTxnRow>();
          }
        }
        transactions = (res.results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
      } catch {
        let res: { results?: InventoryTxnRow[] };
        try {
          res = await db
            .prepare(
              `SELECT it.item_id, ii.sku, ii.name, it.quantity, ii.current_stock, it.reference_type, it.created_at
               FROM inventory_transactions it
               JOIN inventory_items ii ON it.item_id = ii.id
               WHERE it.created_at >= ?
               AND it.reference_type != 'sync'
               ORDER BY it.created_at DESC
               LIMIT 500`
            )
            .bind(cutoff)
            .all<InventoryTxnRow>();
        } catch {
          res = await db
            .prepare(
              `SELECT it.item_id, ii.sku, ii.name, it.quantity, it.reference_type, it.created_at
               FROM inventory_transactions it
               JOIN inventory_items ii ON it.item_id = ii.id
               WHERE it.created_at >= ?
               AND it.reference_type != 'sync'
               ORDER BY it.created_at DESC
               LIMIT 500`
            )
            .bind(cutoff)
            .all<InventoryTxnRow>();
        }
        transactions = tenantId === 'default' || tenantId === '*' ? (res.results || []) : [];
      }

      const isNonDefaultTenant = Boolean(tenantId && tenantId !== 'default' && tenantId !== '*');
      const envForKv = isNonDefaultTenant
        ? { ...c.env, ERPNEXT_URL: undefined, ERPNEXT_API_KEY: undefined, ERPNEXT_API_SECRET: undefined }
        : c.env;
      const client =
        c.env.AUTH_KV && typeof createErpnextClientWithKv === 'function'
          ? (await createErpnextClientWithKv(envForKv, tenantId)) ??
            (isNonDefaultTenant ? null : createErpnextClient(c.env))
          : createErpnextClient(c.env);
      let synced = 0;
      let failed = 0;

      const seenItemIds = new Set<string>();
      const uniqueTransactions: InventoryTxnRow[] = [];
      for (const txn of transactions) {
        const dedupeKey = txn.item_id || txn.sku || '';
        if (!dedupeKey || seenItemIds.has(dedupeKey)) {
          continue;
        }
        seenItemIds.add(dedupeKey);
        uniqueTransactions.push(txn);
      }

      const effectiveTenant = tenantId && tenantId !== '*' ? tenantId : 'default';
      if (!client) {
        // no real ERPNext bindings → mock / idle mode — log shapes for replay
        const idleTenant =
          (uniqueTransactions[0]?.tenant_id && uniqueTransactions[0].tenant_id.trim() !== '*'
            ? uniqueTransactions[0].tenant_id.trim()
            : '') || effectiveTenant;
        await writeSyncLog(
          db,
          'GET',
          '/api/erpnext/sync/inventory',
          JSON.stringify({ count: uniqueTransactions.length, since: cutoff, tenant_id: idleTenant }),
          JSON.stringify({ mock: true, matched: uniqueTransactions.length }),
          null,
          idleTenant
        );

        return c.json({
          success: true,
          synced: 0,
          failed: 0,
          total: uniqueTransactions.length,
          mock: true,
          message: 'ERPNext not configured — shapes logged to erpnext_sync_log'
        });
      }

      for (const txn of uniqueTransactions) {
        const itemCode = txn.sku || txn.item_id;
        const txnTenant =
          (typeof txn.tenant_id === 'string' && txn.tenant_id.trim() && txn.tenant_id.trim() !== '*'
            ? txn.tenant_id.trim()
            : '') || effectiveTenant;
        const parsedStock =
          typeof txn.current_stock === 'number'
            ? txn.current_stock
            : txn.current_stock !== undefined && txn.current_stock !== null && String(txn.current_stock).trim() !== ''
              ? Number(txn.current_stock)
              : NaN;
        if (!Number.isFinite(parsedStock) || parsedStock < 0) {
          continue;
        }
        const actualQty = parsedStock;
        try {
          // target Bin/{item_code} with the item's current stock balance when available
          const result = await client.put('Bin', itemCode, {
            actual_qty: actualQty
          });

          if (result.error) {
            failed++;
            await writeSyncLog(
              db,
              'PUT',
              `Bin/${itemCode}`,
              JSON.stringify({ actual_qty: actualQty, txnId: txn.item_id, tenant_id: txnTenant }),
              JSON.stringify(result.data ?? {}),
              String((result.data as Record<string, string> | undefined)?.message || result.error || 'Unknown error'),
              txnTenant
            );
          } else {
            synced++;
          }
        } catch (e: unknown) {
          failed++;
          const msg = e instanceof Error ? e.message : String(e);
          await writeSyncLog(
            db,
            'PUT',
            `Bin/${itemCode}`,
            JSON.stringify({ actual_qty: actualQty, tenant_id: txnTenant }),
            null,
            msg,
            txnTenant
          );
        }
      }

      return c.json({ success: true, synced, failed, total: uniqueTransactions.length, mock: client.isMock });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error('erpnext_inventory_sync_failed', { error: msg });
      return c.json({ success: false, error: 'Inventory sync failed', mock: false }, 500);
    }
  };

  app.get('/api/erpnext/sync/inventory', allow, handleInventorySync);
  app.post('/api/erpnext/sync/inventory', allow, handleInventorySync);

  // GET /api/admin/erpnext-sync/status — Admin ERPNext sync status widget
  app.get('/api/admin/erpnext-sync/status', adminStatusAllow, async (c) => {
    try {
      const tenantId = resolveErpnextTenant(c);
      if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
        return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
      }
      const db = c.env.AURA_DB;
      let lastSync: string | null = null;
      let pendingItems = 0;
      let errorMessage: string | undefined;
      let logs: Array<Record<string, unknown>> = [];

      if (db) {
        try {
          let logRows: { results?: Array<Record<string, unknown>> } = { results: [] };
          if (tenantId !== '*') {
            try {
              logRows = await db
                .prepare(
                  `SELECT id, method, endpoint, request_body, response_body, error, created_at, tenant_id
                   FROM erpnext_sync_logs
                   WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
                   ORDER BY created_at DESC LIMIT 20`
                )
                .bind(tenantId, tenantId)
                .all<Record<string, unknown>>();
            } catch {
              logRows = { results: [] };
            }
          }
          if (!logRows?.results?.length) {
            const selectSql = tenantId !== '*'
              ? 'SELECT id, method, endpoint, request_body, response_body, error, created_at, tenant_id FROM erpnext_sync_logs ORDER BY created_at DESC LIMIT 50'
              : 'SELECT id, method, endpoint, request_body, response_body, error, created_at FROM erpnext_sync_logs ORDER BY created_at DESC LIMIT 20';
            try {
              logRows = await db.prepare(selectSql).all<Record<string, unknown>>();
            } catch {
              logRows = await db
                .prepare('SELECT id, method, endpoint, request_body, response_body, error, created_at FROM erpnext_sync_logs ORDER BY created_at DESC LIMIT 20')
                .all<Record<string, unknown>>();
            }
          }
          const filteredLogs = (logRows?.results || []).filter((r) => matchesSyncLogTenant(r, tenantId)).slice(0, 20);
          logs = filteredLogs.map((r) => {
            const endpoint = String(r.endpoint || '');
            const entitySegment = endpoint.split('/').filter(Boolean).pop() || 'sync';
            const entity = entitySegment === 'sync-all'
              ? 'All'
              : entitySegment.charAt(0).toUpperCase() + entitySegment.slice(1);
            const hasError = Boolean(r.error);
            const safeError = hasError ? sanitizeSyncError(r.error) : null;
            const createdAt = String(r.created_at || '');
            return {
              id: String(r.id ?? ''),
              entity,
              action: entitySegment === 'sync-all' ? 'sync-all' : 'sync',
              status: hasError ? 'error' : 'success',
              message: safeError ?? `${String(r.method || 'POST')} ${endpoint}`,
              timestamp: createdAt,
              method: r.method,
              endpoint: r.endpoint,
              error: safeError,
              created_at: createdAt,
            };
          });

          if (tenantId === '*') {
            const latestLog = await db
              .prepare('SELECT created_at, error FROM erpnext_sync_logs ORDER BY created_at DESC LIMIT 1')
              .first<{ created_at?: string; error?: string | null }>();
            if (latestLog?.created_at) lastSync = latestLog.created_at;
            if (latestLog?.error) errorMessage = sanitizeSyncError(latestLog.error);
          } else if (filteredLogs.length > 0) {
            lastSync = (filteredLogs[0].created_at as string) || null;
            if (filteredLogs[0].error) errorMessage = sanitizeSyncError(filteredLogs[0].error);
          }
        } catch {
          try {
            let logRows: { results?: Array<Record<string, unknown>> } = { results: [] };
            if (tenantId !== '*') {
              try {
                logRows = await db
                  .prepare(
                    `SELECT id, method, endpoint, request_body, response_body, error, created_at, tenant_id
                     FROM erpnext_sync_log
                     WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
                     ORDER BY created_at DESC LIMIT 20`
                  )
                  .bind(tenantId, tenantId)
                  .all<Record<string, unknown>>();
              } catch {
                logRows = { results: [] };
              }
            }
            if (!logRows?.results?.length) {
              logRows = await db
                .prepare('SELECT id, method, endpoint, request_body, response_body, error, created_at FROM erpnext_sync_log ORDER BY created_at DESC LIMIT 20')
                .all<Record<string, unknown>>();
            }
            const filteredLogs = (logRows?.results || []).filter((r) => matchesSyncLogTenant(r, tenantId));
            if (filteredLogs.length > 0) {
              lastSync = (filteredLogs[0].created_at as string) || null;
              if (filteredLogs[0].error) errorMessage = sanitizeSyncError(filteredLogs[0].error);
            }
            logs = filteredLogs.map((r) => {
              const endpoint = String(r.endpoint || '');
              const entitySegment = endpoint.split('/').filter(Boolean).pop() || 'sync';
              const entity = entitySegment === 'sync-all'
                ? 'All'
                : entitySegment.charAt(0).toUpperCase() + entitySegment.slice(1);
              const hasError = Boolean(r.error);
              const safeError = hasError ? sanitizeSyncError(r.error) : null;
              const createdAt = String(r.created_at || '');
              return {
                id: String(r.id ?? ''),
                entity,
                action: entitySegment === 'sync-all' ? 'sync-all' : 'sync',
                status: hasError ? 'error' : 'success',
                message: safeError ?? `${String(r.method || 'POST')} ${endpoint}`,
                timestamp: createdAt,
                method: r.method,
                endpoint: r.endpoint,
                error: safeError,
                created_at: createdAt,
              };
            });
          } catch {
            // Table may not exist in minimal test environment
          }
        }
        try {
          if (tenantId && tenantId !== '*') {
            try {
              const queueRow = await db
                .prepare("SELECT COUNT(*) AS cnt FROM erpnext_sync_queue WHERE status = 'pending' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
                .bind(tenantId)
                .first<{ cnt?: number }>();
              pendingItems = Number(queueRow?.cnt ?? 0);
            } catch {
              if (tenantId === 'default') {
                const queueRow = await db
                  .prepare("SELECT COUNT(*) AS cnt FROM erpnext_sync_queue WHERE status = 'pending'")
                  .first<{ cnt?: number }>();
                pendingItems = Number(queueRow?.cnt ?? 0);
              } else {
                pendingItems = 0;
              }
            }
          } else {
            const queueRow = await db
              .prepare("SELECT COUNT(*) AS cnt FROM erpnext_sync_queue WHERE status = 'pending'")
              .first<{ cnt?: number }>();
            pendingItems = Number(queueRow?.cnt ?? 0);
          }
        } catch {
          pendingItems = 0;
        }
      }

      const status: 'synced' | 'pending' | 'error' = errorMessage
        ? 'error'
        : pendingItems > 0
          ? 'pending'
          : 'synced';

      return c.json({
        lastSync,
        status,
        pendingItems,
        logs,
        ...(errorMessage ? { errorMessage } : {}),
      });
    } catch {
      return c.json({ lastSync: null, status: 'error', pendingItems: 0, logs: [], errorMessage: 'Failed to load sync status' }, 500);
    }
  });

  async function syncSingleEntityForTenant(
    entity: 'orders' | 'products' | 'customers' | 'inventory' | 'invoices',
    client: ErpnextClient,
    effectiveTenant: string,
    envForSync: Env,
    now: string,
  ): Promise<number> {
    const db = envForSync.AURA_DB;
    if (!db) {
      const probe = await client.list(
        entity === 'orders'
          ? 'Sales Order'
          : entity === 'products'
            ? 'Item'
            : entity === 'customers'
              ? 'Customer'
              : entity === 'inventory'
                ? 'Bin'
                : 'Sales Invoice',
        { fields: ['name'], limit: 1 }
      );
      return Array.isArray(probe?.data) ? probe.data.length : 0;
    }

    if (entity === 'products') {
      const prodClient = new ErpnextProductClient(client, {
        AURA_DB: db as unknown as import('../clients/erpnext-product-client').ProductEnv['AURA_DB'],
        AURA_KV: envForSync.AUTH_KV as unknown as import('../clients/erpnext-product-client').KVNamespace,
      });
      const since = new Date(Date.now() - 30 * 86400_000).toISOString();
      const changed = await prodClient.searchChangedProducts(since);
      if (changed.length === 0) return 0;
      const syncRes = await prodClient.syncProductsToLocal(
        {
          AURA_DB: db as unknown as import('../clients/erpnext-product-client').ProductEnv['AURA_DB'],
          AURA_KV: envForSync.AUTH_KV as unknown as import('../clients/erpnext-product-client').KVNamespace,
        },
        changed,
        effectiveTenant,
      );
      return syncRes.updated;
    }

    if (entity === 'customers') {
      let localCustomers: Array<{
        id: string;
        name: string;
        phone?: string | null;
        email?: string | null;
        erpnext_id?: string | null;
      }> = [];
      try {
        const res = await db
          .prepare(
            `SELECT id, name, phone, email, erpnext_id
             FROM customers
             WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?
               AND COALESCE(sync_status, 'pending') != 'synced'
             ORDER BY created_at ASC
             LIMIT 50`
          )
          .bind(effectiveTenant)
          .all<typeof localCustomers[number]>();
        localCustomers = res.results || [];
      } catch {
        localCustomers = [];
      }
      if (localCustomers.length === 0) {
        const remote = await client.list('Customer', { fields: ['name'], limit: 50 });
        return Array.isArray(remote?.data) ? remote.data.length : 0;
      }
      let syncedCount = 0;
      for (const cust of localCustomers) {
        const payload = {
          customer_name: cust.name || cust.id,
          mobile_no: cust.phone || '',
          email_id: cust.email || '',
        };
        const existingErpId = cust.erpnext_id?.trim() || '';
        const erpRes = existingErpId
          ? await client.update('Customer', existingErpId, payload)
          : await client.create('Customer', payload);
        const erpName = (erpRes?.data as Record<string, string> | undefined)?.name || existingErpId || cust.name;
        await db
          .prepare(
            "UPDATE customers SET erpnext_id = ?, sync_status = 'synced' WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(erpName, cust.id, effectiveTenant)
          .run()
          .catch(() => {});
        syncedCount++;
      }
      return syncedCount;
    }

    if (entity === 'orders') {
      const queueRes = await processErpnextRetryQueue(
        envForSync as unknown as Record<string, unknown>,
        effectiveTenant,
      );
      let unsyncedOrders: Array<Record<string, unknown>> = [];
      try {
        const ordRes = await db
          .prepare(
            `SELECT o.id, o.items, o.total, o.customer_name, o.customer_phone, o.payment_method, o.payment_status, o.status, o.tenant_id
             FROM orders o
             WHERE COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default') = ?
               AND LOWER(TRIM(COALESCE(o.payment_status, ''))) IN ('paid', 'completed', 'partially_refunded')
               AND LOWER(TRIM(COALESCE(o.status, ''))) NOT IN ('cancelled', 'canceled', 'failed', 'rejected', 'expired', 'refunded')
               AND NOT EXISTS (
                 SELECT 1 FROM erpnext_mappings m
                 WHERE m.local_type = 'order'
                   AND m.local_id = o.id
                   AND COALESCE(NULLIF(TRIM(m.tenant_id), ''), 'default') = ?
                   AND m.sync_status = 'synced'
               )
             ORDER BY o.created_at DESC
             LIMIT 25`
          )
          .bind(effectiveTenant, effectiveTenant)
          .all<Record<string, unknown>>();
        unsyncedOrders = ordRes.results || [];
      } catch {
        unsyncedOrders = [];
      }
      if (unsyncedOrders.length === 0 && queueRes.succeeded === 0) {
        await client.list('Sales Order', { fields: ['name'], limit: 1 });
        return 0;
      }
      let directSynced = 0;
      for (const ord of unsyncedOrders) {
        const ordId = String(ord.id || '');
        if (!ordId) continue;
        let syncOk = false;
        try {
          const syncRes = await syncOrderToERPNext(
            envForSync as unknown as { ERPNEXT_URL: string; ERPNEXT_API_KEY: string; ERPNEXT_API_SECRET: string },
            ordId,
            ord,
          );
          syncOk = !syncRes || !('ok' in syncRes) || syncRes.ok !== false;
        } catch {
          syncOk = false;
        }
        if (syncOk) {
          await db
            .prepare(
              `INSERT INTO erpnext_mappings (id, local_type, local_id, erpnext_id, erpnext_model, sync_status, last_synced_at, tenant_id)
               VALUES (?, 'order', ?, ?, 'Sales Order', 'synced', ?, ?)
               ON CONFLICT(id) DO UPDATE SET sync_status = 'synced', last_synced_at = excluded.last_synced_at`
            )
            .bind(`map_order_${effectiveTenant}_${ordId}`, ordId, ordId, now, effectiveTenant)
            .run()
            .catch(() => {});
          directSynced++;
        }
      }
      return queueRes.succeeded + directSynced;
    }

    if (entity === 'inventory') {
      const binRes = await client.list('Bin', {
        fields: ['name', 'item_code', 'actual_qty'],
        limit: 100,
      });
      const bins = Array.isArray(binRes?.data) ? (binRes.data as Array<Record<string, unknown>>) : [];
      let updatedBins = 0;
      for (const bin of bins) {
        const itemCode = typeof bin.item_code === 'string' ? bin.item_code.trim() : '';
        if (!itemCode) continue;
        const productKey = effectiveTenant !== 'default' ? `${effectiveTenant}::${itemCode}` : itemCode;
        const qty = typeof bin.actual_qty === 'number' ? Math.floor(bin.actual_qty) : Number(bin.actual_qty) || 0;
        await db
          .prepare(
            `INSERT INTO erpnext_product_sync
              (product_id, erpnext_product_id, erpnext_item_code, cached_stock, last_synced_at, erpnext_modified, tenant_id)
             VALUES (?, 0, ?, ?, ?, ?, ?)
             ON CONFLICT(product_id) DO UPDATE SET
              cached_stock = excluded.cached_stock,
              last_synced_at = excluded.last_synced_at
             WHERE COALESCE(NULLIF(TRIM(erpnext_product_sync.tenant_id), ''), 'default') = excluded.tenant_id`
          )
          .bind(productKey, itemCode, qty, now, now, effectiveTenant)
          .run()
          .catch(() => {});
        updatedBins++;
      }
      return updatedBins;
    }

    // entity === 'invoices'
    const invRes = await client.list('Sales Invoice', {
      fields: ['name', 'po_no', 'posting_date', 'grand_total'],
      limit: 100,
    });
    const invoices = Array.isArray(invRes?.data) ? (invRes.data as Array<Record<string, unknown>>) : [];
    let mappedInvoices = 0;
    for (const inv of invoices) {
      const invName = typeof inv.name === 'string' ? inv.name.trim() : '';
      if (!invName) continue;
      const localRef = typeof inv.po_no === 'string' && inv.po_no.trim() ? inv.po_no.trim() : invName;
      await db
        .prepare(
          `INSERT INTO erpnext_mappings (id, local_type, local_id, erpnext_id, erpnext_model, sync_status, last_synced_at, tenant_id)
           VALUES (?, 'invoice', ?, ?, 'Sales Invoice', 'synced', ?, ?)
           ON CONFLICT(id) DO UPDATE SET erpnext_id = excluded.erpnext_id, sync_status = 'synced', last_synced_at = excluded.last_synced_at`
        )
        .bind(`map_invoice_${effectiveTenant}_${localRef}`, localRef, invName, now, effectiveTenant)
        .run()
        .catch(() => {});
      mappedInvoices++;
    }
    return mappedInvoices;
  }

  // POST /api/admin/erpnext-sync/sync-all — Trigger full entity sync
  app.post('/api/admin/erpnext-sync/sync-all', adminTriggerAllow, async (c) => {
    const tenantId = resolveErpnextTenant(c);
    if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const now = new Date().toISOString();
    const effectiveTenant = tenantId === '*' ? 'default' : tenantId;
    const isNonDefaultTenant = effectiveTenant !== 'default';
    const envForKv = isNonDefaultTenant
      ? { ...c.env, ERPNEXT_URL: undefined, ERPNEXT_API_KEY: undefined, ERPNEXT_API_SECRET: undefined }
      : c.env;
    const client = await createErpnextClientWithKv(envForKv, effectiveTenant);
    if (!client) {
      return c.json(
        {
          success: false,
          status: 'not_configured',
          entity: 'all',
          error: 'ERPNext integration is not configured for this tenant',
        },
        501,
      );
    }
    const entities = ['orders', 'products', 'customers', 'inventory', 'invoices'] as const;
    let synced = 0;
    let recordsSynced = 0;
    let failed = 0;
    const errors: string[] = [];
    for (const ent of entities) {
      try {
        const entCount = await syncSingleEntityForTenant(ent, client, effectiveTenant, c.env, now);
        synced++;
        recordsSynced += entCount;
      } catch (err: unknown) {
        failed++;
        const rawErr = err instanceof Error ? err.message : String(err);
        log.error('[erpnext-sync] sync-all entity failed', { entity: ent, tenantId: effectiveTenant, error: rawErr });
        errors.push(`${ent}: ${rawErr}`);
      }
    }
    let webhooksProcessed = 0;
    if (c.env.AURA_DB) {
      webhooksProcessed = await processErpnextWebhookLog(
        c.env.AURA_DB as unknown as Parameters<typeof processErpnextWebhookLog>[0],
        c.env.AUTH_KV as unknown as Parameters<typeof processErpnextWebhookLog>[1],
        effectiveTenant,
      ).catch(() => 0);
    }
    const errorSummary = errors.length > 0 ? errors.join('; ') : null;
    await writeSyncLog(
      c.env.AURA_DB,
      'POST',
      '/api/admin/erpnext-sync/sync-all',
      JSON.stringify({ entities, tenant_id: effectiveTenant }),
      JSON.stringify({ synced, recordsSynced, webhooksProcessed, failed, timestamp: now }),
      errorSummary,
      effectiveTenant
    );
    return c.json(
      {
        success: failed === 0,
        entity: 'all',
        synced,
        recordsSynced,
        webhooksProcessed,
        failed,
        count: synced,
        syncedAt: now,
        ...(errorSummary ? { error: 'ERPNext sync failed for one or more entities' } : {}),
      },
      failed === entities.length ? 502 : 200,
    );
  });

  // POST /api/admin/erpnext-sync/:entity — Trigger single entity sync
  app.post('/api/admin/erpnext-sync/:entity', adminTriggerAllow, async (c) => {
    const tenantId = resolveErpnextTenant(c);
    if (tenantId === FORBIDDEN_TENANT_SENTINEL) {
      return c.json({ success: false, error: 'Cross-tenant access denied' }, 403);
    }
    const entity = String(c.req.param('entity') || '').toLowerCase();
    const validEntities = new Set(['orders', 'products', 'customers', 'inventory', 'invoices']);
    if (!validEntities.has(entity)) {
      return c.json({ success: false, error: `Unsupported sync entity: ${entity}` }, 400);
    }
    const now = new Date().toISOString();
    const effectiveTenant = tenantId === '*' ? 'default' : tenantId;
    const isNonDefaultTenant = effectiveTenant !== 'default';
    const envForKv = isNonDefaultTenant
      ? { ...c.env, ERPNEXT_URL: undefined, ERPNEXT_API_KEY: undefined, ERPNEXT_API_SECRET: undefined }
      : c.env;
    const client = await createErpnextClientWithKv(envForKv, effectiveTenant);
    if (!client) {
      return c.json(
        {
          success: false,
          status: 'not_configured',
          entity,
          error: 'ERPNext integration is not configured for this tenant',
        },
        501,
      );
    }
    try {
      const count = await syncSingleEntityForTenant(
        entity as 'orders' | 'products' | 'customers' | 'inventory' | 'invoices',
        client,
        effectiveTenant,
        c.env,
        now,
      );
      await writeSyncLog(
        c.env.AURA_DB,
        'POST',
        `/api/admin/erpnext-sync/${entity}`,
        JSON.stringify({ entity, tenant_id: effectiveTenant }),
        JSON.stringify({ synced: count, timestamp: now }),
        null,
        effectiveTenant
      );
      return c.json({
        success: true,
        entity,
        synced: count,
        failed: 0,
        count,
        syncedAt: now,
      });
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      log.error('[erpnext-sync] entity sync failed', { entity, tenantId: effectiveTenant, error: errMsg });
      await writeSyncLog(
        c.env.AURA_DB,
        'POST',
        `/api/admin/erpnext-sync/${entity}`,
        JSON.stringify({ entity, tenant_id: effectiveTenant }),
        null,
        errMsg,
        effectiveTenant
      );
      return c.json({ success: false, entity, synced: 0, failed: 1, error: 'ERPNext sync failed' }, 502);
    }
  });
}
