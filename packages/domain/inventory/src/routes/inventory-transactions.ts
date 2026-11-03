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

export function inventoryTransactions(app: Hono<AppContext>) {
  app.get('/:id/transactions', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
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

    let results: Record<string, unknown>[] = [];
    if (tenantId && tenantId !== '*') {
      try {
        const res = await db
          .prepare("SELECT * FROM inventory_transactions WHERE item_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? ORDER BY created_at DESC LIMIT ?")
          .bind(itemId, tenantId, limit)
          .all<Record<string, unknown>>();
        results = res.results || [];
      } catch {
        const res = await db
          .prepare('SELECT * FROM inventory_transactions WHERE item_id = ? ORDER BY created_at DESC LIMIT ?')
          .bind(itemId, limit)
          .all<Record<string, unknown>>();
        results = (res.results || []).filter((r) => matchesTenantRow(r, tenantId));
      }
    } else {
      const res = await db
        .prepare('SELECT * FROM inventory_transactions WHERE item_id = ? ORDER BY created_at DESC LIMIT ?')
        .bind(itemId, limit)
        .all<Record<string, unknown>>();
      results = res.results || [];
    }

    return c.json({ success: true, data: { transactions: results } });
  });

  app.post('/:id/transactions', async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c).trim() || 'default';
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
    const INVENTORY_MUTATION_ROLES = ['owner', 'manager', 'supervisor', 'admin'];
    const INVENTORY_OUTBOUND_ROLES = [...INVENTORY_MUTATION_ROLES, 'kitchen', 'barista', 'chef'];
    const userRole = (c as unknown as { get?: (k: string) => { role?: string } | undefined }).get?.('user')?.role;
    if (
      userRole &&
      (input.type === 'in' ||
        input.type === 'adjust' ||
        input.type === 'release' ||
        input.type === 'reserve') &&
      !INVENTORY_MUTATION_ROLES.includes(userRole)
    ) {
      return c.json({ success: false, error: 'Insufficient permissions for stock adjustment' }, 403);
    }
    if (userRole && ['waste', 'out'].includes(input.type) && !INVENTORY_OUTBOUND_ROLES.includes(userRole)) {
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

    if (input.type === 'release' && (!userRole || !INVENTORY_MUTATION_ROLES.includes(userRole) || input.reference_id)) {
      if (!input.reference_id || !String(input.reference_id).trim()) {
        return c.json({ success: false, error: 'Release transaction requires a valid reservation reference_id' }, 400);
      }
      const reserveRow = await db
        .prepare(
          "SELECT id, quantity FROM inventory_transactions WHERE item_id = ? AND reference_id = ? AND type = 'reserve'"
        )
        .bind(itemId, input.reference_id)
        .first<{ id: string; quantity: number }>()
        .catch(() => null);
      if (!reserveRow || Math.abs(Number(reserveRow.quantity ?? 0)) < Math.abs(qty)) {
        return c.json({ success: false, error: 'No matching reserve transaction found to release' }, 409);
      }
    }

    const currentStock = Math.max(0, Number(item.current_stock ?? 0));
    if ((input.type === 'out' || input.type === 'reserve') && currentStock + qty < 0) {
      return c.json(
        {
          success: false,
          error: `Không đủ tồn kho / Insufficient stock (available: ${currentStock}, requested: ${Math.abs(qty)})`,
        },
        409
      );
    }
    if (currentStock + qty < 0) {
      qty = -currentStock;
    }

    const newStock = Math.max(0, currentStock + qty);

    const itemTenant = 'tenant_id' in item && item.tenant_id !== undefined
      ? ((typeof item.tenant_id === 'string' && item.tenant_id.trim()) || 'default')
      : null;
    const effectiveTenant = tenantId && tenantId !== '*' ? tenantId.trim() || 'default' : itemTenant;

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

    try {
      await db.batch([
        effectiveTenant
          ? db
              .prepare(
                'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
              )
              .bind(id, itemId, input.type, qty, input.reference_id || null, input.reference_type || null, input.notes || null, effectiveTenant)
          : db
              .prepare(
                'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
              )
              .bind(id, itemId, input.type, qty, input.reference_id || null, input.reference_type || null, input.notes || null),
        effectiveTenant
          ? db
              .prepare("UPDATE inventory_items SET current_stock = MAX(0, COALESCE(current_stock, 0) + ?), updated_at = datetime('now') WHERE id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?")
              .bind(qty, itemId, effectiveTenant)
          : db
              .prepare("UPDATE inventory_items SET current_stock = MAX(0, COALESCE(current_stock, 0) + ?), updated_at = datetime('now') WHERE id = ?")
              .bind(qty, itemId),
      ]);
    } catch {
      await db.batch([
        db
          .prepare(
            'INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, notes) VALUES (?, ?, ?, ?, ?, ?, ?)'
          )
          .bind(id, itemId, input.type, qty, input.reference_id || null, input.reference_type || null, input.notes || null),
        db
          .prepare("UPDATE inventory_items SET current_stock = MAX(0, COALESCE(current_stock, 0) + ?), updated_at = datetime('now') WHERE id = ?")
          .bind(qty, itemId),
      ]);
      if (effectiveTenant) {
        await db
          .prepare('UPDATE inventory_transactions SET tenant_id = ? WHERE id = ?')
          .bind(effectiveTenant, id)
          .run()
          .catch(() => {});
      }
    }

    return c.json(
      { success: true, data: { id, item_id: itemId, type: input.type, quantity: qty, new_stock: newStock } },
      201
    );
  });
}
