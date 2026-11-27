// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { calculateOrderConsumption, deductOrderStock } from '../../../packages/domain/inventory/src/policies/inventory-recipe-policy';
import { restoreInventoryForOrder } from '../../../packages/domain/inventory/src/routes/order-deduction';
import { QueryBooleanSchema } from '../schemas/common';
import { PurchaseOrderStatusEnum } from '../schemas/inventory/purchase-orders';
import { nameSchema } from '../lib/validators/common';
import { reservationsRouter, waitlistRouter } from '../../../packages/domain/reservation/src/routes/reservations';
import { createRecruitmentApplication } from '../lib/recruitment-creation';
import type { Env } from '../types/env';

function createSqliteD1(db: DatabaseSync): D1Database {
  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          bound = args;
          return stmt;
        },
        async first<T = Record<string, unknown>>() {
          const prepared = db.prepare(sql);
          const row = prepared.get(...(bound as never[])) as T | undefined;
          return row ?? null;
        },
        async all<T = Record<string, unknown>>() {
          const prepared = db.prepare(sql);
          const results = prepared.all(...(bound as never[])) as T[];
          return { results, success: true, meta: { changes: 0 } };
        },
        async run() {
          const prepared = db.prepare(sql);
          const info = prepared.run(...(bound as never[]));
          return { success: true, meta: { changes: Number(info.changes ?? 0) } };
        },
      };
      return stmt;
    },
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      const results = [];
      for (const s of statements) {
        results.push(await s.run());
      }
      return results;
    },
    async exec(sql: string) {
      db.exec(sql);
      return { count: 1, duration: 0 };
    },
  } as unknown as D1Database;
}

describe('Issue #261: Inventory, BOM, Forecasting & Catalog regressions', () => {
  let sqlite: DatabaseSync;
  let d1: D1Database;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE ingredients (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        name TEXT NOT NULL,
        unit TEXT NOT NULL,
        current_stock REAL NOT NULL DEFAULT 0,
        min_stock REAL NOT NULL DEFAULT 0,
        cost_per_unit REAL NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT
      );
      CREATE TABLE recipes (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        product_id TEXT NOT NULL,
        ingredient_id TEXT,
        quantity REAL DEFAULT 0,
        name TEXT,
        instructions TEXT,
        is_active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE recipe_items (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        recipe_id TEXT NOT NULL,
        ingredient_id TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit TEXT NOT NULL DEFAULT 'g'
      );
      CREATE TABLE stock_movements (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        ingredient_id TEXT NOT NULL,
        type TEXT NOT NULL,
        quantity REAL NOT NULL,
        reference_id TEXT,
        reference_type TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);
    d1 = createSqliteD1(sqlite);
  });

  it('deducts ALL ingredients when a product has multiple recipe rows (tc002: coffee + milk)', async () => {
    sqlite.exec(`
      INSERT INTO ingredients (id, name, unit, current_stock, cost_per_unit) VALUES
        ('ing-coffee', 'Coffee Beans', 'g', 1000, 100),
        ('ing-milk', 'Fresh Milk', 'ml', 2000, 50);
      INSERT INTO recipes (id, product_id, ingredient_id, quantity, name, is_active) VALUES
        ('rec-1', 'tc002', 'ing-coffee', 20, 'Latte Coffee', 1),
        ('rec-2', 'tc002', 'ing-milk', 70, 'Latte Milk', 1);
      INSERT INTO recipe_items (id, recipe_id, ingredient_id, quantity, unit) VALUES
        ('ri-1', 'rec-1', 'ing-coffee', 20, 'g'),
        ('ri-2', 'rec-2', 'ing-milk', 70, 'ml');
    `);

    const calc = await calculateOrderConsumption(d1, [{ productId: 'tc002', quantity: 3 }], 'default');
    expect(calc.depletions).toHaveLength(2);
    const coffeeDep = calc.depletions.find((d) => d.ingredientId === 'ing-coffee');
    const milkDep = calc.depletions.find((d) => d.ingredientId === 'ing-milk');
    expect(coffeeDep?.quantity).toBe(60);
    expect(milkDep?.quantity).toBe(210);

    const res = await deductOrderStock(d1, 'ord-multi-1', [{ productId: 'tc002', quantity: 3 }], {
      allowNegative: true,
      tenantId: 'default',
    });
    expect(res.ok).toBe(true);

    const coffeeRow = sqlite.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get('ing-coffee') as { current_stock: number };
    const milkRow = sqlite.prepare('SELECT current_stock FROM ingredients WHERE id = ?').get('ing-milk') as { current_stock: number };
    expect(coffeeRow.current_stock).toBe(940);
    expect(milkRow.current_stock).toBe(1790);
  });

  it('records negative quantity for post-prep waste in stock_movements', async () => {
    sqlite.exec(`
      INSERT INTO ingredients (id, name, unit, current_stock) VALUES ('ing-coffee', 'Coffee', 'g', 960);
      INSERT INTO stock_movements (id, ingredient_id, type, quantity, reference_id, reference_type) VALUES
        ('sm-1', 'ing-coffee', 'consumption', -40, 'ord-spoil-1', 'order');
    `);

    await restoreInventoryForOrder({ AURA_DB: d1 } as unknown as Env, 'ord-spoil-1', 'default', 'preparing');

    const wasteRow = sqlite
      .prepare("SELECT quantity FROM stock_movements WHERE reference_id = 'ord-spoil-1' AND type = 'waste'")
      .get() as { quantity: number } | undefined;
    expect(wasteRow).toBeDefined();
    expect(wasteRow!.quantity).toBe(-40);
  });

  it('parses QueryBooleanSchema strictly without inverting "false"', () => {
    expect(QueryBooleanSchema.parse('false')).toBe(false);
    expect(QueryBooleanSchema.parse('0')).toBe(false);
    expect(QueryBooleanSchema.parse('true')).toBe(true);
    expect(QueryBooleanSchema.parse('1')).toBe(true);
    expect(QueryBooleanSchema.safeParse('notabool').success).toBe(false);
  });

  it('accepts partially_received and partial in PurchaseOrderStatusEnum', () => {
    expect(PurchaseOrderStatusEnum.safeParse('partially_received').success).toBe(true);
    expect(PurchaseOrderStatusEnum.safeParse('partial').success).toBe(true);
  });

  it('rejects whitespace-only names in nameSchema', () => {
    expect(nameSchema.safeParse('   ').success).toBe(false);
    expect(nameSchema.parse('  Cà phê sữa  ')).toBe('Cà phê sữa');
  });
});

