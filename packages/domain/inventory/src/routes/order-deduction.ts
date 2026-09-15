interface D1Database {
  prepare: (sql: string) => {
    bind: (...args: any[]) => {
      all: <T = any>() => Promise<{ results: T[] }>;
      first: <T = any>() => Promise<T | null>;
      run: () => Promise<{ meta: { changes: number } }>;
    };
  };
  batch: (ops: any[]) => Promise<any[]>;
}

interface Env {
  AURA_DB: D1Database;
  executionCtx?: { waitUntil: (p: Promise<any>) => void };
}

/**
 * Reverse all `reserve` transactions for an order when it is cancelled.
 * Idempotent: no-op if no `reserve` txns exist for the order.
 */
export async function restoreInventoryForOrder(env: Env, orderId: string): Promise<void> {
  const reservations = await env.AURA_DB.prepare(
    `SELECT id, item_id, quantity FROM inventory_transactions
     WHERE reference_id = ? AND reference_type = 'order' AND type = 'reserve'`
  )
    .bind(orderId)
    .all<{ id: string; item_id: string; quantity: number }>();

  if (!reservations.results || reservations.results.length === 0) return;

  const ops = [];
  for (const res of reservations.results) {
    ops.push(
      env.AURA_DB.prepare(
        'UPDATE inventory_items SET current_stock = current_stock + ?, updated_at = datetime(\'now\') WHERE id = ?'
      ).bind(Math.abs(res.quantity), res.item_id)
    );
    ops.push(
      env.AURA_DB.prepare(
        'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(
        crypto.randomUUID(),
        res.item_id,
        'release',
        Math.abs(res.quantity),
        orderId,
        'order',
        `Restore from cancelled order ${orderId}`
      )
    );
    ops.push(env.AURA_DB.prepare('DELETE FROM inventory_transactions WHERE id = ?').bind(res.id));
  }
  await env.AURA_DB.batch(ops);
}

/**
 * Auto-deduct inventory for an order by matching product SKU or name against active inventory items.
 * Never blocks order creation — deduction failures are logged only.
 */
export async function deductInventoryForOrder(
  env: Env,
  orderId: string,
  orderItems: Array<{ product_id: string; quantity: number; name?: string }>
): Promise<void> {
  for (const item of orderItems) {
    try {
      let invItem = await env.AURA_DB.prepare(
        `SELECT id, sku, name, current_stock, unit FROM inventory_items
         WHERE active = 1 AND (sku = ? OR LOWER(name) LIKE ?)
         LIMIT 1`
      )
        .bind(String(item.product_id), `%${(item.name || '').toLowerCase()}%`)
        .first<{ id: string; sku: string; name: string; current_stock: number; unit: string }>();

      if (!invItem) continue;

      const have = invItem.current_stock || 0;
      const need = item.quantity;
      const newStock = Math.max(0, have - need);

      await env.AURA_DB.batch([
        env.AURA_DB.prepare(
          'UPDATE inventory_items SET current_stock = ?, updated_at = datetime(\'now\') WHERE id = ?'
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
    } catch (err) {
      const sku = item.product_id;
      console.error('[inventory] deduction failed', { orderId, productId: sku, message: (err as Error).message });
    }
  }
}
