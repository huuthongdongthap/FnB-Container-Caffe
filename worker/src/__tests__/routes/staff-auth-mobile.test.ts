import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  staffMobileLogin,
  staffTokenRefresh,
  registerStaffDevice,
  revokeStaffDevice,
  listStaffDevices,
} from '@aura/domain-staff';
import { createMockEnv, createMockKV, TEST_JWT_SECRET } from '../test-utils';
import { generateJWT, verifyJWT } from '../../lib/jwt';
import { generateId } from '../../tree/auth/helpers';

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Mint the live staff-mobile session a refresh must present.
 *
 * Refresh no longer accepts a device identifier alone, so the caller has to
 * present a session bound to the same device and staff account it is renewing.
 */
async function mobileSessionBearer(staffId = 'USR_1', deviceId = 'DEV_1'): Promise<string> {
  const token = await generateJWT({
    id: staffId,
    email: 'owner@auraspace.cafe',
    name: 'Owner',
    role: 'owner',
    tenantId: 'cafe-a',
    authVersion: 1,
    authTime: Math.floor(Date.now() / 1000),
    sessionType: 'staff-mobile',
    deviceId,
  } as Record<string, unknown>, TEST_JWT_SECRET, 28800);
  return `Bearer ${token}`;
}

/**
 * The account row the refresh's session gate reads, shaped as D1 returns it.
 */
const STAFF_ACCOUNT: Record<string, unknown> = {
  id: 'USR_1', name: 'Owner', phone: null, role: 'owner',
  tenant_id: 'cafe-a', is_active: 1, auth_version: 1,
};

function buildMockDb(overrides: {
  deviceByToken?: Record<string, unknown> | null;
  deviceById?: Record<string, unknown> | null;
  allDevices?: Record<string, unknown>[];
  ownDevices?: Record<string, unknown>[];
  deleteOk?: boolean;
  /** Session bearer to present; mobile refresh requires a live session JWT. */
  sessionBearer?: string;
} = {}): any {
  const rowsByToken = new Map<string, Record<string, unknown> | null>();
  const rowsById = new Map<string, Record<string, unknown> | null>();
  rowsByToken.set('tok_known', overrides.deviceByToken ?? null);
  rowsById.set('DEV_1', overrides.deviceById ?? {
    id: 'DEV_1',
    staff_id: 'USR_1',
    device_token: 'tok_known',
    pin_hash: 'pin$pbkdf2$100000$dGVzdA==$dGVzdA==',
    role: 'owner',
  });
  rowsById.set('DEV_2', overrides.deviceById ?? {
    id: 'DEV_2',
    staff_id: 'USR_1',
    device_token: 'tok_other',
    pin_hash: 'pin$pbkdf2$100000$dGVzdA==$dGVzdA==',
    role: 'staff',
  });
  rowsById.set('DEV_3', overrides.deviceById ?? {
    id: 'DEV_3', staff_id: 'USR_2', device_token: 'tok_third',
    pin_hash: 'pin$pbkdf2$100000$dGVzdA==$dGVzdA==', role: 'owner',
  });

  const db: any = {
    prepare: (_sql: string) => {
      const sql = _sql;
      const binds: unknown[] = [];
      const stmt: any = {
        bind(...args: unknown[]) { binds.push(...args); return stmt; },
        first: async () => {
          const val = binds[0];
          if (val === undefined) return null;
          const s = String(val);
          if (sql.includes('SELECT tenant_id FROM users') && s === 'USR_1') return { tenant_id: 'cafe-a' };
          // The session gate reads the staff account row to decide whether a
          // presented session is still authorised.
          if (/FROM users WHERE id = \?/i.test(sql)) {
            if (s === STAFF_ACCOUNT.id) return { ...STAFF_ACCOUNT };
            if (s === 'USR_2') return { ...STAFF_ACCOUNT, id: s, role: 'staff' };
            if (s === 'USR_3') return { ...STAFF_ACCOUNT, id: s, role: 'owner' };
            return null;
          }
          if (s.startsWith('tok_')) return rowsByToken.has(s) ? rowsByToken.get(s) : null;
          if (s.startsWith('DEV_')) return rowsById.has(s) ? rowsById.get(s) : null;
          return null;
        },
        async all() {
          const isStaffDevicesSql = sql.includes('FROM staff_devices');
          const deleteIdx = sql.indexOf('DELETE');
          const isDelete = deleteIdx >= 0 && deleteIdx < (sql.indexOf('FROM') >>> 0);
          if (isStaffDevicesSql && !isDelete) {
            if (sql.includes('JOIN users u')) return { results: sql.includes('AND d.staff_id = ?') ? overrides.ownDevices ?? [] : overrides.allDevices ?? [], success: true };
            if (!sql.includes('WHERE')) return { results: overrides.allDevices ?? [], success: true };
            if (sql.includes('staff_id = ?')) return { results: overrides.ownDevices ?? [], success: true };
            if (sql.includes('WHERE role IN')) return { results: overrides.allDevices ?? [], success: true };
          }
          if (isDelete) return { success: true, changes: overrides.deleteOk ? 1 : 0 };
          return { results: [], success: true };
        },
        async run() { return { success: true, changes: 1, meta: { changes: 1 } }; },
      };
      return stmt;
    },
    batch: async (statements: Array<{ run(): Promise<unknown> }>) => Promise.all(statements.map(statement => statement.run())),
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new Uint8Array(),
  };
  return db;
}

