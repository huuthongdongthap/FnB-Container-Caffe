import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { getTenantId } from '../../middleware/tenant';
import {
  VALID_REVENUE_ORDER_SQL,
  buildTenantClause,
  validateDateRangeWindow,
  verifyReportAnalyticsAccess,
} from './analytics-handlers';

const ICT_OFFSET_MS = 7 * 3600_000;

export interface DailyPnlEntry {
  date: string;
  orders: number;
  gross_sales: number;
  discounts: number;
  net_revenue: number;
  refunds: number;
  cogs: number;
  waste_cost: number;
  gross_profit: number;
  gross_margin_pct: number;
}

export interface PnlSummaryReport {
  from: string;
  to: string;
  timezone: 'Asia/Ho_Chi_Minh';
  totals: {
    orders: number;
    gross_sales: number;
    discounts: number;
    net_revenue: number;
    refunds: number;
    cogs: number;
    waste_cost: number;
    gross_profit: number;
    gross_margin_pct: number;
  };
  daily: DailyPnlEntry[];
}

export function registerPnlHandlers(app: Hono<{ Bindings: Env }>) {
  app.get('/pnl', async (c) => {
    const from = c.req.query('from') || new Date(Date.now() + ICT_OFFSET_MS - 30 * 86400_000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date(Date.now() + ICT_OFFSET_MS).toISOString().slice(0, 10);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return c.json({ success: false, error: 'Invalid date format (YYYY-MM-DD required)' }, 400);
    }
    const rangeErr = validateDateRangeWindow(from, to);
    if (rangeErr) {
      return c.json({ success: false, error: rangeErr }, 400);
    }

    const authErr = await verifyReportAnalyticsAccess(c);
    if (authErr) return authErr;

    const db = c.env.AURA_DB;
    const tenantId = getTenantId(c);
    const tf = buildTenantClause(tenantId);
    const invTf = buildTenantClause(tenantId, 'i');

    // 1. Daily Order Revenue & Discounts (Vietnam UTC+7)
    let orderRows: { date: string; orders: number; net_revenue: number; discounts: number }[] = [];
    try {
      const res = await db
        .prepare(
          `SELECT DATE(datetime(created_at, '+7 hours')) as date,
                  COUNT(*) as orders,
                  COALESCE(SUM(total), 0) as net_revenue,
                  COALESCE(SUM(discount), 0) as discounts
           FROM orders
           WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${VALID_REVENUE_ORDER_SQL}${tf.and}
           GROUP BY DATE(datetime(created_at, '+7 hours')) ORDER BY date`
        )
        .bind(from, to, ...tf.binds)
        .all<{ date: string; orders: number; net_revenue: number; discounts: number }>();
      orderRows = res.results || [];
    } catch {
      const res = await db
        .prepare(
          `SELECT DATE(datetime(created_at, '+7 hours')) as date,
                  COUNT(*) as orders,
                  COALESCE(SUM(total), 0) as net_revenue,
                  0 as discounts
           FROM orders
           WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${VALID_REVENUE_ORDER_SQL}${tf.and}
           GROUP BY DATE(datetime(created_at, '+7 hours')) ORDER BY date`
        )
        .bind(from, to, ...tf.binds)
        .all<{ date: string; orders: number; net_revenue: number; discounts: number }>();
      orderRows = res.results || [];
    }

    // 2. Daily Inventory COGS (sale/reserve deductions net of release + BOM stock movements) & Waste Cost (Vietnam UTC+7)
    let invRows: { date: string; cogs: number; waste_cost: number }[] = [];
    try {
      const res = await db
        .prepare(
          `SELECT DATE(datetime(t.created_at, '+7 hours')) as date,
                  MAX(0, COALESCE(SUM(CASE WHEN t.type IN ('out', 'reserve', 'sale') THEN ABS(t.quantity) * COALESCE(i.cost_per_unit, 0) WHEN t.type = 'release' THEN -ABS(t.quantity) * COALESCE(i.cost_per_unit, 0) ELSE 0 END), 0)) as cogs,
                  COALESCE(SUM(CASE WHEN t.type = 'waste' THEN ABS(t.quantity) * COALESCE(i.cost_per_unit, 0) ELSE 0 END), 0) as waste_cost
           FROM inventory_transactions t
           JOIN inventory_items i ON i.id = t.item_id
           WHERE DATE(datetime(t.created_at, '+7 hours')) BETWEEN ? AND ?
             AND t.type IN ('out', 'reserve', 'sale', 'release', 'waste')${invTf.and}
           GROUP BY DATE(datetime(t.created_at, '+7 hours')) ORDER BY date`
        )
        .bind(from, to, ...invTf.binds)
        .all<{ date: string; cogs: number; waste_cost: number }>();
      invRows = res.results || [];
    } catch {
      invRows = [];
    }

    // 2b. BOM Ingredient Stock Movements COGS (when inventory_transactions has no row for a date)
    let bomMovementRows: { date: string; cogs: number }[] = [];
    try {
      const smTf = buildTenantClause(tenantId, 'sm');
      const smRes = await db
        .prepare(
          `SELECT DATE(datetime(sm.created_at, '+7 hours')) as date,
                  MAX(0, COALESCE(SUM(CASE WHEN sm.type IN ('consumption', 'order_deduction', 'deduction', 'out') THEN ABS(sm.quantity) * COALESCE(ing.cost_per_unit, ing.unit_cost, 0) WHEN sm.type IN ('release', 'reversal', 'in_reversal') THEN -ABS(sm.quantity) * COALESCE(ing.cost_per_unit, ing.unit_cost, 0) ELSE 0 END), 0)) as cogs
           FROM stock_movements sm
           JOIN ingredients ing ON ing.id = sm.ingredient_id
           WHERE DATE(datetime(sm.created_at, '+7 hours')) BETWEEN ? AND ?
             AND sm.reference_type = 'order'
             AND sm.type IN ('consumption', 'order_deduction', 'deduction', 'out', 'release', 'reversal', 'in_reversal')${smTf.and}
           GROUP BY DATE(datetime(sm.created_at, '+7 hours')) ORDER BY date`
        )
        .bind(from, to, ...smTf.binds)
        .all<{ date: string; cogs: number }>();
      bomMovementRows = smRes.results || [];
    } catch {
      bomMovementRows = [];
    }

    // 3. Daily Refunds (if refunds table exists)
    let refundRows: { date: string; refunds: number }[] = [];
    try {
      const ordTf = buildTenantClause(tenantId, 'o');
      const res = await db
        .prepare(
          `SELECT DATE(datetime(r.created_at, '+7 hours')) as date,
                  COALESCE(SUM(r.amount), 0) as refunds
           FROM refunds r
           JOIN orders o ON o.id = r.order_id
           WHERE DATE(datetime(r.created_at, '+7 hours')) BETWEEN ? AND ?
             AND r.status IN ('approved', 'completed', 'succeeded')${ordTf.and}
           GROUP BY DATE(datetime(r.created_at, '+7 hours')) ORDER BY date`
        )
        .bind(from, to, ...ordTf.binds)
        .all<{ date: string; refunds: number }>();
      refundRows = res.results || [];
    } catch {
      refundRows = [];
    }

    const dates = new Set<string>();
    for (const r of orderRows) if (r.date) dates.add(r.date);
    for (const r of invRows) if (r.date) dates.add(r.date);
    for (const r of bomMovementRows) if (r.date) dates.add(r.date);
    for (const r of refundRows) if (r.date) dates.add(r.date);

    const orderMap = new Map(orderRows.map((r) => [r.date, r]));
    const invMap = new Map(invRows.map((r) => [r.date, r]));
    const bomMap = new Map(bomMovementRows.map((r) => [r.date, r]));
    const refundMap = new Map(refundRows.map((r) => [r.date, r]));

    const daily: DailyPnlEntry[] = [...dates].sort().map((date) => {
      const o = orderMap.get(date);
      const inv = invMap.get(date);
      const bom = bomMap.get(date);
      const ref = refundMap.get(date);
      const orders = Number(o?.orders || 0);
      const netRevenue = Math.round(Number(o?.net_revenue || 0));
      const discounts = Math.round(Number(o?.discounts || 0));
      const grossSales = netRevenue + discounts;
      const refunds = Math.round(Number(ref?.refunds || 0));
      const invCogs = Math.round(Number(inv?.cogs || 0));
      const bomCogs = Math.round(Number(bom?.cogs || 0));
      const cogs = invCogs > 0 ? invCogs : bomCogs;
      const wasteCost = Math.round(Number(inv?.waste_cost || 0));
      const grossProfit = netRevenue - refunds - cogs - wasteCost;
      const grossMarginPct =
        netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 1000) / 10 : 0;

      return {
        date,
        orders,
        gross_sales: grossSales,
        discounts,
        net_revenue: netRevenue,
        refunds,
        cogs,
        waste_cost: wasteCost,
        gross_profit: grossProfit,
        gross_margin_pct: grossMarginPct,
      };
    });

    const totals = daily.reduce(
      (acc, d) => {
        acc.orders += d.orders;
        acc.gross_sales += d.gross_sales;
        acc.discounts += d.discounts;
        acc.net_revenue += d.net_revenue;
        acc.refunds += d.refunds;
        acc.cogs += d.cogs;
        acc.waste_cost += d.waste_cost;
        acc.gross_profit += d.gross_profit;
        return acc;
      },
      {
        orders: 0,
        gross_sales: 0,
        discounts: 0,
        net_revenue: 0,
        refunds: 0,
        cogs: 0,
        waste_cost: 0,
        gross_profit: 0,
        gross_margin_pct: 0,
      }
    );
    totals.gross_margin_pct =
      totals.net_revenue > 0 ? Math.round((totals.gross_profit / totals.net_revenue) * 1000) / 10 : 0;

    const payload: PnlSummaryReport = {
      from,
      to,
      timezone: 'Asia/Ho_Chi_Minh',
      totals,
      daily,
    };

    return c.json({ success: true, data: payload });
  });
}
