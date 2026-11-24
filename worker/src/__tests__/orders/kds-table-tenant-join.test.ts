// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { handleGetKdsOrders } from '../../routes/orders-hono-handlers/kds-handlers';
import type { Env } from '../../types/env';

function createSqliteD1(sqlite: DatabaseSync) {
  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const statement = {
        bind(...params: unknown[]) {
          bound = params;
          return statement;
        },
        async all<T = Record<string, unknown>>() {
          const stmt = sqlite.prepare(sql);
          const rows = stmt.all(...(bound as Array<string | number | null>)) as T[];
          return { results: rows };
        },
        async first<T = Record<string, unknown>>() {
          const stmt = sqlite.prepare(sql);
          const row = stmt.get(...(bound as Array<string | number | null>)) as T | undefined;
          return row ?? null;
        },
        async run() {
          const stmt = sqlite.prepare(sql);
          stmt.run(...(bound as Array<string | number | null>));
          return { success: true };
        },
      };
      return statement;
    },
  };
}

describe('KDS table join tenant isolation and table_number preference', () => {
  it('prefers cafe_tables.table_number, scopes join by tenant_id, excludes empty QR check-ins, and sorts ready last', async () => {
    const sqlite = new DatabaseSync(':memory:');
    sqlite.exec(`
      CREATE TABLE cafe_tables (
        id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        table_number TEXT,
        name TEXT
      );
      CREATE TABLE orders (
        id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        customer_name TEXT,
        table_id TEXT,
        order_number TEXT,
        items TEXT,
        notes TEXT,
        status TEXT,
        order_type TEXT,
        payment_status TEXT,
        payment_method TEXT,
        is_cod INTEGER,
        created_at TEXT,
        updated_at TEXT,
        cancelled_at TEXT,
        previous_status TEXT
      );
    `);

    // Same table id across two tenants to verify tenant-scoped JOIN prevents cross-tenant leakage
    sqlite.prepare(
      'INSERT INTO cafe_tables (id, tenant_id, table_number, name) VALUES (?, ?, ?, ?)'
    ).run('tbl-shared', 'store-a', 'A-01', 'Window Table');
    sqlite.prepare(
      'INSERT INTO cafe_tables (id, tenant_id, table_number, name) VALUES (?, ?, ?, ?)'
    ).run('tbl-shared', 'store-b', 'B-99', 'Patio Table');

    // Table with blank table_number falls back to name
    sqlite.prepare(
      'INSERT INTO cafe_tables (id, tenant_id, table_number, name) VALUES (?, ?, ?, ?)'
    ).run('tbl-name-only', 'store-a', '   ', 'VIP Corner');

    // Table belonging only to store-b (should NOT match store-a order)
    sqlite.prepare(
      'INSERT INTO cafe_tables (id, tenant_id, table_number, name) VALUES (?, ?, ?, ?)'
    ).run('tbl-other-tenant', 'store-b', 'B-77', 'Secret B');

    const insertOrder = sqlite.prepare(`
      INSERT INTO orders (
        id, tenant_id, customer_name, table_id, order_number, items, notes,
        status, order_type, payment_status, payment_method, is_cod, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Ready order created earliest -> should still sort AFTER pending/preparing
    insertOrder.run(
      'ord-ready', 'store-a', 'An', 'tbl-shared', 'ORD-001',
      JSON.stringify([{ name: 'Latte', quantity: 1 }]), '',
      'ready', 'dine_in', 'paid', 'cash', 0,
      '2026-11-24 01:00:00', '2026-11-24 01:05:00'
    );

    // Pending order on tbl-name-only
    insertOrder.run(
      'ord-pending', 'store-a', 'Binh', 'tbl-name-only', 'ORD-002',
      JSON.stringify([{ name: 'Espresso', quantity: 1 }]), '',
      'pending', 'dine_in', 'paid', 'cash', 0,
      '2026-11-24 01:02:00', '2026-11-24 01:02:00'
    );

    // Order referencing table_id that only exists in store-b -> must fall back to raw table_id
    insertOrder.run(
      'ord-cross-table', 'store-a', 'Chi', 'tbl-other-tenant', 'ORD-003',
      JSON.stringify([{ name: 'Matcha', quantity: 1 }]), '',
      'preparing', 'dine_in', 'paid', 'cash', 0,
      '2026-11-24 01:03:00', '2026-11-24 01:03:00'
    );

    // Empty QR check-in placeholder -> must be excluded in SQL
    insertOrder.run(
      'ord-empty-qr', 'store-a', 'QR Guest', 'tbl-shared', 'ORD-004',
      '[]', 'Khách QR - cho don mon | [OVERDUE]',
      'pending', 'dine_in', 'pending', 'cash', 0,
      '2026-11-24 00:50:00', '2026-11-24 00:50:00'
    );

    const app = new Hono<{ Bindings: Env }>();
    app.get('/api/kds/orders', (c) => {
      c.set('user' as never, { id: 'staff-1', role: 'barista', tenant_id: 'store-a' } as never);
      c.set('tenantId' as never, 'store-a' as never);
      return handleGetKdsOrders(c);
    });

    const db = createSqliteD1(sqlite);
    const res = await app.request(
      'http://localhost/api/kds/orders',
      { headers: { 'X-Tenant-Id': 'store-a' } },
      { AURA_DB: db } as unknown as Env
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: Array<{ id: string; table_name?: string; status: string }>;
    };
    expect(body.success).toBe(true);
    expect(body.data.map((o) => o.id)).toEqual(['ord-pending', 'ord-cross-table', 'ord-ready']);

    const byId = new Map(body.data.map((o) => [o.id, o]));
    expect(byId.get('ord-ready')?.table_name).toBe('A-01');
    expect(byId.get('ord-pending')?.table_name).toBe('VIP Corner');
    expect(byId.get('ord-cross-table')?.table_name).toBe('tbl-other-tenant');
    expect(byId.has('ord-empty-qr')).toBe(false);

    sqlite.close();
  });
});
