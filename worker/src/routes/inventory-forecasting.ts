/**
 * Predictive Inventory Forecasting Router
 * Calculates depletion run-rate (v_run), Days-of-Supply (DOS), and stock-out alerts.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { requireAuth } from '../middleware/auth';
import { getTenantId } from '../middleware/tenant';
import type { InventoryForecastItem } from '../types/api';

export const inventoryForecastingRouter = new Hono<{ Bindings: Env }>();

inventoryForecastingRouter.use('/*', requireAuth(['owner', 'manager', 'staff']));

interface InventoryRow {
  id: string;
  sku: string;
  name: string;
  current_stock: number;
  min_stock?: number;
  max_stock?: number;
  unit?: string;
}

// GET /api/inventory/forecasting/run-rate
inventoryForecastingRouter.get('/run-rate', async (c) => {
  const tenantId = c.req.query('tenant_id') || getTenantId(c);
  const days = Math.max(1, Math.min(30, parseInt(c.req.query('days') || '7', 10)));
  const leadTimeDays = Math.max(1, Math.min(14, parseInt(c.req.query('lead_time_days') || '2', 10)));
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

  const { results: items } = await db.prepare(`
    SELECT id, sku, name, current_stock, min_stock, max_stock, unit
    FROM inventory_items
    WHERE tenant_id = ? AND active = 1
    ORDER BY sku ASC
  `).bind(tenantId).all<InventoryRow>();

  if (!items || items.length === 0) {
    return c.json({ success: true, data: [] });
  }

  const startDate = new Date(Date.now() - days * 86400000).toISOString();

  // Query transaction depletion per item
  const { results: depletions } = await db.prepare(`
    SELECT inventory_item_id, SUM(ABS(quantity)) as total_depleted
    FROM inventory_transactions
    WHERE created_at >= ? AND type IN ('out', 'reserve', 'waste')
    GROUP BY inventory_item_id
  `).bind(startDate).all<{ inventory_item_id: string; total_depleted: number }>();

  const depletionMap = new Map<string, number>();
  for (const d of depletions || []) {
    depletionMap.set(d.inventory_item_id, Number(d.total_depleted || 0));
  }

  const forecastData: InventoryForecastItem[] = items.map((item) => {
    const totalDepleted = depletionMap.get(item.id) || 0;
    const dailyRunRate = Math.round((totalDepleted / days) * 100) / 100;
    const currentStock = Number(item.current_stock || 0);
    const maxStock = Number(item.max_stock || item.min_stock ? (item.min_stock || 10) * 3 : 50);

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
      item_id: item.id,
      item_sku: item.sku,
      item_name: item.name,
      current_stock: currentStock,
      daily_run_rate: dailyRunRate,
      days_of_supply: daysOfSupply,
      risk_level: riskLevel,
      suggested_reorder_qty: suggestedReorder,
      unit: item.unit || 'phần',
      lead_time_days: leadTimeDays
    };
  });

  return c.json({ success: true, data: forecastData, evaluated_days: days });
});

// POST /api/inventory/forecasting/snapshot
inventoryForecastingRouter.post('/snapshot', async (c) => {
  const tenantId = getTenantId(c);
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;
  const snapshotDate = new Date().toISOString().slice(0, 10);

  // Call run-rate logic internally
  const { results: items } = await db.prepare(`
    SELECT id, sku, name, current_stock, min_stock, max_stock
    FROM inventory_items WHERE tenant_id = ? AND active = 1
  `).bind(tenantId).all<InventoryRow>();

  if (!items || items.length === 0) {
    return c.json({ success: true, message: 'No items to snapshot', count: 0 });
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
  const { results: depletions } = await db.prepare(`
    SELECT inventory_item_id, SUM(ABS(quantity)) as total_depleted
    FROM inventory_transactions
    WHERE created_at >= ? AND type IN ('out', 'reserve', 'waste')
    GROUP BY inventory_item_id
  `).bind(sevenDaysAgo).all<{ inventory_item_id: string; total_depleted: number }>();

  const depMap = new Map<string, number>();
  for (const d of depletions || []) depMap.set(d.inventory_item_id, Number(d.total_depleted || 0));

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

    const max = Number(it.max_stock || 50);
    const reorder = Math.max(0, Math.round((max - stock + rate * 2) * 10) / 10);
    const id = `snap_${tenantId}_${it.sku}_${snapshotDate}`;

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
    `).bind(id, tenantId, it.sku, it.name, rate, stock, dos, risk, reorder, snapshotDate));
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
  const tenantId = c.req.query('tenant_id') || getTenantId(c);
  const sku = c.req.query('item_sku');
  const limit = Math.min(60, parseInt(c.req.query('limit') || '30', 10));
  const db = (c.env.AURA_DB ?? (c.env as Record<string, unknown>).DB) as import('@cloudflare/workers-types').D1Database;

  let query = 'SELECT * FROM inventory_forecast_snapshots WHERE tenant_id = ?';
  const params: unknown[] = [tenantId];
  if (sku) {
    query += ' AND item_sku = ?';
    params.push(sku);
  }
  query += ' ORDER BY snapshot_date DESC LIMIT ?';
  params.push(limit);

  const { results } = await db.prepare(query).bind(...params).all<Record<string, unknown>>();
  return c.json({ success: true, data: results || [] });
});
