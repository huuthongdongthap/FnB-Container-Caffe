import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { Hono } from 'hono';
import { recruitmentRouter } from '../../routes/recruitment';
import { chatRouter } from '../../routes/chat';
import { contactRouter } from '../../routes/contact';
import { issueStaffSession, requireStaffAccount } from '../../lib/staff-session';
import { createMockEnv, createMockKV } from '../test-utils';

/** Real bootstrap SQLite with D1 statement semantics, including transactional batches. */
export function privacyFixture() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../../../schema.sql', import.meta.url), 'utf8'));
  const runs = new WeakMap<object, () => unknown>();
  const db = {
    prepare(sql: string) {
      let values: any[] = [];
      const run = () => {
        const before = Number(sqlite.prepare('SELECT total_changes() count').get()?.count);
        const result = sqlite.prepare(sql).run(...values);
        return { success: true, meta: { changes: Number(sqlite.prepare('SELECT total_changes() count').get()?.count) - before,
          last_row_id: Number(result.lastInsertRowid) } };
      };
      const statement = {
        bind(...args: unknown[]) { values = args; return statement; },
        async run() { return run(); },
        async first() { return sqlite.prepare(sql).get(...values) || null; },
        async all() { return { success: true, results: sqlite.prepare(sql).all(...values), meta: {} }; },
      };
      runs.set(statement, run);
      return statement;
    },
    async batch(statements: D1PreparedStatement[]) {
      sqlite.exec('BEGIN');
      try {
        const result = statements.map((statement) => runs.get(statement)!());
        sqlite.exec('COMMIT'); return result;
      } catch (error) { sqlite.exec('ROLLBACK'); throw error; }
    },
  } as unknown as D1Database;
  const app = new Hono();
  app.route('/api/recruitment', recruitmentRouter);
  app.route('/api/chat', chatRouter);
  const env = createMockEnv({ AURA_DB: db, AUTH_KV: createMockKV(), ENVIRONMENT: 'production', PILOT_TENANT_ID: 'cafe-a' });
  for (const [id, role, tenant] of [
    ['owner', 'owner', 'cafe-a'], ['manager', 'manager', 'cafe-a'], ['other', 'owner', 'cafe-b'],
    ['staff', 'staff', 'cafe-a'], ['admin', 'admin', 'cafe-a'], ['wildcard', 'owner', '*'],
    ['hq', 'manager', 'hq'], ['cashier', 'cashier', 'cafe-a'],
  ]) sqlite.prepare('INSERT INTO users(id,name,role,tenant_id,is_active,auth_version) VALUES (?,?,?,?,1,1)').run(id, id, role, tenant);
  const token = async (id: string) => (await issueStaffSession(env, await requireStaffAccount(db, id), { sessionType: 'staff-web' })).token;
  const request = async (path: string, id?: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => {
    const req = new Request(`https://test.aura${path}`, { method, headers: { 'Content-Type': 'application/json',
      ...(id ? { Authorization: `Bearer ${await token(id)}` } : {}), ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return path === '/api/contact' ? contactRouter.fetch(req, env) : app.fetch(req, env);
  };
  return { sqlite, db, env, token, request };
}
export const candidate = { fullName: 'Local Applicant', phone: '0901234567', position: 'barista', shifts: ['morning'] };
