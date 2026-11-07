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

const SNAPSHOT_READ_ROLES = [
  'owner',
  'admin',
  'manager',
  'supervisor',
  'staff',
  'cashier',
  'barista',
  'kitchen',
  'chef',
  'warehouse',
];
const SNAPSHOT_GENERATE_ROLES = ['owner', 'admin', 'manager', 'supervisor', 'staff', 'warehouse'];
const INVENTORY_MUTATION_ROLES = ['owner', 'manager', 'supervisor', 'admin'];

function verifySnapshotTenant(
  c: {
    get?: (k: string) => unknown;
    req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined };
  },
  mode: 'read' | 'write' | 'generate'
): { ok: true; tenantId: string } | { ok: false } {
  const user = c.get?.('user') as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const resolvedTenant = getTenantId(c as unknown as Parameters<typeof getTenantId>[0]).trim() || 'default';
  const candidateOverrides = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (v || '').trim())
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return { ok: false };
  }
  const requestedTenant = candidateOverrides[0] || '';

  if (!user) {
    return { ok: false };
  }

  const userRole = String(user.role || '').trim().toLowerCase();
  if (mode === 'read' && !SNAPSHOT_READ_ROLES.includes(userRole)) {
    return { ok: false };
  }
  if (mode === 'generate' && !SNAPSHOT_GENERATE_ROLES.includes(userRole)) {
    return { ok: false };
  }
  if (mode === 'write' && !INVENTORY_MUTATION_ROLES.includes(userRole)) {
    return { ok: false };
  }

  const rawUserTenant = user.tenantId ?? user.tenant_id;
  const contextTenant = typeof c.get?.('tenantId') === 'string' ? String(c.get('tenantId')).trim() : '';
  const userTenant =
    (rawUserTenant && String(rawUserTenant).trim()) ||
    (!requestedTenant && contextTenant && contextTenant !== '*' && contextTenant.toLowerCase() !== 'hq'
      ? contextTenant
      : 'default');
  const isHqAdmin =
    (userRole === 'owner' || userRole === 'admin') &&
    (userTenant === '*' || userTenant.toLowerCase() === 'hq');

  if (isHqAdmin) {
    const candidate = requestedTenant || (resolvedTenant.toLowerCase() === 'hq' ? '*' : resolvedTenant);
    return { ok: true, tenantId: !candidate || candidate.toLowerCase() === 'hq' ? '*' : candidate };
  }

  if (
    userTenant === '*' ||
    userTenant.toLowerCase() === 'hq' ||
    requestedTenant === '*' ||
    requestedTenant.toLowerCase() === 'hq' ||
    resolvedTenant === '*' ||
    resolvedTenant.toLowerCase() === 'hq' ||
    (!rawUserTenant && (contextTenant === '*' || contextTenant.toLowerCase() === 'hq'))
  ) {
    return { ok: false };
  }

  if (mode === 'write') {
    if (resolvedTenant !== userTenant || (requestedTenant && requestedTenant !== userTenant)) {
      return { ok: false };
    }
    return { ok: true, tenantId: userTenant };
  }

  if (resolvedTenant !== userTenant) {
    return { ok: false };
  }
  if (requestedTenant && requestedTenant !== userTenant) {
    return { ok: false };
  }

  return { ok: true, tenantId: userTenant };
}

