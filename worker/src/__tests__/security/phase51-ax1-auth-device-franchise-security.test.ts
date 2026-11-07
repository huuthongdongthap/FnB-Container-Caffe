import { describe, it, expect } from 'vitest';
import { OpenAPIHono } from '@hono/zod-openapi';
import type { Env } from '../../types/env';
import { registerAuthHandlers } from '../../routes/openapi-auth-handlers/auth-handlers';
import { registerDeviceHandlers } from '../../routes/openapi-auth-handlers/device-handlers';
import { registerForgotPasswordHandler } from '../../routes/openapi-auth-handlers/password-handlers';
import { registerStaffHandlers } from '../../routes/openapi-auth-handlers/staff-handlers';
import { registerWithVerification } from '../../routes/auth-register';
import { verifyEmail } from '../../routes/auth-verify';
import { loginUser } from '../../tree/auth/login';
import { listStaff } from '../../tree/auth/list-staff';
import { listStaffDevices, revokeStaffDevice } from '../../../../packages/domain/staff/commands/staff-auth';
import { franchiseRouter } from '../../routes/franchise-locations';
import { issueStaffSession } from '../../lib/staff-session';
import { generateJWT } from '../../lib/jwt';

const TEST_JWT_SECRET = 'phase51_ax1_test_jwt_secret_minimum_32_bytes_long!';

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

