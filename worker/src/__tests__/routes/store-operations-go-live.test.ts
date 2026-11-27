import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { createOrder, updateOrder } from '@aura/domain-order';
import { receivePurchaseOrder } from '@aura/domain-inventory';
import { reportsRouter } from '../../routes/reports';
import { reconciliationRoutes } from '@aura/domain-shift';
import { loginRateLimit, resetLoginRateLimitMemory } from '../../middleware/rate-limit-login';
import { authEndpointsRouter } from '../../routes/auth-endpoints';
import { VALID_REVENUE_ORDER_SQL } from '../../routes/reports-handlers/analytics-handlers';
import { generateJWT } from '../../lib/jwt';
import { issueStaffSession } from '../../lib/staff-session';
import { VALID_EXPORT_ORDER_SQL } from '../../routes/reports-handlers/export-handlers';

// Minimal SQL literal parser so seeded INSERTs that inline literal values
// (e.g. INSERT INTO purchase_order_items ... VALUES ('poi_1', ...)) land in the
// in-memory tables instead of being silently dropped by the mock.
function splitSqlValues(raw: string): unknown[] {
  const out: unknown[] = [];
  let cur = '';
  let quote: string | null = null;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (quote) {
      if (ch === quote) {
        if (raw[i + 1] === quote) { cur += quote; i++; continue; }
        quote = null;
        cur += ch;
        continue;
      }
      cur += ch;
      continue;
    }
    if (ch === "'" || ch === '"') { quote = ch; cur += ch; continue; }
    if (ch === ',') { out.push(normalizeSqlValue(cur)); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim() || out.length) out.push(normalizeSqlValue(cur));
  return out;
}

function normalizeSqlValue(raw: string): unknown {
  const s = raw.trim();
  if (s === '?') return '__ARG__';
  if ((s.startsWith("'") && s.endsWith("'")) || (s.startsWith('"') && s.endsWith('"'))) return s.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if (/^null$/i.test(s)) return null;
  return s;
}

function parseInsertRow(sql: string, args: unknown[], table: string): Record<string, unknown> | null {
  const m = sql.match(new RegExp(`INSERT\\s+INTO\\s+${table}\\s*\\(([^)]*)\\)\\s*VALUES\\s*\\(([\\s\\S]*)\\)`, 'i'));
  if (!m) return null;
  const cols = m[1].split(',').map((c) => c.trim()).filter(Boolean);
  const values = splitSqlValues(m[2]);
  let argIdx = 0;
  const row: Record<string, unknown> = {};
  cols.forEach((col, i) => {
    const v = values[i];
    row[col] = v === '__ARG__' ? args[argIdx++] : v;
  });
  return row;
}

