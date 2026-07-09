#!/usr/bin/env python3
"""Patch the loyalty test file: remove broken vi.mock blocks, fix auth-middleware JWT handling."""

path = 'src/__tests__/tree/loyalty/index.test.ts'

with open(path, 'r') as f:
    content = f.read()

# 1. Remove the broken referral/zalo mock block (lines 65-74)
bad_block1 = '''// ── Stub dynamic imports (referrals + zalo) ──────────────────────────────────
const mockProcessReferralOnFirstOrder = vi.fn();
const mockNotifyMember = vi.fn();
vi.mock('../../../tree/routes/referrals.js', () => ({
  processReferralOnFirstOrder: mockProcessReferralOnFirstOrder,
}));
vi.mock('../../../tree/routes/zalo.js', () => ({
  notifyMember: mockNotifyMember,
}));

'''
content = content.replace(bad_block1, '')

# 2. Remove the broken JWT mock block (lines 75-80)
bad_block2 = '''// ── Stub JWT for auth tests ──────────────────────────────────────────────────
const mockVerifyJWT = vi.fn();
vi.mock('../../../tree/lib/jwt.js', () => ({
  verifyJWT: (...args: unknown[]) => mockVerifyJWT(...args),
  generateJWT: () => 'test-token',
}));

'''
content = content.replace(bad_block2, '')

# 3. Fix auth-middleware: replace mock-based tests with real JWT-based tests
# Replace the 2 failing auth-middleware tests (401 with invalid token, 404 ghost user)
old_auth = '''  it('returns 401 when no Authorization header', async () => {
    mockVerifyJWT.mockResolvedValue(null);
    const ctx = makeMdwCtx({ header: () => undefined });
    const res = await authCustomer(ctx as Parameters<typeof authCustomer>[0], async () => new Response('ok'));
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(false);
  });

  it('returns 401 when JWT is invalid', async () => {
    mockVerifyJWT.mockResolvedValue(null);
    const ctx = makeMdwCtx({ header: () => 'Bearer bad-token' });
    const res = await authCustomer(ctx as Parameters<typeof authCustomer>[0], async () => new Response('ok'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when customer not found after valid token', async () => {
    let stepIdx = 0;
    const db: D1Database = {
      prepare: (_sql: string) => {
        stepIdx++;
        return {
          bind: () => ({ first: async () => null }),
          first: async () => null,
        };
      },
    } as unknown as D1Database;
    mockVerifyJWT.mockResolvedValue({ email: 'ghost@test.com', id: 99 });
    const ctx = makeMdwCtx({ header: () => 'Bearer valid-token', env: { AURA_DB: db } });
    const res = await authCustomer(ctx as Parameters<typeof authCustomer>[0], async () => new Response('ok'));
    expect(res.status).toBe(404);
  });'''

new_auth = '''  it('returns 401 when no Authorization header', async () => {
    const ctx = makeMdwCtx({ header: () => undefined, reqPath: '/api/loyalty/summary' });
    const res = await authCustomer(ctx as Parameters<typeof authCustomer>[0], async () => new Response('ok'));
    expect(res.status).toBe(401);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.success).toBe(false);
  });

  it('returns 401 when token is malformed', async () => {
    const ctx = makeMdwCtx({ header: () => 'Bearer not-a-real-jwt-token', reqPath: '/api/loyalty/summary' });
    const res = await authCustomer(ctx as Parameters<typeof authCustomer>[0], async () => new Response('ok'));
    expect(res.status).toBe(401);
  });

  it('returns 404 when customer not found after valid token', async () => {
    let stepIdx = 0;
    const db: D1Database = {
      prepare: (_sql: string) => {
        stepIdx++;
        return {
          bind: () => ({ first: async () => null }),
          first: async () => null,
        };
      },
    } as unknown as D1Database;
    const JWT_SECRET = 'this-is-a-valid-secret-key-16+';
    const { generateJWT } = await import('../../../lib/jwt.js');
    const validToken = generateJWT({ email: 'ghost@test.com', id: 99 }, JWT_SECRET, 3600);
    const ctx = makeMdwCtx({ header: () => 'Bearer ' + validToken, env: { AURA_DB: db, JWT_SECRET } });
    const res = await authCustomer(ctx as Parameters<typeof authCustomer>[0], async () => new Response('ok'));
    expect(res.status).toBe(404);
  });'''

content = content.replace(old_auth, new_auth)

# 4. Fix "sets customer" test to use real JWT generation
old_set_customer = '''  it('sets customer and calls next when authenticated', async () => {
    const customer = {
      id: 1, name: 'Auth User', email: 'auth@test.com', phone: '0909123456',
      loyalty_points: 100, lifetime_points: 200, loyalty_tier: 'bronze', created_at: '2025-01-01',
    };
    let stepIdx = 0;
    const db: D1Database = {
      prepare: (_sql: string) => {
        stepIdx++;
        return {
          bind: () => ({ first: async () => customer }),
          first: async () => customer,
        };
      },
    } as unknown as D1Database;
    mockVerifyJWT.mockResolvedValue({ email: 'auth@test.com', id: 1 });
    const setCalls: Array<{ k: string; v: unknown }> = [];
    let nextCalled = false;
    const ctx = makeMdwCtx({
      header: () => 'Bearer valid-token',
      env: { AURA_DB: db },
      set: (k: string, v: unknown) => { setCalls.push({ k, v }); },
    });
    const res = await authCustomer(ctx as Parameters<typeof authCustomer>[0], async () => { nextCalled = true; return new Response('ok'); });
    expect(nextCalled).toBe(true);
    expect(res.status).toBe(200);
    expect(setCalls.some((c) => c.k === 'customer')).toBe(true);
  });'''

new_set_customer = '''  it('sets customer and calls next when authenticated', async () => {
    const customer = {
      id: 1, name: 'Auth User', email: 'auth@test.com', phone: '0909123456',
      loyalty_points: 100, lifetime_points: 200, loyalty_tier: 'bronze', created_at: '2025-01-01',
    };
    let stepIdx = 0;
    const db: D1Database = {
      prepare: (_sql: string) => {
        stepIdx++;
        return {
          bind: () => ({ first: async () => customer }),
          first: async () => customer,
        };
      },
    } as unknown as D1Database;
    const JWT_SECRET = 'this-is-a-valid-secret-key-16+';
    const { generateJWT } = await import('../../../lib/jwt.js');
    const validToken = generateJWT({ email: 'auth@test.com', id: 1 }, JWT_SECRET, 3600);
    const setCalls: Array<{ k: string; v: unknown }> = [];
    let nextCalled = false;
    const ctx = makeMdwCtx({
      header: () => 'Bearer ' + validToken,
      env: { AURA_DB: db, JWT_SECRET },
      set: (k: string, v: unknown) => { setCalls.push({ k, v }); },
    });
    const res = await authCustomer(ctx as Parameters<typeof authCustomer>[0], async () => { nextCalled = true; return new Response('ok'); });
    expect(nextCalled).toBe(true);
    expect(res.status).toBe(200);
    expect(setCalls.some((c) => c.k === 'customer')).toBe(true);
  });'''

content = content.replace(old_set_customer, new_set_customer)

with open(path, 'w') as f:
    f.write(content)

print('Patched successfully')
# Verify the key lines are present
assert 'vi.mock' not in content, 'ERROR: vi.mock still present!'
assert '../../../lib/jwt.js' in content, 'ERROR: jwt import missing'
print('Verification passed: no vi.mock blocks, jwt import present')
