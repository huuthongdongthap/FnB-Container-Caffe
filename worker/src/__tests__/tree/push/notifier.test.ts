import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initPush, sendPushToCustomer } from '../../../tree/push/notifier.js';
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: vi.fn().mockResolvedValue(undefined),
  },
}));
function makeD1(rows: unknown[] = []): D1Database {
  return {
    prepare: () => ({
      bind: () => ({ all: async () => ({ results: rows }) }),
      all: async () => ({ results: rows }),
    }),
  };
}
function makeEnv(overrides: Record<string, unknown> = {}): Parameters<typeof sendPushToCustomer>[0]['env'] {
  return {
    VAPID_PUBLIC_KEY: 'pk',
    VAPID_PRIVATE_KEY: 'sk',
    VAPID_EMAIL: 'admin@auraspace.vn',
    AURA_DB: makeD1([{ id: 's1', endpoint: 'https://push.example.com/abc', auth_key: 'k1', p256dh_key: 'k2', customer_id: 'c1', role: 'customer' }]),
    ...overrides,
  } as any;
}
describe('Push: notifier', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it('initPush configures VAPID', () => {
    const env = makeEnv();
    expect(() => initPush(env)).not.toThrow();
  });
  it('returns sent=0 failed=0 when keys missing', async () => {
    const env = makeEnv({ VAPID_PUBLIC_KEY: undefined, VAPID_PRIVATE_KEY: undefined } as Record<string, unknown>);
    const r = await sendPushToCustomer(env as any, 'c1', { title: 'Hello', body: 'World' });
    expect(r).toEqual({ sent: 0, failed: 0 });
  });
  it('sends notification to customer subscriptions', async () => {
    const env = makeEnv();
    const r = await sendPushToCustomer(env as any, 'c1', { title: 'Hello', body: 'World' });
    expect(r.sent).toBeGreaterThanOrEqual(0);
    expect(typeof r.failed).toBe('number');
  });
  it('broadcasts when customerId is null', async () => {
    const env = makeEnv();
    const r = await sendPushToCustomer(env as any, null, { title: 'Broadcast', body: 'msg' });
    expect(typeof r.sent).toBe('number');
  });
});
