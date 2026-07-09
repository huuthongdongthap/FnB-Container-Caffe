import { describe, it, expect } from 'vitest';
import { handleLookup } from '../../../tree/loyalty/lookup-handler';

function makeCtx(overrides: {
  phone?: string
  customer?: Record<string, unknown> | null
} = {}): unknown {
  const {
    phone = '0909009009',
    customer = { id: 'cust_1', name: 'Test', phone, loyalty_points: 500, loyalty_tier: 'bronze', created_at: '2026-01-01' }
  } = overrides;

  let callIdx = 0;
  const results: Array<Record<string, unknown> | null> = [customer, null, { total: 0 }, null];

  return {
    req: { query: (k: string) => k === 'phone' ? phone : '' },
    env: { AURA_DB: {
      prepare: () => {
        const r = results[callIdx] ?? null;
        callIdx++;
        return {
          bind: () => ({
            first: async() => (r && !('results' in (r as Record<string, unknown>)) ? r : null),
            all: async() => ({ results: [] })
          })
        };
      }
    } },
    json: (data: unknown, status?: number) => {
      if (status) {
        return { status, body: data };
      }
      return { status: 200, body: data };
    }
  } as unknown as Parameters<typeof handleLookup>[0];
}

describe('handleLookup', () => {
  it('returns 200 with member data on happy path', async() => {
    const ctx = makeCtx();
    const res = await handleLookup(ctx as never);
    expect((res as Response).status).toBe(200);
  });

  it('returns 400 when phone is missing', async() => {
    const ctx = makeCtx({ phone: '' });
    const res = await handleLookup(ctx as never);
    expect((res as Response).status).toBe(400);
  });

  it('returns 200 with not-found when customer does not exist', async() => {
    const ctx = makeCtx({ customer: null });
    const res = await handleLookup(ctx as never);
    expect((res as Response).status).toBe(200);
  });
});
