// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const schema = readFileSync(new URL('../worker/schema.sql', import.meta.url), 'utf8');
const databases: DatabaseSync[] = [];
const freshDatabase = () => {
  const db = new DatabaseSync(':memory:');
  databases.push(db);
  db.exec(schema);
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
});