export function createStoreMockDb() {  const customers = new Map<string, { id: string; tenant_id: string; loyalty_points: number }>([
    ['cust_sadec_1', { id: 'cust_sadec_1', tenant_id: 'default', loyalty_points: 250 }],
  ]);
  const orders = new Map<string, Record<string, unknown>>();
  const loyaltyTx: Array<{ id: string; customer_id: string; order_id: string; points: number; type: string }> = [];
  const shifts = new Map<string, Record<string, unknown>>([
    [
      'shift_evening_1',
      {
        id: 'shift_evening_1',
        staff_id: 'owner_1',
        tenant_id: 'default',
        status: 'closed',
        clock_in: '2026-11-18T10:00:00.000Z',
        clock_out: '2026-11-18T16:00:00.000Z',
        opening_cash: 500000,
      },
    ],
  ]);
  const shiftReconciliations: Array<Record<string, unknown>> = [];
  const users = new Map<string, Record<string, unknown>>([
    [
      'owner_1',
      {
        id: 'owner_1',
        name: 'Chủ quán Sa Đéc',
        phone: '0909123456',
        role: 'owner',
        tenant_id: 'default',
        is_active: 1,
        auth_version: 1,
      },
    ],
  ]);
  const purchaseOrders = new Map<string, Record<string, unknown>>();
  const purchaseOrderItems = new Map<string, Record<string, unknown>>();
  const ingredients = new Map<string, Record<string, unknown>>();
  const stockMovements: Array<Record<string, unknown>> = [];
  const payments: Array<Record<string, unknown>> = [];

  const db = {
    customers,
    orders,
    loyaltyTx,
    shiftReconciliations,
    users,
    purchaseOrders,
    purchaseOrderItems,
    ingredients,
    stockMovements,
    payments,
    async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
      const out = [];
      for (const s of stmts) {
        out.push(await s.run());
      }
      return out;
    },
    prepare(sql: string) {
      // D1 statements may be executed directly (db.prepare(sql).run()) or after
      // bind(). Both shapes must reach the same handler with the same args.
      const buildStatement = (args: unknown[]) => {
          const stmt = {
            async first<T = Record<string, unknown>>(): Promise<T | null> {
              if (sql.includes('FROM products WHERE id = ?') || sql.includes('FROM menu_items WHERE id = ?')) {
                const id = String(args[0]);
                if (id === 'prod_cf_sua') {
                  return {
                    id: 'prod_cf_sua',
                    name: 'Cà Phê Sữa Đá Sa Đéc',
                    price: 45000,
                    available: 1,
                    is_available: 1,
                    tenant_id: 'default',
                  } as unknown as T;
                }
                return null;
              }
              if (sql.includes('FROM customers WHERE id = ?')) {
                const id = String(args[0]);
                const c = customers.get(id);
                return (c ? { ...c } : null) as T | null;
              }
              if (sql.includes('FROM orders WHERE id = ?')) {
                const id = String(args[0]);
                const o = orders.get(id);
                return (o ? { ...o } : null) as T | null;
              }
              if (sql.includes('FROM users WHERE id = ?')) {
                const id = String(args[0]);
                const u = users.get(id);
                return (u ? { ...u } : null) as T | null;
              }
              if (sql.includes('FROM purchase_orders WHERE id = ?')) {
                const id = String(args[0]);
                const po = purchaseOrders.get(id);
                return (po ? { ...po } : null) as T | null;
              }
              if (sql.includes('FROM purchase_order_items WHERE purchase_order_id = ?')) {
                const poId = String(args[0]);
                return { results: (purchaseOrderItems.get(poId) || []) as unknown as T[] };
              }
              if (sql.includes('FROM ingredients WHERE id = ?')) {
                const id = String(args[0]);
                const ing = ingredients.get(id);
                return (ing ? { ...ing } : null) as T | null;
              }
              if (sql.includes('FROM payments WHERE order_id = ?')) {
                const ordId = String(args[0]);
                return { results: payments.filter((p) => p.order_id === ordId) as unknown as T[] };
              }
              if (sql.includes("FROM loyalty_transactions WHERE order_id = ? AND type = 'redeem'")) {
                const ordId = String(args[0]);
                const tx = loyaltyTx.find((t) => t.order_id === ordId && t.type === 'redeem');
                return (tx ? { customer_id: tx.customer_id, pts: Math.abs(tx.points) } : null) as T | null;
              }
              if (sql.includes("FROM loyalty_transactions WHERE order_id = ? AND type = 'refund_redeem'")) {
                const ordId = String(args[0]);
                const tx = loyaltyTx.find((t) => t.order_id === ordId && t.type === 'refund_redeem');
                return (tx ? { id: tx.id } : null) as T | null;
              }
              if (
                sql.includes('FROM shifts WHERE id = ?') ||
                sql.includes('FROM staff_shifts WHERE id = ?') ||
                sql.includes('FROM staff_shifts')
              ) {
                const id = String(args[0]);
                const s = shifts.get(id);
                return (s ? { ...s } : null) as T | null;
              }
              if (sql.includes('FROM users WHERE id = ?')) {
                const u = users.get(String(args[0]));
                return (u ? { is_active: 1, ...u } : null) as T | null;
              }
              if (sql.includes('FROM purchase_orders WHERE id = ?')) {
                const po = purchaseOrders.get(String(args[0]));
                return (po ? { ...po } : null) as T | null;
              }
              if (sql.includes('FROM purchase_order_items WHERE purchase_order_id = ?')) {
                const poId = String(args[0]);
                const rows = [...purchaseOrderItems.values()].filter(
                  (i: Record<string, unknown>) => String(i.purchase_order_id) === poId
                );
                return { results: rows.map((r) => ({ ...r })) } as unknown as T;
              }
              if (sql.includes('FROM ingredients WHERE id = ?')) {
                const ing = ingredients.get(String(args[0]));
                return (ing ? { ...ing } : null) as T | null;
              }
              if (sql.includes('FROM shift_reconciliations WHERE shift_id = ?')) {
                const shiftId = String(args[0]);
                const found = shiftReconciliations.find((r) => r.shift_id === shiftId);
                return (found ? { ...found } : null) as T | null;
              }
              if (sql.includes('FROM purchase_order_items WHERE id = ?')) {
                const id = String(args[0]);
                const item = [...purchaseOrderItems.values()].find((i: Record<string, unknown>) => String(i.id) === id);
                return (item ? { ...item } : null) as T | null;
              }
              if (sql.includes('FROM purchase_order_items') && sql.includes('purchase_order_id = ?')) {
                const poId = String(args[0]);
                const matched = [...purchaseOrderItems.values()].filter((i: Record<string, unknown>) =>
                  String(i.purchase_order_id) === poId
                );
                return { results: matched.map((i) => ({ ...i })) as unknown as T[] };
              }
              if (sql.includes('FROM payments') && (sql.includes('SUM(') || sql.includes("payment_method = 'cash'"))) {
                return { total: 350000 } as unknown as T;
              }
              if (sql.includes('FROM orders') && sql.includes('SUM(')) {
                return {
                  results: [
                    {
                      date: '2026-11-18',
                      total_collected: 110000,
                      discounts: 45000,
                      shipping_fee: 0,
                      service_fee: 0,
                      tip_amount: 0,
                    },
                  ] as unknown as T[],
                };
              }
              if (sql.includes('FROM cash_payouts')) {
                return { total: 50000 } as unknown as T;
              }
              return null;
            },
            async run(): Promise<{ changes: number; meta: { last_row_id: number } }> {
              return { changes: 1, meta: { last_row_id: 1 } };
            },
            async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
              if (sql.includes('FROM payments p LEFT JOIN cash_payment_attributions')) {
                return {
                  results: [
                    { id: 'pay_evening_cash_1', amount: 350000, shift_id: 'shift_evening_1', candidates: 1 },
                  ] as unknown as T[],
                };
              }
              if (sql.includes('FROM products WHERE id IN') || sql.includes('FROM menu_items WHERE id IN')) {
                return {
                  results: [
                    {
                      id: 'prod_cf_sua',
                      name: 'Cà Phê Sữa Đá Sa Đéc',
                      price: 45000,
                      available: 1,
                      is_available: 1,
                      tenant_id: 'default',
                    },
                  ] as unknown as T[],
                };
              }
              if (sql.includes('FROM orders WHERE id = ?')) {
                const id = String(args[0]);
                const o = orders.get(id);
                return { results: (o ? [{ ...o }] : []) as unknown as T[] };
              }
              if (sql.includes('FROM orders') && sql.includes('customer_name') && (sql.includes('ORDER BY created_at') || sql.includes('ORDER BY o.created_at'))) {
                // Row-level export SELECT: apply the same WHERE clauses SQLite would,
                // but only the ones present in the SQL text the handler actually sent.
                const dateArgs = args.map(String).filter((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
                const from = dateArgs[0] || String(args[0]);
                const to = dateArgs[1] || String(args[1]);
                const badStatuses = ['cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired'];
                const badPayStatuses = ['refunded', 'failed', 'cancelled', 'canceled'];
                const enforcesValidity = sql.includes("'cancelled'") && sql.includes('payment_status');
                const matched = [...orders.values()].filter((o) => {
                  const raw = String(o.created_at || '');
                  const utcMs = Date.parse(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
                  const ictDate = new Date(utcMs + 7 * 3600_000).toISOString().slice(0, 10);
                  if (!(ictDate >= from && ictDate <= to)) return false;
                  if (!enforcesValidity) return true;
                  if (badStatuses.includes(String(o.status || '').toLowerCase())) return false;
                  if (badPayStatuses.includes(String(o.payment_status || '').toLowerCase())) return false;
                  const isQrPlaceholder =
                    String(o.customer_name || '') === 'Khách QR - cho don mon' ||
                    ['', '[]'].includes(String(o.items ?? ''));
                  if (Number(o.total || 0) === 0 && isQrPlaceholder) return false;
                  return true;
                });
                return {
                  results: matched.map((o) => ({
                    ...o,
                    ict_date: new Date(
                      Date.parse(String(o.created_at).includes('T') ? String(o.created_at) : `${String(o.created_at).replace(' ', 'T')}Z`) + 7 * 3600_000
                    ).toISOString().slice(0, 10),
                  })) as unknown as T[],
                };
              }
              if (sql.includes('FROM orders') && (sql.includes("DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ?") || sql.includes("DATE(datetime(COALESCE(cod_paid_at, created_at), '+7 hours')) BETWEEN ? AND ?"))) {
                const from = String(args[0]);
                const to = String(args[1]);
                const matched = [...orders.values()].filter((o) => {
                  const raw = String(o.created_at || '');
                  const utcMs = Date.parse(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
                  const ictDate = new Date(utcMs + 7 * 3600_000).toISOString().slice(0, 10);
                  return ictDate >= from && ictDate <= to && o.status !== 'cancelled';
                });

                if (sql.includes('GROUP BY method')) {
                  if (matched.length === 0) return { results: [] };
                  const sum = matched.reduce((acc, o) => acc + Number(o.total || 0), 0);
                  return {
                    results: [{ method: 'cash', count: matched.length, total: sum }] as unknown as T[],
                  };
                }

                if (sql.includes('SUM(')) {
                  const totalCollected = matched.reduce((acc, o) => acc + Number(o.total || 0), 0);
                  const shippingFee = matched.reduce((acc, o) => acc + Number(o.shipping_fee || 0), 0);
                  const serviceFee = matched.reduce((acc, o) => acc + Number(o.service_fee || 0), 0);
                  const tipAmount = matched.reduce((acc, o) => acc + Number(o.tip_amount || 0), 0);
                  const discounts = matched.reduce((acc, o) => acc + Number(o.discount || 0), 0);
                  return {
                    results: [{
                      date: (matched[0]?.created_at ? new Date(Date.parse(String(matched[0].created_at).includes('T') ? String(matched[0].created_at) : `${String(matched[0].created_at).replace(' ', 'T')}Z`) + 7 * 3600_000).toISOString().slice(0, 10) : ''),
                      orders: matched.length,
                      total_collected: totalCollected,
                      shipping_fee: shippingFee,
                      service_fee: serviceFee,
                      tip_amount: tipAmount,
                      discounts: discounts,
                    }] as unknown as T[],
                  };
                }

                const byDate = new Map<string, { date: string; orders: number; net_revenue: number; discounts: number }>();
                for (const o of matched) {
                  const raw = String(o.created_at || '');
                  const utcMs = Date.parse(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
                  const ictDate = new Date(utcMs + 7 * 3600_000).toISOString().slice(0, 10);
                  const cur = byDate.get(ictDate) || { date: ictDate, orders: 0, net_revenue: 0, discounts: 0 };
                  cur.orders += 1;
                  cur.net_revenue += Number(o.total || 0);
                  cur.discounts += Number(o.discount || 0);
                  byDate.set(ictDate, cur);
                }
                return { results: [...byDate.values()] as unknown as T[] };
              }
              if (sql.includes('FROM purchase_order_items WHERE purchase_order_id = ?')) {
                const poId = String(args[0]);
                const matched = [...purchaseOrderItems.values()].filter((i) => String(i.purchase_order_id) === poId);
                return { results: matched.map((i) => ({ ...i })) as unknown as T[] };
              }
              if (sql.includes('FROM purchase_order_items WHERE id = ?')) {
                const item = purchaseOrderItems.get(String(args[0]));
                return { results: (item ? [{ ...item }] : []) as unknown as T[] };
              }
              if (sql.includes('FROM inventory_transactions t')) {
                return {
                  results: [{ date: '2026-11-18', cogs: 24000, waste_cost: 3000 }] as unknown as T[],
                };
              }
              if (sql.includes('FROM refunds r')) {
                // Simulate a deployment without the standalone refunds table so the
                // handler falls back to the payments refund ledger.
                throw new Error('no such table: refunds');
              }
              if (sql.includes('FROM payments') && sql.includes('refund_amount')) {
                const byDate = new Map<string, { date: string; refunds: number }>();
                for (const p of payments) {
                  if (Number(p.refund_amount || 0) <= 0) continue;
                  const raw = String(p.created_at || '');
                  const utcMs = Date.parse(raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`);
                  if (!Number.isFinite(utcMs)) continue;
                  const ictDate = new Date(utcMs + 7 * 3600_000).toISOString().slice(0, 10);
                  const cur = byDate.get(ictDate) || { date: ictDate, refunds: 0 };
                  cur.refunds += Number(p.refund_amount || 0);
                  byDate.set(ictDate, cur);
                }
                return { results: [...byDate.values()] as unknown as T[] };
              }
              if (sql.includes('FROM shift_reconciliations')) {
                return { results: shiftReconciliations as unknown as T[] };
              }
              return { results: [] };
            },
            async run(): Promise<{ meta: { changes: number } }> {
              if (sql.includes('UPDATE customers SET loyalty_points = loyalty_points - ?')) {
                const pts = Number(args[0]);
                const custId = String(args[1]);
                const minPts = Number(args[2]);
                const c = customers.get(custId);
                if (!c || c.loyalty_points < minPts) {
                  return { meta: { changes: 0 } };
                }
                c.loyalty_points -= pts;
                return { meta: { changes: 1 } };
              }
              if (sql.includes('UPDATE customers SET loyalty_points = COALESCE(loyalty_points, 0) + ?')) {
                const pts = Number(args[0]);
                const custId = String(args[1]);
                const c = customers.get(custId);
                if (c) c.loyalty_points += pts;
                return { meta: { changes: 1 } };
              }
              if (sql.includes('INSERT INTO loyalty_transactions')) {
                const isRefund = sql.includes("'refund_redeem'");
                loyaltyTx.push({
                  id: String(args[0]),
                  customer_id: String(args[1]),
                  order_id: String(args[2]),
                  points: Number(args[3]),
                  type: isRefund ? 'refund_redeem' : 'redeem',
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes('INSERT INTO orders')) {
                const hasLoyaltyCol = sql.includes('loyalty_points_redeemed');
                const id = String(args[0]);
                // Literal-aware parse handles both bound domain inserts and raw test
                // seeds that inline literal values. Normalize numeric/date fields after.
                const parsed = parseInsertRow(sql, args, 'orders');
                if (parsed) {
                  const row = parsed;
                  row.total = Number(row.total || 0);
                  row.shipping_fee = Number(row.shipping_fee || 0);
                  row.service_fee = Number(row.service_fee || 0);
                  row.tip_amount = Number(row.tip_amount || 0);
                  row.discount = Number(row.discount || 0);
                  row.tenant_id = row.tenant_id ?? 'default';
                  orders.set(String(row.id ?? id), row);
                  return { meta: { changes: 1 } };
                }
                // Fallback: domain createOrder positional shape (all values bound).
                orders.set(id, {
                  id,
                  items: args[1],
                  total: Number(args[2]),
                  status: args[3],
                  customer_name: args[4],
                  customer_phone: args[5],
                  payment_method: args[8],
                  payment_status: args[9],
                  shipping_fee: Number(args[10] || 0),
                  discount: Number(args[11] || 0),
                  loyalty_points_redeemed: hasLoyaltyCol ? Number(args[12] || 0) : 0,
                  customer_id: hasLoyaltyCol ? args[19] : args[18],
                  tenant_id: hasLoyaltyCol ? args[20] : args[19],
                  created_at: '2026-11-18T15:30:00.000Z',
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes('INSERT INTO purchase_orders')) {
                const row = parseInsertRow(sql, args, 'purchase_orders');
                if (!row) return { meta: { changes: 0 } };
                purchaseOrders.set(String(row.id), row);
                return { meta: { changes: 1 } };
              }
              if (sql.includes('INSERT INTO purchase_order_items')) {
                const row = parseInsertRow(sql, args, 'purchase_order_items');
                if (!row) return { meta: { changes: 0 } };
                row.received_quantity = Number(row.received_quantity || 0);
                row.quantity = Number(row.quantity || 0);
                row.unit_price = Number(row.unit_price || 0);
                purchaseOrderItems.set(String(row.id), row);
                return { meta: { changes: 1 } };
              }
              if (sql.includes('UPDATE purchase_order_items SET received_quantity = COALESCE(received_quantity, 0) + ?')) {
                // Atomic relative increment: args = [addQty, id, addQty(guard), ...]
                const addQty = Number(args[0]);
                const id = String(args[1]);
                const item = purchaseOrderItems.get(id);
                if (!item) return { meta: { changes: 0 } };
                const next = Number(item.received_quantity || 0) + addQty;
                if (next > Number(item.quantity || 0)) return { meta: { changes: 0 } };
                item.received_quantity = next;
                return { meta: { changes: 1 } };
              }
              if (sql.includes('UPDATE purchase_orders SET status = ?')) {
                const id = String(args[2]);
                const po = purchaseOrders.get(id);
                if (!po) return { meta: { changes: 0 } };
                po.status = String(args[0]);
                return { meta: { changes: 1 } };
              }
              if (sql.includes('UPDATE ingredients SET current_stock = current_stock + ?')) {
                const addQty = Number(args[0]);
                const id = String(args[3]);
                const ing = ingredients.get(id);
                if (ing) {
                  ing.current_stock = Number(ing.current_stock || 0) + addQty;
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              if (sql.includes('INSERT INTO stock_movements')) {
                stockMovements.push({
                  id: args[0],
                  ingredient_id: args[1],
                  type: args[2],
                  quantity: args[3],
                  reference_id: args[4],
                  reference_type: args[5],
                  tenant_id: args[9] ?? 'default',
                });
                return { meta: { changes: 1 } };
              }
              if (sql.includes('INSERT INTO payments')) {
                // Literal-aware parse so seeds that inline refund_amount/created_at
                // are not shifted by the bound-args-only positional mapping.
                const parsed = parseInsertRow(sql, args, 'payments');
                if (parsed) {
                  parsed.refund_amount = Number(parsed.refund_amount || 0);
                  payments.push(parsed);
                  return { meta: { changes: 1 } };
                }
                const colsMatch = sql.match(/INSERT INTO payments\s*\(([^)]*)\)/i);
                const cols = (colsMatch?.[1] || '').split(',').map((c) => c.trim()).filter(Boolean);
                const row: Record<string, unknown> = {};
                cols.forEach((col, i) => {
                  row[col] = args[i];
                });
                payments.push(row);
                return { meta: { changes: 1 } };
              }
              if (sql.includes('UPDATE orders SET') && sql.includes('status = ?')) {
                const newStatus = String(args[0]);
                for (const [k, v] of orders.entries()) {
                  if (args.includes(k)) {
                    v.status = newStatus;
                  }
                }
                return { meta: { changes: 1 } };
              }
              if (sql.includes('INSERT INTO shift_reconciliations')) {
                const colMatch = sql.match(/INSERT INTO shift_reconciliations\s*\(([^)]+)\)/i);
                const cols = colMatch ? colMatch[1].split(',').map((c) => c.trim()) : [];
                const row: Record<string, unknown> = { tenant_id: 'default' };
                cols.forEach((col, i) => {
                  row[col] = args[i];
                });
                row.created_at = '2026-11-18T15:45:00.000Z';
                shiftReconciliations.push(row);
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 1 } };
            },
          };
          return stmt;
      };
      const direct = buildStatement([]);
      return {
        first: direct.first,
        run: direct.run,
        all: direct.all,
        bind(...args: unknown[]) {
          return buildStatement(args);
        },
      };
    },
  };

  return db;
}

describe('Store Operations Go-Live Readiness Suite', () => {
  const JWT_SECRET = 'store-go-live-secret-32-chars-minimum!!';

  beforeEach(() => {
    resetLoginRateLimitMemory();
  });

  it('redeems loyalty points atomically at checkout (100 pts = 10,000 VND) and refunds points on order cancellation', async () => {
    const mockDb = createStoreMockDb();
    const customerToken = await generateJWT(
      { sub: 'cust_sadec_1', role: 'customer', tenant_id: 'default' },
      JWT_SECRET,
      3600
    );

    const env = {
      AURA_DB: mockDb as unknown as Env['AURA_DB'],
      JWT_SECRET,
    } as unknown as Record<string, unknown>;

    // 1. Over-redemption beyond balance (250 pts) is rejected
    const overReq = new Request('https://auraspace.cafe/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        customer_id: 'cust_sadec_1',
        customer_name: 'Nguyễn Văn Sa Đéc',
        customer_phone: '0909123456',
        total: 90000,
        items: [{ id: 'prod_cf_sua', name: 'Cà Phê Sữa Đá Sa Đéc', price: 45000, quantity: 2 }],
        payment_method: 'cod',
        order_type: 'takeaway',
        redeem_points: 300,
      }),
    });
    const overRes = await createOrder(overReq, env);
    expect(overRes.status).toBe(400);
    expect(mockDb.customers.get('cust_sadec_1')?.loyalty_points).toBe(250);

    // 2. Valid 150-point redemption deducts 15,000 VND from 90,000 VND subtotal -> 75,000 VND total
    const okReq = new Request('https://auraspace.cafe/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        customer_id: 'cust_sadec_1',
        customer_name: 'Nguyễn Văn Sa Đéc',
        customer_phone: '0909123456',
        total: 90000,
        items: [{ id: 'prod_cf_sua', name: 'Cà Phê Sữa Đá Sa Đéc', price: 45000, quantity: 2 }],
        payment_method: 'cod',
        order_type: 'takeaway',
        redeem_points: 150,
      }),
    });
    const okRes = await createOrder(okReq, env);
    expect(okRes.status).toBe(201);
    const createdBody = (await okRes.json()) as {
      data: { id: string; total: number; discount: number; loyalty_points_redeemed: number };
    };
    expect(createdBody.data.discount).toBe(15000);
    expect(createdBody.data.total).toBe(75000);
    expect(createdBody.data.loyalty_points_redeemed).toBe(150);
    expect(mockDb.customers.get('cust_sadec_1')?.loyalty_points).toBe(100);
    expect(mockDb.loyaltyTx.some((t) => t.type === 'redeem' && t.points === -150)).toBe(true);

    // 3. Cancelling the order restores the 150 redeemed points back to the customer (idempotent)
    const cancelReq = new Request(`https://auraspace.cafe/api/orders/${createdBody.data.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    const cancelRes = await updateOrder(cancelReq, env, createdBody.data.id, 'owner', 'default');
    expect(cancelRes.status).toBe(200);
    expect(mockDb.customers.get('cust_sadec_1')?.loyalty_points).toBe(250);
    expect(mockDb.loyaltyTx.some((t) => t.type === 'refund_redeem' && t.points === 150)).toBe(true);
  });

  it('buckets 22:30 Vietnam ICT evening orders into the correct local store day in P&L and Cash Reconciliation reports', async () => {
    const mockDb = createStoreMockDb();
    const ownerToken = await generateJWT(
      { sub: 'owner_1', role: 'owner', tenant_id: 'default' },
      JWT_SECRET,
      3600
    );

    const env = {
      AURA_DB: mockDb as unknown as Env['AURA_DB'],
      JWT_SECRET,
      CASH_RECONCILIATION_ENABLED: 'true',
    } as Env;

    // Seed a 22:30 ICT order (15:30 UTC on 2026-11-18)
    mockDb.orders.set('ord_evening_2230', {
      id: 'ord_evening_2230',
      subtotal: 120000,
      discount: 10000,
      total: 110000,
      status: 'completed',
      payment_status: 'paid',
      payment_method: 'cash',
      tenant_id: 'default',
      created_at: '2026-11-18T15:30:00.000Z',
    });

    const app = new Hono<{ Bindings: Env }>();
    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 'owner_1', role: 'owner', tenant_id: 'default' } as never);
      await next();
    });
    reconciliationRoutes(app);
    app.route('/api/reports', reportsRouter);

    // 1. Reconcile evening cash drawer with VND denominations
    const recRes = await app.request(
      'https://auraspace.cafe/api/shifts/shift_evening_1/reconcile',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ownerToken}`,
        },
        body: JSON.stringify({
          opening_float: 500000,
          denominations: [
            { denomination: 500000, count: 1 },
            { denomination: 200000, count: 1 },
            { denomination: 100000, count: 1 },
          ],
          notes: 'Chốt ca tối Container Sa Đéc',
        }),
      },
      env
    );
    expect(recRes.status).toBe(201);
    const recBody = (await recRes.json()) as { data: { expected_cash: number; actual_cash: number; variance: number } };
    expect(recBody.data.expected_cash).toBe(800000); // 500k float + 350k cash in - 50k payout
    expect(recBody.data.actual_cash).toBe(800000);
    expect(recBody.data.variance).toBe(0);

    // 2. P&L report attributes 22:30 ICT order + BOM COGS to 2026-11-18
    const pnlRes = await app.request(
      'https://auraspace.cafe/api/reports/pnl?from=2026-11-18&to=2026-11-18',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env
    );
    expect(pnlRes.status).toBe(200);
    const pnlJson = (await pnlRes.json()) as {
      data: { totals: { net_revenue: number; discounts: number; cogs: number; waste_cost: number; gross_profit: number } };
    };
    expect(pnlJson.data.totals.net_revenue).toBe(110000);
    expect(pnlJson.data.totals.discounts).toBe(10000);
    expect(pnlJson.data.totals.cogs).toBe(24000);
    expect(pnlJson.data.totals.waste_cost).toBe(3000);
    expect(pnlJson.data.totals.gross_profit).toBe(83000);

    // 3. Reconciliation report returns the counted shift when enabled
    const shiftRepRes = await app.request(
      'https://auraspace.cafe/api/reports/reconciliation?from=2026-11-18&to=2026-11-18',
      { headers: { Authorization: `Bearer ${ownerToken}` } },
      env
    );
    expect(shiftRepRes.status).toBe(200);
    const shiftRepJson = (await shiftRepRes.json()) as { data: { shifts: unknown[]; totals: { cash_actual: number } } };
    expect(shiftRepJson.data.shifts).toHaveLength(1);
    expect(shiftRepJson.data.totals.cash_actual).toBe(800000);
    // 4. Reconciliation route resolves AuthUser.tenantId (camelCase) for franchise tenant isolation & HQ access
    const franchiseApp = new Hono<{ Bindings: Env }>();
    franchiseApp.use('*', async (c, next) => {
      c.set('user' as never, { id: 'staff_cantho_1', role: 'staff', tenantId: 'store-cantho' } as never);
      await next();
    });
    reconciliationRoutes(franchiseApp);
    const crossTenantRes = await franchiseApp.request(
      'https://auraspace.cafe/api/shifts/shift_evening_1/reconciliation?tenant_id=default',
      {},
      env
    );
    expect(crossTenantRes.status).toBe(403);
  });

  it('blocks brute-force login after 5 failed attempts and fails closed (503) in production when AUTH_KV errors', async () => {
    const kvStore = new Map<string, string>();
    const healthyKv = {
      get: async (k: string) => kvStore.get(k) ?? null,
      put: async (k: string, v: string) => {
        kvStore.set(k, v);
      },
      delete: async (k: string) => {
        kvStore.delete(k);
      },
    };

    const app = new Hono<{ Bindings: Env }>();
    app.post('/login', loginRateLimit(), (c) => c.json({ ok: false, error: 'Invalid password' }, 401));

    const prodEnv = { ENVIRONMENT: 'production', AUTH_KV: healthyKv as unknown as Env['AUTH_KV'] } as Env;

    for (let i = 0; i < 5; i++) {
      const r = await app.request(
        'https://auraspace.cafe/login',
        { method: 'POST', headers: { 'CF-Connecting-IP': '203.113.10.9' } },
        prodEnv
      );
      expect(r.status).toBe(401);
    }

    // 6th attempt from same IP is blocked with 429 even if attacker rotates X-Forwarded-For
    const sixth = await app.request(
      'https://auraspace.cafe/login',
      {
        method: 'POST',
        headers: {
          'CF-Connecting-IP': '203.113.10.9',
          'X-Forwarded-For': '198.51.100.77',
        },
      },
      prodEnv
    );
    expect(sixth.status).toBe(429);

    // Broken AUTH_KV in production fails closed with 503 on authEndpointsRouter
    const brokenEnv = {
      ENVIRONMENT: 'production',
      AUTH_KV: {
        get: async () => {
          throw new Error('KV outage');
        },
        put: async () => {
          throw new Error('KV outage');
        },
      } as unknown as Env['AUTH_KV'],
    } as Env;

    const authApp = new Hono<{ Bindings: Env }>();
    authApp.route('/api/auth', authEndpointsRouter);
    const outageRes = await authApp.request(
      'https://auraspace.cafe/api/auth/login',
      {
        method: 'POST',
        headers: { 'CF-Connecting-IP': '203.113.10.55', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'secret' }),
      },
      brokenEnv
    );
    expect(outageRes.status).toBe(503);
  });

  it('caps loyalty point redemption at 50% of subtotal and enforces QR placeholder exclusion in VALID_REVENUE_ORDER_SQL', async () => {
    const mockDb = createStoreMockDb();
    mockDb.customers.set('cust_vip_600', {
      id: 'cust_vip_600',
      tenant_id: 'default',
      loyalty_points: 600,
    });
    const customerToken = await generateJWT(
      { sub: 'cust_vip_600', role: 'customer', tenant_id: 'default' },
      JWT_SECRET,
      3600
    );
    const env = {
      AURA_DB: mockDb as unknown as Env['AURA_DB'],
      JWT_SECRET,
    } as unknown as Record<string, unknown>;

    const req = new Request('https://auraspace.cafe/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${customerToken}`,
      },
      body: JSON.stringify({
        customer_id: 'cust_vip_600',
        customer_name: 'VIP Sa Đéc',
        customer_phone: '0909888999',
        total: 90000,
        items: [{ id: 'prod_cf_sua', name: 'Cà Phê Sữa Đá Sa Đéc', price: 45000, quantity: 2 }],
        payment_method: 'cod',
        order_type: 'takeaway',
        redeem_points: 600,
      }),
    });
    const res = await createOrder(req, env);
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      data: { total: number; discount: number; loyalty_points_redeemed: number };
    };
    // 50% of 90,000 VND = 45,000 VND = 450 points maximum
    expect(body.data.loyalty_points_redeemed).toBe(450);
    expect(body.data.discount).toBe(45000);
    expect(body.data.total).toBe(45000);
    expect(mockDb.customers.get('cust_vip_600')?.loyalty_points).toBe(150);

    // VALID_REVENUE_ORDER_SQL must exclude QR check-in placeholders and cancelled payment_status
    expect(VALID_REVENUE_ORDER_SQL).toContain("Khách QR - cho don mon");
    expect(VALID_REVENUE_ORDER_SQL).toContain("'cancelled'");
    expect(VALID_REVENUE_ORDER_SQL).toContain("'canceled'");
  });

  // ── Phase 37: Lượt 10 integration suite ──────────────────────────────

  describe('Lượt 10 integration', () => {
    const setupStoreDb = () => createStoreMockDb();

    it('per-store cash reconciliation opt-out returns 501 PILOT_CASH_RECONCILIATION_DISABLED while default store succeeds', async () => {
      const tenantDisabled = 'store-cantho';
      const env = {
        CASH_RECONCILIATION_ENABLED: 'true',
        CASH_RECONCILIATION_DISABLED_TENANTS: tenantDisabled,
        JWT_SECRET: 'test-secret-16-chars',
        AURA_DB: setupStoreDb() as unknown as Env['AURA_DB'],
      } as unknown as Record<string, unknown>;
      const ownerToken = await generateJWT(
        { sub: 'owner_1', role: 'owner', tenant_id: '*' },
        'test-secret-16-chars',
        3600
      );

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'owner_1', role: 'owner', tenant_id: '*' });
        await next();
      });
      reconciliationRoutes(app);
      const recReq = new Request(
        'https://auraspace.cafe/api/shifts/shift_evening_1/reconcile',
        { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-cantho', Authorization: `Bearer ${ownerToken}` } }
      );
      const res = await app.request(recReq, undefined, env as never);
      // Opted-out store returns 501
      expect(res.status).toBe(501);
      const body = (await res.json()) as { code?: string };
      expect(body.code).toBe('PILOT_CASH_RECONCILIATION_DISABLED');

      // Default store (not in disabled list) proceeds
      const defaultEnv = {
        ...env,
        CASH_RECONCILIATION_DISABLED_TENANTS: '',
        AURA_DB: setupStoreDb() as unknown as Env['AURA_DB'],
      } as unknown as Record<string, unknown>;
      const defaultApp = new Hono<{ Bindings: Env }>();
      defaultApp.use('*', async (c, next) => {
        c.set('user', { id: 'owner_1', role: 'owner', tenant_id: '*' });
        await next();
      });
      reconciliationRoutes(defaultApp);
      const defaultReq = new Request(
        'https://auraspace.cafe/api/shifts/shift_evening_1/reconcile',
        { method: 'POST', headers: { 'Content-Type': 'application/json' } }
      );
      const defaultRes = await defaultApp.request(defaultReq, undefined, defaultEnv as never);
      expect(defaultRes.status).not.toBe(501);
    });

    it('/api/reports/pnl separates pure F&B net_revenue from pass-through fees and aggregates refunded payments when no refunds table', async () => {
      const db = setupStoreDb();
      // Seed orders with fees + a refunded payment (no standalone refunds table)
      const now = new Date('2026-11-18T12:00:00.000Z').toISOString();
      await db.prepare(
        "INSERT INTO orders (id, tenant_id, status, payment_status, total, shipping_fee, service_fee, tip_amount, discount, created_at) VALUES (?, 'default', 'completed', 'completed', 150000, 15000, 10000, 5000, 10000, ?)"
      ).bind('order_pnl_1', now).run();
      await db.prepare(
        "INSERT INTO orders (id, tenant_id, status, payment_status, total, shipping_fee, service_fee, tip_amount, discount, created_at) VALUES (?, 'default', 'completed', 'completed', 100000, 0, 0, 0, 0, ?)"
      ).bind('order_pnl_2', now).run();
      await db.prepare(
        "INSERT INTO payments (id, order_id, tenant_id, refund_amount, refund_status, created_at) VALUES (?, 'order_pnl_2', 'default', 40000, 'refunded', ?)"
      ).bind('payment_pnl_2', now).run();

      const env = {
        AURA_DB: db as unknown as Env['AURA_DB'],
        JWT_SECRET: 'test-secret-16-chars',
      } as unknown as Record<string, unknown>;

      const { token: ownerToken } = await issueStaffSession(
        env as { JWT_SECRET: string },
        { id: 'owner_1', name: 'Chủ quán Sa Đéc', phone: '0909123456', role: 'owner', tenant_id: 'default', is_active: 1, auth_version: 1 },
        { sessionType: 'staff-web' }
      );

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/reports', reportsRouter);
      const res = await app.request(
        'https://auraspace.cafe/api/reports/pnl?from=2026-11-18&to=2026-11-18',
        {
          headers: { Authorization: `Bearer ${ownerToken}`, 'X-Tenant-Id': 'default' },
        },
        env as never
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: {
          daily: Array<{ net_revenue: number; shipping_fee: number; service_fee: number; tip_amount: number; total_collected: number; refunds: number; gross_sales: number }>;
          totals: { net_revenue: number; shipping_fee: number; service_fee: number; tip_amount: number; total_collected: number; refunds: number; gross_sales: number };
        };
      };
      const day = body.data.daily.find((d) => d.date === '2026-11-18');
      expect(day?.total_collected).toBe(210000);
      expect(day?.shipping_fee).toBe(15000);
      expect(day?.service_fee).toBe(10000);
      expect(day?.tip_amount).toBe(5000);
      // pure F&B net_revenue = total_collected - shipping - service - tip - refunds
      expect(day?.net_revenue).toBe(Math.max(0, 250000 - 15000 - 10000 - 5000 - 40000));
      // gross_sales = baseNetBeforeRefunds + discounts
      expect(day?.gross_sales).toBe(250000 - 15000 - 10000 - 5000 + 10000);
      // refund aggregated from payments (no refunds table)
      expect(day?.refunds).toBe(40000);
      expect(body.data.totals.refunds).toBe(40000);
    });

    it('domain receivePurchaseOrder uses atomic relative COALESCE(received_quantity, 0) + ?', async () => {
      const db = setupStoreDb();
      await db.prepare(
        "INSERT INTO purchase_orders (id, tenant_id, status, total_amount, created_at) VALUES ('po_atomic_1', 'default', 'pending', 200000, ?)"
      ).bind(new Date('2026-11-18T08:00:00.000Z').toISOString()).run();
      await db.prepare(
        "INSERT INTO purchase_order_items (id, purchase_order_id, ingredient_id, quantity, unit_price, total_price, received_quantity) VALUES ('poi_atomic_1', 'po_atomic_1', 'ing_atomic_1', 10, 20000, 200000, 2)"
      ).run();

      const result = await receivePurchaseOrder(
        db as unknown as Parameters<typeof receivePurchaseOrder>[0],
        'po_atomic_1',
        [{ ingredientId: 'ing_atomic_1', receivedQuantity: 3 }],
        { tenantId: 'default' }
      );
      expect(result.ok).toBe(true);
      expect(result.status).toBe('partially_received');

      const row = await db.prepare('SELECT received_quantity FROM purchase_order_items WHERE id = ?').bind('poi_atomic_1').first();
      expect(Number((row as { received_quantity: number })?.received_quantity)).toBe(5);
    });

    it('/api/reports/export excludes 0đ QR check-in placeholder rows and cancelled payment_status', async () => {
      const db = setupStoreDb();
      await db.prepare(
        "INSERT INTO orders (id, tenant_id, status, payment_status, total, customer_name, items, created_at) VALUES ('export_qr_1', 'default', 'completed', 'completed', 0, 'Khách QR - cho don mon', '', ?)"
      ).bind(new Date('2026-11-18T09:00:00.000Z').toISOString()).run();
      await db.prepare(
        "INSERT INTO orders (id, tenant_id, status, payment_status, total, customer_name, items, created_at) VALUES ('export_cancel_1', 'default', 'cancelled', 'cancelled', 100000, 'Khách hàng', '[]', ?)"
      ).bind(new Date('2026-11-18T09:05:00.000Z').toISOString()).run();
      await db.prepare(
        "INSERT INTO orders (id, tenant_id, status, payment_status, total, customer_name, items, created_at) VALUES ('export_ok_1', 'default', 'completed', 'completed', 150000, 'Khách thật', '[{\"id\":\"p1\"}]', ?)"
      ).bind(new Date('2026-11-18T09:10:00.000Z').toISOString()).run();

      const env = {
        AURA_DB: db as unknown as Env['AURA_DB'],
        JWT_SECRET,
      } as unknown as Record<string, unknown>;

      const { token: ownerToken } = await issueStaffSession(
        env as { JWT_SECRET: string },
        { id: 'owner_1', name: 'Chủ quán Sa Đéc', phone: '0909123456', role: 'owner', tenant_id: 'default', is_active: 1, auth_version: 1 },
        { sessionType: 'staff-web' }
      );

      const app2 = new Hono<{ Bindings: Env }>();
      app2.route('/api/reports', reportsRouter);
      const res = await app2.request('https://auraspace.cafe/api/reports/export?type=orders&from=2026-11-18&to=2026-11-18', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      }, env);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type') || '').toContain('text/csv');
      // CSV body: BOM + header row + one row per surviving order.
      const csv = (await res.text()).replace(/^﻿/, '').trim();
      const lines = csv.split('\n');
      expect(lines[0]).toContain('id');
      const body = lines.slice(1).join('\n');
      expect(body).not.toContain('export_qr_1');
      expect(body).not.toContain('export_cancel_1');
      expect(body).toContain('export_ok_1');
    });
  });

  describe('Lượt 10 validation', () => {
    it('VALID_EXPORT_ORDER_SQL excludes cancelled/canceled payment_status and 0đ QR placeholders', () => {
      // VALID_EXPORT_ORDER_SQL imported at top of file
      expect(VALID_EXPORT_ORDER_SQL).toContain("'cancelled'");
      expect(VALID_EXPORT_ORDER_SQL).toContain("'canceled'");
      expect(VALID_EXPORT_ORDER_SQL).toContain("Khách QR - cho don mon");
      expect(VALID_EXPORT_ORDER_SQL).toContain("COALESCE(total, 0) = 0");
    });
  });
});
