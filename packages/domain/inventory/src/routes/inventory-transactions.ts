import { Hono } from 'hono';
import { inventoryTransactionSchema } from '../model/inventory-schemas';

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

interface AppEnv {
  AURA_DB: D1Database;
  executionCtx?: { waitUntil: (p: Promise<any>) => void };
}

type AppContext = { Bindings: AppEnv };

export function inventoryTransactions(app: Hono<AppContext>) {
  app.get('/:id/transactions', async (c) => {
    const db = c.env.AURA_DB;
    const itemId = c.req.param('id');
    const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 200);

    const { results } = await db
      .prepare('SELECT * FROM inventory_transactions WHERE item_id = ? ORDER BY created_at DESC LIMIT ?')
      .bind(itemId, limit)
      .all();

    return c.json({ success: true, data: { transactions: results || [] } });
  });

  app.post('/:id/transactions', async (c) => {
    const db = c.env.AURA_DB;
    const itemId = c.req.param('id');
    const body = await c.req.json();
    const input = inventoryTransactionSchema.parse(body);

    const item = await db
      .prepare('SELECT * FROM inventory_items WHERE id = ? AND active = 1')
      .bind(itemId)
      .first<{ id: string; sku: string; name: string; current_stock: number; unit: string; min_stock: number }>();

    if (!item) {
      return c.json({ success: false, error: 'Item không tồn tại / Item not found' }, 404);
    }

    const id = crypto.randomUUID();
    const qty =
      input.type === 'out' || input.type === 'waste' ? -Math.abs(input.quantity) : Math.abs(input.quantity);
    const newStock = Math.max(0, (item.current_stock || 0) + qty);

    if (newStock < (item.min_stock || 0) && input.type !== 'adjust') {
      try {
        c.executionCtx?.waitUntil(
          db
            .prepare("INSERT OR IGNORE INTO _alerts (alert_key, message, severity) VALUES (?, ?, 'warning')")
            .bind(
              `inventory:${item.sku}:${new Date().toISOString().slice(0, 10)}`,
              `${item.sku}: Tồn kho thấp (${newStock} ${item.unit}) / Low stock alert`
            )
            .run()
            .catch(() => {})
        );
      } catch {
        // waitUntil unavailable in test context — ignore
      }
    }

    await db.batch([
      db
        .prepare(
          'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(id, itemId, input.type, qty, input.reference_id || null, input.reference_type || null, input.notes || null),
      db
        .prepare("UPDATE inventory_items SET current_stock = ?, updated_at = datetime('now') WHERE id = ?")
        .bind(newStock, itemId),
    ]);

    return c.json(
      { success: true, data: { id, item_id: itemId, type: input.type, quantity: qty, new_stock: newStock } },
      201
    );
  });
}
