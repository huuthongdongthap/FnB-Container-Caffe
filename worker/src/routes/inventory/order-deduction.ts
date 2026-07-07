import { createErpnextClient } from '../../clients/erpnext-client';
import { createLogger } from '../../middleware/logger';
import type { Env } from '../../types/env';

const log = createLogger({ route: 'inventory-deduction' });

/**
 * Deduct inventory for an order after it is created.
 * Called AFTER order + order_items are persisted.
 * Never blocks order creation — deduction failures are logged only.
 *
 * Also fires a best-effort ERPNext Bin stock push after each variant, logged
 * via waitUntil so the local DB and ERPNext stay loosely in sync without
 * blocking the caller.
 */
export async function deductInventoryForOrder(
  env: Env,
  orderId: string,
  orderItems: Array<{ product_id: string; quantity: number; name?: string }>
): Promise<void> {
  for (const item of orderItems) {
    let invItem: { id: string; sku: string; name: string; current_stock: number; unit: string } | null = null;
    try {
      // 1:1 product → inventory match by SKU or name
      invItem = await env.AURA_DB.prepare(
        `SELECT id, sku, name, current_stock, unit FROM inventory_items
         WHERE active = 1 AND (sku = ? OR LOWER(name) LIKE ?)
         LIMIT 1`
      ).bind(String(item.product_id), `%${(item.name || '').toLowerCase()}%`)
        .first<{ id: string; sku: string; name: string; current_stock: number; unit: string }>();

      if (!invItem) {
        log.warn('inventory_no_match', { orderId, productId: item.product_id });
        continue;
      }

      const have = invItem.current_stock || 0;
      const need = item.quantity;
      if (have < need) {
        log.warn('inventory_low_stock', {
          orderId,
          itemSku: invItem.sku,
          need,
          have,
          unit: invItem.unit,
        });
      }

      const newStock = Math.max(0, have - need);
      await env.AURA_DB.batch([
        env.AURA_DB.prepare(
          'UPDATE inventory_items SET current_stock = ?, updated_at = datetime("now") WHERE id = ?'
        ).bind(newStock, invItem.id),
        env.AURA_DB.prepare(
          'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          crypto.randomUUID(),
          invItem.id,
          'reserve',
          -need,
          orderId,
          'order',
          `Auto-deduct from order ${orderId}`
        ),
      ]);

      // ERPNext Bin push (fire-and-forget, do not block deduction).
      // Retries and backoff are handled inside createErpnextClient / ErpnextClient.
      const typedEnv = env as Env & { executionCtx?: ExecutionContext };
      if (typedEnv.ERPNEXT_SYNC_ENABLED === 'true') {
        try {
          const erpClient = createErpnextClient(typedEnv);
          if (erpClient) {
            const itemCode = invItem.sku || invItem.id;
            const erpPromise = erpClient.put('Bin', itemCode, { actual_qty: newStock }).catch(() => {});
            typedEnv.executionCtx?.waitUntil(erpPromise);
          }
        } catch {
          // stock sync is best-effort — do not fail the deduction
        }
      }
    } catch (err) {
      const sku = invItem?.sku ?? item.product_id;
      log.error('inventory_deduction_failed', { orderId, productId: sku, message: (err as Error).message });
    }
  }
}