export function inventorySnapshots(app: Hono<AppContext>) {
  const handleListAllSnapshots = async (c: any) => {
    const tenantCheck = verifySnapshotTenant(c as never, 'read');
    if (!tenantCheck.ok) {
      return c.json({ error: 'Cross-tenant snapshot access denied' }, 403);
    }
    const db = c.env.AURA_DB;
    const tenantId = tenantCheck.tenantId;
    const rawLimit = parseInt(c.req.query('limit') || '50', 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;
    let results: { results: Record<string, unknown>[] } = { results: [] };
    try {
      results =
        tenantId !== '*'
          ? await db
              .prepare(
                "SELECT * FROM inventory_snapshots WHERE COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY date DESC LIMIT ?"
              )
              .bind(tenantId, limit)
              .all()
          : await db
              .prepare('SELECT * FROM inventory_snapshots ORDER BY date DESC LIMIT ?')
              .bind(limit)
              .all();
    } catch {
      results = { results: [] };
    }
    const snapshots = (results.results || []).filter((r) => matchesTenantRow(r, tenantId));
    return c.json({ snapshots });
  };

  app.get('/snapshots', handleListAllSnapshots);

  const handleGenerateSnapshots = async (c: any) => {
    const userRole = String((c as unknown as { get?: (k: string) => { role?: string } | undefined }).get?.('user')?.role || '')
      .trim()
      .toLowerCase();
    if (!userRole || !SNAPSHOT_GENERATE_ROLES.includes(userRole)) {
      return c.json({ error: 'Insufficient permissions to generate inventory snapshots' }, 403);
    }
    const tenantCheck = verifySnapshotTenant(c as never, 'generate');
    if (!tenantCheck.ok) {
      return c.json({ error: 'Cross-tenant snapshot generation denied' }, 403);
    }
    const effectiveTenant = tenantCheck.tenantId === '*' ? 'default' : tenantCheck.tenantId;
    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    return c.json({ success: true, date: today, tenant_id: effectiveTenant }, 201);
  };

  app.post('/generate', handleGenerateSnapshots);
  app.post('/snapshots/generate', handleGenerateSnapshots);

  app.get('/:id/snapshots', async (c) => {
    const tenantCheck = verifySnapshotTenant(c as never, 'read');
    if (!tenantCheck.ok) {
      return c.json({ error: 'Cross-tenant snapshot access denied' }, 403);
    }
    const db = c.env.AURA_DB;
    const tenantId = tenantCheck.tenantId;
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

    const effectiveTenant =
      tenantId === '*'
        ? (item.tenant_id &&
          String(item.tenant_id).trim() &&
          String(item.tenant_id).trim() !== '*' &&
          String(item.tenant_id).trim().toLowerCase() !== 'hq'
            ? String(item.tenant_id).trim()
            : 'default')
        : tenantId;

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
    if (effectiveTenant !== '*') {
      try {
        const tenantQuery = `${query} AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY date DESC LIMIT ?`;
        results = await db.prepare(tenantQuery).bind(...params, effectiveTenant, limit).all<Record<string, unknown>>();
      } catch {
        results =
          effectiveTenant === 'default'
            ? await db.prepare(`${query} ORDER BY date DESC LIMIT ?`).bind(...params, limit).all<Record<string, unknown>>()
            : { results: [] };
      }
    } else {
      results = await db.prepare(`${query} ORDER BY date DESC LIMIT ?`).bind(...params, limit).all<Record<string, unknown>>();
    }
    const snapshots = (results.results || []).filter((r) => {
      if (effectiveTenant !== 'default' && effectiveTenant !== '*' && (!('tenant_id' in r) || r.tenant_id === undefined)) {
        return false;
      }
      return matchesTenantRow(r, effectiveTenant);
    });
    return c.json({ snapshots });
  });

  app.post('/:id/snapshots', async (c) => {
    const userRole = (c as unknown as { get?: (k: string) => { role?: string } | undefined }).get?.('user')?.role;
    if (!userRole || !INVENTORY_MUTATION_ROLES.includes(userRole)) {
      return c.json({ error: 'Insufficient permissions to record inventory snapshot' }, 403);
    }
    const tenantCheck = verifySnapshotTenant(c as never, 'write');
    if (!tenantCheck.ok) {
      return c.json({ error: 'Cross-tenant snapshot mutation denied' }, 403);
    }
    const db = c.env.AURA_DB;
    const tenantId = tenantCheck.tenantId;
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
        ? (item.tenant_id &&
          String(item.tenant_id).trim() &&
          String(item.tenant_id).trim() !== '*' &&
          String(item.tenant_id).trim().toLowerCase() !== 'hq'
            ? String(item.tenant_id).trim()
            : 'default')
        : tenantId;

    const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
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
        existing =
          effectiveTenant === 'default'
            ? await db
                .prepare('SELECT id, opening_stock FROM inventory_snapshots WHERE item_id = ? AND date = ?')
                .bind(itemId, today)
                .first<{ id: string; opening_stock: number } | null>()
            : null;
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
        } catch (err) {
          if (effectiveTenant === 'default') {
            await db.prepare('UPDATE inventory_snapshots SET closing_stock = ? WHERE id = ?').bind(closing, id).run();
          } else {
            throw err;
          }
        }
      } else {
        await db.prepare('UPDATE inventory_snapshots SET closing_stock = ? WHERE id = ?').bind(closing, id).run();
      }
    } else {
      id = crypto.randomUUID();
      try {
        await db
          .prepare(
            'INSERT INTO inventory_snapshots (id, item_id, date, opening_stock, closing_stock, tenant_id) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .bind(id, itemId, today, closing, closing, effectiveTenant)
          .run();
      } catch (err) {
        if (effectiveTenant !== 'default') {
          throw err;
        }
        await db
          .prepare(
            'INSERT INTO inventory_snapshots (id, item_id, date, opening_stock, closing_stock) VALUES (?, ?, ?, ?, ?)'
          )
          .bind(id, itemId, today, closing, closing)
          .run();
      }
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
