// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { reportsRouter } from '../../../routes/reports';
import { createMockEnv } from '../../test-utils';
import { orderCreationFixture } from '../../integrations/order-creation-fixture';

it('counts only settled digital orders in the store’s ICT order-date window', async () => {
  const { sqlite, env } = orderCreationFixture();
  try {
    const insert = sqlite.prepare(`INSERT INTO orders
      (id, items, total, status, payment_status, payment_method, customer_name, customer_phone, tenant_id, created_at)
      VALUES (?, '[]', ?, ?, ?, ?, 'Guest', '0900000010', ?, ?)`);
    insert.run('abandoned', 45000, 'pending', 'unpaid', 'payos', 'default', '2026-11-17T17:00:00Z');
    insert.run('settled', 65000, 'preparing', 'paid', 'payos', 'default', '2026-11-18T16:59:59Z');
    insert.run('legacy', 25000, 'completed', 'completed', 'qr', 'default', '2026-11-18T00:00:00Z');
    insert.run('cash', 20000, 'completed', 'paid', 'cash', 'default', '2026-11-18T00:00:00Z');
    insert.run('other-tenant', 33000, 'completed', 'paid', 'payos', 'cafe-b', '2026-11-18T00:00:00Z');
    insert.run('next-day', 35000, 'completed', 'paid', 'payos', 'default', '2026-11-18T17:00:00Z');
    insert.run('refunded', 21000, 'refunded', 'refunded', 'payos', 'default', '2026-11-18T00:00:00Z');

    const app = new Hono();
    app.use('*', async (c, next) => {
      c.set('user' as never, { id: 'owner-local', role: 'owner', tenantId: 'default' } as never);
      await next();
    });
    app.route('/api/reports', reportsRouter);
    const response = await app.request('/api/reports/reconciliation?from=2026-11-18&to=2026-11-18', {}, {
      ...env, CASH_RECONCILIATION_ENABLED: 'true',
    });
    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data.totals).toMatchObject({ digital_payments: 90000, revenue: 155000, order_count: 4 });
    expect(data.payment_methods).toContainEqual({ method: 'payos', count: 2, total: 110000 });
  } finally {
    sqlite.close();
  }
});

describe('reports reconciliation pilot gate', () => {
  let app: Hono<any>;
  const prepare = vi.fn(() => { throw new Error('Disabled cash reports must not read legacy tables'); });
  const batch = vi.fn(() => { throw new Error('Disabled cash reports must not write records'); });

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.route('/api/reports', reportsRouter);
  });

  const request = (query = '') => app.request(`/api/reports/reconciliation${query}`, {}, createMockEnv({
    AURA_DB: { prepare, batch } as any,
  }));

  it('returns the explicit disabled contract instead of fabricated financial totals', async () => {
    const response = await request('?from=2026-07-15&to=2026-07-16');
    expect(response.status).toBe(501);
    expect(await response.json()).toEqual({
      success: false,
      code: 'PILOT_CASH_RECONCILIATION_DISABLED',
      error: 'Cash reconciliation is unavailable for the attendance pilot',
    });
  });

  it('never reads the legacy cash and shift topology', async () => {
    await request();
    expect(prepare).not.toHaveBeenCalled();
  });

  it('never writes a settlement or reconciliation record', async () => {
    await request();
    expect(batch).not.toHaveBeenCalled();
  });

  it('cannot enable reporting through query parameters', async () => {
    const response = await request('?from=invalid&to=invalid&tenant_id=other&enabled=true');
    expect(response.status).toBe(501);
    expect((await response.json()).data).toBeUndefined();
    expect(prepare).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });
});
