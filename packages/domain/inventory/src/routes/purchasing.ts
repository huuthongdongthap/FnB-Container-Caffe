import { Hono } from 'hono';
import type { PurchaseOrderInput } from '../model/supplier-policy';

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

/**
 * Create purchase order and record stock intake in a single transaction.
 * Inserts into purchase_orders + purchase_order_items, then updates
 * ingredient stock and creates 'in' type inventory_transactions.
 */
export function purchasing(app: Hono<AppContext>) {
  app.post('/purchase-orders', async (c) => {
    const db = c.env.AURA_DB;
    const body = (await c.req.json()) as PurchaseOrderInput;
    const now = new Date().toISOString();

    const supplier = await db
      .prepare('SELECT id, name FROM suppliers WHERE id = ? AND is_active = 1')
      .bind(body.supplier_id)
      .first<{ id: string; name: string }>();
    if (!supplier) {
      return c.json({ success: false, error: 'Supplier not found or inactive' }, 404);
    }

    const poId = `po_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const poInsert = db.prepare(
      `INSERT INTO purchase_orders (id, supplier_id, order_date, expected_date, status, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'received', ?, ?, ?)`
    ).bind(poId, body.supplier_id, now.slice(0, 10), body.expected_date ?? null, body.notes ?? null, now, now);

    const itemOps = [];
    for (const item of body.items) {
      const itemId = `poi_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      itemOps.push(
        db.prepare(
          `INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_cost, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(itemId, poId, item.ingredient_id, item.quantity, item.unit_cost ?? 0, now)
      );
    }

    await db.batch([poInsert, ...itemOps]);

    // Stock intake: update ingredient current_stock + create inventory_transactions
    const intakeOps = [];
    for (const item of body.items) {
      intakeOps.push(
        db.prepare(
          `UPDATE ingredients SET current_stock = current_stock + ?, updated_at = ? WHERE id = ?`
        ).bind(item.quantity, now, item.ingredient_id)
      );
      intakeOps.push(
        db.prepare(
          `INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes)
           VALUES (?, ?, 'in', ?, ?, 'purchase_order', ?)`
        ).bind(
          crypto.randomUUID(),
          item.ingredient_id,
          item.quantity,
          poId,
          `PO intake ${poId} from supplier ${supplier.name}`
        )
      );
    }
    if (intakeOps.length > 0) {
      await db.batch(intakeOps);
    }

    return c.json({ success: true, data: { id: poId } }, 201);
  });

  app.get('/purchase-orders', async (c) => {
    const db = c.env.AURA_DB;
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200);

    const { results } = await db
      .prepare('SELECT * FROM purchase_orders ORDER BY created_at DESC LIMIT ?')
      .bind(limit)
      .all();

    return c.json({ success: true, data: results });
  });

  app.get('/purchase-orders/:id', async (c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');

    const po = await db
      .prepare('SELECT * FROM purchase_orders WHERE id = ?')
      .bind(id)
      .first();
    if (!po) {
      return c.json({ success: false, error: 'Purchase order not found' }, 404);
    }

    const { results: items } = await db
      .prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?')
      .bind(id)
      .all();

    return c.json({ success: true, data: { ...po, items } });
  });
}
