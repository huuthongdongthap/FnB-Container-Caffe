import { Hono } from 'hono';
import { z } from 'zod';
import { inventoryItemSchema } from './schemas';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth.js';

const READ_ROLES = ['owner', 'staff', 'customer'];
const WRITE_ROLES = ['owner', 'staff'];
type AppContext = { Bindings: Env };

export function inventoryCRUD(app: Hono<AppContext>) {
  // LIST — all items or filter by category
  app.get('/', requireAuth(READ_ROLES), async (c) => {
    const db = c.env.AURA_DB;
    const category = c.req.query('category');
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 500);

    let sql = 'SELECT * FROM inventory_items WHERE active = 1';
    const params: (string | number)[] = [];
    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }
    sql += ' ORDER BY category, name ASC LIMIT ?';
    params.push(limit);

    const { results } = await db.prepare(sql).bind(...params).all();
    return c.json({ items: results || [], total: (results || []).length });
  });

  // GET single
  app.get('/:id', requireAuth(READ_ROLES), async (c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    const item = await db.prepare(
      "SELECT *, (SELECT COUNT(*) FROM inventory_transactions WHERE item_id = ?) AS transaction_count FROM inventory_items WHERE id = ?"
    ).bind(id, id).first();
    if (!item) {
      return c.json({ success: false, error: 'Không tìm thấy / Item not found' }, 404);
    }
    return c.json({ success: true, data: item });
  });

  // CREATE
  app.post('/', requireAuth(WRITE_ROLES), async (c) => {
    const db = c.env.AURA_DB;
    const body = await c.req.json();
    const input = inventoryItemSchema.parse(body);

    const id = crypto.randomUUID();
    const sku = input.sku.toUpperCase();

    try {
      await db.prepare(
        `INSERT INTO inventory_items (id, sku, name, name_en, category, unit, current_stock, min_stock, max_stock, cost_per_unit, supplier, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        sku,
        input.name,
        input.name_en || null,
        input.category,
        input.unit,
        input.current_stock,
        input.min_stock,
        input.max_stock,
        input.cost_per_unit,
        input.supplier || null,
        input.active ? 1 : 0,
      ).run();
      return c.json({ success: true, data: { id, sku, ...input } }, 201);
    } catch (e) {
      const msg = (e as Error).message || '';
      if (msg.includes('UNIQUE') || msg.includes('constraint')) {
        return c.json({ success: false, error: 'SKU đã tồn tại / SKU already exists' }, 409);
      }
      throw e;
    }
  });

  // UPDATE
  app.put('/:id', requireAuth(WRITE_ROLES), async (c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    const body = await c.req.json();
    const input = inventoryItemSchema.parse(body);

    const result = await db.prepare(
      `UPDATE inventory_items SET sku=?, name=?, name_en=?, category=?, unit=?, current_stock=?, min_stock=?, max_stock=?, cost_per_unit=?, supplier=?, active=?
       WHERE id=?`
    ).bind(
      input.sku.toUpperCase(),
      input.name,
      input.name_en || null,
      input.category,
      input.unit,
      input.current_stock,
      input.min_stock,
      input.max_stock,
      input.cost_per_unit,
      input.supplier || null,
      input.active ? 1 : 0,
      id,
    ).run();

    if ((result.rowsAffected ?? 0) === 0) {
      return c.json({ success: false, error: 'Item không tồn tại / Item not found' }, 404);
    }

    return c.json({ success: true, data: { id, ...input } });
  });

  // DELETE (soft)
  app.delete('/:id', requireAuth(WRITE_ROLES), async (c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    const result = await db.prepare(
      "UPDATE inventory_items SET active = 0, updated_at = datetime('now') WHERE id = ?"
    ).bind(id).run();
    return c.json({ success: (result.rowsAffected ?? 0) > 0 });
  });
}
