import { DatabaseSync } from 'node:sqlite';
import { createHmac } from 'node:crypto';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

/** Executes real SQL and transactional batches; no pattern-matching D1 responses. */
export function paymentSqliteDB() {
  const sqlite = new DatabaseSync(':memory:');
  const executedStatements: Array<{ sql: string; binds: unknown[] }> = [];
  const runStatement = new WeakMap<object, () => any>();
  sqlite.exec(`CREATE TABLE orders (id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', customer_id TEXT,
    total INTEGER, payment_status TEXT DEFAULT 'unpaid', payment_method TEXT DEFAULT 'payos', status TEXT DEFAULT 'pending',
    items TEXT DEFAULT '[]', customer_name TEXT, customer_phone TEXT, customer_email TEXT, customer_address TEXT,
    notes TEXT, is_cod INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
    CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, method TEXT, amount INTEGER, status TEXT,
    transaction_id TEXT UNIQUE, payment_url TEXT, created_at TEXT, updated_at TEXT,
    refund_status TEXT, refund_amount INTEGER, refund_reason TEXT);
    CREATE TABLE audit_logs (id TEXT, user_id TEXT, action TEXT, entity_type TEXT, entity_id TEXT, metadata TEXT, created_at TEXT);
    CREATE TABLE _metrics (name TEXT, value REAL, tags TEXT, created_at TEXT);`);
  function prepare(sql: string) {
    let args: any[] = [];
    const run = () => {
      executedStatements.push({ sql, binds: args });
      const before = Number(sqlite.prepare('SELECT total_changes() AS count').get()?.count ?? 0);
      const result = sqlite.prepare(sql).run(...args);
      // workerd/D1 includes changes from timestamp triggers in meta.changes.
      const after = Number(sqlite.prepare('SELECT total_changes() AS count').get()?.count ?? 0);
      return { success: true, meta: { changes: after - before, last_row_id: Number(result.lastInsertRowid) } };
    };
    const statement = {
      bind(...values: any[]) { args = values; return statement; },
      async first() { return sqlite.prepare(sql).get(...args) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...args), success: true, meta: {} }; },
      async run() { return run(); },
      async raw() { return []; },
    };
    runStatement.set(statement, run);
    return statement as unknown as D1PreparedStatement;
  }
  const db = { prepare, async batch(statements: D1PreparedStatement[]) {
    sqlite.exec('BEGIN');
    try {
      const results = statements.map((statement) => {
        const run = runStatement.get(statement);
        if (!run) throw new Error('Unknown statement in local D1 batch');
        return run();
      });
      sqlite.exec('COMMIT'); return results;
    }
    catch (error) { sqlite.exec('ROLLBACK'); throw error; }
  } } as unknown as D1Database;
  function order(id: string, tenant = 'default', customer: string | null = null) {
    sqlite.prepare('INSERT INTO orders (id, tenant_id, customer_id, total) VALUES (?, ?, ?, 20000)').run(id, tenant, customer);
  }
  function payment(orderId: string, status = 'pending', code = '123456') {
    sqlite.prepare(`INSERT INTO payments (id, order_id, method, amount, status, transaction_id, created_at, updated_at)
      VALUES (?, ?, 'payos', 20000, ?, ?, ?, ?)`).run(`pay_${orderId}`, orderId, status, code, new Date().toISOString(), new Date().toISOString());
  }
  function seed(table: 'orders' | 'payments', row: Record<string, any>) {
    const names = new Set(sqlite.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
    const values = Object.entries(row).filter(([key, value]) => names.has(key) && value !== undefined);
    sqlite.prepare(`INSERT INTO ${table} (${values.map(([key]) => key).join(',')}) VALUES (${values.map(() => '?').join(',')})`)
      .run(...values.map(([, value]) => value));
  }
  return { db, sqlite, order, payment, seed, executedStatements };
}

/** Independent signing fixture following the provider's documented payment-requests sample. */
export function signedPayOSResponse(data: Record<string, any>, checksumKey: string): Response {
  const canonical = Object.keys(data).sort().filter((key) => data[key] !== undefined).map((key) => {
    let value = data[key];
    if (Array.isArray(value)) value = JSON.stringify(value.map((entry) => entry && typeof entry === 'object'
      ? Object.fromEntries(Object.keys(entry).sort().map((field) => [field, entry[field]])) : entry));
    return `${key}=${[null, undefined, 'null', 'undefined'].includes(value) ? '' : value}`;
  }).join('&');
  return new Response(JSON.stringify({ code: '00', data, signature: createHmac('sha256', checksumKey).update(canonical).digest('hex') }),
    { headers: { 'Content-Type': 'application/json' } });
}

export function payosCheckoutResponse(body: { orderCode: number; amount: number }, checksumKey: string, linkId = 'test123'): Response {
  return signedPayOSResponse({ orderCode: body.orderCode, amount: body.amount, status: 'PENDING',
    paymentLinkId: linkId, checkoutUrl: `https://pay.payos.vn/web/${linkId}` }, checksumKey);
}
