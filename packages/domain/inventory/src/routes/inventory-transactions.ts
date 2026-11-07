import { Hono } from 'hono';
import { getTenantId, matchesTenantRow } from 'worker/src/lib/db';
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

function verifyTransactionTenant(
  c: {
    get?: (k: string) => unknown;
    req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined };
  },
  _mode: 'read' | 'write'
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

  const rawRole = String(user.role || '').trim().toLowerCase();
  const isStaff = ['owner', 'admin', 'manager', 'supervisor', 'staff', 'waiter', 'cashier', 'kitchen', 'barista', 'chef'].includes(rawRole);
  if (!isStaff) {
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
    (user.role === 'owner' || user.role === 'admin') &&
    (userTenant.toLowerCase() === 'hq' || userTenant === '*');

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

  if (resolvedTenant !== userTenant) {
    return { ok: false };
  }
  if (requestedTenant && requestedTenant !== userTenant) {
    return { ok: false };
  }

  return { ok: true, tenantId: userTenant };
}

export function inventoryTransactions(app: Hono<AppContext>) {
  app.get('/:id/transactions', async (c) => {
    const user = (c as unknown as { get?: (k: string) => unknown }).get?.('user');
    if (!user) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }
    const tenantCheck = verifyTransactionTenant(c as never, 'read');
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant transaction access denied' }, 403);
    }
    const db = c.env.AURA_DB;
    const tenantId = tenantCheck.tenantId;
    const itemId = c.req.param('id');
    const rawLimit = parseInt(c.req.query('limit') || '50', 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 200) : 50;

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
      return c.json({ success: false, error: 'Item không tồn tại / Item not found' }, 404);
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

    let results: Record<string, unknown>[] = [];
    if (effectiveTenant && effectiveTenant !== '*') {
      try {
        const res = await db
          .prepare("SELECT * FROM inventory_transactions WHERE item_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT ?")
          .bind(itemId, effectiveTenant, limit)
          .all<Record<string, unknown>>();
        results = (res.results || []).filter((r) => matchesTenantRow(r, effectiveTenant));
      } catch {
        if (effectiveTenant === 'default') {
          const res = await db
            .prepare('SELECT * FROM inventory_transactions WHERE item_id = ? ORDER BY created_at DESC LIMIT ?')
            .bind(itemId, limit)
            .all<Record<string, unknown>>();
          results = (res.results || []).filter((r) => matchesTenantRow(r, effectiveTenant));
        } else {
          results = [];
        }
      }
    } else {
      const res = await db
        .prepare('SELECT * FROM inventory_transactions WHERE item_id = ? ORDER BY created_at DESC LIMIT ?')
        .bind(itemId, limit)
        .all<Record<string, unknown>>();
      results = (res.results || []).filter((r) => matchesTenantRow(r, effectiveTenant));
    }

    return c.json({ success: true, data: { transactions: results } });
  });

  app.post('/:id/transactions', async (c) => {
    const INVENTORY_MUTATION_ROLES = ['owner', 'manager', 'supervisor', 'admin'];
    const INVENTORY_OUTBOUND_ROLES = [...INVENTORY_MUTATION_ROLES, 'kitchen', 'barista', 'chef'];
    const userRole = (c as unknown as { get?: (k: string) => { role?: string } | undefined }).get?.('user')?.role;
    if (!userRole || !INVENTORY_OUTBOUND_ROLES.includes(userRole)) {
      return c.json({ success: false, error: 'Insufficient permissions for stock adjustment' }, 403);
    }
    const tenantCheck = verifyTransactionTenant(c as never, 'write');
    if (!tenantCheck.ok) {
      return c.json({ success: false, error: 'Cross-tenant transaction mutation denied' }, 403);
    }
    const db = c.env.AURA_DB;
    const tenantId = tenantCheck.tenantId;
    const itemId = c.req.param('id');
    const body = await c.req.json();
    if (
      body?.item_id !== undefined &&
      String(body.item_id).trim() !== '' &&
      String(body.item_id).trim() !== itemId
    ) {
      return c.json({ success: false, error: 'item_id in body does not match URL parameter' }, 400);
    }
    const parsed = inventoryTransactionSchema.safeParse({ ...body, item_id: itemId });
    if (!parsed.success) {
      return c.json({ success: false, error: parsed.error.issues[0]?.message || 'Invalid transaction payload' }, 400);
    }
    const input = parsed.data;
    if (
      (input.type === 'in' ||
        input.type === 'adjust' ||
        input.type === 'release' ||
        input.type === 'reserve') &&
      !INVENTORY_MUTATION_ROLES.includes(userRole)
    ) {
      return c.json({ success: false, error: 'Insufficient permissions for stock adjustment' }, 403);
    }
    if (['waste', 'out'].includes(input.type) && !INVENTORY_OUTBOUND_ROLES.includes(userRole)) {
      return c.json({ success: false, error: 'Insufficient permissions for stock adjustment' }, 403);
    }

    const item = await db
      .prepare('SELECT * FROM inventory_items WHERE id = ? AND active = 1')
      .bind(itemId)
      .first<{ id: string; sku: string; name: string; current_stock: number; unit: string; min_stock: number; tenant_id?: string | null }>();

    if (!item || !matchesTenantRow(item as unknown as Record<string, unknown>, tenantId)) {
      return c.json({ success: false, error: 'Item không tồn tại / Item not found' }, 404);
    }

    const id = crypto.randomUUID();
    let qty =
      input.type === 'out' || input.type === 'waste' || input.type === 'reserve'
        ? -Math.abs(input.quantity)
        : input.type === 'adjust' && Number(input.quantity) < 0
          ? Number(input.quantity)
          : Math.abs(input.quantity);

    const itemTenant = 'tenant_id' in item && item.tenant_id !== undefined
      ? ((typeof item.tenant_id === 'string' &&
          item.tenant_id.trim() &&
          item.tenant_id.trim() !== '*' &&
          item.tenant_id.trim().toLowerCase() !== 'hq')
          ? item.tenant_id.trim()
          : 'default')
      : 'default';
    const effectiveTenant = (tenantId && tenantId !== '*' && tenantId.toLowerCase() !== 'hq' ? tenantId.trim() : itemTenant) || 'default';

    if (input.type === 'release') {
      if (!input.reference_id || !String(input.reference_id).trim()) {
        return c.json({ success: false, error: 'Release transaction requires a valid reservation reference_id' }, 400);
      }
      let netReserved = 0;
      try {
        const txRows = await db
          .prepare(
            "SELECT id, type, quantity, tenant_id FROM inventory_transactions WHERE item_id = ? AND reference_id = ? AND type IN ('reserve', 'release') AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
          )
          .bind(itemId, input.reference_id, effectiveTenant)
          .all<{ id: string; type?: string; quantity: number; tenant_id?: string | null }>();
        const rows = txRows.results || [];
        if (rows.length > 0) {
          for (const r of rows) {
            if (!matchesTenantRow(r as unknown as Record<string, unknown>, effectiveTenant)) continue;
            if (r.type === 'release') {
              netReserved -= Math.abs(Number(r.quantity ?? 0));
            } else {
              netReserved += Math.abs(Number(r.quantity ?? 0));
            }
          }
        } else {
          const singleReserve = await db
            .prepare(
              "SELECT id, quantity, tenant_id FROM inventory_transactions WHERE item_id = ? AND reference_id = ? AND type = 'reserve' AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
            )
            .bind(itemId, input.reference_id, effectiveTenant)
            .first<{ id: string; quantity: number; tenant_id?: string | null }>();
          if (singleReserve && matchesTenantRow(singleReserve as unknown as Record<string, unknown>, effectiveTenant)) {
            netReserved = Math.abs(Number(singleReserve.quantity ?? 0));
          }
        }
      } catch {
        if (effectiveTenant === 'default') {
          const singleReserve = await db
            .prepare(
              "SELECT id, quantity FROM inventory_transactions WHERE item_id = ? AND reference_id = ? AND type = 'reserve'"
            )
            .bind(itemId, input.reference_id)
            .first<{ id: string; quantity: number }>()
            .catch(() => null);
          if (singleReserve && matchesTenantRow(singleReserve as unknown as Record<string, unknown>, effectiveTenant)) {
            netReserved = Math.abs(Number(singleReserve.quantity ?? 0));
          }
        }
      }
      if (netReserved < Math.abs(qty)) {
        return c.json({ success: false, error: 'No matching reserve transaction found to release' }, 409);
      }
    }

    const currentStock = Math.max(0, Number(item.current_stock ?? 0));
    if (
      (input.type === 'out' || input.type === 'reserve' || input.type === 'waste' || (input.type === 'adjust' && qty < 0)) &&
      currentStock + qty < 0
    ) {
      return c.json(
        {
          success: false,
          error: `Không đủ tồn kho / Insufficient stock (available: ${currentStock}, requested: ${Math.abs(qty)})`,
        },
        409
      );
    }

    const newStock = Math.max(0, currentStock + qty);

    if (newStock < (item.min_stock || 0) && input.type !== 'adjust') {
      const alertPrefix = effectiveTenant ? `${effectiveTenant}:` : '';
      try {
        c.executionCtx?.waitUntil(
          db
            .prepare("INSERT OR IGNORE INTO _alerts (alert_key, message, severity) VALUES (?, ?, 'warning')")
            .bind(
              `${alertPrefix}inventory:${item.sku}:${new Date().toISOString().slice(0, 10)}`,
              `${item.sku}: Tồn kho thấp (${newStock} ${item.unit}) / Low stock alert`
            )
            .run()
            .catch(() => {})
        );
      } catch {
        // waitUntil unavailable in test context — ignore
      }
    }

    let stockUpdateResult: { meta?: { changes?: number } } | undefined;
    const wrapStockUpdate = (stmt: { run: () => Promise<{ meta: { changes: number } }> }) => {
      if (typeof stmt?.run === 'function') {
        const origRun = stmt.run.bind(stmt);
        stmt.run = async () => {
          const res = await origRun();
          stockUpdateResult = res;
          return res;
        };
      }
      return stmt;
    };

    let batchRes: any[] | undefined;
    try {
      const primaryStockUpdateStmt =
        qty < 0
          ? db
              .prepare(
                "UPDATE inventory_items SET current_stock = MAX(0, COALESCE(current_stock, 0) + ?), updated_at = datetime('now') WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? AND COALESCE(current_stock, 0) + ? >= 0"
              )
              .bind(qty, itemId, effectiveTenant, qty)
          : db
              .prepare(
                "UPDATE inventory_items SET current_stock = MAX(0, COALESCE(current_stock, 0) + ?), updated_at = datetime('now') WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?"
              )
              .bind(qty, itemId, effectiveTenant);

      batchRes = await db.batch([
        db
          .prepare(
            'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          )
          .bind(id, itemId, input.type, qty, input.reference_id || null, input.reference_type || null, input.notes || null, effectiveTenant),
        wrapStockUpdate(primaryStockUpdateStmt),
      ]);
    } catch (err) {
      if (effectiveTenant !== 'default') {
        throw err;
      }
      stockUpdateResult = undefined;
      const fallbackStockUpdateStmt =
        qty < 0
          ? db
              .prepare(
                "UPDATE inventory_items SET current_stock = MAX(0, COALESCE(current_stock, 0) + ?), updated_at = datetime('now') WHERE id = ? AND COALESCE(current_stock, 0) + ? >= 0"
              )
              .bind(qty, itemId, qty)
          : db
              .prepare(
                "UPDATE inventory_items SET current_stock = MAX(0, COALESCE(current_stock, 0) + ?), updated_at = datetime('now') WHERE id = ?"
              )
              .bind(qty, itemId);

      batchRes = await db.batch([
        db
          .prepare(
            'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
          )
          .bind(id, itemId, input.type, qty, input.reference_id || null, input.reference_type || null, input.notes || null),
        wrapStockUpdate(fallbackStockUpdateStmt),
      ]);
      await db
        .prepare('UPDATE inventory_transactions SET tenant_id = ? WHERE id = ?')
        .bind(effectiveTenant, id)
        .run()
        .catch(() => {});
    }

    const effectiveStockUpdate = stockUpdateResult ?? batchRes?.[1];
    if (
      qty < 0 &&
      effectiveStockUpdate?.meta &&
      typeof effectiveStockUpdate.meta.changes === 'number' &&
      effectiveStockUpdate.meta.changes === 0
    ) {
      await db
        .prepare('DELETE FROM inventory_transactions WHERE id = ?')
        .bind(id)
        .run()
        .catch(() => {});
      return c.json(
        {
          success: false,
          error: `Không đủ tồn kho / Insufficient stock (concurrent modification, available: ${currentStock}, requested: ${Math.abs(qty)})`,
        },
        409
      );
    }

    return c.json(
      { success: true, data: { id, item_id: itemId, type: input.type, quantity: qty, new_stock: newStock } },
      201
    );
  });
}
