import { Hono } from 'hono';
import {
  createCanonicalPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
} from '../policies/purchasing-receiving-policy';
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
 * Canonical Purchasing Router
 * Rules: PO creation does NOT touch stock. Stock is only incremented via Receiving.
 */
export function purchasing(app: Hono<AppContext>) {
  app.post('/purchase-orders', async (c) => {
    try {
      const db = c.env.AURA_DB;
      const body = (await c.req.json()) as PurchaseOrderInput;
      const po = await createCanonicalPurchaseOrder(db as any, {
        supplierId: body.supplier_id,
        items: body.items.map(i => ({
          ingredientId: i.ingredient_id,
          quantity: i.quantity,
          unitPrice: i.unit_cost,
        })),
        expectedDate: body.expected_date,
        notes: body.notes,
      });

      return c.json({ success: true, data: po }, 201);
    } catch (err) {
      return c.json({ success: false, error: (err as Error).message }, 400);
    }
  });

  app.post('/purchase-orders/:id/receive', async (c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    const body = await c.req.json() as { items: Array<{ ingredient_id: string; quantity: number }>; receipt_id?: string };

    const result = await receivePurchaseOrder(
      db as any,
      id,
      (body.items || []).map(i => ({ ingredientId: i.ingredient_id, receivedQuantity: i.quantity })),
      { receiptId: body.receipt_id }
    );

    if (!result.ok) {
      return c.json({ success: false, error: result.error }, 400);
    }
    return c.json({ success: true, data: result });
  });

  app.post('/purchase-orders/:id/cancel', async (c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    const result = await cancelPurchaseOrder(db as any, id);
    if (!result.ok) {
      return c.json({ success: false, error: result.error }, 400);
    }
    return c.json({ success: true });
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