function mockContext(opts: {
  user?: { id: string; role: string };
  paramId?: string;
  query?: Record<string, string>;
  body?: unknown;
  kv?: ReturnType<typeof createMockKV>;
  deviceByToken?: Record<string, unknown> | null;
  deviceById?: Record<string, unknown> | null;
  allDevices?: Record<string, unknown>[];
  ownDevices?: Record<string, unknown>[];
  deleteOk?: boolean;
  /** Session bearer to present; mobile refresh requires a live session JWT. */
  sessionBearer?: string;
} = {}): any {
  const user = opts.user ?? { id: 'USR_1', role: 'owner' };
  const db = buildMockDb({
    deviceByToken: opts.deviceByToken,
    deviceById: opts.deviceById,
    allDevices: opts.allDevices,
    ownDevices: opts.ownDevices,
    deleteOk: opts.deleteOk,
  });
  const kv = opts.kv ?? createMockKV();

  const rawHeaders: Record<string, string> = {};
  if (opts.body !== undefined) rawHeaders['Content-Type'] = 'application/json';
  if (opts.sessionBearer) rawHeaders['Authorization'] = opts.sessionBearer;

  const req: any = {
    raw: new Request('https://test.aura/mobile/test', {
      method: 'POST',
      headers: rawHeaders,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    }),
    param: (_name: string) => opts.paramId || undefined,
    query: (name: string) => opts.query?.[name],
    json: async () => opts.body ?? {},
    header: (_name: string) => '',
  };

  const ctx: any = {
    req,
    env: {
      AURA_DB: db,
      AUTH_KV: kv,
      JWT_SECRET: TEST_JWT_SECRET,
      JWT_EXPIRY_SECONDS: '3600',
      AURA_AI_API_KEY: '',
      AURA_AI_PROVIDER: 'openrouter',
      __D1_BLOB__: undefined,
      __D1_META__: undefined,
    },
    get: (key: string) => key === 'user' ? { ...user, tenantId: 'cafe-a' } : undefined,
    set: (_k: string, v: unknown) => { if (typeof v !== 'function') throw new Error('set called with non-function'); },
    json: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
  };
  return ctx;
}

// Valid PIN hash helper: pin = "1234", salt = "test", hash = sha256("test"+"1234") x 3 iterations simplified
// We test at the handler level, so we provide a deterministic hash for "1234"
function makePinHash(pin: string, saltB64: string): string {
  return `pin$pbkdf2$100000$${saltB64}$testhash`;
}

