import { describe, it, expect, vi } from 'vitest';
import { promotionsRouter } from '../../routes/promotions';
import { createMockEnv } from '../test-utils';

function mockToken(role: string = 'owner'): string {
  try {
    const crypto = require('crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: 'u_1',
      role,
      email: role === 'owner' ? 'owner@test.aura' : 'user@test.aura',
      name: role === 'owner' ? 'Owner Test' : 'User Test',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600
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
});
