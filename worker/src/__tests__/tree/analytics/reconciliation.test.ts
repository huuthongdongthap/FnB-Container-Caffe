import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { reportsRouter } from '../../../routes/reports';
import { createMockEnv } from '../../test-utils';

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
