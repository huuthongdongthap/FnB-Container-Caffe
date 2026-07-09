import { Hono } from 'hono';
import { requireAuth } from '../../middleware/auth.js';
import type { Env } from '../../types/env';

const READ_ROLES = ['owner', 'staff', 'customer'];
type AppContext = { Bindings: Env };

export function inventorySnapshots(app: Hono<AppContext>) {
  // GET /api/inventory/:id/snapshots?from=...&to=...
  app.get('/:id/snapshots', requireAuth(READ_ROLES), async(c) => {
    const db = c.env.AURA_DB;
    const itemId = c.req.param('id');
    const limit = Math.min(parseInt(c.req.query('limit') || '30'), 100);

    let query = 'SELECT * FROM inventory_snapshots WHERE item_id = ?';
    const params: (string | number)[] = [itemId];

    const from = c.req.query('from');
    const to = c.req.query('to');
    if (from) {
      query += ' AND date >= ?'; params.push(from);
    }
    if (to) {
      query += ' AND date <= ?'; params.push(to);
    }

    query += ' ORDER BY date DESC LIMIT ?';
    params.push(limit);

    const results = await db.prepare(query).bind(...params).all();
    return c.json({ snapshots: results.results || [] });
  });

  // POST /api/inventory/:id/snapshots — close-of-day snapshot (owner only)
  app.post('/:id/snapshots', requireAuth(['owner', 'staff']), async(c) => {
    const db = c.env.AURA_DB;
    const itemId = c.req.param('id');
    const item = await db.prepare('SELECT current_stock FROM inventory_items WHERE id = ?').bind(itemId).first<{ current_stock: number }>();
    if (!item) {
      return c.json({ error: 'Item không tồn tại' }, 404);
    }

    const today = new Date().toISOString().slice(0, 10);
    const closing = item.current_stock || 0;

    const existing = await db.prepare(
      'SELECT id, opening_stock FROM inventory_snapshots WHERE item_id = ? AND date = ?'
    ).bind(itemId, today).first<{ id: string; opening_stock: number } | null>();

    let id: string;
    if (existing) {
      id = existing.id;
      await db.prepare(
        'UPDATE inventory_snapshots SET closing_stock = ? WHERE id = ?'
      ).bind(closing, id).run();
    } else {
      id = crypto.randomUUID();
      await db.prepare(
        'INSERT INTO inventory_snapshots (id, item_id, date, opening_stock, closing_stock) VALUES (?, ?, ?, ?, ?)'
      ).bind(id, itemId, today, closing, closing).run();
    }

    return c.json({ id, item_id: itemId, date: today, opening_stock: existing?.opening_stock ?? closing, closing_stock: closing }, 201);
  });
}
