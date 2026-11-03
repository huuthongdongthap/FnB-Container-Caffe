import { Hono } from 'hono';
import { getTenantId, matchesTenantRow } from 'worker/src/lib/db';
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

const PURCHASING_MUTATION_ROLES = new Set(['owner', 'manager', 'supervisor', 'admin']);

/**
 * Canonical Purchasing Router
 * Rules: PO creation does NOT touch stock. Stock is only incremented via Receiving.
 */
export function purchasing(app: Hono<AppContext>) {
  app.post('/purchase-orders', async (c) => {
    const userRole = (c as unknown as { get?: (k: string) => { role?: string } | undefined }).get?.('user')?.role;
    if (userRole && !PURCHASING_MUTATION_ROLES.has(userRole)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    try {
      const db = c.env.AURA_DB;
      const tenantId = getTenantId(c).trim() || 'default';
      const body = (await c.req.json()) as PurchaseOrderInput;
      const po = await createCanonicalPurchaseOrder(
        db as any,
        {
          supplierId: body.supplier_id,
          items: body.items.map(i => ({
            ingredientId: i.ingredient_id,
            quantity: i.quantity,
            unitPrice: i.unit_cost,
          })),
          expectedDate: body.expected_date,
          notes: body.notes,
          tenantId,
        },
        tenantId
      );

      return c.json({ success: true, data: po }, 201);
    } catch (err) {
      return c.json({ success: false, error: (err as Error).message }, 400);
    }
  });

  app.post('/purchase-orders/:id/receive', async (c) => {
    const userRole = (c as unknown as { get?: (k: string) => { role?: string } | undefined }).get?.('user')?.role;
    if (userRole && !PURCHASING_MUTATION_ROLES.has(userRole)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
    const id = c.req.param('id');
    const body = await c.req.json() as { items: Array<{ ingredient_id: string; quantity: number }>; receipt_id?: string };

    const result = await receivePurchaseOrder(
      db as any,
      id,
      (body.items || []).map(i => ({ ingredientId: i.ingredient_id, receivedQuantity: i.quantity })),
      { receiptId: body.receipt_id, tenantId }
    );

    if (!result.ok) {
      return c.json({ success: false, error: result.error }, 400);
    }
    return c.json({ success: true, data: result });
  });

  app.post('/purchase-orders/:id/cancel', async (c) => {
    const userRole = (c as unknown as { get?: (k: string) => { role?: string } | undefined }).get?.('user')?.role;
    if (userRole && !PURCHASING_MUTATION_ROLES.has(userRole)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
    const id = c.req.param('id');
    const result = await cancelPurchaseOrder(db as any, id, tenantId);
    if (!result.ok) {
      return c.json({ success: false, error: result.error }, 400);
    }
    return c.json({ success: true });
  });

  app.get('/purchase-orders', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
    const rawLimit = parseInt(c.req.query('limit') || '50', 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
    const fetchLimit = Math.max(limit, 200);

    let results: Record<string, unknown>[] = [];
    if (tenantId && tenantId !== '*') {
      try {
        const res = await db
          .prepare(
            "SELECT * FROM purchase_orders WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT ?"
          )
          .bind(tenantId, limit)
          .all<Record<string, unknown>>();
        results = res.results || [];
      } catch {
        const res = await db
          .prepare('SELECT * FROM purchase_orders ORDER BY created_at DESC LIMIT ?')
          .bind(fetchLimit)
          .all<Record<string, unknown>>();
        results = res.results || [];
      }
    } else {
      const res = await db
        .prepare('SELECT * FROM purchase_orders ORDER BY created_at DESC LIMIT ?')
        .bind(fetchLimit)
        .all<Record<string, unknown>>();
      results = res.results || [];
    }

    const filtered = (results || [])
      .filter((r) => matchesTenantRow(r, tenantId))
      .slice(0, limit);

    return c.json({ success: true, data: filtered });
  });

  app.get('/purchase-orders/:id', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
    const id = c.req.param('id');

    const po = await db
      .prepare('SELECT * FROM purchase_orders WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();
    if (!po || !matchesTenantRow(po, tenantId)) {
      return c.json({ success: false, error: 'Purchase order not found' }, 404);
    }

    const { results: items } = await db
      .prepare('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?')
      .bind(id)
      .all();

    return c.json({ success: true, data: { ...po, items } });
  });
}
