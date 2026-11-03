import { Hono } from 'hono';
import { getTenantId, matchesTenantRow } from 'worker/src/lib/db';
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

const INVENTORY_MUTATION_ROLES = new Set(['owner', 'manager', 'supervisor', 'admin']);

function matchesInventoryTenant(row: Record<string, unknown> | null | undefined, tenantId: string): boolean {
  if (!row) return false;
  return matchesTenantRow(row, tenantId);
}

export function inventoryCRUD(app: Hono<AppContext>) {
  app.get('/', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
    const category = c.req.query('category');
    const rawLimit = parseInt(c.req.query('limit') || '100', 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 100;
    const fetchLimit = Math.max(limit, 500);

    let query = 'SELECT * FROM inventory_items WHERE active = 1';
    const params: (string | number)[] = [];
    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    query += ' ORDER BY name LIMIT ?';
    params.push(fetchLimit);

    let results: { results: any[] };
    try {
      if (tenantId !== '*') {
        try {
          let tenantQuery = "SELECT * FROM inventory_items WHERE active = 1 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
          const tenantParams: (string | number)[] = [tenantId];
          if (category) {
            tenantQuery += ' AND category = ?';
            tenantParams.push(category);
          }
          tenantQuery += ' ORDER BY name LIMIT ?';
          tenantParams.push(fetchLimit);
          results = await db.prepare(tenantQuery).bind(...tenantParams).all();
        } catch {
          results = await db.prepare(query).bind(...params).all();
        }
      } else {
        results = await db.prepare(query).bind(...params).all();
      }
    } catch {
      let fallbackQuery = 'SELECT * FROM ingredients WHERE is_active = 1';
      const fallbackParams: (string | number)[] = [];
      if (category) {
        fallbackQuery += ' AND category = ?';
        fallbackParams.push(category);
      }
      fallbackQuery += ' ORDER BY name LIMIT ?';
      fallbackParams.push(fetchLimit);
      if (tenantId !== '*') {
        try {
          let tenantFallbackQuery = "SELECT * FROM ingredients WHERE is_active = 1 AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?";
          const tenantFallbackParams: (string | number)[] = [tenantId];
          if (category) {
            tenantFallbackQuery += ' AND category = ?';
            tenantFallbackParams.push(category);
          }
          tenantFallbackQuery += ' ORDER BY name LIMIT ?';
          tenantFallbackParams.push(fetchLimit);
          results = await db.prepare(tenantFallbackQuery).bind(...tenantFallbackParams).all();
        } catch {
          results = await db.prepare(fallbackQuery).bind(...fallbackParams).all();
        }
      } else {
        results = await db.prepare(fallbackQuery).bind(...fallbackParams).all();
      }
    }
    const items = (results.results || [])
      .filter((r: Record<string, unknown>) => matchesInventoryTenant(r, tenantId))
      .slice(0, limit);
    return c.json({ success: true, data: { items } });
  });

  app.get('/:id', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
    const id = c.req.param('id');
    let item = await db
      .prepare('SELECT * FROM inventory_items WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>()
      .catch(() => null);
    if (!item) {
      item = await db
        .prepare('SELECT * FROM ingredients WHERE id = ?')
        .bind(id)
        .first<Record<string, unknown>>()
        .catch(() => null);
    }
    if (!item || !matchesInventoryTenant(item, tenantId)) {
      return c.json({ success: false, error: 'Không tìm thấy / Item not found' }, 404);
    }
    return c.json({ success: true, data: item });
  });

  app.post('/', async (c) => {
    const userRole = (c as unknown as { get?: (k: string) => { role?: string } | undefined }).get?.('user')?.role;
    if (userRole && !INVENTORY_MUTATION_ROLES.has(userRole)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const db = c.env.AURA_DB;
    const rawTenantId = getTenantId(c).trim() || 'default';
    const tenantId = rawTenantId === '*' ? 'default' : rawTenantId;
    const body = await c.req.json();
    const parsed = inventoryItemSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid inventory item payload' }, 400);
    }
    const input = parsed.data;

    let existingRows: Record<string, unknown>[] = [];
    try {
      const res = await db
        .prepare('SELECT * FROM inventory_items WHERE sku = ?')
        .bind(input.sku)
        .all<Record<string, unknown>>();
      existingRows = res.results || [];
    } catch {
      existingRows = [];
    }
    if (existingRows.length === 0) {
      const single = await db
        .prepare('SELECT * FROM inventory_items WHERE sku = ?')
        .bind(input.sku)
        .first<Record<string, unknown>>()
        .catch(() => null);
      if (single) existingRows = [single];
    }
    if (existingRows.some((r) => matchesInventoryTenant(r, tenantId))) {
      return c.json({ success: false, error: 'SKU đã tồn tại / SKU already exists' }, 409);
    }

    const id = crypto.randomUUID();
    try {
      await db
        .prepare(
          `INSERT INTO inventory_items
           (id, sku, name, name_en, category, unit, current_stock, min_stock, max_stock, cost_per_unit, supplier, active, tenant_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
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
          input.supplier || null,
          tenantId
        )
        .run();
    } catch {
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
    }

    return c.json({ success: true, data: { id, ...input } }, 201);
  });

  app.put('/:id', async (c) => {
    const userRole = (c as unknown as { get?: (k: string) => { role?: string } | undefined }).get?.('user')?.role;
    if (userRole && !INVENTORY_MUTATION_ROLES.has(userRole)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
    const id = c.req.param('id');
    const body = await c.req.json();
    const parsed = inventoryItemSchema.partial().safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid inventory item update payload' }, 400);
    }
    const input = parsed.data;

    const existing = await db
      .prepare('SELECT * FROM inventory_items WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>();
    if (!existing || !matchesInventoryTenant(existing, tenantId)) {
      return c.json({ success: false, error: 'Item không tồn tại / Item not found' }, 404);
    }

    if (input.sku !== undefined && input.sku !== existing.sku) {
      let duplicateRows: Record<string, unknown>[] = [];
      const dupStmt = db
        .prepare('SELECT * FROM inventory_items WHERE sku = ? AND id != ?')
        .bind(input.sku, id) as unknown as {
        all?: <T = Record<string, unknown>>() => Promise<{ results?: T[] }>;
        first?: <T = Record<string, unknown>>() => Promise<T | null>;
      };
      if (typeof dupStmt.all === 'function') {
        const res = await dupStmt.all<Record<string, unknown>>().catch(() => ({ results: [] }));
        duplicateRows = res.results || [];
      } else if (typeof dupStmt.first === 'function') {
        const row = await dupStmt.first<Record<string, unknown>>().catch(() => null);
        if (row) duplicateRows = [row];
      }
      const conflict = duplicateRows.find((r) => String(r.id ?? '') !== id && matchesInventoryTenant(r, tenantId));
      if (conflict) {
        return c.json({ success: false, error: `SKU '${input.sku}' already exists` }, 409);
      }
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

    if (tenantId && tenantId !== '*') {
      try {
        await db
          .prepare(
            `UPDATE inventory_items SET ${sets.join(', ')} WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?`
          )
          .bind(...params, tenantId)
          .run();
      } catch {
        await db.prepare(`UPDATE inventory_items SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run();
      }
    } else {
      await db.prepare(`UPDATE inventory_items SET ${sets.join(', ')} WHERE id = ?`).bind(...params).run();
    }
    return c.json({ success: true, data: { id, ...input } });
  });

  app.delete('/:id', async (c) => {
    const userRole = (c as unknown as { get?: (k: string) => { role?: string } | undefined }).get?.('user')?.role;
    if (userRole && !INVENTORY_MUTATION_ROLES.has(userRole)) {
      return c.json({ success: false, error: 'Insufficient permissions' }, 403);
    }
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
    const id = c.req.param('id');
    const existing = await db
      .prepare('SELECT * FROM inventory_items WHERE id = ?')
      .bind(id)
      .first<Record<string, unknown>>()
      .catch(() => null);
    if (!existing || !matchesInventoryTenant(existing, tenantId)) {
      return c.json({ success: false });
    }
    let result: { meta: { changes: number } };
    if (tenantId && tenantId !== '*') {
      try {
        result = await db
          .prepare(
            "UPDATE inventory_items SET active = 0, updated_at = datetime('now') WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(id, tenantId)
          .run();
      } catch {
        result = await db
          .prepare("UPDATE inventory_items SET active = 0, updated_at = datetime('now') WHERE id = ?")
          .bind(id)
          .run();
      }
    } else {
      result = await db
        .prepare("UPDATE inventory_items SET active = 0, updated_at = datetime('now') WHERE id = ?")
        .bind(id)
        .run();
    }
    return c.json({ success: (result.meta.changes ?? 0) > 0 });
  });
}