function deviceWithPin(pinHash: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'DEV_1',
    staff_id: 'USR_1',
    device_token: 'tok_known',
    pin_hash: pinHash,
    role: 'owner',
    last_login_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('staffMobileLogin', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 when device_token is missing', async () => {
    const ctx: any = mockContext({ body: { pin: '1234' } });
    const res = await staffMobileLogin(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns 404 when device not registered', async () => {
    const ctx: any = mockContext({
      body: { device_token: 'tok_unknown', pin: '1234' },
      deviceByToken: null,
    });
    const res = await staffMobileLogin(ctx);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('chưa đăng ký');
  });

  it('returns 401 for wrong PIN', async () => {
    const pinHash = makePinHash('1234', btoa('testsalt'));
    const ctx: any = mockContext({
      body: { device_token: 'tok_known', pin: '0000' },
      deviceByToken: deviceWithPin(pinHash),
    });
    const res = await staffMobileLogin(ctx);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain('PIN');
  });

  it('returns 200 + JWT for valid PIN', async () => {
    const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode('1234'),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      keyMaterial,
      256
    );
    const saltB64 = btoa(String.fromCharCode(...salt));
    const hashB64 = btoa(String.fromCharCode(...new Uint8Array(bits)));
    const pinHash = `pin$pbkdf2$100000$${saltB64}$${hashB64}`;
    const ctx: any = mockContext({
      body: { device_token: 'tok_known', pin: '1234' },
      deviceByToken: deviceWithPin(pinHash),
    });
    const res = await staffMobileLogin(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(10);
    expect((await verifyJWT(body.token, TEST_JWT_SECRET))?.tenantId).toBe('cafe-a');
    expect(body.user.tenantId).toBe('cafe-a');
  });

  it('returns 503 on unavailable auth state without leaking internal message', async () => {
    const badDb: any = {
      prepare: () => ({ bind: () => ({ first: async () => { throw new Error('DB_INTERNAL_SECRET_DOWN'); } }), first: async () => { throw new Error('DB_INTERNAL_SECRET_DOWN'); } }),
    };
    const ctx: any = {
      req: {
        raw: new Request('https://test.aura/mobile/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device_token: 'tok_known', pin: '1234' }),
        }),
        param: () => 'DEV_1',
        query: () => undefined,
        json: async () => ({ device_token: 'tok_known', pin: '1234' }),
        header: () => '',
      },
      env: { AURA_DB: badDb, AUTH_KV: createMockKV(), JWT_SECRET: TEST_JWT_SECRET },
      get: (key: string) => key === 'user' ? { id: 'USR_1', role: 'owner' } : undefined,
      set: () => {},
      json: (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }),
    };
    const res = await staffMobileLogin(ctx);
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(String(body.error)).not.toContain('DB_INTERNAL_SECRET_DOWN');
  });

  it('locks out device_token with 429 after 5 failed PIN attempts', async () => {
    const pinHash = makePinHash('1234', btoa('testsalt'));
    const sharedKv = createMockKV();
    for (let i = 1; i <= 4; i++) {
      const ctx: any = mockContext({
        body: { device_token: 'tok_known', pin: '0000' },
        deviceByToken: deviceWithPin(pinHash),
        kv: sharedKv,
      });
      const res = await staffMobileLogin(ctx);
      expect(res.status).toBe(401);
    }

    const ctx5: any = mockContext({
      body: { device_token: 'tok_known', pin: '0000' },
      deviceByToken: deviceWithPin(pinHash),
      kv: sharedKv,
    });
    const res5 = await staffMobileLogin(ctx5);
    expect(res5.status).toBe(429);
  });
});

