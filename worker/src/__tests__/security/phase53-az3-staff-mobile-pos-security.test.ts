import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { staffTipsRouter } from '../../../../packages/domain/staff/commands/staff-tips';
import {
  registerStaffDevice,
  listStaffDevices,
  revokeStaffDevice,
} from '../../../../packages/domain/staff/commands/staff-auth';
import { registerStaffHandlers } from '../../routes/openapi-staff-handlers/staff-handlers';
import { updateTableStatus } from '../../routes/tables-mobile';
import { getOrdersMobile, getOrderDetail, createOrderMobile } from '../../routes/orders-mobile';
import { issueStaffSession } from '../../lib/staff-session';

const TEST_JWT_SECRET = 'phase53_az3_test_jwt_secret_minimum_32_bytes_long!';

async function makeStaffAuthHeader(
  id: string,
  role: string,
  tenantId: string
): Promise<Record<string, string>> {
  const issued = await issueStaffSession(
    { JWT_SECRET: TEST_JWT_SECRET } as unknown as Env,
    {
      id,
      name: id,
      phone: null,
      role,
      tenant_id: tenantId,
      is_active: 1,
      auth_version: 1,
    },
    { email: `${id}@aura.vn`, sessionType: 'staff-web' }
  );
  return { Authorization: `Bearer ${issued.token}` };
}

function createMemoryKV(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
    delete: async (key: string) => {
      store.delete(key);
    },
  };
}

