import type { Env } from '../../types/env';

/**
 * Deduct inventory for an order after it is created.
 * Called AFTER order + order_items are persisted.
 * Never blocks order creation — deduction failures are logged only.
 */
export async function deductInventoryForOrder(
  env: Env,
  orderId: string,
  orderItems: Array<{ product_id: string; quantity: number; name?: string }>
): Promise<void> {
  for (const item of orderItems) {
    try {
      // 1:1 product → inventory match by SKU or name
      const invItem = await env.AURA_DB.prepare(
        `SELECT id, sku, name, current_stock, unit FROM inventory_items
         WHERE active = 1 AND (sku = ? OR LOWER(name) LIKE ?)
         LIMIT 1`
      )
        .bind(String(item.product_id), `%${(item.name || '').toLowerCase()}%`)
        .first<{ id: string; sku: string; name: string; current_stock: number; unit: string }>();

      if (!invItem) {
        console.debug(`[inventory] No match for product ${item.product_id} — skip`);
        continue;
      }

      const have = invItem.current_stock || 0;
      const need = item.quantity;
      if (have < need) {
        console.warn(
          `[inventory] Low stock for ${invItem.sku}: need ${need}, have ${have} ${invItem.unit}`
        );
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
    } catch (e) {
      console.error(`[inventory] Deduction failed for order ${orderId}, item ${item.product_id}:`, e);
    }
  }
}
