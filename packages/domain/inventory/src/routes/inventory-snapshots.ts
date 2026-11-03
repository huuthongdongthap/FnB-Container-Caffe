import { Hono } from 'hono';
import { getTenantId, matchesTenantRow } from 'worker/src/lib/db';

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

const INVENTORY_MUTATION_ROLES = ['owner', 'manager', 'supervisor', 'admin'];

export function inventorySnapshots(app: Hono<AppContext>) {
  app.get('/:id/snapshots', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
    const itemId = c.req.param('id');
    const rawLimit = parseInt(c.req.query('limit') || '30', 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 30;

    let item = await db
      .prepare('SELECT * FROM inventory_items WHERE id = ?')
      .bind(itemId)
      .first<Record<string, unknown>>()
      .catch(() => null);
    if (!item) {
      item = await db
        .prepare('SELECT * FROM ingredients WHERE id = ?')
        .bind(itemId)
        .first<Record<string, unknown>>()
        .catch(() => null);
    }
    if (!item || !matchesTenantRow(item, tenantId)) {
      return c.json({ error: 'Item không tồn tại' }, 404);
    }

    let query = 'SELECT * FROM inventory_snapshots WHERE item_id = ?';
    const params: (string | number)[] = [itemId];

    const from = c.req.query('from');
    const to = c.req.query('to');
    if (from) {
      query += ' AND date >= ?';
      params.push(from);
    }
    if (to) {
      query += ' AND date <= ?';
      params.push(to);
    }

    let results: { results: Record<string, unknown>[] };
    if (tenantId !== '*') {
      try {
        const tenantQuery = `${query} AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY date DESC LIMIT ?`;
        results = await db.prepare(tenantQuery).bind(...params, tenantId, limit).all<Record<string, unknown>>();
      } catch {
        results = await db.prepare(`${query} ORDER BY date DESC LIMIT ?`).bind(...params, limit).all<Record<string, unknown>>();
      }
    } else {
      results = await db.prepare(`${query} ORDER BY date DESC LIMIT ?`).bind(...params, limit).all<Record<string, unknown>>();
    }
    const snapshots = (results.results || []).filter(
      (r) => !('tenant_id' in r) || r.tenant_id == null || matchesTenantRow(r, tenantId)
    );
    return c.json({ snapshots });
  });

  app.post('/:id/snapshots', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
    const userRole = (c as unknown as { get?: (k: string) => { role?: string } | undefined }).get?.('user')?.role;
    if (userRole && !INVENTORY_MUTATION_ROLES.includes(userRole)) {
      return c.json({ error: 'Insufficient permissions to record inventory snapshot' }, 403);
    }
    const itemId = c.req.param('id');
    let item = await db
      .prepare('SELECT * FROM inventory_items WHERE id = ?')
      .bind(itemId)
      .first<{ current_stock: number; tenant_id?: string | null }>()
      .catch(() => null);
    if (!item) {
      item = await db
        .prepare('SELECT * FROM ingredients WHERE id = ?')
        .bind(itemId)
        .first<{ current_stock: number; tenant_id?: string | null }>()
        .catch(() => null);
    }
    if (!item || !matchesTenantRow(item as unknown as Record<string, unknown>, tenantId)) {
      return c.json({ error: 'Item không tồn tại' }, 404);
    }

    const effectiveTenant =
      tenantId === '*'
        ? (item.tenant_id && String(item.tenant_id).trim() && String(item.tenant_id).trim() !== '*'
            ? String(item.tenant_id).trim()
            : 'default')
        : tenantId;

    const today = new Date().toISOString().slice(0, 10);
    const closing = item.current_stock || 0;

    let existing: { id: string; opening_stock: number } | null = null;
    if (effectiveTenant && effectiveTenant !== '*') {
      try {
        existing = await db
          .prepare(
            "SELECT id, opening_stock FROM inventory_snapshots WHERE item_id = ? AND date = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(itemId, today, effectiveTenant)
          .first<{ id: string; opening_stock: number } | null>();
      } catch {
        existing = await db
          .prepare('SELECT id, opening_stock FROM inventory_snapshots WHERE item_id = ? AND date = ?')
          .bind(itemId, today)
          .first<{ id: string; opening_stock: number } | null>();
      }
    } else {
      existing = await db
        .prepare('SELECT id, opening_stock FROM inventory_snapshots WHERE item_id = ? AND date = ?')
        .bind(itemId, today)
        .first<{ id: string; opening_stock: number } | null>();
    }

    let id: string;
    if (existing) {
      id = existing.id;
      if (effectiveTenant && effectiveTenant !== '*') {
        try {
          await db
            .prepare(
              "UPDATE inventory_snapshots SET closing_stock = ? WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            )
            .bind(closing, id, effectiveTenant)
            .run();
        } catch {
          await db.prepare('UPDATE inventory_snapshots SET closing_stock = ? WHERE id = ?').bind(closing, id).run();
        }
      } else {
        await db.prepare('UPDATE inventory_snapshots SET closing_stock = ? WHERE id = ?').bind(closing, id).run();
      }
    } else {
      id = crypto.randomUUID();
      await db
        .prepare(
          'INSERT INTO inventory_snapshots (id, item_id, date, opening_stock, closing_stock) VALUES (?, ?, ?, ?, ?)'
        )
        .bind(id, itemId, today, closing, closing)
        .run();
    }
    if (effectiveTenant && effectiveTenant !== '*') {
      await db
        .prepare('UPDATE inventory_snapshots SET tenant_id = ? WHERE id = ?')
        .bind(effectiveTenant, id)
        .run()
        .catch(() => {});
    }

    return c.json(
      {
        id,
        item_id: itemId,
        date: today,
        opening_stock: existing?.opening_stock ?? closing,
        closing_stock: closing,
      },
      201
    );
  });
}
