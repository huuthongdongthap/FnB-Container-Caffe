import type { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { getTenantId } from '../../middleware/tenant';
import {
  NET_ORDER_TOTAL_SQL,
  VALID_REVENUE_ORDER_SQL,
  buildTenantClause,
  validateDateRangeWindow,
  verifyReportAnalyticsAccess,
} from './analytics-handlers';
import type {
  CategorySummary,
  DailyReconciliationReport,
  PaymentMethodSummary,
  ReconciliationRow,
  UnreconciledShiftSummary,
} from './types';

const ICT_OFFSET_MS = 7 * 3600_000;

function isCashReconciliationEnabled(env: Env | undefined): boolean {
  const flag = String(env?.CASH_RECONCILIATION_ENABLED ?? '').trim().toLowerCase();
  return flag === 'true' || flag === '1';
}

async function isTenantCashReconciliationOptedOut(
  env: Env | undefined,
  db: D1Database,
  tenantId: string,
): Promise<boolean> {
  const disabledEnv = String(env?.CASH_RECONCILIATION_DISABLED_TENANTS ?? '')
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (disabledEnv.includes(tenantId)) return true;
  try {
    // Tenant-specific row wins over the 'default' fallback row.
    const res = await db
      .prepare(
        `SELECT value FROM settings
         WHERE key = 'cash_reconciliation_enabled'
           AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') IN (?, 'default')
         ORDER BY CASE WHEN COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? THEN 0 ELSE 1 END
         LIMIT 1`,
      )
      .bind(tenantId, tenantId)
      .all<{ value: string }>();
    const resolved = res.results?.[0]?.value;
    if (resolved !== undefined && ['false', '0'].includes(String(resolved).trim().toLowerCase())) return true;
  } catch {
    // settings table absent or unreadable → fall back to env flag only
  }
  return false;
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

    const tenantId = getTenantId(c);
    if (await isTenantCashReconciliationOptedOut(c.env, c.env.AURA_DB, tenantId)) {
      return c.json(
        {
          success: false,
          code: 'PILOT_CASH_RECONCILIATION_DISABLED',
          error: 'Cash reconciliation disabled for tenant',
        },
        501,
      );
    }

    const db = c.env.AURA_DB;
    const tf = buildTenantClause(getTenantId(c));
    const rTf = buildTenantClause(getTenantId(c), 'r');

    let shiftRows: Record<string, unknown>[] = [];
    try {
      const res = await db
        .prepare(
          `SELECT r.shift_id, r.staff_id, r.reconciled_by, r.opening_float, r.cash_payment_total, r.cash_payout_total,
                  r.expected_cash, r.actual_cash, r.variance, r.variance_status, r.denominations,
                  r.remitted_cash, r.closing_float, r.handover_to_staff_id, r.online_sales_total,
                  r.created_at, ss.date as shift_business_date, ss.clock_in as shift_clock_in
           FROM shift_reconciliations r
           LEFT JOIN staff_shifts ss
             ON CAST(ss.id AS TEXT) = r.shift_id
            AND COALESCE(NULLIF(TRIM(ss.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default')
           WHERE COALESCE(NULLIF(TRIM(ss.date), ''), DATE(datetime(r.created_at, '+7 hours'))) BETWEEN ? AND ?${rTf.and}
           ORDER BY r.created_at DESC`
        )
        .bind(from, to, ...rTf.binds)
        .all<Record<string, unknown>>();
      shiftRows = res.results || [];
    } catch {
      try {
        const res = await db
          .prepare(
            `SELECT shift_id, staff_id, reconciled_by, opening_float, cash_payment_total, cash_payout_total,
                    expected_cash, actual_cash, variance, variance_status, denominations,
                    remitted_cash, closing_float, handover_to_staff_id, online_sales_total, created_at
             FROM shift_reconciliations
             WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ?${tf.and}
             ORDER BY created_at DESC`
          )
          .bind(from, to, ...tf.binds)
          .all<Record<string, unknown>>();
        shiftRows = res.results || [];
      } catch {
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
      }
    }

    type HydratedShift = ReconciliationRow & { _sortKey: string };
    const hydratedShifts: HydratedShift[] = shiftRows.map((r) => {
      const createdRaw = String(r.created_at || '');
      const parsedMs = Date.parse(createdRaw.includes('T') ? createdRaw : `${createdRaw.replace(' ', 'T')}Z`);
      const fallbackIctDate = Number.isFinite(parsedMs)
        ? new Date(parsedMs + ICT_OFFSET_MS).toISOString().slice(0, 10)
        : createdRaw.slice(0, 10);
      const shiftBizDate =
        typeof r.shift_business_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.shift_business_date.trim())
          ? r.shift_business_date.trim()
          : fallbackIctDate;

      let denomMeta: {
        denominations?: unknown[];
        remitted_cash?: number;
        closing_float?: number;
        handover_to_staff_id?: string | null;
        online_sales_total?: number;
      } = {};
      if (r.denominations) {
        try {
          const parsed = typeof r.denominations === 'string'
            ? (JSON.parse(r.denominations) as typeof denomMeta)
            : (r.denominations as typeof denomMeta);
          if (parsed && typeof parsed === 'object') {
            denomMeta = parsed;
          }
        } catch {
          denomMeta = {};
        }
      }
      const hasDenominations = Array.isArray(denomMeta.denominations) && denomMeta.denominations.length > 0;
      const expectedCash = Number(r.expected_cash || 0);
      const actualCash = r.actual_cash !== null && r.actual_cash !== undefined ? Number(r.actual_cash) : null;
      const colRemitted = r.remitted_cash !== null && r.remitted_cash !== undefined ? Number(r.remitted_cash) : 0;
      const remittedCash =
        colRemitted !== 0
          ? colRemitted
          : (denomMeta.remitted_cash !== undefined ? Number(denomMeta.remitted_cash || 0) : 0);
      const colClosing = r.closing_float !== null && r.closing_float !== undefined ? Number(r.closing_float) : null;
      const closingFloat =
        colClosing !== null && (colClosing !== 0 || denomMeta.closing_float === undefined)
          ? colClosing
          : denomMeta.closing_float !== undefined
            ? Number(denomMeta.closing_float || 0)
            : Math.max(0, (actualCash ?? expectedCash) - remittedCash);
      const handoverToStaffId =
        (typeof r.handover_to_staff_id === 'string' && r.handover_to_staff_id.trim()) ||
        (typeof denomMeta.handover_to_staff_id === 'string' && denomMeta.handover_to_staff_id.trim()) ||
        null;
      const colOnline = r.online_sales_total !== null && r.online_sales_total !== undefined ? Number(r.online_sales_total) : 0;
      const onlineSalesTotal =
        colOnline !== 0
          ? colOnline
          : (denomMeta.online_sales_total !== undefined ? Number(denomMeta.online_sales_total || 0) : 0);
      const staffId = typeof r.staff_id === 'string' ? r.staff_id : '';
      const reconciledBy = typeof r.reconciled_by === 'string' && r.reconciled_by ? r.reconciled_by : staffId;
      const sortClock = String(r.shift_clock_in || createdRaw || '');

      return {
        shift_id: String(r.shift_id || ''),
        staff_id: staffId,
        reconciled_by: reconciledBy,
        date: shiftBizDate,
        opening_float: Number(r.opening_float || 0),
        cash_payments: Number(r.cash_payment_total || 0),
        cash_payouts: Number(r.cash_payout_total || 0),
        expected_cash: expectedCash,
        actual_cash: actualCash,
        variance:
          r.variance !== null && r.variance !== undefined
            ? Number(r.variance)
            : actualCash !== null
              ? actualCash - expectedCash
              : null,
        remitted_cash: remittedCash,
        closing_float: closingFloat,
        handover_to_staff_id: handoverToStaffId,
        online_sales_total: onlineSalesTotal,
        status: String(r.variance_status || 'balanced'),
        denominated: hasDenominations,
        _sortKey: sortClock,
      };
    });

    const shifts: ReconciliationRow[] = hydratedShifts.map(({ _sortKey: _ignored, ...rest }) => rest);

    // Group shifts per business date in chronological order so carried-over opening_float
    // across sequential shifts on the same day is never summed multiple times.
    const shiftsByDay = new Map<string, HydratedShift[]>();
    for (const s of hydratedShifts) {
      const list = shiftsByDay.get(s.date) || [];
      list.push(s);
      shiftsByDay.set(s.date, list);
    }

    let cashExpected = 0;
    let cashActual = 0;
    let cashVariance = 0;
    let totalOpeningFloat = 0;
    let totalCashPayments = 0;
    let totalCashPayouts = 0;
    let totalRemittedCash = 0;
    let finalClosingFloat = 0;

    const sortedDays = [...shiftsByDay.keys()].sort();
    for (const dayKey of sortedDays) {
      const dayList = (shiftsByDay.get(dayKey) || []).slice().sort((a, b) => a._sortKey.localeCompare(b._sortKey));
      if (dayList.length === 0) continue;
      const dayOpening = dayList[0].opening_float;
      const dayNetDelta = dayList.reduce((acc, s) => acc + (s.expected_cash - s.opening_float), 0);
      const dayVar = dayList.reduce(
        (acc, s) => acc + (s.variance !== null ? s.variance : (s.actual_cash ?? s.expected_cash) - s.expected_cash),
        0
      );
      const dayRemitted = dayList.reduce((acc, s) => acc + s.remitted_cash, 0);
      const dayExpected = dayOpening + dayNetDelta;
      const dayActual = dayExpected + dayVar;

      if (totalOpeningFloat === 0 && dayKey === sortedDays[0]) {
        totalOpeningFloat = dayOpening;
      }
      totalCashPayments += dayList.reduce((acc, s) => acc + s.cash_payments, 0);
      totalCashPayouts += dayList.reduce((acc, s) => acc + s.cash_payouts, 0);
      totalRemittedCash += dayRemitted;
      cashExpected += dayExpected;
      cashActual += dayActual;
      cashVariance += dayVar;
      finalClosingFloat = Math.max(0, dayActual - dayRemitted);
    }
    // Note: across multi-day ranges where day D+1 carries forward day D's closing_float,
    // use the range's first day opening_float + net cash movements across all shifts in the range:
    if (sortedDays.length > 1 && hydratedShifts.length > 0) {
      const allChrono = hydratedShifts.slice().sort((a, b) => a._sortKey.localeCompare(b._sortKey));
      totalOpeningFloat = allChrono[0].opening_float;
      const rangeNetDelta = allChrono.reduce((acc, s) => acc + (s.expected_cash - s.opening_float), 0);
      cashExpected = totalOpeningFloat + rangeNetDelta;
      cashActual = cashExpected + cashVariance;
      finalClosingFloat = Math.max(0, cashActual - totalRemittedCash);
    }

    const orderDateSettlementPredicate =
      "(((cod_paid_at IS NULL OR TRIM(cod_paid_at) = '') AND DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ?) OR (cod_paid_at IS NOT NULL AND TRIM(cod_paid_at) != '' AND DATE(datetime(cod_paid_at, '+7 hours')) BETWEEN ?1 AND ?2))";

    let pmRows: Array<PaymentMethodSummary & { settled_total?: number }> = [];
    try {
      const res = await db
        .prepare(
          `SELECT LOWER(TRIM(COALESCE(NULLIF(TRIM(payment_method), ''), 'cash'))) as method,
                  COUNT(*) as count,
                  COALESCE(SUM(${NET_ORDER_TOTAL_SQL}), 0) as total,
                  COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(payment_status, ''))) IN ('paid', 'completed', 'partially_refunded') THEN ${NET_ORDER_TOTAL_SQL} ELSE 0 END), 0) as settled_total
           FROM orders
           WHERE ${orderDateSettlementPredicate} AND ${VALID_REVENUE_ORDER_SQL}${tf.and}
           GROUP BY method ORDER BY total DESC`
        )
        .bind(from, to, ...tf.binds)
        .all<PaymentMethodSummary & { settled_total?: number }>();
      pmRows = res.results || [];
    } catch {
      try {
        const res = await db
          .prepare(
            `SELECT LOWER(TRIM(COALESCE(NULLIF(TRIM(payment_method), ''), 'cash'))) as method,
                    COUNT(*) as count,
                    COALESCE(SUM(${NET_ORDER_TOTAL_SQL}), 0) as total,
                    COALESCE(SUM(CASE WHEN LOWER(TRIM(COALESCE(payment_status, ''))) IN ('paid', 'completed', 'partially_refunded') THEN ${NET_ORDER_TOTAL_SQL} ELSE 0 END), 0) as settled_total
             FROM orders
             WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${VALID_REVENUE_ORDER_SQL}${tf.and}
             GROUP BY method ORDER BY total DESC`
          )
          .bind(from, to, ...tf.binds)
          .all<PaymentMethodSummary & { settled_total?: number }>();
        pmRows = res.results || [];
      } catch {
        const res = await db
          .prepare(
            `SELECT COALESCE(NULLIF(TRIM(payment_method), ''), 'cash') as method,
                    COUNT(*) as count,
                    COALESCE(SUM(total), 0) as total,
                    COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_status, '')) IN ('paid', 'completed', 'partially_refunded') THEN total ELSE 0 END), 0) as settled_total
             FROM orders
             WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${VALID_REVENUE_ORDER_SQL}${tf.and}
             GROUP BY method ORDER BY total DESC`
          )
          .bind(from, to, ...tf.binds)
          .all<PaymentMethodSummary & { settled_total?: number }>();
        pmRows = res.results || [];
      }
    }

    const paymentRows = pmRows || [];
    const paymentMethods = paymentRows.map(({ method, count, total }) => ({ method, count, total }));
    const totalRevenue = paymentMethods.reduce((acc, p) => acc + Number(p.total || 0), 0);
    const totalOrders = paymentMethods.reduce((acc, p) => acc + Number(p.count || 0), 0);
    const digitalPayments = paymentRows.reduce((acc, p) => {
      const method = p.method.toLowerCase();
      return method === 'cash' || method === 'cod'
        ? acc
        : acc + Number(p.settled_total !== undefined ? p.settled_total : p.total || 0);
    }, 0);

    // Populate real category breakdown from valid revenue orders in window
    const categoryMap = new Map<string, { items_sold: number; revenue: number }>();
    // Load tenant categories map to resolve category_id stored in order snapshots
    const categoryNameById = new Map<string, string>();
    try {
      const { results: catRows } = await db
        .prepare(`SELECT id, name FROM categories WHERE 1=1${tf.and}`)
        .bind(...tf.binds)
        .all<{ id?: string | number | null; name?: string | null }>();
      for (const row of catRows || []) {
        if (row.id !== null && row.id !== undefined && row.name) {
          categoryNameById.set(String(row.id), String(row.name).trim());
        }
      }
    } catch {
      // categories table unavailable in minimal test schemas
    }

    try {
      const { results: orderItemRows } = await db
        .prepare(
          `SELECT items FROM orders
           WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${VALID_REVENUE_ORDER_SQL}${tf.and}`
        )
        .bind(from, to, ...tf.binds)
        .all<{ items?: string | null }>();
      for (const row of orderItemRows || []) {
        if (!row.items) continue;
        try {
          const parsed = JSON.parse(row.items) as Array<{
            category?: string;
            category_name?: string;
            category_id?: string | number;
            quantity?: number;
            price?: number;
            unit_price?: number;
            unitPriceCents?: number;
            subtotal?: number;
            subtotalCents?: number;
            line_total?: number;
            total_price?: number;
            modifiers?: Array<
              | {
                  priceAdjustment?: number;
                  price_adjustment?: number;
                  priceDelta?: number;
                  price_delta?: number;
                  extraPrice?: number;
                  price?: number;
                }
              | string
            >;
          }>;
          if (!Array.isArray(parsed)) continue;
          for (const item of parsed) {
            const rawCat =
              item.category ||
              item.category_name ||
              (item.category_id !== undefined && item.category_id !== null
                ? categoryNameById.get(String(item.category_id)) || String(item.category_id)
                : '');
            const cat = String(rawCat || 'Khác').trim() || 'Khác';
            const qty = Math.max(0, Number(item.quantity ?? 1) || 0);
            const explicitLineTotal =
              item.subtotalCents ?? item.subtotal ?? item.line_total ?? item.total_price;
            let lineRevenue: number;
            if (explicitLineTotal !== undefined && explicitLineTotal !== null && Number.isFinite(Number(explicitLineTotal))) {
              lineRevenue = Math.max(0, Number(explicitLineTotal));
            } else {
              const unitPrice = Number(item.unitPriceCents ?? item.price ?? item.unit_price ?? 0) || 0;
              const modifierUnitDelta = Array.isArray(item.modifiers)
                ? item.modifiers.reduce((sum, mod) => {
                    if (!mod || typeof mod !== 'object') return sum;
                    const delta = Number(
                      mod.priceAdjustment ??
                        mod.price_adjustment ??
                        mod.priceDelta ??
                        mod.price_delta ??
                        mod.extraPrice ??
                        mod.price ??
                        0
                    );
                    return sum + (Number.isFinite(delta) ? delta : 0);
                  }, 0)
                : 0;
              lineRevenue = Math.max(0, qty * (unitPrice + modifierUnitDelta));
            }
            const prev = categoryMap.get(cat) || { items_sold: 0, revenue: 0 };
            categoryMap.set(cat, {
              items_sold: prev.items_sold + qty,
              revenue: prev.revenue + lineRevenue,
            });
          }
        } catch {
          // Skip malformed JSON items row
        }
      }
    } catch {
      // orders.items unavailable
    }
    const categories: CategorySummary[] = Array.from(categoryMap.entries())
      .map(([category, stats]) => ({ category, ...stats }))
      .sort((a, b) => b.revenue - a.revenue);

    // Flag open or clock-out shifts in range that have not been reconciled yet
    // Exclude any shift already reconciled (including overnight shifts reconciled on the next day)
    const unreconciledShifts: UnreconciledShiftSummary[] = [];
    try {
      const reconTenantClause = tenantId !== '*'
        ? " AND COALESCE(NULLIF(TRIM(r.tenant_id), ''), 'default') = ?"
        : '';
      const cpaTenantClause = tenantId !== '*'
        ? " AND COALESCE(NULLIF(TRIM(cpa.tenant_id), ''), 'default') = ?"
        : '';
      const cpTenantClause = tenantId !== '*'
        ? " AND COALESCE(NULLIF(TRIM(cp.tenant_id), ''), 'default') = ?"
        : '';
      type StaffShiftRow = {
        id: string | number;
        staff_name?: string | null;
        role?: string | null;
        date?: string | null;
        clock_in?: string | null;
        clock_out?: string | null;
        opening_cash?: number | null;
      };
      let staffShiftRows: StaffShiftRow[] = [];
      try {
        const extraBinds = tenantId !== '*' ? [tenantId, tenantId, tenantId] : [];
        const res = await db
          .prepare(
            `SELECT id, staff_name, role, date, clock_in, clock_out, opening_cash
             FROM staff_shifts
             WHERE date BETWEEN ? AND ?
               AND clock_in IS NOT NULL${tf.and}
               AND (
                 LOWER(TRIM(COALESCE(role, 'staff'))) NOT IN ('barista', 'chef', 'kitchen', 'bep', 'shipper', 'rider', 'waiter')
                 OR COALESCE(opening_cash, 0) > 0
                 OR EXISTS (
                   SELECT 1 FROM cash_payment_attributions cpa
                   WHERE cpa.shift_id = CAST(staff_shifts.id AS TEXT)${cpaTenantClause}
                 )
                 OR EXISTS (
                   SELECT 1 FROM cash_payouts cp
                   WHERE cp.shift_id = CAST(staff_shifts.id AS TEXT)
                     AND LOWER(COALESCE(cp.status, 'completed')) IN ('completed', 'approved')${cpTenantClause}
                 )
               )
               AND NOT EXISTS (
                 SELECT 1 FROM shift_reconciliations r
                 WHERE r.shift_id = CAST(staff_shifts.id AS TEXT)${reconTenantClause}
               )
             ORDER BY clock_in DESC`
          )
          .bind(from, to, ...tf.binds, ...extraBinds)
          .all<StaffShiftRow>();
        staffShiftRows = res.results || [];
      } catch {
        const reconBinds = tenantId !== '*' ? [tenantId] : [];
        const res = await db
          .prepare(
            `SELECT id, staff_name, role, date, clock_in, clock_out, opening_cash
             FROM staff_shifts
             WHERE date BETWEEN ? AND ?
               AND clock_in IS NOT NULL${tf.and}
               AND (
                 LOWER(TRIM(COALESCE(role, 'staff'))) NOT IN ('barista', 'chef', 'kitchen', 'bep', 'shipper', 'rider', 'waiter')
                 OR COALESCE(opening_cash, 0) > 0
               )
               AND NOT EXISTS (
                 SELECT 1 FROM shift_reconciliations r
                 WHERE r.shift_id = CAST(staff_shifts.id AS TEXT)${reconTenantClause}
               )
             ORDER BY clock_in DESC`
          )
          .bind(from, to, ...tf.binds, ...reconBinds)
          .all<StaffShiftRow>();
        staffShiftRows = res.results || [];
      }
      for (const s of staffShiftRows || []) {
        const sid = String(s.id);
        unreconciledShifts.push({
          shift_id: sid,
          staff_name: String(s.staff_name || 'Nhân viên'),
          ...(s.role ? { role: String(s.role) } : {}),
          date: String(s.date || from),
          status: s.clock_out ? 'unreconciled' : 'open',
          opening_float: Number(s.opening_cash || 0),
        });
      }
    } catch {
      // staff_shifts table unavailable
    }

    const report: DailyReconciliationReport = {
      from,
      to,
      shifts,
      unreconciled_shifts: unreconciledShifts,
      has_unreconciled_shifts: unreconciledShifts.length > 0,
      payment_methods: paymentMethods,
      categories,
      totals: {
        revenue: totalRevenue,
        order_count: totalOrders,
        opening_float: totalOpeningFloat,
        cash_payments: totalCashPayments,
        cash_payouts: totalCashPayouts,
        remitted_cash: totalRemittedCash,
        closing_float: finalClosingFloat,
        cash_expected: cashExpected,
        cash_actual: cashActual,
        cash_variance: cashVariance,
        digital_payments: digitalPayments,
      },
    };

    return c.json({ success: true, data: report });
  });
}
