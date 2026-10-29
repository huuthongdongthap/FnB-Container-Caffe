import { DatabaseSync } from 'node:sqlite';
import { createHmac } from 'node:crypto';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

/** Executes real SQL and transactional batches; no pattern-matching D1 responses. */
export function paymentSqliteDB(options: { canonicalStaff?: boolean; authVersion?: boolean } = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const executedStatements: Array<{ sql: string; binds: unknown[] }> = [];
  const runStatement = new WeakMap<object, () => any>();
  sqlite.exec(`CREATE TABLE orders (id TEXT PRIMARY KEY, tenant_id TEXT DEFAULT 'default', customer_id TEXT, table_id TEXT,
    total INTEGER, payment_status TEXT DEFAULT 'unpaid', payment_method TEXT DEFAULT 'payos', status TEXT DEFAULT 'pending',
    items TEXT DEFAULT '[]', customer_name TEXT, customer_phone TEXT, customer_email TEXT, customer_address TEXT,
    notes TEXT, is_cod INTEGER DEFAULT 0, created_at TEXT, updated_at TEXT);
    CREATE TABLE payments (id TEXT PRIMARY KEY, order_id TEXT NOT NULL, method TEXT, amount INTEGER, status TEXT,
    transaction_id TEXT UNIQUE, payment_url TEXT, created_at TEXT, updated_at TEXT,
    refund_status TEXT, refund_amount INTEGER, refund_reason TEXT);
    -- Mirrors 005_audit_logs.sql: the canonical audit writer tries the wide
    -- schema first and this older shape last, so a narrower table here would
    -- make every audit assertion fail for a reason that exists only in the test.
    CREATE TABLE audit_logs (id TEXT, actor_id TEXT, actor_name TEXT, action TEXT,
      resource_type TEXT, resource_id TEXT, details TEXT, ip_address TEXT, created_at TEXT);
    CREATE TABLE _metrics (name TEXT, value REAL, tags TEXT, created_at TEXT);
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, phone TEXT, role TEXT,
      tenant_id TEXT DEFAULT 'default', is_active INTEGER DEFAULT 1,
      ${options.authVersion === false ? '' : 'auth_version INTEGER DEFAULT 1,'}
      ${options.canonicalStaff ? '' : 'email TEXT, pin_hash TEXT,'}
      password_hash TEXT, created_at TEXT, updated_at TEXT);
    CREATE TABLE staff_login_identities (email TEXT PRIMARY KEY, staff_id TEXT NOT NULL UNIQUE REFERENCES users(id));
    CREATE TABLE payment_reconciliation_jobs (payment_id TEXT PRIMARY KEY, next_attempt_at TEXT NOT NULL,
      lease_until TEXT, lease_owner TEXT, last_checked_at TEXT, last_outcome TEXT, attempts INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL);`);
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
  // `users` is included because the request-time staff-session gate reads the
  // account row behind every staff token; a missing row reads as revoked.
  function seed(table: 'orders' | 'payments' | 'users', row: Record<string, any>) {
    const names = new Set(sqlite.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
    if (names.size === 0) throw new Error(`Unknown table ${table}`);
    const values = Object.entries(row).filter(([key, value]) => names.has(key) && value !== undefined);
    sqlite.prepare(`INSERT INTO ${table} (${values.map(([key]) => key).join(',')}) VALUES (${values.map(() => '?').join(',')})`)
      .run(...values.map(([, value]) => value));
  }
  /** Staff account row satisfying the request-time session gate for `id`/`role`. */
  function staffAccount(id: string, role: string, tenantId = 'cafe-a') {
    seed('users', { id, name: `User ${role}`, role, tenant_id: tenantId, is_active: 1, auth_version: 1 });
  }
  return { db, sqlite, order, payment, seed, staffAccount, executedStatements };
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