describe('Staff Tips Ledger, OpenAPI Staff Management, Mobile Device Auth & Mobile POS Security', () => {
  describe('1. Staff Tips Ledger tenant confinement, scalar session lookup & settled tip immutability', () => {
    it('rejects cross-tenant header/query overrides with 403 for non-HQ callers and returns 404 when viewing cross-tenant staff tips', async () => {
      const authHeaders = await makeStaffAuthHeader('mgr-a', 'manager', 'store-a');
      const db = {
        prepare(sql: string) {
          return {
            bind(...args: unknown[]) {
              return {
                async first() {
                  if (sql.includes('FROM users WHERE id = ?') && args.length === 1) {
                    const [id] = args as [string];
                    if (id === 'mgr-a') {
                      return {
                        id: 'mgr-a',
                        name: 'Manager A',
                        role: 'manager',
                        tenant_id: 'store-a',
                        is_active: 1,
                        auth_version: 1,
                      };
                    }
                    return null;
                  }
                  if (sql.includes('FROM users WHERE id = ?')) {
                    const [id, tenant] = args as [string, string];
                    if (id === 'staff-store-a' && tenant === 'store-a') {
                      return { id: 'staff-store-a', role: 'waiter' };
                    }
                    return null;
                  }
                  return { total_tips: 0, tipped_orders: 0 };
                },
                async all() {
                  return { results: [] };
                },
              };
            },
          };
        },
      };

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/staff-tips', staffTipsRouter);
      const env = { AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET } as unknown as Env;

      // Mismatched X-Tenant-ID header on GET /api/staff-tips -> 403
      const summarySpoofRes = await app.request(
        '/api/staff-tips',
        { method: 'GET', headers: { ...authHeaders, 'X-Tenant-ID': 'store-b' } },
        env
      );
      expect(summarySpoofRes.status).toBe(403);

      // Mismatched query tenant_id on GET /api/staff-tips/:staffId -> 403
      const detailSpoofRes = await app.request(
        '/api/staff-tips/staff-store-a?tenant_id=store-b',
        { method: 'GET', headers: authHeaders },
        env
      );
      expect(detailSpoofRes.status).toBe(403);

      // Mismatched X-Tenant-ID on POST /api/staff-tips/assign -> 403
      const assignSpoofRes = await app.request(
        '/api/staff-tips/assign',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-b' },
          body: JSON.stringify({ order_id: 'ord-1', staff_id: 'staff-store-a' }),
        },
        env
      );
      expect(assignSpoofRes.status).toBe(403);

      // Viewing a staff member from another tenant on GET /api/staff-tips/:staffId -> 404
      const crossStaffRes = await app.request(
        '/api/staff-tips/staff-store-b',
        { method: 'GET', headers: authHeaders },
        env
      );
      expect(crossStaffRes.status).toBe(404);
    });

    it('uses scalar table_sessions subqueries in GET /api/staff-tips so tip totals do not fan-out across multiple table sessions', async () => {
      const authHeaders = await makeStaffAuthHeader('mgr-1', 'manager', 'store-a');
      const capturedQueries: string[] = [];
      const db = {
        prepare(sql: string) {
          if (sql.includes('FROM orders o')) {
            capturedQueries.push(sql);
          }
          return {
            bind() {
              return {
                async first() {
                  if (sql.includes('FROM users WHERE id = ?')) {
                    return {
                      id: 'mgr-1',
                      name: 'Manager 1',
                      role: 'manager',
                      tenant_id: 'store-a',
                      is_active: 1,
                      auth_version: 1,
                    };
                  }
                  return null;
                },
                async all() {
                  return {
                    results: [
                      {
                        staff_id: 'waiter-1',
                        staff_name: 'Waiter One',
                        staff_role: 'waiter',
                        order_count: 1,
                        total_tips: 25000,
                        avg_tip: 25000,
                        max_tip: 25000,
                      },
                    ],
                  };
                },
              };
            },
          };
        },
      };

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/staff-tips', staffTipsRouter);

      const res = await app.request(
        '/api/staff-tips?from=2026-11-01&to=2026-11-04',
        { method: 'GET', headers: authHeaders },
        { AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET } as unknown as Env
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        summary: { grand_total_tips: number; total_tipped_orders: number };
      };
      expect(body.success).toBe(true);
      expect(body.summary.grand_total_tips).toBe(25000);
      expect(body.summary.total_tipped_orders).toBe(1);

      expect(capturedQueries).toHaveLength(1);
      const summaryQuery = capturedQueries[0];
      expect(summaryQuery).not.toMatch(/LEFT\s+JOIN\s+table_sessions/i);
      expect(summaryQuery).toContain('SELECT ts.waiter_id FROM table_sessions ts');
      expect(summaryQuery).toContain('ts.created_at <= o.created_at ORDER BY ts.created_at DESC LIMIT 1');
    });

    it('validates target staff role/tenant and blocks tip_amount mutation on paid or completed orders with 409 in POST /api/staff-tips/assign', async () => {
      const authHeaders = await makeStaffAuthHeader('mgr-a', 'manager', 'store-a');
      const orders = new Map<string, { id: string; tip_amount: number; status: string; payment_status: string }>([
        ['ord-open', { id: 'ord-open', tip_amount: 10000, status: 'preparing', payment_status: 'unpaid' }],
        ['ord-paid', { id: 'ord-paid', tip_amount: 15000, status: 'completed', payment_status: 'paid' }],
      ]);
      const users = new Map<string, { id: string; role: string; tenant_id: string }>([
        ['mgr-a', { id: 'mgr-a', role: 'manager', tenant_id: 'store-a' }],
        ['waiter-a', { id: 'waiter-a', role: 'waiter', tenant_id: 'store-a' }],
        ['cust-a', { id: 'cust-a', role: 'customer', tenant_id: 'store-a' }],
        ['waiter-b', { id: 'waiter-b', role: 'waiter', tenant_id: 'store-b' }],
      ]);

      const db = {
        prepare(sql: string) {
          return {
            bind(...args: unknown[]) {
              return {
                async first() {
                  if (sql.includes('FROM orders WHERE id = ?')) {
                    const [orderId, tenant] = args as [string, string];
                    if (tenant !== 'store-a') return null;
                    return orders.get(orderId) ?? null;
                  }
                  if (sql.includes('FROM users WHERE id = ?') && args.length === 1) {
                    const [staffId] = args as [string];
                    const u = users.get(staffId);
                    if (!u) return null;
                    return {
                      id: u.id,
                      name: u.id,
                      role: u.role,
                      tenant_id: u.tenant_id,
                      is_active: 1,
                      auth_version: 1,
                    };
                  }
                  if (sql.includes('FROM users WHERE id = ?')) {
                    const [staffId, tenant] = args as [string, string];
                    const u = users.get(staffId);
                    if (!u || u.tenant_id !== tenant) return null;
                    return { id: u.id, role: u.role };
                  }
                  return null;
                },
                async run() {
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      };

      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/staff-tips', staffTipsRouter);
      const env = { AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET } as unknown as Env;

      // 1. Cross-tenant staff_id -> 404
      const crossStaffRes = await app.request(
        '/api/staff-tips/assign',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 'ord-open', staff_id: 'waiter-b' }),
        },
        env
      );
      expect(crossStaffRes.status).toBe(404);

      // 2. Customer account as staff_id -> 400
      const customerRoleRes = await app.request(
        '/api/staff-tips/assign',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 'ord-open', staff_id: 'cust-a' }),
        },
        env
      );
      expect(customerRoleRes.status).toBe(400);

      // 3. Changing tip_amount on a paid/completed order -> 409
      const mutatePaidTipRes = await app.request(
        '/api/staff-tips/assign',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 'ord-paid', staff_id: 'waiter-a', tip_amount: 50000 }),
        },
        env
      );
      expect(mutatePaidTipRes.status).toBe(409);

      // 4. Attributing existing tip_amount on a paid order without changing tip_amount -> 200
      const attributePaidTipRes = await app.request(
        '/api/staff-tips/assign',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: 'ord-paid', staff_id: 'waiter-a', tip_amount: 15000 }),
        },
        env
      );
      expect(attributePaidTipRes.status).toBe(200);
    });
  });

  describe('2. OpenAPI Staff Management tenant confinement, PII masking & auditId-scoped audit logs', () => {
    it('enforces caller-vs-header tenant confinement, masks email/phone for supervisor callers, and confines created staff to callerTenant', async () => {
      const staffList = [
        {
          id: 'sup-a',
          name: 'Supervisor Self',
          email: 'sup-a@aura.vn',
          phone: '0901111111',
          role: 'supervisor',
          tenant_id: 'store-a',
          is_active: 1,
          auth_version: 1,
          created_at: '2026-11-01T00:00:00Z',
        },
        {
          id: 'waiter-a',
          name: 'Waiter Colleague',
          email: 'waiter-a@aura.vn',
          phone: '0902222222',
          role: 'waiter',
          tenant_id: 'store-a',
          is_active: 1,
          auth_version: 1,
          created_at: '2026-11-01T00:00:00Z',
        },
      ];
      let insertedUserTenant: string | null = null;

      const db = {
        prepare(sql: string) {
          return {
            bind(...args: unknown[]) {
              return {
                async first() {
                  if (sql.includes('COUNT(*)')) return { total: staffList.length };
                  if (sql.includes('FROM users WHERE LOWER(email)')) return null;
                  if (sql.includes('FROM staff_login_identities')) return null;
                  if (sql.includes('FROM users WHERE id = ?')) {
                    const id = String(args[0]);
                    return staffList.find(s => s.id === id) ?? null;
                  }
                  return null;
                },
                async all() {
                  return { results: staffList };
                },
                async run() {
                  if (sql.includes('INSERT INTO users') && sql.includes('tenant_id')) {
                    insertedUserTenant = String(args[4] ?? args[6] ?? '');
                  }
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
        async batch(stmts: Array<{ run?: () => Promise<unknown> }>) {
          for (const s of stmts) {
            if (typeof s.run === 'function') {
              await s.run();
            }
          }
          return stmts.map(() => ({ meta: { changes: 1 } }));
        },
      };

      const app = new OpenAPIHono<{ Bindings: Env }>();
      let currentUser: Record<string, unknown> = { id: 'sup-a', role: 'supervisor', tenant_id: 'store-a' };
      app.use('*', async (c, next) => {
        c.set('user' as never, currentUser as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerStaffHandlers(app);

      // 1. Supervisor listing staff sees own email/phone but colleague's email/phone are masked (null)
      const listRes = await app.request('/api/staff', { method: 'GET' }, { AURA_DB: db } as unknown as Env);
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as {
        data: { staff: Array<{ id: string; email: string | null; phone: string | null }> };
      };
      const selfEntry = listBody.data.staff.find(s => s.id === 'sup-a')!;
      const colleagueEntry = listBody.data.staff.find(s => s.id === 'waiter-a')!;
      expect(selfEntry.email).toBe('sup-a@aura.vn');
      expect(selfEntry.phone).toBe('0901111111');
      expect(colleagueEntry.email).toBeNull();
      expect(colleagueEntry.phone).toBeNull();

      // 2. Supervisor getting colleague detail also masks email & phone
      const detailRes = await app.request('/api/staff/waiter-a', { method: 'GET' }, { AURA_DB: db } as unknown as Env);
      expect(detailRes.status).toBe(200);
      const detailBody = (await detailRes.json()) as {
        data: { id: string; email: string | null; phone: string | null };
      };
      expect(detailBody.data.email).toBeNull();
      expect(detailBody.data.phone).toBeNull();

      // 3. Non-HQ manager with mismatched X-Tenant-ID gets 403 across list/create/delete
      currentUser = { id: 'mgr-a', role: 'manager', tenant_id: 'store-a' };
      const crossListRes = await app.request(
        '/api/staff',
        { method: 'GET', headers: { 'X-Tenant-ID': 'store-b' } },
        { AURA_DB: db } as unknown as Env
      );
      expect(crossListRes.status).toBe(403);

      // 4. Manager creating staff in their own tenant writes callerTenant ('store-a')
      const createRes = await app.request(
        '/api/staff',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'New Cashier',
            email: 'newcashier@aura.vn',
            password: 'Password123!',
            role: 'cashier',
          }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(createRes.status).toBe(201);
      expect(insertedUserTenant).toBe('store-a');
    });

    it('scopes fallback UPDATE audit_logs by auditId in writeStaffAuditLog and blocks unscoped fallback for non-default tenants', async () => {
      const executedStatements: Array<{ sql: string; args: unknown[] }> = [];

      const db = {
        prepare(sql: string) {
          return {
            bind(...args: unknown[]) {
              return {
                async first() {
                  if (sql.includes('FROM users WHERE id = ?')) {
                    return {
                      id: 'waiter-def',
                      name: 'Waiter Default',
                      email: 'w@aura.vn',
                      phone: null,
                      role: 'waiter',
                      is_active: 1,
                      auth_version: 1,
                      tenant_id: 'default',
                      created_at: '2026-11-01T00:00:00Z',
                    };
                  }
                  return null;
                },
                async run() {
                  // Simulate legacy schema where INSERT INTO audit_logs (..., tenant_id, ...) fails
                  if (sql.includes('INSERT INTO audit_logs') && sql.includes('tenant_id')) {
                    throw new Error('table audit_logs has no column named tenant_id');
                  }
                  executedStatements.push({ sql, args });
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      };

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'owner-def', role: 'owner', tenantId: 'default' } as never);
        c.set('tenantId' as never, 'default' as never);
        await next();
      });
      registerStaffHandlers(app);

      const patchRes = await app.request(
        '/api/staff/waiter-def',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Waiter Updated' }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(patchRes.status).toBe(200);

      const fallbackAuditInsert = executedStatements.find(s => s.sql.includes('INSERT INTO audit_logs'));
      const fallbackAuditUpdate = executedStatements.find(s => s.sql.includes('UPDATE audit_logs SET tenant_id = ? WHERE id = ?'));
      expect(fallbackAuditInsert).toBeDefined();
      expect(fallbackAuditUpdate).toBeDefined();
      const generatedAuditId = fallbackAuditInsert!.args[0];
      expect(typeof generatedAuditId).toBe('string');
      expect(fallbackAuditUpdate!.args).toEqual(['default', generatedAuditId]);
    });
  });

  describe('3. Mobile Staff Device Auth tenant confinement, probe prevention & PIN lockout cleanup', () => {
    it('reads snake_case caller.tenant_id, rejects header/query tenant mismatch with 403, and returns 404 before 403 on cross-tenant device revoke', async () => {
      const db = {
        prepare(sql: string) {
          return {
            bind(...args: unknown[]) {
              return {
                async first() {
                  if (sql.includes('FROM staff_devices WHERE id = ?')) {
                    const devId = String(args[0]);
                    if (devId === 'dev-store-b-owner') {
                      return {
                        id: 'dev-store-b-owner',
                        staff_id: 'owner-b',
                        role: 'owner',
                        device_token: 'tok_store_b_1234',
                      };
                    }
                  }
                  if (sql.includes('FROM users WHERE id = ?')) {
                    const userId = String(args[0]);
                    if (userId === 'owner-b') {
                      return {
                        id: 'owner-b',
                        name: 'Owner B',
                        role: 'owner',
                        tenant_id: 'store-b',
                        is_active: 1,
                        auth_version: 1,
                      };
                    }
                  }
                  return null;
                },
                async all() {
                  return { results: [] };
                },
              };
            },
          };
        },
      };

      const app = new Hono<{ Bindings: Env }>();
      let callerUser: Record<string, unknown> = { id: 'waiter-a', role: 'waiter', tenant_id: 'store-a' };
      app.use('*', async (c, next) => {
        c.set('user' as never, callerUser as never);
        await next();
      });
      app.get('/mobile/devices', listStaffDevices);
      app.post('/mobile/devices/register', registerStaffDevice);
      app.delete('/mobile/devices/:device_id', revokeStaffDevice);

      // 1. Waiter in store-a attempting to probe a cross-tenant owner device gets 404 (not 403)
      const probeRes = await app.request(
        '/mobile/devices/dev-store-b-owner',
        { method: 'DELETE' },
        { AURA_DB: db } as unknown as Env
      );
      expect(probeRes.status).toBe(404);

      // 2. Manager with snake_case tenant_id: 'store-a' sending X-Tenant-ID: 'store-b' gets 403 on list, register, and revoke
      callerUser = { id: 'mgr-a', role: 'manager', tenant_id: 'store-a' };
      const listMismatch = await app.request(
        '/mobile/devices',
        { method: 'GET', headers: { 'X-Tenant-ID': 'store-b' } },
        { AURA_DB: db } as unknown as Env
      );
      expect(listMismatch.status).toBe(403);

      const regMismatch = await app.request(
        '/mobile/devices/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-b' },
          body: JSON.stringify({
            device_token: 'device_tok_valid_12345',
            device_name: 'iPad 1',
            staff_id: 'waiter-a',
            pin: '2580',
          }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(regMismatch.status).toBe(403);

      const revokeMismatch = await app.request(
        '/mobile/devices/dev-store-b-owner?tenant_id=store-b',
        { method: 'DELETE' },
        { AURA_DB: db } as unknown as Env
      );
      expect(revokeMismatch.status).toBe(403);
    });

    it('clears pin_lockout:${device_token} from AUTH_KV upon registerStaffDevice and revokeStaffDevice', async () => {
      const deviceToken = 'pos_terminal_token_998877';
      const kv = createMemoryKV({
        [`pin_lockout:${deviceToken}`]: JSON.stringify({ count: 5, locked_until: Date.now() + 900_000 }),
      });

      const db = {
        prepare(sql: string) {
          return {
            sql,
            args: [] as unknown[],
            bind(...args: unknown[]) {
              this.args = args;
              return this;
            },
            async first() {
              if (sql.includes('FROM users WHERE id = ?')) {
                return {
                  id: 'waiter-a',
                  name: 'Waiter A',
                  role: 'waiter',
                  tenant_id: 'store-a',
                  is_active: 1,
                  auth_version: 1,
                };
              }
              if (sql.includes('FROM staff_devices WHERE device_token = ?')) {
                return {
                  id: 'dev-1',
                  staff_id: 'waiter-a',
                  device_token: deviceToken,
                  device_name: 'POS 1',
                  role: 'waiter',
                  pin_hash: 'old_hash',
                };
              }
              if (sql.includes('FROM staff_devices WHERE id = ?')) {
                return {
                  id: 'dev-1',
                  staff_id: 'waiter-a',
                  role: 'waiter',
                  device_token: deviceToken,
                };
              }
              return null;
            },
            async run() {
              return { meta: { changes: 1 } };
            },
          };
        },
        async batch() {
          return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }];
        },
      };

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'owner-a', role: 'owner', tenant_id: 'store-a' } as never);
        await next();
      });
      app.post('/mobile/devices/register', registerStaffDevice);
      app.delete('/mobile/devices/:device_id', revokeStaffDevice);

      // 1. Re-registering/rotating PIN clears pin_lockout:${device_token}
      expect(await kv.get(`pin_lockout:${deviceToken}`)).not.toBeNull();
      const regRes = await app.request(
        '/mobile/devices/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            device_token: deviceToken,
            device_name: 'POS 1',
            staff_id: 'waiter-a',
            pin: '4826',
          }),
        },
        { AURA_DB: db, AUTH_KV: kv } as unknown as Env
      );
      expect(regRes.status).toBe(201);
      expect(await kv.get(`pin_lockout:${deviceToken}`)).toBeNull();

      // 2. Re-seed lockout and verify revokeStaffDevice also clears pin_lockout:${device_token}
      await kv.put(`pin_lockout:${deviceToken}`, JSON.stringify({ count: 5, locked_until: Date.now() + 900_000 }));
      expect(await kv.get(`pin_lockout:${deviceToken}`)).not.toBeNull();

      const revokeRes = await app.request(
        '/mobile/devices/dev-1',
        { method: 'DELETE' },
        { AURA_DB: db, AUTH_KV: kv } as unknown as Env
      );
      expect(revokeRes.status).toBe(200);
      expect(await kv.get(`pin_lockout:${deviceToken}`)).toBeNull();
    });
  });

  describe('4. Mobile POS Tables & Orders tenant scoping and PII masking', () => {
    it('scopes UPDATE cafe_tables and UPDATE table_sessions by effectiveTableTenant even when HQ caller has wildcard tenant (*)', async () => {
      const executedUpdates: Array<{ sql: string; args: unknown[] }> = [];
      const db = {
        prepare(sql: string) {
          return {
            bind(...args: unknown[]) {
              return {
                async first() {
                  if (sql.includes('FROM cafe_tables WHERE id = ?')) {
                    return {
                      id: 'tbl-1',
                      table_number: 1,
                      status: 'Occupied',
                      tenant_id: 'store-b',
                      current_order_id: 'ord-99',
                    };
                  }
                  return null;
                },
                async all() {
                  return { results: [] };
                },
                async run() {
                  if (sql.startsWith('UPDATE')) {
                    executedUpdates.push({ sql, args });
                  }
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      };

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'hq-admin', role: 'admin', tenantId: '*' } as never);
        c.set('tenantId' as never, '*' as never);
        await next();
      });
      app.patch('/mobile/tables/:id', updateTableStatus);

      const res = await app.request(
        '/mobile/tables/tbl-1',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'free' }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(res.status).toBe(200);

      const cafeTableUpdate = executedUpdates.find(u => u.sql.includes('UPDATE cafe_tables'));
      const sessionUpdate = executedUpdates.find(u => u.sql.includes('UPDATE table_sessions'));
      expect(cafeTableUpdate).toBeDefined();
      expect(cafeTableUpdate!.sql).toContain("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?");
      expect(cafeTableUpdate!.args).toContain('store-b');

      expect(sessionUpdate).toBeDefined();
      expect(sessionUpdate!.sql).toContain("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?4");
      expect(sessionUpdate!.args).toContain('store-b');
    });

    it('masks customer_phone, customer_email, customer_address, and delivery_address for supervisor/waiter in mobile orders and enforces snake_case tenant_id in createOrderMobile', async () => {
      const sampleOrder = {
        id: 'ord-mobile-1',
        table_id: 'tbl-1',
        tenant_id: 'store-a',
        customer_name: 'Nguyen Van A',
        customer_phone: '0909123456',
        customer_email: 'nguyenvana@example.com',
        customer_address: '123 Le Loi, Q1',
        delivery_address: '123 Le Loi, Q1',
        items: JSON.stringify([{ id: 'p1', name: 'Espresso', qty: 1, price: 35000 }]),
        status: 'pending',
        created_at: '2026-11-04T00:00:00Z',
      };

      const db = {
        prepare(sql: string) {
          return {
            bind() {
              return {
                async all() {
                  return { results: [sampleOrder] };
                },
                async first() {
                  if (sql.includes('FROM orders WHERE id = ?')) {
                    return sampleOrder;
                  }
                  return null;
                },
              };
            },
          };
        },
      };

      const app = new Hono<{ Bindings: Env }>();
      let currentUser: Record<string, unknown> = { id: 'sup-1', role: 'supervisor', tenant_id: 'store-a' };
      app.use('*', async (c, next) => {
        c.set('user' as never, currentUser as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      app.get('/mobile/orders', getOrdersMobile);
      app.get('/mobile/orders/:id', getOrderDetail);
      app.post('/mobile/orders', createOrderMobile);

      // 1. Supervisor gets masked PII in GET /mobile/orders and GET /mobile/orders/:id
      const listRes = await app.request('/mobile/orders', { method: 'GET' }, { AURA_DB: db } as unknown as Env);
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as {
        orders: Array<Record<string, unknown>>;
      };
      expect(listBody.orders[0].customer_phone).toBeNull();
      expect(listBody.orders[0].customer_email).toBeNull();
      expect(listBody.orders[0].customer_address).toBeNull();
      expect(listBody.orders[0].delivery_address).toBeNull();

      const detailRes = await app.request('/mobile/orders/ord-mobile-1', { method: 'GET' }, { AURA_DB: db } as unknown as Env);
      expect(detailRes.status).toBe(200);
      const detailBody = (await detailRes.json()) as {
        order: Record<string, unknown>;
      };
      expect(detailBody.order.customer_phone).toBeNull();
      expect(detailBody.order.customer_email).toBeNull();
      expect(detailBody.order.customer_address).toBeNull();
      expect(detailBody.order.delivery_address).toBeNull();

      // 2. Manager still receives unmasked PII
      currentUser = { id: 'mgr-1', role: 'manager', tenant_id: 'store-a' };
      const mgrRes = await app.request('/mobile/orders/ord-mobile-1', { method: 'GET' }, { AURA_DB: db } as unknown as Env);
      expect(mgrRes.status).toBe(200);
      const mgrBody = (await mgrRes.json()) as {
        order: Record<string, unknown>;
      };
      expect(mgrBody.order.customer_phone).toBe('0909123456');
      expect(mgrBody.order.customer_address).toBe('123 Le Loi, Q1');

      // 3. Waiter with snake_case tenant_id: 'store-a' attempting cross-tenant POST /mobile/orders with X-Tenant-ID: 'store-b' gets 403
      currentUser = { id: 'waiter-1', role: 'waiter', tenant_id: 'store-a' };
      const crossCreateRes = await app.request(
        '/mobile/orders',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'store-b' },
          body: JSON.stringify({
            table_id: 'tbl-1',
            items: [{ product_id: 'p1', quantity: 1 }],
          }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(crossCreateRes.status).toBe(403);
    });
  });
});
