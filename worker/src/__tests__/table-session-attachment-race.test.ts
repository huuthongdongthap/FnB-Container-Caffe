// @vitest-environment node
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../types/env';
import { registerOrderHandlers } from '../routes/table-sessions-handlers/order-handlers';

const openDatabases: DatabaseSync[] = [];
afterEach(() => { for (const sqlite of openDatabases.splice(0)) sqlite.close(); });

function fixture(legacy = false, tenant = 'default') {
  const sqlite = new DatabaseSync(':memory:');
  openDatabases.push(sqlite);
  const counter = legacy ? 'orders_count' : 'order_count';
  sqlite.exec(`CREATE TABLE table_sessions (id TEXT PRIMARY KEY, table_id TEXT, tenant_id TEXT, status TEXT,
    ${counter} INTEGER, total_amount INTEGER, updated_at TEXT);
    CREATE TABLE orders (id TEXT PRIMARY KEY, tenant_id TEXT, status TEXT, total INTEGER,
      table_id TEXT, updated_at TEXT${legacy ? '' : ', session_id TEXT'});
    CREATE TRIGGER timestamp_order AFTER UPDATE ON orders
      BEGIN UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id; END;
    INSERT INTO table_sessions VALUES ('s1', 't1', 'default', 'active', 0, 0, NULL);`);
  sqlite.prepare("INSERT INTO orders (id, tenant_id, status, total) VALUES ('o1', ?, 'pending', 50)").run(tenant);
  const session = () => sqlite.prepare(`SELECT *, ${counter} AS order_count FROM table_sessions`).get();
  const order = () => sqlite.prepare('SELECT * FROM orders').get();
  let resume = () => {};
  let reached = () => {};
  const paused = new Promise<void>((resolve) => { reached = resolve; });
  const gate = new Promise<void>((resolve) => { resume = resolve; });
  let pause = true;
  function prepare(sql: string) {
    let args: SQLInputValue[] = [];
    const statement = {
      bind(...values: SQLInputValue[]) { args = values; return statement; },
      async first() {
        if (pause && sql.includes('FROM orders')) { pause = false; reached(); await gate; }
        return sqlite.prepare(sql).get(...args) ?? null;
      },
      run() {
        const before = sqlite.prepare('SELECT total_changes() AS count').get()?.count;
        sqlite.prepare(sql).run(...args);
        const after = sqlite.prepare('SELECT total_changes() AS count').get()?.count;
        return { success: true, meta: { changes: Number(after) - Number(before) } };
      },
    };
    return statement;
  }
  const db = {
    prepare,
    async batch(statements: ReturnType<typeof prepare>[]) {
      sqlite.exec('BEGIN');
      try {
        const results = statements.map((statement) => statement.run());
        sqlite.exec('COMMIT');
        return results;
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  const app = new Hono<{ Bindings: Env; Variables: { user: { role: string; tenant_id: string } } }>();
  app.use('*', async (c, next) => { c.set('user', { role: 'owner', tenant_id: 'default' }); await next(); });
  registerOrderHandlers(app);
  const attach = () => app.request('/s1/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: 'o1' }) }, { AURA_DB: db } as unknown as Env);
  return { sqlite, session, order, attach, paused, resume };
}

describe('table session attachment serialization', () => {
  for (const legacy of [false, true]) {
    for (const terminal of ['closed', 'completed', 'no_show', 'abandoned']) {
      it(`does not reopen ${terminal} after initial read (legacy=${legacy})`, async () => {
        const f = fixture(legacy);
        const pending = f.attach();
        await f.paused;
        f.sqlite.prepare('UPDATE table_sessions SET status = ?').run(terminal);
        f.resume();
        const response = await pending;
        expect(f.session()?.status).toBe(terminal);
        expect(f.session()?.total_amount).toBe(0);
        expect(f.session()?.order_count).toBe(0);
        expect(f.order()?.table_id).toBeNull();
        if (!legacy) expect(f.order()?.session_id).toBeNull();
        expect(response.status).toBe(409);
      });
    }
  }
  for (const legacy of [false, true]) {
    it(`rolls back the claim when the bill write fails and attaches once on retry (legacy=${legacy})`, async () => {
      const f = fixture(legacy);
      f.sqlite.exec(`CREATE TRIGGER reject_bill BEFORE UPDATE ON table_sessions
        BEGIN SELECT RAISE(ABORT, 'transient bill failure'); END;`);
      const pending = f.attach(); await f.paused; f.resume();
      expect((await pending).status).toBe(500);
      expect(f.order()).toMatchObject({ table_id: null, updated_at: null });
      if (!legacy) expect(f.order()?.session_id).toBeNull();
      expect(f.session()).toMatchObject({ status: 'active', order_count: 0, total_amount: 0 });
      f.sqlite.exec('DROP TRIGGER reject_bill');
      expect((await f.attach()).status).toBe(200);
      expect(await (await f.attach()).json()).toMatchObject({ idempotent: true });
      expect(f.session()).toMatchObject({ status: 'ordering', order_count: 1, total_amount: 50 });
    });
  }
  it('attaches once and reattachment is idempotent', async () => {
    const f = fixture();
    const pending = f.attach(); await f.paused; f.resume();
    expect((await pending).status).toBe(200);
    expect((await f.attach()).status).toBe(200);
    expect(f.session()?.total_amount).toBe(50);
    expect(f.session()?.order_count).toBe(1);
  });
  it('does not mutate a different tenant order', async () => {
    const f = fixture(false, 'other');
    const pending = f.attach(); await f.paused; f.resume();
    expect((await pending).status).toBe(404);
    expect(f.order()?.table_id).toBeNull();
    expect(f.session()?.total_amount).toBe(0);
  });
});