describe('staffTokenRefresh', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 when device_token is missing', async () => {
    const ctx: any = mockContext({ body: {}, sessionBearer: await mobileSessionBearer() });
    const res = await staffTokenRefresh(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 401 when device not found', async () => {
    const ctx: any = mockContext({
      body: { device_token: 'tok_nonexistent' },
      deviceByToken: null,
      sessionBearer: await mobileSessionBearer(),
    });
    const res = await staffTokenRefresh(ctx);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('DEVICE_REVOKED');
  });

  it('returns 401 when no session is presented', async () => {
    // A device identifier alone is no longer a credential: refresh requires the
    // live session it is renewing.
    const ctx: any = mockContext({
      body: { device_token: 'tok_known' },
      deviceByToken: deviceWithPin(''),
    });
    const res = await staffTokenRefresh(ctx);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('SESSION_EXPIRED');
  });

  it('returns 200 with new token for valid device', async () => {
    const ctx: any = mockContext({
      body: { device_token: 'tok_known' },
      deviceByToken: deviceWithPin(''),
      sessionBearer: await mobileSessionBearer(),
    });
    const res = await staffTokenRefresh(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.token).toBeTruthy();
    expect(typeof body.token).toBe('string');
    // Staff sessions are capped at the absolute staff TTL, not the generic
    // JWT expiry, so a device left unlocked cannot carry authority into the
    // next shift.
    expect(body.expires_in).toBe(28800);
    expect((await verifyJWT(body.token, TEST_JWT_SECRET))?.tenantId).toBe('cafe-a');
  });

  it('returns 429 when device_token is currently locked out', async () => {
    const lockedKv = createMockKV();
    await lockedKv.put('pin_lockout:tok_known', '5');
    const ctx: any = mockContext({
      body: { device_token: 'tok_known' },
      deviceByToken: deviceWithPin(''),
      kv: lockedKv,
      sessionBearer: await mobileSessionBearer(),
    });
    const res = await staffTokenRefresh(ctx);
    expect(res.status).toBe(429);
  });
});