describe('Phase 51 Slice AX1 — Auth, Staff Device, Customer Takeover & Franchise Royalty Security', () => {
  describe('1. Staff device bearer token protection (openapi-auth-handlers/device-handlers.ts)', () => {
    it('masks staff device_token in GET /api/auth/devices and omits raw device_token from revocation audit_logs', async () => {
      const secretDeviceToken = 'secret_pos_tok_123456';
      const auditInserts: Array<{ action: string; resourceType: string; resourceId: string; details: string; tenantId: string }> = [];
      let staffDeviceDeleted = false;

      const db = {
        prepare(sql: string) {
          return {
            sql,
            args: [] as unknown[],
            bind(...args: unknown[]) {
              this.args = args;
              return this;
            },
            async all() {
              if (sql.includes('FROM trusted_devices')) {
                return { results: [] };
              }
              if (sql.includes('FROM staff_devices')) {
                // Verify raw device_token is not selected unmasked when substr is used,
                // and even if a driver returns device_token, handler masks it.
                return {
                  results: [
                    {
                      id: 'sdev-1',
                      device_fingerprint: secretDeviceToken.slice(-4),
                      device_token: secretDeviceToken,
                      device_name: 'POS Counter iPad',
                      role: 'cashier',
                      is_active: 1,
                      last_login_at: '2026-11-01T10:00:00.000Z',
                      created_at: '2026-10-01T10:00:00.000Z',
                      updated_at: '2026-11-01T10:00:00.000Z',
                    },
                  ],
                };
              }
              return { results: [] };
            },
            async first() {
              if (sql.includes('FROM trusted_devices')) {
                return null;
              }
              if (sql.includes('FROM staff_devices')) {
                return {
                  id: 'sdev-1',
                  device_name: 'POS Counter iPad',
                  active: 1,
                };
              }
              return null;
            },
            async run() {
              if (sql.includes('INSERT INTO audit_logs')) {
                auditInserts.push({
                  action: String(this.args[2] ?? ''),
                  resourceType: String(this.args[3] ?? ''),
                  resourceId: String(this.args[4] ?? ''),
                  details: String(this.args[5] ?? ''),
                  tenantId: 'default',
                });
              } else if (sql.includes('UPDATE audit_logs SET tenant_id = ?') && auditInserts.length > 0) {
                auditInserts[auditInserts.length - 1].tenantId = String(this.args[0] ?? 'default');
              }
              return { meta: { changes: 1 } };
            },
          };
        },
        async batch(stmts: Array<{ sql: string; args: unknown[] }>) {
          for (const s of stmts) {
            if (s.sql.includes('DELETE FROM staff_devices')) {
              staffDeviceDeleted = true;
            }
          }
          return [];
        },
      };

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'staff-cashier-1', role: 'cashier', tenantId: 'store_a' } as never);
        c.set('tenantId' as never, 'store_a' as never);
        await next();
      });
      registerDeviceHandlers(app);

      const listRes = await app.request('/api/auth/devices', { method: 'GET' }, { AURA_DB: db } as unknown as Env);
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as {
        success: boolean;
        data: Array<{ id: string; fingerprint: string; name: string }>;
      };
      expect(listBody.success).toBe(true);
      expect(listBody.data).toHaveLength(1);
      expect(listBody.data[0].id).toBe('sdev-1');
      expect(listBody.data[0].fingerprint).toBe('***3456');
      expect(listBody.data[0].fingerprint).not.toContain(secretDeviceToken);
      expect(JSON.stringify(listBody)).not.toContain(secretDeviceToken);

      const revokeRes = await app.request('/api/auth/devices/sdev-1', { method: 'DELETE' }, { AURA_DB: db } as unknown as Env);
      expect(revokeRes.status).toBe(200);
      expect(staffDeviceDeleted).toBe(true);
      expect(auditInserts).toHaveLength(1);
      expect(auditInserts[0].action).toBe('revoke_device');
      expect(auditInserts[0].resourceType).toBe('staff_device');
      expect(auditInserts[0].tenantId).toBe('store_a');
      expect(auditInserts[0].details).not.toContain(secretDeviceToken);
      expect(auditInserts[0].details).not.toContain('deviceToken');
      expect(auditInserts[0].details).not.toContain('device_token');
      expect(JSON.parse(auditInserts[0].details)).toEqual({
        device_name: 'POS Counter iPad',
        active: 1,
      });

      // Cross-tenant header override must be rejected with 403
      const crossTenantRes = await app.request(
        '/api/auth/devices',
        { method: 'GET', headers: { 'X-Tenant-ID': 'store_b' } },
        { AURA_DB: db } as unknown as Env
      );
      expect(crossTenantRes.status).toBe(403);
    });
  });

  describe('2. Customer registration & login phone collision protection (auth-register.ts, auth-verify.ts, tree/auth/login.ts)', () => {
    it('prevents an attacker registering with a victim phone number from adopting the victim customer ID or wallet', async () => {
      const kv = createMemoryKV();
      const customers = new Map<string, Record<string, unknown>>([
        [
          'cust_victim_default',
          {
            id: 'cust_victim_default',
            email: 'victim@example.com',
            name: 'Victim Default',
            phone: '0901234567',
            tenant_id: 'default',
            loyalty_points: 500,
          },
        ],
        [
          'cust_victim_tenant_b',
          {
            id: 'cust_victim_tenant_b',
            email: 'victim_b@example.com',
            name: 'Victim B',
            phone: '0901234567',
            tenant_id: 'tenant_b',
            loyalty_points: 900,
          },
        ],
      ]);
      const wallets = new Map<string, Record<string, unknown>>([
        ['cust_victim_default', { id: 'wal_victim_1', customer_id: 'cust_victim_default', balance: 50000, tenant_id: 'default' }],
        ['cust_victim_tenant_b', { id: 'wal_victim_2', customer_id: 'cust_victim_tenant_b', balance: 80000, tenant_id: 'tenant_b' }],
      ]);
      const verifyCodes = new Map<string, { id: string; email: string; code: string; expires_at: string }>();

      const db = {
        prepare(sql: string) {
          return {
            sql,
            args: [] as unknown[],
            bind(...args: unknown[]) {
              this.args = args;
              return this;
            },
            async first<T = Record<string, unknown>>(): Promise<T | null> {
              if (sql.includes('FROM email_verifications')) {
                const targetEmail = String(this.args[0] ?? '').toLowerCase();
                return (verifyCodes.get(targetEmail) as unknown as T) ?? null;
              }
              if (sql.includes('FROM customers')) {
                // Even if an underlying mock DB returns a phone-matched customer row with a registered email,
                // the handlers must refuse to adopt a customer row with a different email or cross-tenant row.
                for (const cust of customers.values()) {
                  const custEmail = String(cust.email || '').toLowerCase();
                  const custPhone = String(cust.phone || '');
                  const custId = String(cust.id || '');
                  if (this.args.some(a => String(a).toLowerCase() === custEmail && custEmail !== '')) {
                    return cust as unknown as T;
                  }
                  if (this.args.some(a => String(a) === custId)) {
                    return cust as unknown as T;
                  }
                  if (
                    sql.includes('phone = ?') &&
                    this.args.some(a => String(a) === custPhone && custPhone !== '')
                  ) {
                    // Simulate SQL checking (email IS NULL OR TRIM(email) = '')
                    if (!custEmail) {
                      return cust as unknown as T;
                    }
                    // Also return victim row if SQL didn't filter it out, to prove JS guard also blocks adoption
                    return cust as unknown as T;
                  }
                }
                return null;
              }
              return null;
            },
            async run() {
              if (sql.includes('email_verifications') && sql.includes('INSERT')) {
                const [id, email, code, expiresAt] = this.args as [string, string, string, string];
                verifyCodes.set(email.toLowerCase(), { id, email, code, expires_at: expiresAt });
              } else if (sql.includes('INSERT INTO customers')) {
                const [id, email, name, phone, , tenantId] = this.args as [string, string, string, string, string, string];
                customers.set(id, { id, email, name, phone, tenant_id: tenantId || 'default', loyalty_points: 0 });
              } else if (sql.includes('UPDATE customers')) {
                const targetId = String(this.args[this.args.length - 2] ?? this.args[this.args.length - 1]);
                const existing = customers.get(targetId);
                if (existing) {
                  existing.email = existing.email || this.args[0];
                }
              } else if (sql.includes('INSERT INTO cashback_wallets')) {
                const [id, customerId, tenantId] = this.args as [string, string, string];
                wallets.set(customerId, { id, customer_id: customerId, balance: 0, tenant_id: tenantId || 'default' });
              }
              return { rowCount: 1, meta: { changes: 1 } };
            },
          };
        },
      };

      const env = {
        AURA_DB: db,
        AUTH_KV: kv,
        JWT_SECRET: TEST_JWT_SECRET,
        JWT_EXPIRY_SECONDS: '3600',
        PILOT_TENANT_ID: 'default',
      };

      const regReq = new Request('https://example.com/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'attacker@example.com',
          password: 'Password123!',
          name: 'Attacker',
          phone: '0901234567',
        }),
      });
      const regRes = await registerWithVerification(regReq, env);
      expect(regRes.status).toBe(201);
      const regBody = (await regRes.json()) as {
        success: boolean;
        user: { id: string; email: string; phone: string };
      };
      expect(regBody.success).toBe(true);
      expect(regBody.user.id).not.toBe('cust_victim_default');
      expect(regBody.user.id).not.toBe('cust_victim_tenant_b');
      expect(customers.get('cust_victim_default')?.email).toBe('victim@example.com');
      expect(wallets.get('cust_victim_default')?.balance).toBe(50000);

      // Verify email flow must also keep attacker isolated from victim's customer ID
      const verifyRecord = verifyCodes.get('attacker@example.com');
      expect(verifyRecord).toBeDefined();
      const verifyReq = new Request('https://example.com/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'attacker@example.com',
          code: verifyRecord!.code,
        }),
      });
      const verifyRes = await verifyEmail(verifyReq, env);
      expect(verifyRes.status).toBe(200);
      const verifyBody = (await verifyRes.json()) as { user: { id: string } };
      expect(verifyBody.user.id).toBe(regBody.user.id);
      expect(verifyBody.user.id).not.toBe('cust_victim_default');

      // Login flow must also keep attacker isolated from victim's customer ID and wallet
      const loginReq = new Request('https://example.com/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'attacker@example.com',
          password: 'Password123!',
        }),
      });
      const loginRes = await loginUser(loginReq, env);
      expect(loginRes.status).toBe(200);
      const loginBody = (await loginRes.json()) as { user: { id: string; tenantId: string } };
      expect(loginBody.user.id).toBe(regBody.user.id);
      expect(loginBody.user.id).not.toBe('cust_victim_default');
      expect(loginBody.user.id).not.toBe('cust_victim_tenant_b');
      expect(wallets.get(loginBody.user.id)?.balance ?? 0).toBe(0);
    });
  });

  describe('3. Case-insensitive email, staff anti-shadowing & OTP reset invalidation', () => {
    it('blocks customer registration when email exists in staff_login_identities (case-insensitive)', async () => {
      const db = {
        prepare(sql: string) {
          return {
            bind(...args: unknown[]) {
              return {
                async first() {
                  if (sql.includes('FROM staff_login_identities') && String(args[0]).toLowerCase() === 'staff@example.com') {
                    return { id: 'staff_100' };
                  }
                  return null;
                },
              };
            },
          };
        },
      };

      const app = new OpenAPIHono<{ Bindings: Env }>();
      registerAuthHandlers(app);

      const res = await app.request(
        '/api/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'Staff@Example.com',
            password: 'Password123!',
            name: 'Shadow Attempt',
          }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(res.status).toBe(409);
      const body = (await res.json()) as { success: boolean; error: string };
      expect(body.success).toBe(false);
      expect(body.error).toContain('Email already exists');
    });

    it('invalidates prior unused password_reset OTPs in otp_codes and email_verifications when a new reset is requested', async () => {
      const otpRows: Array<{ id: string; email: string; code: string; purpose: string; used: number; expires_at: string }> = [];
      const verificationRows: Array<{ id: string; email: string; code: string; type: string; used: number; expires_at: string }> = [];

      const db = {
        prepare(sql: string) {
          return {
            args: [] as unknown[],
            bind(...args: unknown[]) {
              this.args = args;
              return this;
            },
            async first() {
              if (sql.includes('FROM users') && String(this.args[0]).toLowerCase() === 'customer@example.com') {
                return { id: 'cust_1', role: 'customer' };
              }
              if (sql.includes('FROM otp_codes') && sql.includes('code = ?')) {
                const [email, code] = this.args as [string, string];
                return (
                  otpRows.find(
                    r => r.email.toLowerCase() === email.toLowerCase() && r.code === code && r.used === 0
                  ) ?? null
                );
              }
              if (sql.includes('FROM email_verifications') && sql.includes('code = ?')) {
                const [email, code] = this.args as [string, string];
                return (
                  verificationRows.find(
                    r => r.email.toLowerCase() === email.toLowerCase() && r.code === code && r.used === 0
                  ) ?? null
                );
              }
              return null;
            },
            async run() {
              if (sql.startsWith('UPDATE otp_codes SET used = 1')) {
                const email = String(this.args[0] ?? '').toLowerCase();
                for (const r of otpRows) {
                  if (r.email.toLowerCase() === email && r.purpose === 'password_reset') {
                    r.used = 1;
                  }
                }
              } else if (sql.startsWith('UPDATE email_verifications SET used = 1')) {
                const email = String(this.args[0] ?? '').toLowerCase();
                for (const r of verificationRows) {
                  if (r.email.toLowerCase() === email && r.type === 'password_reset') {
                    r.used = 1;
                  }
                }
              } else if (sql.includes('INSERT INTO email_verifications')) {
                const [id, email, code, type, expiresAt, used] = this.args as [string, string, string, string, string, number];
                verificationRows.push({ id, email, code, type, used, expires_at: expiresAt });
              } else if (sql.includes('INSERT INTO otp_codes')) {
                const [id, email, code, purpose, expiresAt, used] = this.args as [string, string, string, string, string, number];
                otpRows.push({ id, email, code, purpose, used, expires_at: expiresAt });
              }
              return { meta: { changes: 1 } };
            },
          };
        },
      };

      const app = new OpenAPIHono<{ Bindings: Env }>();
      registerForgotPasswordHandler(app);
      registerDeviceHandlers(app);

      // First reset request
      const res1 = await app.request(
        '/api/auth/forgot-password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'Customer@Example.com' }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(res1.status).toBe(200);
      expect(otpRows).toHaveLength(1);
      expect(verificationRows).toHaveLength(1);
      expect(otpRows[0].used).toBe(0);
      expect(verificationRows[0].used).toBe(0);
      const firstCode = otpRows[0].code;

      // Second reset request invalidates the first OTP immediately
      const res2 = await app.request(
        '/api/auth/reset-password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'customer@example.com' }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(res2.status).toBe(200);
      expect(otpRows).toHaveLength(2);
      expect(verificationRows).toHaveLength(2);
      expect(otpRows[0].used).toBe(1);
      expect(verificationRows[0].used).toBe(1);
      expect(otpRows[1].used).toBe(0);
      expect(verificationRows[1].used).toBe(0);

      // Attempting to reset password with the invalidated first OTP fails with 400
      const replayRes = await app.request(
        '/api/auth/reset-password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'customer@example.com',
            code: firstCode,
            newPassword: 'NewPassword123!',
          }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(replayRes.status).toBe(400);
    });

    it('blocks bootstrap-owner when an owner already exists in staff_accounts', async () => {
      const db = {
        prepare(sql: string) {
          return {
            bind() {
              return this;
            },
            async first() {
              if (sql.includes('FROM users WHERE role = \'owner\'')) return null;
              if (sql.includes('FROM staff_accounts WHERE role = \'owner\'')) return { id: 'owner_existing' };
              return null;
            },
          };
        },
      };

      const app = new OpenAPIHono<{ Bindings: Env }>();
      registerStaffHandlers(app);

      const res = await app.request(
        '/api/auth/bootstrap-owner',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'attacker@example.com',
            password: 'Password123!',
            name: 'Fake Owner',
          }),
        },
        { AURA_DB: db } as unknown as Env
      );
      expect(res.status).toBe(409);
    });
  });

  describe('4. Staff PII masking for non-owner/admin callers & staff device tenant isolation', () => {
    it('masks staff email and phone for supervisor callers in GET /api/auth/staff and listStaff while allowing owner full view', async () => {
      const staffRows = [
        {
          id: 'sup-1',
          name: 'Supervisor Self',
          email: 'sup@example.com',
          phone: '0900000001',
          role: 'supervisor',
          locale: 'vi',
          is_active: 1,
          avatar_url: null,
          created_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-01T00:00:00Z',
        },
        {
          id: 'cashier-2',
          name: 'Cashier Colleague',
          email: 'cashier@example.com',
          phone: '0900000002',
          role: 'cashier',
          locale: 'vi',
          is_active: 1,
          avatar_url: null,
          created_at: '2026-10-01T00:00:00Z',
          updated_at: '2026-10-01T00:00:00Z',
        },
      ];

      const db = {
        prepare(sql: string) {
          return {
            bind() {
              return this;
            },
            async first() {
              if (sql.includes('COUNT(*)')) return { total: staffRows.length };
              if (sql.includes('FROM users WHERE id = ?')) {
                return {
                  id: 'sup-1',
                  name: 'Supervisor Self',
                  role: 'supervisor',
                  tenant_id: 'store_a',
                  is_active: 1,
                  auth_version: 1,
                };
              }
              return null;
            },
            async all() {
              return { results: staffRows };
            },
          };
        },
      };

      const app = new OpenAPIHono<{ Bindings: Env }>();
      let currentUser = { id: 'sup-1', role: 'supervisor', tenantId: 'store_a' };
      app.use('*', async (c, next) => {
        c.set('user' as never, currentUser as never);
        c.set('tenantId' as never, currentUser.tenantId as never);
        await next();
      });
      registerStaffHandlers(app);

      // Supervisor request -> colleague email & phone are null
      const supRes = await app.request('/api/auth/staff', { method: 'GET' }, { AURA_DB: db } as unknown as Env);
      expect(supRes.status).toBe(200);
      const supBody = (await supRes.json()) as {
        data: { staff: Array<{ id: string; email: string | null; phone: string | null }> };
      };
      const colleague = supBody.data.staff.find(s => s.id === 'cashier-2')!;
      const selfRow = supBody.data.staff.find(s => s.id === 'sup-1')!;
      expect(colleague.email).toBeNull();
      expect(colleague.phone).toBeNull();
      expect(selfRow.email).toBe('sup@example.com');
      expect(selfRow.phone).toBe('0900000001');

      // Cross-tenant header override from supervisor -> 403
      const crossRes = await app.request(
        '/api/auth/staff',
        { method: 'GET', headers: { 'X-Tenant-ID': 'store_b' } },
        { AURA_DB: db } as unknown as Env
      );
      expect(crossRes.status).toBe(403);

      // Owner request -> full email & phone visible
      currentUser = { id: 'owner-1', role: 'owner', tenantId: 'store_a' };
      const ownerRes = await app.request('/api/auth/staff', { method: 'GET' }, { AURA_DB: db } as unknown as Env);
      expect(ownerRes.status).toBe(200);
      const ownerBody = (await ownerRes.json()) as {
        data: { staff: Array<{ id: string; email: string | null; phone: string | null }> };
      };
      const colleagueForOwner = ownerBody.data.staff.find(s => s.id === 'cashier-2')!;
      expect(colleagueForOwner.email).toBe('cashier@example.com');
      expect(colleagueForOwner.phone).toBe('0900000002');

      // Also verify tree/auth/list-staff.ts masks PII for supervisor
      const kv = createMemoryKV({
        'user:sup-1': JSON.stringify({ email: 'sup@example.com' }),
        'user:cashier-2': JSON.stringify({ email: 'cashier@example.com' }),
      });
      const issuedSupSession = await issueStaffSession(
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET: TEST_JWT_SECRET } as unknown as Env,
        {
          id: 'sup-1',
          name: 'Supervisor Self',
          phone: '0900000001',
          role: 'supervisor',
          tenant_id: 'store_a',
          is_active: 1,
          auth_version: 1,
        },
        { email: 'sup@example.com', sessionType: 'staff-web' }
      );
      const treeRes = await listStaff(
        new Request('https://example.com/api/auth/staff', {
          headers: { Authorization: `Bearer ${issuedSupSession.token}` },
        }),
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET: TEST_JWT_SECRET }
      );
      expect(treeRes.status).toBe(200);
      const treeBody = (await treeRes.json()) as {
        staff: Array<{ id: string; email: string | null; phone: string | null }>;
      };
      const treeColleague = treeBody.staff.find(s => s.id === 'cashier-2')!;
      expect(treeColleague.email).toBeNull();
      expect(treeColleague.phone).toBeNull();
    });

    it('supports HQ wildcard tenant (*) in listStaffDevices and blocks unscoped fallback in revokeStaffDevice for non-default tenants', async () => {
      let capturedSql = '';
      let capturedBindArgs: unknown[] = [];
      const db = {
        prepare(sql: string) {
          capturedSql = sql;
          return {
            sql,
            bind(...args: unknown[]) {
              capturedBindArgs = args;
              return this;
            },
            async all() {
              return {
                results: [
                  {
                    id: 'dev_hq_1',
                    staff_id: 'staff_a',
                    device_name: 'Store A POS',
                    role: 'cashier',
                    last_login_at: null,
                    created_at: '2026-10-01T00:00:00Z',
                  },
                ],
              };
            },
            async first() {
              if (sql.includes('FROM staff_devices WHERE id = ?')) {
                return { id: 'dev_store_a', staff_id: 'staff_a', role: 'cashier' };
              }
              if (sql.includes('FROM users WHERE id = ?')) {
                return {
                  id: 'staff_a',
                  name: 'Cashier A',
                  role: 'cashier',
                  tenant_id: 'store_a',
                  is_active: 1,
                  auth_version: 1,
                };
              }
              return null;
            },
          };
        },
        async batch() {
          throw new Error('no such column: tenant_id');
        },
      };

      const hqApp = new OpenAPIHono<{ Bindings: Env }>();
      hqApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'hq-admin', role: 'admin', tenantId: '*' } as never);
        await next();
      });
      hqApp.get('/mobile/devices', c => listStaffDevices(c));

      const hqRes = await hqApp.request('/mobile/devices', { method: 'GET' }, { AURA_DB: db } as unknown as Env);
      expect(hqRes.status).toBe(200);
      expect(capturedSql).toContain('WHERE 1=1');
      expect(capturedBindArgs).toHaveLength(0);

      // Non-default tenant revokeStaffDevice must NOT fall back to unscoped UPDATE users when tenant_id column fails
      const storeApp = new OpenAPIHono<{ Bindings: Env }>();
      storeApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'owner-a', role: 'owner', tenantId: 'store_a' } as never);
        await next();
      });
      storeApp.delete('/mobile/devices/:device_id', c => revokeStaffDevice(c));

      const revokeRes = await storeApp.request(
        '/mobile/devices/dev_store_a',
        { method: 'DELETE' },
        { AURA_DB: db } as unknown as Env
      );
      expect(revokeRes.status).toBe(503);
    });
  });

  describe('5. Franchise location royalty metrics filtering & full-day end_date (franchise-locations.ts)', () => {
    it('excludes canceled, refunded, failed, rejected, expired orders and refunded/failed payment_status and includes full end_date day', async () => {
      const orders = [
        { id: 'ord_valid_1', tenant_id: 'store_a', status: 'completed', payment_status: 'paid', total: 100000, created_at: '2026-10-15T09:00:00.000Z' },
        { id: 'ord_valid_end_day', tenant_id: 'store_a', status: 'delivered', payment_status: 'paid', total: 200000, created_at: '2026-10-31T14:30:00.000Z' },
        { id: 'ord_canceled_us', tenant_id: 'store_a', status: 'canceled', payment_status: 'unpaid', total: 500000, created_at: '2026-10-20T10:00:00.000Z' },
        { id: 'ord_cancelled_uk', tenant_id: 'store_a', status: 'cancelled', payment_status: 'unpaid', total: 400000, created_at: '2026-10-20T11:00:00.000Z' },
        { id: 'ord_refunded_status', tenant_id: 'store_a', status: 'refunded', payment_status: 'refunded', total: 300000, created_at: '2026-10-21T10:00:00.000Z' },
        { id: 'ord_failed_status', tenant_id: 'store_a', status: 'failed', payment_status: 'failed', total: 250000, created_at: '2026-10-22T10:00:00.000Z' },
        { id: 'ord_rejected_status', tenant_id: 'store_a', status: 'rejected', payment_status: 'unpaid', total: 150000, created_at: '2026-10-23T10:00:00.000Z' },
        { id: 'ord_expired_status', tenant_id: 'store_a', status: 'expired', payment_status: 'unpaid', total: 120000, created_at: '2026-10-24T10:00:00.000Z' },
        { id: 'ord_refunded_pay', tenant_id: 'store_a', status: 'completed', payment_status: 'refunded', total: 350000, created_at: '2026-10-25T10:00:00.000Z' },
        { id: 'ord_other_tenant', tenant_id: 'store_b', status: 'completed', payment_status: 'paid', total: 900000, created_at: '2026-10-15T09:00:00.000Z' },
        { id: 'ord_next_month', tenant_id: 'store_a', status: 'completed', payment_status: 'paid', total: 700000, created_at: '2026-11-01T00:00:01.000Z' },
      ];

      let executedMetricsSql = '';
      let executedMetricsParams: unknown[] = [];

      const db = {
        prepare(sql: string) {
          return {
            sql,
            args: [] as unknown[],
            bind(...args: unknown[]) {
              this.args = args;
              return this;
            },
            async first<T = Record<string, unknown>>(): Promise<T | null> {
              if (sql.includes('FROM users WHERE id = ?')) {
                return {
                  id: 'owner_a',
                  name: 'Owner A',
                  role: 'owner',
                  tenant_id: 'store_a',
                  is_active: 1,
                  auth_version: 1,
                } as unknown as T;
              }
              if (sql.includes('FROM franchise_locations')) {
                return {
                  id: 'loc_store_a',
                  code: 'FR-A',
                  name: 'Franchise Store A',
                  tenant_id: 'store_a',
                  royalty_percentage: 5.0,
                } as unknown as T;
              }
              if (sql.includes('FROM orders')) {
                executedMetricsSql = sql;
                executedMetricsParams = this.args;
                const [tenantParam, startParam, endParam] = this.args as [string, string, string];
                const excludedStatuses = new Set(['cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired']);
                const excludedPaymentStatuses = new Set(['refunded', 'failed', 'cancelled', 'canceled']);

                const matching = orders.filter(o => {
                  if (o.tenant_id !== tenantParam) return false;
                  if (excludedStatuses.has(o.status.toLowerCase())) return false;
                  if (excludedPaymentStatuses.has(o.payment_status.toLowerCase())) return false;
                  if (startParam && o.created_at < startParam) return false;
                  if (endParam && o.created_at > endParam) return false;
                  return true;
                });
                const gross = matching.reduce((sum, o) => sum + o.total, 0);
                return { order_count: matching.length, gross_sales: gross } as unknown as T;
              }
              return null;
            },
          };
        },
      };

      const kv = createMemoryKV();
      const issuedOwner = await issueStaffSession(
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET: TEST_JWT_SECRET } as unknown as Env,
        {
          id: 'owner_a',
          name: 'Owner A',
          phone: null,
          role: 'owner',
          tenant_id: 'store_a',
          is_active: 1,
          auth_version: 1,
        },
        { email: 'owner_a@example.com', sessionType: 'staff-web' }
      );

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.route('/api/franchise', franchiseRouter);

      const res = await app.request(
        '/api/franchise/locations/loc_store_a/metrics?start_date=2026-10-01&end_date=2026-10-31',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${issuedOwner.token}` },
        },
        { AURA_DB: db, AUTH_KV: kv, JWT_SECRET: TEST_JWT_SECRET } as unknown as Env
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: {
          order_count: number;
          gross_sales: number;
          royalty_percentage: number;
          royalty_amount: number;
          net_franchisee_payout: number;
        };
      };
      expect(body.success).toBe(true);
      expect(executedMetricsSql).toContain("NOT IN ('cancelled', 'canceled', 'refunded', 'failed', 'rejected', 'expired')");
      expect(executedMetricsSql).toContain("LOWER(COALESCE(payment_status, '')) NOT IN ('refunded', 'failed', 'cancelled', 'canceled')");
      expect(executedMetricsParams).toEqual(['store_a', '2026-10-01', '2026-10-31T23:59:59.999Z']);
      expect(body.data.order_count).toBe(2);
      expect(body.data.gross_sales).toBe(300000);
      expect(body.data.royalty_amount).toBe(15000);
      expect(body.data.net_franchisee_payout).toBe(285000);
    });
  });
});