describe('Issue #264: Reservations, Waitlist & Recruitment regressions', () => {
  let sqlite: DatabaseSync;
  let d1: D1Database;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE cafe_tables (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        code TEXT,
        name TEXT,
        capacity INTEGER DEFAULT 4,
        zone TEXT DEFAULT 'indoor',
        status TEXT NOT NULL DEFAULT 'Available',
        current_session_id TEXT
      );
      CREATE TABLE reservations (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        table_id TEXT NOT NULL,
        customer_id TEXT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        guest_count INTEGER DEFAULT 2,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        zone TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'confirmed',
        created_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE table_sessions (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        table_id TEXT NOT NULL,
        reservation_id TEXT,
        guest_count INTEGER DEFAULT 2,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        started_at TEXT,
        closed_at TEXT,
        updated_at TEXT
      );
      CREATE TABLE waitlist (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        party_size INTEGER NOT NULL DEFAULT 2,
        zone TEXT DEFAULT 'indoor',
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'waiting',
        notified_at TEXT,
        seated_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL DEFAULT 'default',
        phone TEXT
      );
    `);
    d1 = createSqliteD1(sqlite);
  });

  function createReservationApp(user?: { id: string; role: string; phone?: string }) {
    const app = new Hono<{ Bindings: Env; Variables: { user?: unknown; tenantId?: string } }>();
    app.use('*', async (c, next) => {
      if (user) c.set('user', user);
      c.set('tenantId', 'default');
      await next();
    });
    app.route('/api/reservations', reservationsRouter);
    app.route('/api/waitlist', waitlistRouter);
    return app;
  }

  it('rejects invalid reservation inputs (blank name, bad phone, 2027-99-99, 99:99)', async () => {
    sqlite.exec(`INSERT INTO cafe_tables (id, code, name, capacity, status) VALUES ('t01', 'T01', 'Bàn 1', 4, 'Available')`);
    const app = createReservationApp({ id: 'cust-1', role: 'customer' });

    const badPayloads = [
      { table_id: 't01', customer_name: '   ', customer_phone: '0901234567', date: '2027-05-01', time: '10:00' },
      { table_id: 't01', customer_name: 'An', customer_phone: 'audit3notphone', date: '2027-05-01', time: '10:00' },
      { table_id: 't01', customer_name: 'An', customer_phone: '0901234567', date: '2027-99-99', time: '10:00' },
      { table_id: 't01', customer_name: 'An', customer_phone: '0901234567', date: '2027-05-01', time: '99:99' },
    ];

    for (const payload of badPayloads) {
      const res = await app.request(
        '/api/reservations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
        { AURA_DB: d1 } as unknown as Env
      );
      expect(res.status).toBe(400);
    }
  });

  it('allows logged-in customer to self-cancel own reservation (both via customer_id and phone fallback)', async () => {
    sqlite.exec(`
      INSERT INTO cafe_tables (id, code, name, capacity, status) VALUES ('t02', 'T02', 'Bàn 2', 4, 'Available');
      INSERT INTO customers (id, phone) VALUES ('cust-legacy', '0909888777');
      INSERT INTO reservations (id, table_id, customer_id, customer_name, customer_phone, date, time, status) VALUES
        ('rsv-owned', 't02', 'cust-1', 'Minh', '0901112223', '2027-06-01', '14:00', 'confirmed'),
        ('rsv-legacy', 't02', NULL, 'Lan', '+84 909-888-777', '2027-06-02', '15:00', 'confirmed');
    `);

    const app1 = createReservationApp({ id: 'cust-1', role: 'customer' });
    const res1 = await app1.request('/api/reservations/rsv-owned', { method: 'DELETE' }, { AURA_DB: d1 } as unknown as Env);
    expect(res1.status).toBe(200);

    const app2 = createReservationApp({ id: 'cust-legacy', role: 'customer' });
    const res2 = await app2.request('/api/reservations/rsv-legacy', { method: 'DELETE' }, { AURA_DB: d1 } as unknown as Env);
    expect(res2.status).toBe(200);
  });

  it('releases Occupied table and closes table_sessions when cancelling a future-day seated reservation', async () => {
    sqlite.exec(`
      INSERT INTO cafe_tables (id, code, name, capacity, status) VALUES ('t06', 'T06', 'Bàn 6', 4, 'Occupied');
      INSERT INTO reservations (id, table_id, customer_name, customer_phone, date, time, status) VALUES
        ('rsv-future-seated', 't06', 'Khách', '0901234567', '2027-12-31', '19:00', 'seated');
      INSERT INTO table_sessions (id, table_id, reservation_id, status, notes) VALUES
        ('sess-1', 't06', 'rsv-future-seated', 'active', 'reservation:rsv-future-seated');
    `);

    const staffApp = createReservationApp({ id: 'staff-1', role: 'manager' });
    const res = await staffApp.request(
      '/api/reservations/rsv-future-seated',
      { method: 'DELETE' },
      { AURA_DB: d1 } as unknown as Env
    );
    expect(res.status).toBe(200);

    const tableRow = sqlite.prepare('SELECT status FROM cafe_tables WHERE id = ?').get('t06') as { status: string };
    expect(tableRow.status).toBe('Available');

    const sessRow = sqlite.prepare('SELECT status FROM table_sessions WHERE id = ?').get('sess-1') as { status: string };
    expect(sessRow.status).not.toBe('active');
  });

  it('supports full Waitlist CRUD (POST, GET, PATCH, DELETE /api/waitlist)', async () => {
    const staffApp = createReservationApp({ id: 'staff-1', role: 'manager' });
    const env = { AURA_DB: d1 } as unknown as Env;

    const createRes = await staffApp.request(
      '/api/waitlist',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_name: 'Hùng', customer_phone: '0912345678', party_size: 3, zone: 'outdoor' }),
      },
      env
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as { data: { id: string; status: string } };
    expect(created.data.status).toBe('waiting');

    const listRes = await staffApp.request('/api/waitlist', { method: 'GET' }, env);
    expect(listRes.status).toBe(200);
    const listBody = (await listRes.json()) as { data: Array<{ id: string }> };
    expect(listBody.data.some((r) => r.id === created.data.id)).toBe(true);

    const patchRes = await staffApp.request(
      `/api/waitlist/${created.data.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'notified' }),
      },
      env
    );
    expect(patchRes.status).toBe(200);
    const patched = (await patchRes.json()) as { data: { status: string } };
    expect(patched.data.status).toBe('notified');

    const delRes = await staffApp.request(`/api/waitlist/${created.data.id}`, { method: 'DELETE' }, env);
    expect(delRes.status).toBe(200);
  });

  it('rejects invalid phone and birthYear in POST /api/recruitment/apply', async () => {
    const app = new Hono<{ Bindings: Env }>();
    app.post('/api/recruitment/apply', (c) => createRecruitmentApplication(c, false));

    const badPhoneRes = await app.request(
      '/api/recruitment/apply',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Nguyễn Văn A', phone: 'not-a-phone', birthYear: '2000' }),
      },
      { AURA_DB: d1 } as unknown as Env
    );
    expect(badPhoneRes.status).toBe(400);

    const badYearRes = await app.request(
      '/api/recruitment/apply',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Nguyễn Văn A', phone: '0901234567', birthYear: 'abcd-9999' }),
      },
      { AURA_DB: d1 } as unknown as Env
    );
    expect(badYearRes.status).toBe(400);
  });
});
