import { describe, it, expect, vi } from 'vitest';
import { app } from '../../index';
import { generateJWT } from '../../lib/jwt';
import { createMockEnv, TEST_JWT_SECRET } from '../test-utils';
import { executeKdsStatusTransition } from '@aura/domain-kitchen';

type Row = { id: string; tenant_id: string; status: string; payment_status: string; payment_method: string; total: number };
function fixtures(tenant = 'cafe-a', status = 'preparing', beforeWrite?: (row: Row) => void) {
  const row: Row = { id: 'ORD_TEST', tenant_id: tenant, status, payment_status: 'unpaid', payment_method: 'cod', total: 20000 };
  const writes: string[] = [];
  const db = { prepare(sql: string) {
    let binds: unknown[] = [];
    const stmt = {
      bind(...values: unknown[]) { binds = values; return stmt; },
      async first() {
        // The session gate reads the staff account row behind a token, so a
        // lookup by id has to answer that account or the session reads as
        // revoked before the route under test runs.
        if (/FROM users WHERE id = \?/i.test(sql)) {
          const accounts = ['staff','cashier','waiter','kitchen'].map(role => ({ id: `actor-${role}`, name: role, role, tenant_id: 'cafe-a', is_active: 1, auth_version: 1 }));
          return accounts.find(row => row.id === binds[0]) || null;
        }
        if (!sql.includes('FROM orders WHERE id = ?')) return null;
        if (binds[0] !== row.id || (sql.includes('tenant_id = ?') && binds.at(-1) !== row.tenant_id)) return null;
        return { ...row };
      },
      async all() { const value = await stmt.first(); return { results: value ? [value] : [] }; },
      async run() {
        if (!sql.startsWith('UPDATE orders')) return { success: true, meta: { changes: 1 } };
        beforeWrite?.(row);
        const isStatus = sql.startsWith('UPDATE orders SET status = ?');
        const expectedStatus = binds[isStatus ? 3 : 3];
        const sameTenant = !sql.includes('tenant_id = ?') || binds.at(-1) === row.tenant_id;
        const paidMatches = !sql.includes('AND payment_status = ?') || binds[4] === row.payment_status;
        if (!sameTenant || (sql.includes('AND status = ?') && expectedStatus !== row.status) || !paidMatches) return { success: true, meta: { changes: 0 } };
        writes.push(sql);
        if (isStatus) row.status = String(binds[0]);
        else row.payment_status = 'paid';
        return { success: true, meta: { changes: 1 } };
      },
    };
    return stmt;
  }, async batch(statements: { run(): Promise<unknown> }[]) {
    const results = []; for (const statement of statements) results.push(await statement.run()); return results;
  } };
  const env = createMockEnv({ AURA_DB: db }) as any;
  return { row, db, env, writes };
}
async function request(path: string, method = 'PATCH', role = 'staff', status = 'ready') {
  const token = await generateJWT({ id: `actor-${role}`, sub: `actor-${role}`, role, tenantId: 'cafe-a', email: 'a@test.aura',
    authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web' } as any, TEST_JWT_SECRET, 28800);
  return new Request(`https://test.aura${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(method === 'PATCH' && !path.includes('mark-cod-paid') ? { body: JSON.stringify({ status }) } : {}),
  });
}

describe('KDS canonical lifecycle and tenant writes', () => {
  for (const [path, method] of [
    ['/api/orders/ORD_TEST/status', 'PATCH'], ['/api/admin/orders/ORD_TEST/status', 'PATCH'],
    ['/api/admin/orders/ORD_TEST/complete', 'POST'], ['/api/orders/ORD_TEST', 'PATCH'],
  ]) it(`blocks foreign tenant without mutation via ${method} ${path}`, async () => {
    const { env, row, writes } = fixtures('cafe-b');
    const response = await app.fetch(await request(path, method), env);
    expect(response.status).toBe(404); expect(row.status).toBe('preparing'); expect(writes).toHaveLength(0);
  });
  it('rejects invalid terminal resurrection through admin alias', async () => {
    const { env, row, writes } = fixtures('cafe-a', 'cancelled');
    const response = await app.fetch(await request('/api/admin/orders/ORD_TEST/status', 'PATCH', 'staff', 'preparing'), env);
    expect(response.status).toBe(400); expect(row.status).toBe('cancelled'); expect(writes).toHaveLength(0);
  });
  it('does not complete a preparing order through the legacy complete alias', async () => {
    const { env, row } = fixtures();
    const response = await app.fetch(await request('/api/admin/orders/ORD_TEST/complete', 'POST'), env);
    expect(response.status).toBe(400); expect(row.status).toBe('preparing');
  });
  it('rejects concurrent state change and publishes no transition event', async () => {
    const { db, row, writes } = fixtures('cafe-a', 'preparing', value => { value.status = 'cancelled'; });
    const kv = { put: vi.fn(async () => {}) };
    const result = await executeKdsStatusTransition(db, row.id, 'ready', 'staff', { tenantId: 'cafe-a', kv });
    expect(result.statusCode).toBe(409); expect(row.status).toBe('cancelled'); expect(writes).toHaveLength(0); expect(kv.put).not.toHaveBeenCalled();
  });
  for (const status of ['pending', 'preparing', 'ready']) it(`collects COD without completing ${status} work`, async () => {
    const { env, row, writes } = fixtures('cafe-a', status);
    const response = await app.fetch(await request('/api/orders/ORD_TEST/mark-cod-paid', 'PATCH', 'cashier'), env);
    expect(response.status).toBe(200); expect(row.payment_status).toBe('paid'); expect(row.status).toBe(status);
    expect(writes[0]).toContain('AND status = ? AND payment_status = ?');
    expect(writes[0]).not.toContain("status = 'completed'");
  });
  it('does not collect COD over a concurrent cancellation', async () => {
    const { env, row } = fixtures('cafe-a', 'preparing', value => { value.status = 'cancelled'; });
    const response = await app.fetch(await request('/api/orders/ORD_TEST/mark-cod-paid', 'PATCH', 'cashier'), env);
    expect(response.status).toBe(409); expect(row.payment_status).toBe('unpaid'); expect(row.status).toBe('cancelled');
  });
  for (const role of ['cashier', 'waiter', 'kitchen', 'staff']) it(`allows legitimate ${role} KDS queue and authenticated stream`, async () => {
    const { env } = fixtures();
    const queue = await app.fetch(await request('/api/kds/orders', 'GET', role), env);
    const stream = await app.fetch(await request('/api/kds/orders/stream', 'GET', role), env);
    expect(queue.status).toBe(200); expect(stream.status).toBe(200); await stream.body?.cancel();
  });
});
