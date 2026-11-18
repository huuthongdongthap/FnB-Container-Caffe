import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { getTenantId } from '../../middleware/tenant';
import {
  VALID_REVENUE_ORDER_SQL,
  buildTenantClause,
  validateDateRangeWindow,
  verifyReportAnalyticsAccess,
} from './analytics-handlers';
import type { DailyReconciliationReport, PaymentMethodSummary, ReconciliationRow } from './types';

const ICT_OFFSET_MS = 7 * 3600_000;

function isCashReconciliationEnabled(env: Env | undefined): boolean {
  const flag = String(env?.CASH_RECONCILIATION_ENABLED ?? '').trim().toLowerCase();
  return flag === 'true' || flag === '1';
}

export function registerReconciliationHandlers(app: Hono<{ Bindings: Env }>) {
  app.get('/reconciliation', async (c) => {
    if (!isCashReconciliationEnabled(c.env)) {
      return c.json(
        {
          success: false,
          code: 'PILOT_CASH_RECONCILIATION_DISABLED',
          error: 'Cash reconciliation is unavailable for the attendance pilot',
        },
        501
      );
    }

    const from = c.req.query('from') || new Date(Date.now() + ICT_OFFSET_MS - 7 * 86400_000).toISOString().slice(0, 10);
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
    const tf = buildTenantClause(getTenantId(c));

    let shiftRows: Record<string, unknown>[] = [];
    try {
      const res = await db
        .prepare(
          `SELECT shift_id, opening_float, cash_payment_total, cash_payout_total,
                  expected_cash, actual_cash, variance, variance_status, denominations, created_at
           FROM shift_reconciliations
           WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ?${tf.and}
           ORDER BY created_at DESC`
        )
        .bind(from, to, ...tf.binds)
        .all<Record<string, unknown>>();
      shiftRows = res.results || [];
    } catch {
      shiftRows = [];
    }

    const shifts: ReconciliationRow[] = shiftRows.map((r) => {
      const createdRaw = String(r.created_at || '');
      const parsedMs = Date.parse(createdRaw.includes('T') ? createdRaw : `${createdRaw.replace(' ', 'T')}Z`);
      const dateStr = Number.isFinite(parsedMs)
        ? new Date(parsedMs + ICT_OFFSET_MS).toISOString().slice(0, 10)
        : createdRaw.slice(0, 10);
      return {
        shift_id: String(r.shift_id || ''),
        date: dateStr,
        opening_float: Number(r.opening_float || 0),
        cash_payments: Number(r.cash_payment_total || 0),
        cash_payouts: Number(r.cash_payout_total || 0),
        expected_cash: Number(r.expected_cash || 0),
        actual_cash: r.actual_cash !== null && r.actual_cash !== undefined ? Number(r.actual_cash) : null,
        variance: r.variance !== null && r.variance !== undefined ? Number(r.variance) : null,
        status: String(r.variance_status || 'balanced'),
        denominated: Boolean(r.denominations && String(r.denominations) !== '{"denominations":[]}'),
      };
    });

    const { results: pmRows } = await db
      .prepare(
        `SELECT COALESCE(NULLIF(TRIM(payment_method), ''), 'cash') as method,
                COUNT(*) as count,
                COALESCE(SUM(total), 0) as total
         FROM orders
         WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${VALID_REVENUE_ORDER_SQL}${tf.and}
         GROUP BY method ORDER BY total DESC`
      )
      .bind(from, to, ...tf.binds)
      .all<PaymentMethodSummary>();

    const paymentMethods = pmRows || [];
    const totalRevenue = paymentMethods.reduce((acc, p) => acc + Number(p.total || 0), 0);
    const totalOrders = paymentMethods.reduce((acc, p) => acc + Number(p.count || 0), 0);
    const cashExpected = shifts.reduce((acc, s) => acc + s.expected_cash, 0);
    const cashActual = shifts.reduce((acc, s) => acc + (s.actual_cash ?? 0), 0);

    const digitalPayments = paymentMethods
      .filter((m) => m.method !== 'cash' && m.method !== 'cod')
      .reduce((acc, m) => acc + Number(m.total || 0), 0);

    const report: DailyReconciliationReport = {
      from,
      to,
      shifts,
      payment_methods: paymentMethods,
      categories: [],
      totals: {
        revenue: totalRevenue,
        order_count: totalOrders,
        cash_expected: cashExpected,
        cash_actual: cashActual,
        cash_variance: cashActual - cashExpected,
        digital_payments: digitalPayments,
      },
    };

    return c.json({ success: true, data: report });
  });
}
