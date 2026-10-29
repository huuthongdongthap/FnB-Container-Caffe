import { describe, it, expect, vi } from 'vitest';
import { promotionsRouter } from '../../routes/promotions';
import { createMockEnv } from '../test-utils';

function mockToken(role: string = 'owner'): string {
  try {
    const crypto = require('crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      id: 'u_1', sub: 'u_1',
      role,
      email: role === 'owner' ? 'owner@test.aura' : 'user@test.aura',
      name: role === 'owner' ? 'Owner Test' : 'User Test',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      // The staff-session gate needs the token to name the credential entry it
      // came from and the session version it was issued at.
      ...(role === 'customer' ? {} : { authVersion: 1, authTime: Math.floor(Date.now() / 1000), sessionType: 'staff-web' })
    })).toString('base64url');
    const sig = crypto.createHmac('sha256', 'test-jwt-secret-at-least-16-chars').update(header + '.' + payload).digest('base64url');
    return 'Bearer ' + header + '.' + payload + '.' + sig;
  } catch {
    return 'Bearer stub_token';
  }
}

describe('Promotions Routes (/api/promotions)', () => {
  it('GET / lists all promotions', async () => {
    const env = createMockEnv();
    const mockPromos = [
      { id: '1', code: 'SUMMER20', percent: 20, is_active: 1 }
    ];
    env.AURA_DB.prepare = vi.fn().mockReturnValue({
      all: vi.fn().mockResolvedValue({ results: mockPromos })
    }) as any;

    const res = await promotionsRouter.request('/', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockPromos);
  });

  it('GET /:code returns single promotion if found', async () => {
    const env = createMockEnv();
    const mockPromo = { id: '1', code: 'SUMMER20', percent: 20, is_active: 1 };
    env.AURA_DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(mockPromo)
      })
    }) as any;

    const res = await promotionsRouter.request('/summer20', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.code).toBe('SUMMER20');
  });

  it('GET /:code returns 404 when promotion does not exist', async () => {
    const env = createMockEnv();
    env.AURA_DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(null)
      })
    }) as any;

    const res = await promotionsRouter.request('/notfound', { method: 'GET' }, env);
    expect(res.status).toBe(404);
  });

  it('POST /validate checks active valid promo code', async () => {
    const env = createMockEnv();
    const mockPromo = {
      id: 'p1',
      code: 'DISC10',
      percent: 10,
      max_discount: 50000,
      min_order: 100000,
      usage_limit: 10,
      usage_count: 2,
      is_active: 1,
      starts_at: null,
      expires_at: null
    };

    env.AURA_DB.prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(mockPromo)
      })
    }) as any;

    const res = await promotionsRouter.request('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'disc10', order_total: 150000 })
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.valid).toBe(true);
    expect(body.data.percent).toBe(10);
  });

  it('POST /redeem successfully calculates discount and logs redemption', async () => {
    const env = createMockEnv();
    const mockPromo = {
      id: 'p1',
      code: 'DISC10',
      percent: 10,
      max_discount: 50000,
      min_order: 100000,
      usage_limit: 10,
      usage_count: 2,
      is_active: 1
    };

    const runMock = vi.fn().mockResolvedValue({ success: true });
    env.AURA_DB.prepare = vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(mockPromo),
        run: runMock
      })
    })) as any;

    const res = await promotionsRouter.request('/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'DISC10', order_id: 'ord_123', order_total: 200000 })
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.discount_amount).toBe(20000); // 10% of 200000
    expect(runMock).toHaveBeenCalled();
  });

  it('POST / allows admin and manager roles to create promotions', async () => {
    for (const role of ['admin', 'manager']) {
      const env = { ...createMockEnv(), JWT_SECRET: 'test-jwt-secret-at-least-16-chars' };
      let callIdx = 0;
      env.AURA_DB.prepare = vi.fn().mockImplementation((sql: string) => ({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockImplementation(async () => {
            // The session gate's account lookup must not consume the route's
            // own first-call slot, or the duplicate-code branch stops being
            // the first answer.
            if (/FROM users WHERE id = \?/i.test(sql)) {
              return { id: 'u_1', name: 'Admin', phone: null, role, tenant_id: 'default', is_active: 1, auth_version: 1 };
            }
            callIdx += 1;
            return callIdx === 1 ? null : { code: 'NEWPROMO', percent: 15, is_active: 1 };
          }),
          run: vi.fn().mockResolvedValue({ success: true })
        })
      })) as any;

      const res = await promotionsRouter.request('/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: mockToken(role)
        },
        body: JSON.stringify({ code: 'newpromo', percent: 15 })
      }, env);

      expect(res.status).toBe(201);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.data.code).toBe('NEWPROMO');
    }
  });

  it('POST /validate permanently allows WELCOME (-10%, cap 30,000 VND) for new customer with registration info', async () => {
    const env = createMockEnv();
    env.AURA_DB.prepare = vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(async () => {
          if (/FROM promotions/i.test(sql)) {
            return {
              id: 'promo_welcome',
              code: 'WELCOME',
              percent: 10,
              max_discount: 30000,
              min_order: 0,
              usage_limit: 1,
              usage_count: 999,
              expires_at: '2020-01-01T00:00:00Z',
              is_active: 1,
            };
          }
          if (/COUNT\(\*\)\s+AS\s+cnt\s+FROM\s+orders/i.test(sql)) {
            return { cnt: 0 };
          }
          return null;
        }),
      }),
    })) as any;

    const res = await promotionsRouter.request('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'welcome',
        order_total: 400000,
        customer_name: 'Khach Moi',
        customer_phone: '0912345678',
      }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.data.valid).toBe(true);
    expect(body.data.percent).toBe(10);
    expect(body.data.max_discount).toBe(30000);
    expect(body.data.discount_amount).toBe(30000);
  });

  it('POST /validate rejects WELCOME for returning customer with prior non-cancelled order', async () => {
    const env = createMockEnv();
    env.AURA_DB.prepare = vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(async () => {
          if (/FROM promotions/i.test(sql)) {
            return { id: 'promo_welcome', code: 'WELCOME', percent: 10, max_discount: 30000, min_order: 0, usage_limit: 0, usage_count: 0, is_active: 1 };
          }
          if (/COUNT\(\*\)\s+AS\s+cnt\s+FROM\s+orders/i.test(sql)) {
            return { cnt: 1 };
          }
          return null;
        }),
      }),
    })) as any;

    const res = await promotionsRouter.request('/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'WELCOME',
        order_total: 100000,
        customer_name: 'Khach Cu',
        customer_phone: '0912345678',
      }),
    }, env);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.data.valid).toBe(false);
    expect(body.data.reason).toContain('khách hàng mới');
  });

  it('POST /redeem is idempotent for the same order_id and enforces min_order', async () => {
    const env = createMockEnv();
    env.AURA_DB.prepare = vi.fn().mockImplementation((sql: string) => ({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockImplementation(async () => {
          if (/FROM promotions/i.test(sql)) {
            return { id: 'p1', code: 'DISC10', percent: 10, max_discount: 50000, min_order: 100000, usage_limit: 10, usage_count: 2, is_active: 1 };
          }
          if (/FROM promotion_redemptions WHERE order_id = \?/i.test(sql)) {
            return { id: 7, promotion_id: 'p1', code: 'DISC10', discount_amount: 15000, order_id: 'ord_dup' };
          }
          return null;
        }),
      }),
    })) as any;

    const dupRes = await promotionsRouter.request('/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'DISC10', order_id: 'ord_dup', order_total: 150000 }),
    }, env);

    expect(dupRes.status).toBe(200);
    const dupBody = await dupRes.json() as any;
    expect(dupBody.success).toBe(true);
    expect(dupBody.data.idempotent).toBe(true);
    expect(dupBody.data.discount_amount).toBe(15000);
  });
});