describe('registerStaffDevice', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 for invalid body (missing staff_id)', async () => {
    const ctx: any = mockContext({
      user: { id: 'USR_1', role: 'owner' },
      body: { device_token: 'tok_new1', role: 'staff', pin: '1234' },
    });
    const res = await registerStaffDevice(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 404 when staff_id not found in KV', async () => {
    const emptyKv = createMockKV();
    const ctx: any = mockContext({
      user: { id: 'USR_1', role: 'owner' },
      body: { device_token: 'tok_new1', staff_id: 'USR_999', role: 'staff', pin: '1234' },
      kv: emptyKv,
    });
    const res = await registerStaffDevice(ctx);
    expect(res.status).toBe(404);
  });

  it('returns 201 for owner registering owner device', async () => {
    const kv = createMockKV({
      'user:USR_2': JSON.stringify({ id: 'USR_2', name: 'Staff User' }),
    });
    const ctx: any = mockContext({
      user: { id: 'USR_1', role: 'owner' },
      body: { device_token: 'tok_newdev', staff_id: 'USR_2', role: 'staff', pin: '1234' },
      kv,
    });
    const res = await registerStaffDevice(ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 403 when waiter tries to register device', async () => {
    const kv = createMockKV({ 'user:USR_2': JSON.stringify({ id: 'USR_2', name: 'Staff User' }) });
    const ctx: any = mockContext({
      user: { id: 'USR_1', role: 'waiter' },
      body: { device_token: 'tok_new1', staff_id: 'USR_2', role: 'staff', pin: '1234' },
      kv,
    });
    const res = await registerStaffDevice(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 403 when staff tries to register device', async () => {
    const kv = createMockKV({ 'user:USR_2': JSON.stringify({ id: 'USR_2', name: 'Staff User' }) });
    const ctx: any = mockContext({
      user: { id: 'USR_1', role: 'staff' },
      body: { device_token: 'tok_new1', staff_id: 'USR_2', role: 'staff', pin: '1234' },
      kv,
    });
    const res = await registerStaffDevice(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 403 when manager tries to register owner device', async () => {
    const kv = createMockKV({ 'user:USR_2': JSON.stringify({ id: 'USR_2', name: 'Staff User' }) });
    const ctx: any = mockContext({
      user: { id: 'USR_1', role: 'manager' },
      body: { device_token: 'tok_new1', staff_id: 'USR_2', role: 'owner', pin: '1234' },
      kv,
    });
    const res = await registerStaffDevice(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 201 for manager registering staff device', async () => {
    const kv = createMockKV({ 'user:USR_2': JSON.stringify({ id: 'USR_2', name: 'Staff User' }) });
    const ctx: any = mockContext({
      user: { id: 'USR_1', role: 'manager' },
      body: { device_token: 'tok_new1', staff_id: 'USR_2', role: 'staff', pin: '1234' },
      kv,
    });
    const res = await registerStaffDevice(ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 403 when customer token hits register', async () => {
    const kv = createMockKV({ 'user:USR_2': JSON.stringify({ id: 'USR_2', name: 'Staff User' }) });
    const ctx: any = mockContext({
      user: { id: 'USR_1', role: 'customer' },
      body: { device_token: 'tok_new1', staff_id: 'USR_2', role: 'staff', pin: '1234' },
      kv,
    });
    const res = await registerStaffDevice(ctx);
    expect(res.status).toBe(403);
  });

  it('preserves kitchen UI role when registering a device', async () => {
    const kv = createMockKV({ 'user:USR_2': JSON.stringify({ id: 'USR_2', name: 'Kitchen Staff' }) });
    const ctx: any = mockContext({
      user: { id: 'USR_1', role: 'manager' },
      body: { device_token: 'tok_kitchen_01', staff_id: 'USR_2', role: 'kitchen', pin: '1234' },
      kv,
    });
    const res = await registerStaffDevice(ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.user.role).toBe('kitchen');
  });
});

describe('revokeStaffDevice', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns 400 when device_id is missing', async () => {
    const ctx: any = mockContext({
      user: { id: 'USR_1', role: 'owner' },
      paramId: undefined,
    });
    const res = await revokeStaffDevice(ctx);
    expect(res.status).toBe(400);
  });

  it('returns 404 when device does not exist', async () => {
    const ctx: any = mockContext({
      user: { id: 'USR_1', role: 'owner' },
      paramId: 'DEV_NULL',
      deviceById: null,
    });
    const res = await revokeStaffDevice(ctx);
    expect(res.status).toBe(404);
  });

  it('returns 200 when owner revokes any device', async () => {
    const ctx: any = mockContext({
      user: { id: 'USR_1', role: 'owner' },
      paramId: 'DEV_2',
      deviceById: { id: 'DEV_2', staff_id: 'USR_2', role: 'staff' },
    });
    const res = await revokeStaffDevice(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 200 when staff revokes own device', async () => {
    const ctx: any = mockContext({
      user: { id: 'USR_2', role: 'staff' },
      paramId: 'DEV_2',
      deviceById: { id: 'DEV_2', staff_id: 'USR_2', role: 'staff' },
    });
    const res = await revokeStaffDevice(ctx);
    expect(res.status).toBe(200);
  });

  it('returns 403 when staff tries to revoke others device', async () => {
    const ctx: any = mockContext({
      user: { id: 'USR_2', role: 'staff' },
      paramId: 'DEV_1',
      deviceById: { id: 'DEV_1', staff_id: 'USR_1', role: 'owner' },
    });
    const res = await revokeStaffDevice(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 200 when manager revokes staff device', async () => {
    const ctx: any = mockContext({
      user: { id: 'USR_1', role: 'manager' },
      paramId: 'DEV_2',
      deviceById: { id: 'DEV_2', staff_id: 'USR_2', role: 'staff' },
    });
    const res = await revokeStaffDevice(ctx);
    expect(res.status).toBe(200);
  });

  it('returns 403 when manager tries to revoke owner device', async () => {
    const ctx: any = mockContext({
      user: { id: 'USR_2', role: 'manager' },
      paramId: 'DEV_1',
      deviceById: { id: 'DEV_1', staff_id: 'USR_1', role: 'owner' },
    });
    const res = await revokeStaffDevice(ctx);
    expect(res.status).toBe(403);
  });

  it('returns 403 when waiter tries to revoke any device', async () => {
    const ctx: any = mockContext({
      user: { id: 'USR_2', role: 'waiter' },
      paramId: 'DEV_1',
      deviceById: { id: 'DEV_1', staff_id: 'USR_1', role: 'staff' },
    });
    const res = await revokeStaffDevice(ctx);
    expect(res.status).toBe(403);
  });
});

describe('listStaffDevices', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  const sampleDevices = [
    { id: 'DEV_1', staff_id: 'USR_1', device_name: 'iPad Pro', role: 'owner', last_login_at: '2026-07-10T10:00:00Z', created_at: '2026-07-01T08:00:00Z' },
    { id: 'DEV_2', staff_id: 'USR_2', device_name: 'iPhone 15', role: 'staff', last_login_at: null, created_at: '2026-07-05T09:00:00Z' },
  ];

  it('returns 200 + all devices for owner', async () => {
    const ctx: any = mockContext({
      user: { id: 'USR_1', role: 'owner' },
      allDevices: sampleDevices,
    });
    const res = await listStaffDevices(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.devices).toHaveLength(2);
    expect(body.devices[0].id).toBe('DEV_1');
    expect(body.devices[0].staff_id).toBe('USR_1');
  });

  it('returns 200 + empty array for owner with no devices', async () => {
    const ctx: any = mockContext({
      user: { id: 'USR_1', role: 'owner' },
      allDevices: [],
    });
    const res = await listStaffDevices(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.devices).toHaveLength(0);
  });

  it('returns 200 + filtered devices for manager (staff/waiter only)', async () => {
    const mgrDevices = [
      { id: 'DEV_2', staff_id: 'USR_2', device_name: 'iPhone 15', role: 'staff', last_login_at: null, created_at: '2026-07-05T09:00:00Z' },
    ];
    const ctx: any = mockContext({
      user: { id: 'USR_1', role: 'manager' },
      allDevices: mgrDevices,
    });
    const res = await listStaffDevices(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.devices.length).toBeGreaterThan(0);
    expect(body.devices.every((d: any) => ['staff', 'waiter'].includes(d.role))).toBe(true);
  });

  it('returns 200 + own devices for staff', async () => {
    const ownDevices = [
      { id: 'DEV_2', device_name: 'iPhone 15', role: 'staff', last_login_at: null, created_at: '2026-07-05T09:00:00Z' },
    ];
    const ctx: any = mockContext({
      user: { id: 'USR_2', role: 'staff' },
      ownDevices,
    });
    const res = await listStaffDevices(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.devices).toHaveLength(1);
    expect(body.devices[0].id).toBe('DEV_2');
    expect(body.devices[0].role).toBe('staff');
  });

  it('returns 200 + own devices for waiter', async () => {
    const ownDevices = [
      { id: 'DEV_2', staff_id: 'USR_2', device_name: 'iPhone 15', role: 'waiter', last_login_at: null, created_at: '2026-07-05T09:00:00Z' },
    ];
    const ctx: any = mockContext({
      user: { id: 'USR_2', role: 'waiter' },
      ownDevices,
    });
    const res = await listStaffDevices(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.devices).toHaveLength(1);
  });

  it('returns 401 when no user in context', async () => {
    const ctx: any = mockContext({
      user: undefined,
      deviceById: null,
    });
    ctx.get = (_key: string) => undefined;
    const res = await listStaffDevices(ctx);
    expect(res.status).toBe(401);
  });
});
