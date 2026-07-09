/**
 * ERPNext Inventory Sync — /api/erpnext/sync/inventory
 * Pushes local inventory_transactions to ERPNext Bin doctype.
 * Fire-and-forget: failures are counted, never raised to the caller.
 *
 * Mock mode: when ERPNEXT_BASE_URL / keys are missing or ERPNEXT_SYNC_ENABLED=false,
 * createErpnextClient returns null → endpoint returns a stub response.
 */

import { createErpnextClient } from '../clients/erpnext-client';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types/env';

interface InventoryTxnRow {
  item_id: string;
  sku: string | null;
  name: string | null;
  quantity: number;
  reference_type: string | null;
  created_at: string;
}

const allow = requireAuth(['owner', 'staff']);

export function erpnextSyncRoutes(app: import('hono').Hono<{ Bindings: Env }>): void {
  app.get('/api/erpnext/sync/inventory', allow, async(c) => {
    try {
      const db = c.env.AURA_DB;
      if (!db) {
        return c.json({ success: false, error: 'AURA_DB missing', mock: false }, 503);
      }

      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { results: transactions = [] } = await db
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

      const client = createErpnextClient(c.env);
      let synced = 0;
      let failed = 0;

      if (!client) {
        // no real ERPNext bindings → mock / idle mode — log shapes for replay
        await db
          .prepare(
            `INSERT INTO erpnext_sync_log (id, method, endpoint, request_body, response_body, error)
             VALUES (?, ?, ?, ?, ?, ?)`
          )
          .bind(
            crypto.randomUUID(),
            'GET',
            '/api/erpnext/sync/inventory',
            JSON.stringify({ count: transactions.length, since: cutoff }),
            JSON.stringify({ mock: true, matched: transactions.length }),
            null
          )
          .run();

        return c.json({
          success: true,
          synced: 0,
          failed: 0,
          total: transactions.length,
          mock: true,
          message: 'ERPNext not configured — shapes logged to erpnext_sync_log'
        });
      }

      for (const txn of transactions) {
        try {
          // target Bin/{item_code} so ERPNext can apply the delta directly
          const itemCode = txn.sku || txn.item_id;
          const result = await client.put('Bin', itemCode, {
            actual_qty: txn.quantity
          });

          if (result.error) {
            failed++;
            await db
              .prepare(
                `INSERT INTO erpnext_sync_log (id, method, endpoint, request_body, response_body, error)
                 VALUES (?, ?, ?, ?, ?, ?)`
              )
              .bind(
                crypto.randomUUID(),
                'PUT',
                `Bin/${itemCode}`,
                JSON.stringify({ actual_qty: txn.quantity, txnId: txn.item_id }),
                JSON.stringify(result.data ?? {}),
                String((result.data as Record<string, string> | undefined)?.message || result.error || 'Unknown error')
              )
              .run();
          } else {
            synced++;
          }
        } catch (e: unknown) {
          failed++;
          const msg = e instanceof Error ? e.message : String(e);
          await db
            .prepare(
              `INSERT INTO erpnext_sync_log (id, method, endpoint, request_body, response_body, error)
               VALUES (?, ?, ?, ?, ?, ?)`
            )
            .bind(
              crypto.randomUUID(),
              'PUT',
              `Bin/${txn.sku || txn.item_id}`,
              JSON.stringify({ actual_qty: txn.quantity }),
              null,
              msg
            )
            .run();
        }
      }

      return c.json({ success: true, synced, failed, total: transactions.length, mock: client.isMock });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: msg, mock: false }, 500);
    }
  });
}
