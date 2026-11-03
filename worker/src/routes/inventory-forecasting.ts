/**
 * Predictive Inventory Forecasting Router
 * Calculates depletion run-rate (v_run), Days-of-Supply (DOS), and stock-out alerts.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { getTenantId } from '../middleware/tenant';
import { matchesTenantRow } from '../lib/db';
import type { InventoryForecastItem } from '../types/api';

export const inventoryForecastingRouter = new Hono<{ Bindings: Env }>();

inventoryForecastingRouter.use('/*', requireAuth(['owner', 'admin', 'manager', 'supervisor', 'staff']));

interface InventoryRow {
  id: string;
  sku: string;
  name: string;
  current_stock: number;
  min_stock?: number;
  max_stock?: number;
  unit?: string;
  tenant_id?: string | null;
}

async function queryTenantDepletions(
  db: import('@cloudflare/workers-types').D1Database,
  startDate: string,
  tenantId: string,
  allowedItemIds?: Set<string>
): Promise<{ item_id: string; total_depleted: number }[]> {
  const filterRows = (rows: { item_id: string; total_depleted: number; tenant_id?: string | null }[]) =>
    (rows || []).filter((r) => {
      const raw = r as unknown as { item_id?: string; inventory_item_id?: string; ingredient_id?: string };
      const id = raw.item_id || raw.inventory_item_id || raw.ingredient_id;
      const hasTenantProp = 'tenant_id' in r && r.tenant_id !== undefined;
      if (hasTenantProp) {
        if (!matchesTenantRow(r as unknown as Record<string, unknown>, tenantId)) return false;
      } else if (allowedItemIds && allowedItemIds.size > 0) {
        if (!id || !allowedItemIds.has(id)) return false;
      } else if (!matchesTenantRow(r as unknown as Record<string, unknown>, tenantId)) {
        return false;
      }
      if (allowedItemIds && allowedItemIds.size > 0) {
        if (id && !allowedItemIds.has(id)) return false;
      }
      return true;
    });

  const queryStockMovementDepletions = async () => {
    try {
      const res = await db.prepare(`
        SELECT ingredient_id as item_id, SUM(ABS(quantity)) as total_depleted, tenant_id
        FROM stock_movements
        WHERE created_at >= ? AND (type IN ('out', 'consumption', 'sale', 'waste') OR (type = 'adjustment' AND quantity < 0))
          AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
        GROUP BY ingredient_id, tenant_id
      `).bind(startDate, tenantId, tenantId).all<{ item_id: string; total_depleted: number; tenant_id?: string | null }>();
      return filterRows(res.results || []);
    } catch {
      try {
        const res = await db.prepare(`
          SELECT ingredient_id as item_id, SUM(ABS(quantity)) as total_depleted, tenant_id
          FROM stock_movements
          WHERE created_at >= ? AND (type IN ('out', 'consumption', 'sale', 'waste') OR (type = 'adjustment' AND quantity < 0))
          GROUP BY ingredient_id, tenant_id
        `).bind(startDate).all<{ item_id: string; total_depleted: number; tenant_id?: string | null }>();
        return filterRows(res.results || []);
      } catch {
        try {
          const res = await db.prepare(`
            SELECT ingredient_id as item_id, SUM(ABS(quantity)) as total_depleted
            FROM stock_movements
            WHERE created_at >= ? AND (type IN ('out', 'consumption', 'sale', 'waste') OR (type = 'adjustment' AND quantity < 0))
            GROUP BY ingredient_id
          `).bind(startDate).all<{ item_id: string; total_depleted: number; tenant_id?: string | null }>();
          return filterRows(res.results || []);
        } catch {
          return [];
        }
      }
    }
  };

  let depletions: { item_id: string; total_depleted: number; tenant_id?: string | null }[] = [];
  try {
    const res = await db.prepare(`
      SELECT item_id, SUM(ABS(quantity)) as total_depleted, tenant_id
      FROM inventory_transactions
      WHERE created_at >= ? AND type IN ('out', 'reserve', 'waste')
        AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
      GROUP BY item_id, tenant_id
    `).bind(startDate, tenantId, tenantId).all<{ item_id: string; total_depleted: number; tenant_id?: string | null }>();
    depletions = filterRows(res.results || []);
  } catch {
    try {
      const res = await db.prepare(`
        SELECT inventory_item_id as item_id, SUM(ABS(quantity)) as total_depleted, tenant_id
        FROM inventory_transactions
        WHERE created_at >= ? AND type IN ('out', 'reserve', 'waste')
          AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)
        GROUP BY inventory_item_id, tenant_id
      `).bind(startDate, tenantId, tenantId).all<{ item_id: string; total_depleted: number; tenant_id?: string | null }>();
      depletions = filterRows(res.results || []);
    } catch {
      try {
        const res = await db.prepare(`
          SELECT item_id, SUM(ABS(quantity)) as total_depleted
          FROM inventory_transactions
          WHERE created_at >= ? AND type IN ('out', 'reserve', 'waste')
          GROUP BY item_id
        `).bind(startDate).all<{ item_id: string; total_depleted: number; tenant_id?: string | null }>();
        depletions = filterRows(res.results || []);
      } catch {
        try {
          const res = await db.prepare(`
            SELECT inventory_item_id as item_id, SUM(ABS(quantity)) as total_depleted
            FROM inventory_transactions
            WHERE created_at >= ? AND type IN ('out', 'reserve', 'waste')
            GROUP BY inventory_item_id
          `).bind(startDate).all<{ item_id: string; total_depleted: number; tenant_id?: string | null }>();
          depletions = filterRows(res.results || []);
        } catch {
          depletions = await queryStockMovementDepletions();
        }
      }
    }
  }

  if (depletions.length === 0) {
    depletions = await queryStockMovementDepletions();
  }
  return depletions;
}

async function queryTenantInventoryItems(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string,
  includeUnit = true
): Promise<InventoryRow[]> {
  const unitCol = includeUnit ? ', unit' : '';
  let items: InventoryRow[] = [];
  let hasTenantCol = true;
  try {
    const res = await db.prepare(`
      SELECT id, sku, name, current_stock, min_stock, max_stock${unitCol}, tenant_id
      FROM inventory_items
      WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) AND active = 1
      ORDER BY sku ASC
    `).bind(tenantId, tenantId).all<InventoryRow>();
    items = (res.results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/no such column:\s*tenant_id/i.test(msg)) {
      hasTenantCol = false;
    } else if (/no such column:\s*max_stock/i.test(msg)) {
      try {
        const res = await db.prepare(`
          SELECT id, sku, name, current_stock, min_stock${unitCol}, tenant_id
          FROM inventory_items
          WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) AND active = 1
          ORDER BY sku ASC
        `).bind(tenantId, tenantId).all<InventoryRow>();
        items = (res.results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
      } catch {
        hasTenantCol = false;
      }
    } else {
      try {
        const res = await db.prepare(`
          SELECT id, COALESCE(sku, id) AS sku, name, current_stock, min_stock, max_stock${unitCol}, tenant_id
          FROM inventory_items
          WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) AND COALESCE(active, is_active, 1) = 1
          ORDER BY COALESCE(sku, id) ASC
        `).bind(tenantId, tenantId).all<InventoryRow>();
        items = (res.results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
      } catch {
        try {
          const res = await db.prepare(`
            SELECT id, COALESCE(sku, id) AS sku, name, current_stock, min_stock${unitCol}, tenant_id
            FROM inventory_items
            WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) AND COALESCE(active, is_active, 1) = 1
            ORDER BY COALESCE(sku, id) ASC
          `).bind(tenantId, tenantId).all<InventoryRow>();
          items = (res.results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
        } catch {
          hasTenantCol = false;
        }
      }
    }
  }
  if ((!hasTenantCol || items.length === 0) && (tenantId === 'default' || tenantId === '*')) {
    try {
      const res = await db.prepare(`
        SELECT id, COALESCE(sku, id) AS sku, name, current_stock, min_stock, max_stock${unitCol}
        FROM inventory_items
        WHERE COALESCE(active, is_active, 1) = 1
        ORDER BY COALESCE(sku, id) ASC
      `).all<InventoryRow>();
      items = (res.results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
    } catch {
      try {
        const res = await db.prepare(`
          SELECT id, COALESCE(sku, id) AS sku, name, current_stock, min_stock${unitCol}
          FROM inventory_items
          WHERE COALESCE(active, is_active, 1) = 1
          ORDER BY COALESCE(sku, id) ASC
        `).all<InventoryRow>();
        items = (res.results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
      } catch {
        items = [];
      }
    }
  }
  if (items.length === 0 && tenantId === 'default') {
    try {
      const res = await db.prepare(`
        SELECT id, COALESCE(sku, id) AS sku, name, current_stock, min_stock, max_stock${unitCol}
        FROM ingredients
        WHERE is_active = 1
        ORDER BY id ASC
      `).all<InventoryRow>();
      items = (res.results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
    } catch {
      try {
        const res = await db.prepare(`
          SELECT id, COALESCE(sku, id) AS sku, name, current_stock, min_stock${unitCol}
          FROM ingredients
          WHERE is_active = 1
          ORDER BY id ASC
        `).all<InventoryRow>();
        items = (res.results || []).filter((r) => matchesTenantRow(r as unknown as Record<string, unknown>, tenantId));
      } catch {
        items = [];
      }
    }
  }
  return items;
}

function resolveMaxStock(item: { max_stock?: number | null; min_stock?: number | null }): number {
  return Number(item.max_stock) > 0
    ? Number(item.max_stock)
    : (Number(item.min_stock) > 0 ? Number(item.min_stock) * 3 : 50);
}

function buildDepletionMap(depletions: { item_id: string; total_depleted: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const d of depletions || []) {
    const raw = d as unknown as { inventory_item_id?: string; ingredient_id?: string };
    const itemId = d.item_id || raw.inventory_item_id || raw.ingredient_id;
    if (itemId) {
      map.set(itemId, (map.get(itemId) || 0) + Number(d.total_depleted || 0));
    }
  }
  return map;
}

// GET /api/inventory/forecasting/run-rate
inventoryForecastingRouter.get('/run-rate', async (c) => {
  const tenantId = getTenantId(c);
  const rawDays = parseInt(c.req.query('days') || '7', 10);
  const days = Number.isFinite(rawDays) ? Math.max(1, Math.min(30, rawDays)) : 7;
  const rawLeadTime = parseInt(c.req.query('lead_time_days') || '2', 10);
  const leadTimeDays = Number.isFinite(rawLeadTime) ? Math.max(1, Math.min(14, rawLeadTime)) : 2;
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

  const items = await queryTenantInventoryItems(db, tenantId, true);

  if (!items || items.length === 0) {
    return c.json({ success: true, data: [] });
  }

  const startDate = new Date(Date.now() - days * 86400000).toISOString();
  const allowedItemIds = new Set(items.map((it) => it.id));

  // Query transaction depletion per item (with tenant scoping + fallback across schema variants)
  const depletions = await queryTenantDepletions(db, startDate, tenantId, allowedItemIds);
  const depletionMap = buildDepletionMap(depletions);

  const forecastData: InventoryForecastItem[] = items.map((item) => {
    const totalDepleted = depletionMap.get(item.id) || 0;
    const dailyRunRate = Math.round((totalDepleted / days) * 100) / 100;
    const currentStock = Number(item.current_stock || 0);
    const maxStock = resolveMaxStock(item);

    let daysOfSupply = 999.0;
    let riskLevel: 'CRITICAL' | 'WARNING' | 'HEALTHY' = 'HEALTHY';

    if (dailyRunRate > 0) {
      daysOfSupply = Math.round((currentStock / dailyRunRate) * 10) / 10;
      if (daysOfSupply <= 2.0) {
        riskLevel = 'CRITICAL';
      } else if (daysOfSupply <= 5.0) {
        riskLevel = 'WARNING';
      }
    } else if (currentStock <= (item.min_stock || 5)) {
      riskLevel = 'WARNING';
      daysOfSupply = 5.0;
    }

    const projectedDepletion = dailyRunRate * leadTimeDays;
    const suggestedReorder = Math.max(0, Math.round((maxStock - currentStock + projectedDepletion) * 10) / 10);

    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      item_id: item.id,
      item_sku: item.sku,
      item_name: item.name,
      current_stock: currentStock,
      daily_run_rate: dailyRunRate,
      days_of_supply: daysOfSupply,
      risk_level: riskLevel,
      suggested_reorder_qty: suggestedReorder,
      recommended_reorder_qty: suggestedReorder,
      unit: item.unit || 'phần',
      lead_time_days: leadTimeDays
    } as unknown as InventoryForecastItem;
  });

  return c.json({ success: true, data: forecastData, evaluated_days: days });
});

// POST /api/inventory/forecasting/snapshot
inventoryForecastingRouter.post('/snapshot', requireAuth(['owner', 'manager', 'supervisor', 'admin']), async (c) => {
  const user = c.get('user' as never) as { role?: string } | undefined;
  if (user?.role && !['owner', 'manager', 'supervisor', 'admin'].includes(user.role)) {
    return c.json({ success: false, error: 'Insufficient permissions' }, 403);
  }
  const tenantId = getTenantId(c);
  const snapshotTenant = tenantId === '*' ? 'default' : tenantId;
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const snapshotDate = new Date().toISOString().slice(0, 10);

  // Call run-rate logic internally with schema fallbacks
  const items = await queryTenantInventoryItems(db, tenantId, false);

  if (!items || items.length === 0) {
    return c.json({ success: true, message: 'No items to snapshot', count: 0 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const allowedItemIds = new Set(items.map((it) => it.id));
  const depletions = await queryTenantDepletions(db, sevenDaysAgo, tenantId, allowedItemIds);
  const depMap = buildDepletionMap(depletions);

  const stmts: import('@cloudflare/workers-types').D1PreparedStatement[] = [];
  let critical = 0;
  let warning = 0;

  for (const it of items) {
    const rate = Math.round(((depMap.get(it.id) || 0) / 7) * 100) / 100;
    const stock = Number(it.current_stock || 0);
    const dos = rate > 0 ? Math.round((stock / rate) * 10) / 10 : 999.0;
    let risk = 'HEALTHY';
    if (dos <= 2.0 && rate > 0) { risk = 'CRITICAL'; critical++; }
    else if ((dos <= 5.0 && rate > 0) || stock <= (it.min_stock || 5)) { risk = 'WARNING'; warning++; }

    const max = resolveMaxStock(it);
    const reorder = Math.max(0, Math.round((max - stock + rate * 2) * 10) / 10);
    const itemTenant = (it.tenant_id && String(it.tenant_id).trim()) ? String(it.tenant_id).trim() : snapshotTenant;
    const id = `snap_${itemTenant}_${it.sku}_${snapshotDate}`;

    stmts.push(db.prepare(`
      INSERT INTO inventory_forecast_snapshots (
        id, tenant_id, item_sku, item_name, daily_run_rate, current_stock,
        days_of_supply, risk_level, suggested_reorder_qty, lead_time_days, snapshot_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 2, ?)
      ON CONFLICT(id) DO UPDATE SET
        daily_run_rate = excluded.daily_run_rate,
        current_stock = excluded.current_stock,
        days_of_supply = excluded.days_of_supply,
        risk_level = excluded.risk_level,
        suggested_reorder_qty = excluded.suggested_reorder_qty
    `).bind(id, itemTenant, it.sku, it.name, rate, stock, dos, risk, reorder, snapshotDate));
  }

  for (let i = 0; i < stmts.length; i += 50) {
    await db.batch(stmts.slice(i, i + 50));
  }

  return c.json({
    success: true,
    message: `Snapshot created for ${items.length} items`,
    snapshot_date: snapshotDate,
    critical_alerts: critical,
    warning_alerts: warning
  });
});

// GET /api/inventory/forecasting/history
inventoryForecastingRouter.get('/history', async (c) => {
  const tenantId = getTenantId(c);
  const sku = c.req.query('item_sku');
  const rawLimit = parseInt(c.req.query('limit') || '30', 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(60, Math.max(1, rawLimit)) : 30;
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

  let query = "SELECT * FROM inventory_forecast_snapshots WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)";
  const params: unknown[] = [tenantId, tenantId];
  if (sku) {
    query += ' AND item_sku = ?';
    params.push(sku);
  }
  query += ' ORDER BY snapshot_date DESC LIMIT ?';
  params.push(limit);

  let results: Record<string, unknown>[] = [];
  try {
    const res = await db.prepare(query).bind(...params).all<Record<string, unknown>>();
    results = res.results || [];
  } catch {
    if (tenantId === 'default' || tenantId === '*') {
      let fallbackQuery = 'SELECT * FROM inventory_forecast_snapshots';
      const fallbackParams: unknown[] = [];
      if (sku) {
        fallbackQuery += ' WHERE item_sku = ?';
        fallbackParams.push(sku);
      }
      fallbackQuery += ' ORDER BY snapshot_date DESC LIMIT ?';
      fallbackParams.push(limit);
      try {
        const res = await db.prepare(fallbackQuery).bind(...fallbackParams).all<Record<string, unknown>>();
        results = res.results || [];
      } catch {
        results = [];
      }
    }
  }
  const filtered = (results || []).filter((r) => matchesTenantRow(r, tenantId));
  return c.json({ success: true, data: filtered });
});
