import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import type {
  DailyReconciliationReport,
  PaymentMethodSummary,
  CategorySummary,
  ReconciliationRow
} from './types';

export function registerReconciliationHandlers(app: Hono<{ Bindings: Env }>) {
  // GET /api/reports/reconciliation — daily cash + digital reconciliation
  app.get('/reconciliation', async (c) => {
    const db = c.env.AURA_DB;
    const from = c.req.query('from') || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const to = c.req.query('to') || new Date().toISOString().slice(0, 10);

    // ── Shifts with reconciliation data ──
    const { results: shifts } = await db.prepare(
      `SELECT s.id, DATE(s.created_at) AS shift_date,
              COALESCE(sr.opening_float, 0) AS opening_float,
              COALESCE(sr.actual_cash, 0) AS actual_cash,
              COALESCE(sr.denominations, '{}') AS denominations
       FROM shifts s
       LEFT JOIN shift_reconciliations sr ON sr.shift_id = s.id
       WHERE DATE(s.created_at) BETWEEN ? AND ?`
    ).bind(from, to).all<{
      id: string;
      shift_date: string;
      opening_float: number;
      actual_cash: number;
      denominations: string;
    }>();

    // ── Cash payments (orders with payment_method='cash' paid in period) ──
    const { results: cashPayments } = await db.prepare(
      `SELECT DATE(created_at) AS date, COALESCE(SUM(total), 0) AS total
       FROM orders
       WHERE payment_method = 'cash' AND status != 'cancelled'
         AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)`
    ).bind(from, to).all<{ date: string; total: number }>();

    // ── Cash payouts (expense transactions in period) ──
    const { results: cashPayouts } = await db.prepare(
      `SELECT DATE(created_at) AS date, COALESCE(SUM(amount), 0) AS total
       FROM expenses
       WHERE payment_method = 'cash' AND status = 'approved'
         AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY DATE(created_at)`
    ).bind(from, to).all<{ date: string; total: number }>();

    // ── Payment method summary ──
    const { results: payMethods } = await db.prepare(
      `SELECT payment_method AS method, COUNT(*) AS count, COALESCE(SUM(total), 0) AS total
       FROM orders
       WHERE status != 'cancelled' AND DATE(created_at) BETWEEN ? AND ?
       GROUP BY payment_method`
    ).bind(from, to).all<{ method: string; count: number; total: number }>();

    // ── Category revenue summary (parse items JSON) ──
    const { results: ordersWithItems } = await db.prepare(
      `SELECT items FROM orders WHERE status != 'cancelled' AND DATE(created_at) BETWEEN ? AND ?`
    ).bind(from, to).all<{ items: string }>();

    // Build payment method aggregation
    const pmMap = new Map((payMethods || []).map(p => [p.method, p]));
    const paymentMethodSummary: PaymentMethodSummary[] = [...pmMap.entries()].map(([method, data]) => ({
      method,
      count: data.count,
      total: data.total,
    }));

    // Category summary aggregation
    const catMap = new Map<string, { count: number; total: number }>();
    for (const row of ordersWithItems || []) {
      try {
        const items = JSON.parse(row.items || '[]');
        if (!Array.isArray(items)) continue;
        for (const item of items) {
          const cat = item.category || 'Other';
          const qty = item.qty || item.quantity || 1;
          const price = item.price || item.unit_price || 0;
          const cur = catMap.get(cat) || { count: 0, total: 0 };
          cur.count += qty;
          cur.total += price * qty;
          catMap.set(cat, cur);
        }
      } catch {
        // Skip malformed items
      }
    }
    const categorySummary: CategorySummary[] = [...catMap.entries()].map(([category, data]) => ({
      category,
      items_sold: data.count,
      revenue: data.total,
    }));

    // Digital payments total (non-cash)
    const digitalTotal = payMethods
      .filter(p => p.method !== 'cash')
      .reduce((s, p) => s + p.total, 0);

    // Build per-shift reconciliation rows
    const cashPayMap = new Map(cashPayments.map(p => [p.date, p.total]));
    const cashOutMap = new Map(cashPayouts.map(p => [p.date, p.total]));

    const reconciliationRows: ReconciliationRow[] = shifts.map((s, idx) => {
      const cashPay = cashPayMap.get(s.shift_date) || 0;
      const cashOut = cashOutMap.get(s.shift_date) || 0;
      const expected = s.opening_float + cashPay - cashOut;
      const hasDenominations = s.denominations && s.denominations !== '{}';
      const actual = hasDenominations ? s.actual_cash : null;
      const variance = hasDenominations ? actual - expected : null;
      const status = variance === null
        ? 'unreconciled'
        : variance === 0
          ? 'balanced'
          : variance > 0
            ? 'overage'
            : 'shortage';
      return {
        shift_id: s.id + '_' + idx,
        date: s.shift_date,
        opening_float: s.opening_float,
        cash_payments: cashPay,
        cash_payouts: cashOut,
        expected_cash: expected,
        actual_cash: actual,
        variance,
        status,
        denominated: hasDenominations,
      };
    });

    // Compute totals
    const totalRevenue = payMethods.reduce((s, p) => s + p.total, 0);
    const totalCashExpected = reconciliationRows.reduce((s, r) => s + r.expected_cash, 0);
    const totalCashActual = reconciliationRows.reduce((s, r) => s + (r.actual_cash || 0), 0);
    const totalCashVariance = reconciliationRows.reduce((s, r) => s + (r.variance || 0), 0);
    const orderCount = payMethods.reduce((s, p) => s + p.count, 0);

    const report: DailyReconciliationReport = {
      from,
      to,
      shifts: reconciliationRows,
      payment_methods: paymentMethodSummary,
      categories: categorySummary,
      totals: {
        revenue: totalRevenue,
        cash_expected: totalCashExpected,
        cash_actual: totalCashActual,
        cash_variance: totalCashVariance,
        digital_payments: digitalTotal,
        order_count: orderCount,
      },
    };

    return c.json({ success: true, data: report });
  });
}
