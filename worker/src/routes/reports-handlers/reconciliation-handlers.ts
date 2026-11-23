import type { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { getTenantId } from '../../middleware/tenant';
import {
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
                COALESCE(SUM(total), 0) as total,
                COALESCE(SUM(CASE WHEN LOWER(COALESCE(payment_status, '')) IN ('paid', 'completed') THEN total ELSE 0 END), 0) as settled_total
         FROM orders
         WHERE DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ? AND ${VALID_REVENUE_ORDER_SQL}${tf.and}
         GROUP BY method ORDER BY total DESC`
      )
      .bind(from, to, ...tf.binds)
      .all<PaymentMethodSummary & { settled_total: number }>();

    const paymentRows = pmRows || [];
    const paymentMethods = paymentRows.map(({ method, count, total }) => ({ method, count, total }));
    const totalRevenue = paymentMethods.reduce((acc, p) => acc + Number(p.total || 0), 0);
    const totalOrders = paymentMethods.reduce((acc, p) => acc + Number(p.count || 0), 0);
    const digitalPayments = paymentRows.reduce((acc, p) => {
      const method = p.method.toLowerCase();
      return method === 'cash' || method === 'cod' ? acc : acc + Number(p.settled_total || 0);
    }, 0);
    const cashExpected = shifts.reduce((acc, s) => acc + s.expected_cash, 0);
    const cashActual = shifts.reduce((acc, s) => acc + (s.actual_cash ?? 0), 0);

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
      const reconBinds = tenantId !== '*' ? [tenantId] : [];
      const { results: staffShiftRows } = await db
        .prepare(
          `SELECT id, staff_name, role, date, clock_in, clock_out, opening_cash
           FROM staff_shifts
           WHERE date BETWEEN ? AND ?
             AND clock_in IS NOT NULL${tf.and}
             AND (
               LOWER(TRIM(COALESCE(role, 'staff'))) NOT IN ('barista', 'chef', 'kitchen', 'shipper', 'waiter')
               OR COALESCE(opening_cash, 0) > 0
             )
             AND NOT EXISTS (
               SELECT 1 FROM shift_reconciliations r
               WHERE r.shift_id = CAST(staff_shifts.id AS TEXT)${reconTenantClause}
             )
           ORDER BY clock_in DESC`
        )
        .bind(from, to, ...tf.binds, ...reconBinds)
        .all<{
          id: string | number;
          staff_name?: string | null;
          role?: string | null;
          date?: string | null;
          clock_in?: string | null;
          clock_out?: string | null;
          opening_cash?: number | null;
        }>();
      for (const s of staffShiftRows || []) {
        const sid = String(s.id);
        unreconciledShifts.push({
          shift_id: sid,
          staff_name: String(s.staff_name || 'Nhân viên'),
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
        cash_expected: cashExpected,
        cash_actual: cashActual,
        cash_variance: cashActual - cashExpected,
        digital_payments: digitalPayments,
      },
    };

    return c.json({ success: true, data: report });
  });
}
