import { Hono } from 'hono';
import { inventoryItemSchema } from '../model/inventory-schemas';

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

export function inventoryCRUD(app: Hono<AppContext>) {
  app.get('/', async (c) => {
    const db = c.env.AURA_DB;
    const category = c.req.query('category');
    const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 500);

    let query = 'SELECT * FROM inventory_items WHERE active = 1';
    const params: (string | number)[] = [];
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    query += ' ORDER BY name LIMIT ?';
    params.push(limit);

    let results: { results: any[] };
    try {
      results = await db.prepare(query).bind(...params).all();
    } catch {
      let fallbackQuery = 'SELECT * FROM ingredients WHERE is_active = 1';
      const fallbackParams: (string | number)[] = [];
      if (category) {
        fallbackQuery += ' AND category = ?';
        fallbackParams.push(category);
      }
      fallbackQuery += ' ORDER BY name LIMIT ?';
      fallbackParams.push(limit);
      results = await db.prepare(fallbackQuery).bind(...fallbackParams).all();
    }
    return c.json({ success: true, data: { items: results.results || [] } });
  });

  app.get('/:id', async (c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    let item = await db
      .prepare('SELECT * FROM inventory_items WHERE id = ?')
      .bind(id)
      .first()
      .catch(() => null);
    if (!item) {
      item = await db
        .prepare('SELECT * FROM ingredients WHERE id = ?')
        .bind(id)
        .first()
        .catch(() => null);
    }
    if (!item) {
      return c.json({ success: false, error: 'Không tìm thấy / Item not found' }, 404);
    }
    return c.json({ success: true, data: item });
  });

  app.post('/', async (c) => {
    const db = c.env.AURA_DB;
    const body = await c.req.json();
    const input = inventoryItemSchema.parse(body);

    const existing = await db
      .prepare('SELECT id FROM inventory_items WHERE sku = ?')
      .bind(input.sku)
      .first<{ id: string }>();
    if (existing) {
      return c.json({ success: false, error: 'SKU đã tồn tại / SKU already exists' }, 409);
    }

    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO inventory_items
         (id, sku, name, name_en, category, unit, current_stock, min_stock, max_stock, cost_per_unit, supplier, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .bind(
        id,
        input.sku,
        input.name,
        input.name_en || null,
        input.category,
        input.unit,
        input.current_stock,
        input.min_stock,
        input.max_stock,
        input.cost_per_unit,
        input.supplier || null
      )
      .run();

    return c.json({ success: true, data: { id, ...input } }, 201);
  });

  app.put('/:id', async (c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    const body = await c.req.json();
    const input = inventoryItemSchema.partial().parse(body);

    const existing = await db
      .prepare('SELECT id FROM inventory_items WHERE id = ?')
      .bind(id)
      .first<{ id: string }>();
    if (!existing) {
      return c.json({ success: false, error: 'Item không tồn tại / Item not found' }, 404);
    }

    const sets: string[] = [];
    const params: (string | number)[] = [];
    const fields: (keyof typeof input)[] = [
      'sku', 'name', 'name_en', 'category', 'unit',
      'current_stock', 'min_stock', 'max_stock', 'cost_per_unit', 'supplier',
    ];
    for (const f of fields) {
      if (input[f] !== undefined) {
        sets.push(`${f} = ?`);
        params.push(input[f] as string | number);
      }
    }
    if (sets.length === 0) {
      return c.json({ success: false, error: 'Không có trường để cập nhật' }, 400);
    }
    sets.push("updated_at = datetime('now')");
    params.push(id);

    await db.prepare(`UPDATE inventory_items SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run();
    return c.json({ success: true, data: { id, ...input } });
  });

  app.delete('/:id', async (c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');
    const result = await db
      .prepare("UPDATE inventory_items SET active = 0, updated_at = datetime('now') WHERE id = ?")
      .bind(id)
      .run();
    return c.json({ success: (result.meta.changes ?? 0) > 0 });
  });
}
