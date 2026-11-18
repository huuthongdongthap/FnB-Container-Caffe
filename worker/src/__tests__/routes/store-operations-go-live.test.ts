import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { createOrder, updateOrder } from '@aura/domain-order';
import { reportsRouter } from '../../routes/reports';
import { reconciliationRoutes } from '@aura/domain-shift';
import { loginRateLimit, resetLoginRateLimitMemory } from '../../middleware/rate-limit-login';
import { authEndpointsRouter } from '../../routes/auth-endpoints';
import { generateJWT } from '../../lib/jwt';

function createStoreMockDb() {
  const customers = new Map<string, { id: string; tenant_id: string; loyalty_points: number }>([
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

  const db = {
    customers,
    orders,
    loyaltyTx,
    shiftReconciliations,
    async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
      const out = [];
      for (const s of stmts) {
        out.push(await s.run());
      }
      return out;
    },
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
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
              if (sql.includes('FROM shifts WHERE id = ?') || sql.includes('FROM staff_shifts WHERE id = ?')) {
                const id = String(args[0]);
                const s = shifts.get(id);
                return (s ? { ...s } : null) as T | null;
              }
              if (sql.includes('FROM shift_reconciliations WHERE shift_id = ?')) {
                const shiftId = String(args[0]);
                const found = shiftReconciliations.find((r) => r.shift_id === shiftId);
                return (found ? { ...found } : null) as T | null;
              }
              if (sql.includes('FROM payments') && (sql.includes('SUM(') || sql.includes("payment_method = 'cash'"))) {
                return { total: 350000 } as unknown as T;
              }
              if (sql.includes('FROM cash_payouts')) {
                return { total: 50000 } as unknown as T;
              }
              return null;
            },
            async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
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
              if (sql.includes('FROM orders') && sql.includes("DATE(datetime(created_at, '+7 hours')) BETWEEN ? AND ?")) {
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
              if (sql.includes('FROM inventory_transactions t')) {
                return {
                  results: [{ date: '2026-11-18', cogs: 24000, waste_cost: 3000 }] as unknown as T[],
                };
              }
              if (sql.includes('FROM refunds r')) {
                return { results: [] };
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
                shiftReconciliations.push({
                  id: args[0],
                  shift_id: args[1],
                  staff_id: args[2],
                  opening_float: args[3],
                  expected_cash: args[4],
                  actual_cash: args[5],
                  variance: args[6],
                  variance_status: args[7],
                  denominations: args[8],
                  cash_payment_total: args[9],
                  cash_payout_total: args[10],
                  tenant_id: 'default',
                  created_at: '2026-11-18T15:45:00.000Z',
                });
                return { meta: { changes: 1 } };
              }
              return { meta: { changes: 1 } };
            },
          };
          return stmt;
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
});
