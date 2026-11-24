import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { getTenantId } from '../../middleware/tenant';
import {
  VALID_REVENUE_ORDER_ALIAS_SQL,
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
  shipping_fee: number;
  service_fee: number;
  tip_amount: number;
  total_collected: number;
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
    shipping_fee: number;
    service_fee: number;
    tip_amount: number;
    total_collected: number;
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
    let orderRows: {
      date: string;
      orders: number;
      total_collected: number;
      shipping_fee: number;
      service_fee: number;
      tip_amount: number;
      discounts: number;
    }[] = [];
    try {
      const res = await db
        .prepare(
          `SELECT DATE(datetime(created_at, '+7 hours')) as date,
                  COUNT(*) as orders,
                  COALESCE(SUM(total), 0) as total_collected,
                  COALESCE(SUM(shipping_fee), 0) as shipping_fee,
                  COALESCE(SUM(service_fee), 0) as service_fee,
                  COALESCE(SUM(tip_amount), 0) as tip_amount,
                  COALESCE(SUM(discount), 0) as discounts
           FROM orders
           WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${VALID_REVENUE_ORDER_SQL}${tf.and}
           GROUP BY DATE(datetime(created_at, '+7 hours')) ORDER BY date`
        )
        .bind(from, to, ...tf.binds)
        .all<{
          date: string;
          orders: number;
          total_collected: number;
          shipping_fee: number;
          service_fee: number;
          tip_amount: number;
          discounts: number;
        }>();
      orderRows = res.results || [];
    } catch {
      const res = await db
        .prepare(
          `SELECT DATE(datetime(created_at, '+7 hours')) as date,
                  COUNT(*) as orders,
                  COALESCE(SUM(total), 0) as total_collected,
                  0 as shipping_fee,
                  0 as service_fee,
                  0 as tip_amount,
                  COALESCE(SUM(discount), 0) as discounts
           FROM orders
           WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${VALID_REVENUE_ORDER_SQL}${tf.and}
           GROUP BY DATE(datetime(created_at, '+7 hours')) ORDER BY date`
        )
        .bind(from, to, ...tf.binds)
        .all<{
          date: string;
          orders: number;
          total_collected: number;
          shipping_fee: number;
          service_fee: number;
          tip_amount: number;
          discounts: number;
        }>();
      orderRows = res.results || [];
    }

    // 2. Daily Inventory COGS (sale/reserve deductions net of release) & Waste Cost (Vietnam UTC+7)
    // Exclude order rows already recorded in stock_movements to avoid double-counting bom-policy dual writes.
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
             AND t.type IN ('out', 'reserve', 'sale', 'release', 'waste')
             AND NOT (
               t.reference_type = 'order'
               AND t.reference_id IS NOT NULL
               AND EXISTS (
                 SELECT 1 FROM stock_movements sm
                 WHERE sm.reference_type = 'order'
                   AND sm.reference_id = t.reference_id
                   AND sm.ingredient_id = t.item_id
                   AND COALESCE(NULLIF(TRIM(sm.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(i.tenant_id), ''), 'default')
               )
             )${invTf.and}
           GROUP BY DATE(datetime(t.created_at, '+7 hours')) ORDER BY date`
        )
        .bind(from, to, ...invTf.binds)
        .all<{ date: string; cogs: number; waste_cost: number }>();
      invRows = res.results || [];
    } catch {
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
    }

    // 2b. BOM Ingredient Stock Movements COGS & Waste (consumption net of cancelled-order restock/reversal + waste)
    let bomMovementRows: { date: string; cogs: number; waste_cost: number }[] = [];
    try {
      const smTf = buildTenantClause(tenantId, 'sm');
      const smRes = await db
        .prepare(
          `SELECT DATE(datetime(sm.created_at, '+7 hours')) as date,
                  MAX(0, COALESCE(SUM(
                    CASE
                      WHEN sm.reference_type = 'order' AND sm.type IN ('consumption', 'order_consumption', 'order_deduction', 'deduction', 'out')
                        THEN ABS(sm.quantity) * COALESCE(ing.cost_per_unit, 0)
                      WHEN sm.reference_type = 'order' AND sm.type IN ('release', 'reversal', 'in_reversal', 'adjustment', 'waste')
                        THEN -ABS(sm.quantity) * COALESCE(ing.cost_per_unit, 0)
                      ELSE 0
                    END
                  ), 0)) as cogs,
                  COALESCE(SUM(
                    CASE WHEN sm.type = 'waste' THEN ABS(sm.quantity) * COALESCE(ing.cost_per_unit, 0) ELSE 0 END
                  ), 0) as waste_cost
           FROM stock_movements sm
           JOIN ingredients ing ON ing.id = sm.ingredient_id
           WHERE DATE(datetime(sm.created_at, '+7 hours')) BETWEEN ? AND ?
             AND (
               (sm.reference_type = 'order' AND sm.type IN ('consumption', 'order_consumption', 'order_deduction', 'deduction', 'out', 'release', 'reversal', 'in_reversal', 'adjustment', 'waste'))
               OR sm.type = 'waste'
             )${smTf.and}
           GROUP BY DATE(datetime(sm.created_at, '+7 hours')) ORDER BY date`
        )
        .bind(from, to, ...smTf.binds)
        .all<{ date: string; cogs: number; waste_cost: number }>();
      bomMovementRows = smRes.results || [];
    } catch {
      bomMovementRows = [];
    }

    // 3. Daily Refunds on recognized-revenue orders (excludes fully refunded orders already omitted from orderRows)
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
             AND r.status IN ('approved', 'completed', 'succeeded')
             AND ${VALID_REVENUE_ORDER_ALIAS_SQL}${ordTf.and}
           GROUP BY DATE(datetime(r.created_at, '+7 hours')) ORDER BY date`
        )
        .bind(from, to, ...ordTf.binds)
        .all<{ date: string; refunds: number }>();
      refundRows = res.results || [];
    } catch {
      // No refunds table → derive refunds from the payments refund ledger for recognized-revenue orders.
      try {
        const pTf = buildTenantClause(tenantId, 'p');
        const res = await db
          .prepare(
            `SELECT DATE(datetime(COALESCE(p.refunded_at, p.updated_at, p.created_at), '+7 hours')) as date,
                    COALESCE(SUM(p.refund_amount), 0) as refunds
             FROM payments p
             JOIN orders o ON o.id = p.order_id
             WHERE DATE(datetime(COALESCE(p.refunded_at, p.updated_at, p.created_at), '+7 hours')) BETWEEN ? AND ?
               AND COALESCE(p.refund_amount, 0) > 0
               AND ${VALID_REVENUE_ORDER_ALIAS_SQL}${pTf.and}
             GROUP BY DATE(datetime(COALESCE(p.refunded_at, p.updated_at, p.created_at), '+7 hours')) ORDER BY date`
          )
          .bind(from, to, ...pTf.binds)
          .all<{ date: string; refunds: number }>();
        refundRows = res.results || [];
      } catch {
        refundRows = [];
      }
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
      const totalCollected = Math.round(Number(o?.total_collected || 0));
      const shippingFee = Math.round(Number(o?.shipping_fee || 0));
      const serviceFee = Math.round(Number(o?.service_fee || 0));
      const tipAmount = Math.round(Number(o?.tip_amount || 0));
      const discounts = Math.round(Number(o?.discounts || 0));
      const refunds = Math.round(Number(ref?.refunds || 0));
      const baseNetBeforeRefunds = Math.max(0, totalCollected - shippingFee - serviceFee - tipAmount);
      const grossSales = baseNetBeforeRefunds + discounts;
      const netRevenue = Math.max(0, baseNetBeforeRefunds - refunds);
      const invCogs = Math.round(Number(inv?.cogs || 0));
      const bomCogs = Math.round(Number(bom?.cogs || 0));
      const cogs = invCogs + bomCogs;
      const wasteCost = Math.round(Number(inv?.waste_cost || 0)) + Math.round(Number(bom?.waste_cost || 0));
      const grossProfit = netRevenue - cogs - wasteCost;
      const grossMarginPct =
        netRevenue > 0 ? Math.round((grossProfit / netRevenue) * 10000) / 100 : 0;

      return {
        date,
        orders,
        gross_sales: grossSales,
        discounts,
        net_revenue: netRevenue,
        shipping_fee: shippingFee,
        service_fee: serviceFee,
        tip_amount: tipAmount,
        total_collected: totalCollected,
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
        acc.shipping_fee += d.shipping_fee;
        acc.service_fee += d.service_fee;
        acc.tip_amount += d.tip_amount;
        acc.total_collected += d.total_collected;
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
        shipping_fee: 0,
        service_fee: 0,
        tip_amount: 0,
        total_collected: 0,
        refunds: 0,
        cogs: 0,
        waste_cost: 0,
        gross_profit: 0,
        gross_margin_pct: 0,
      }
    );
    totals.gross_margin_pct =
      totals.net_revenue > 0
        ? Math.round((totals.gross_profit / totals.net_revenue) * 10000) / 100
        : 0;

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
