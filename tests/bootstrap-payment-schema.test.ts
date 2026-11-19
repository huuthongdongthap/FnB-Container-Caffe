// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const schema = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const dbRootSchema = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');
const databases: DatabaseSync[] = [];
const freshDatabase = (sql = schema) => {
  const db = new DatabaseSync(':memory:');
  databases.push(db);
  db.exec(sql);
  return db;
};
afterEach(() => { for (const db of databases.splice(0)) db.close(); });

describe('fresh Worker bootstrap payment and operational schema', () => {
  it('executes on SQLite with tenant and refund contracts available', () => {
    const db = freshDatabase();
    const columns = (table: string) => db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
    expect(columns('cafe_tables')).toContain('tenant_id');
    expect(columns('orders')).toEqual(expect.arrayContaining(['tenant_id', 'cod_paid_at']));
    expect(columns('payments')).toEqual(expect.arrayContaining([
      'transaction_id', 'payment_url', 'updated_at', 'refund_status', 'refund_amount', 'refund_reason', 'refunded_at',
    ]));
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
  });

  it('has the real optional side-effect tables instead of bypassing SQL errors', () => {
    const db = freshDatabase();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(row => row.name);
    expect(tables).toEqual(expect.arrayContaining([
      '_metrics', '_alerts', 'client_errors', 'customer_identities', 'customer_events', 'consents', 'visits',
      'inventory_items', 'inventory_transactions', 'ingredients', 'stock_movements', 'recipes', 'recipe_items',
    ]));
    expect(db.prepare('PRAGMA table_info(cashback_transactions)').all().map(row => row.name)).toContain('expires_at');
  });

  it('allows COD placeholders but rejects duplicate nonempty gateway transaction codes', () => {
    const db = freshDatabase();
    db.prepare(`INSERT INTO orders(id,items,total,customer_name,customer_phone,payment_method)
      VALUES ('local-order','[]',20000,'Local','0900000010','payos')`).run();
    const insert = db.prepare("INSERT INTO payments(id,order_id,method,amount,transaction_id) VALUES (?,'local-order','payos',20000,?)");
    insert.run('local-payment-1', '123456');
    expect(() => insert.run('local-payment-2', '123456')).toThrow(/UNIQUE/);
    expect(() => { insert.run('cod-1', null); insert.run('cod-2', ''); insert.run('cod-3', ''); }).not.toThrow();
  });

  it('maintains 124-table canonical parity between worker/schema.sql and db/schema.sql', () => {
    const workerDb = freshDatabase(schema);
    const rootDb = freshDatabase(dbRootSchema);
    const listTables = (db: DatabaseSync) =>
      db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
        .all()
        .map(row => String(row.name));
    const workerTables = listTables(workerDb);
    const rootTables = listTables(rootDb);
    expect(workerTables.length).toBeGreaterThanOrEqual(124);
    expect(rootTables).toEqual(workerTables);
    expect(rootDb.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    for (const table of workerTables) {
      const workerCols = workerDb.prepare(`PRAGMA table_info(${table})`).all().map(r => String(r.name)).sort();
      const rootCols = rootDb.prepare(`PRAGMA table_info(${table})`).all().map(r => String(r.name)).sort();
      expect(rootCols, `columns mismatch for ${table}`).toEqual(workerCols);
    }
    const listIndexes = (db: DatabaseSync) =>
      db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY name")
        .all()
        .map(row => String(row.name));
    const workerIndexes = listIndexes(workerDb);
    const rootIndexes = listIndexes(rootDb);
    expect(workerIndexes.length).toBeGreaterThanOrEqual(160);
    expect(rootIndexes).toEqual(workerIndexes);
  });

  it('enforces tenant-scoped partial unique indexes for promos, loyalty, inventory, and reservations', () => {
    const db = freshDatabase();
    db.prepare("INSERT INTO promotions(id, code, name, tenant_id) VALUES ('p1', 'COFFEE10', 'Promo', 'store-a')").run();
    db.prepare("INSERT INTO promotion_usages(id, promotion_id, tenant_id, idempotency_key) VALUES ('u1', 'p1', 'store-a', 'idem-1')").run();
    expect(() =>
      db.prepare("INSERT INTO promotion_usages(id, promotion_id, tenant_id, idempotency_key) VALUES ('u2', 'p1', 'store-a', 'idem-1')").run()
    ).toThrow(/UNIQUE/);

    db.prepare("INSERT INTO loyalty_transactions(id, type, points, tenant_id, idempotency_key) VALUES ('l1', 'earn', 10, 'store-a', 'l-idem-1')").run();
    expect(() =>
      db.prepare("INSERT INTO loyalty_transactions(id, type, points, tenant_id, idempotency_key) VALUES ('l2', 'earn', 10, 'store-a', 'l-idem-1')").run()
    ).toThrow(/UNIQUE/);

    db.prepare("INSERT INTO cafe_tables(id, table_number, zone, capacity, tenant_id) VALUES ('t1', 'B01', 'indoor', 4, 'store-a')").run();
    db.prepare("INSERT INTO reservations(id, table_id, customer_name, customer_phone, date, time, zone, status, tenant_id) VALUES ('r1', 't1', 'Guest A', '0900000001', '2026-11-20', '19:00', 'indoor', 'confirmed', 'store-a')").run();
    expect(() =>
      db.prepare("INSERT INTO reservations(id, table_id, customer_name, customer_phone, date, time, zone, status, tenant_id) VALUES ('r2', 't1', 'Guest B', '0900000002', '2026-11-20', '19:00', 'indoor', 'confirmed', 'store-a')").run()
    ).toThrow(/UNIQUE/);
  });
});
