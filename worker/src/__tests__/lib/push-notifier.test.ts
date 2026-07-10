import { describe, it, expect, vi } from 'vitest';
import { sendPushToUser } from '../../lib/push-notifier';

// ── Mocks ─────────────────────────────────────────────────────────────

vi.mock('../../tree/push/notifier', () => ({
  sendPushToCustomer: vi.fn().mockResolvedValue(undefined),
}));

// ── Helpers ───────────────────────────────────────────────────────────

function makeDb(subs: any[] = []): any {
  return {
    prepare: (_sql: string) => {
      const stmt: any = { _sql: _sql, _binds: [] };
      stmt.bind = (...args: unknown[]) => { stmt._binds = args; return stmt; };
      stmt.all = async () => ({ results: subs, success: true });
      stmt.first = async () => null;
      stmt.run = async () => ({ success: true, changes: 1 });
      stmt.raw = async () => [];
      return stmt;
    },
    batch: async () => [],
    exec: async () => ({ count: 0 }),
    dump: async () => new Uint8Array(),
  };
}

function makeEnv(db: any, vapid = true): any {
  return {
    AURA_DB: db,
    VAPID_PUBLIC_KEY: vapid ? 'BP_test_key' : undefined,
    VAPID_PRIVATE_KEY: vapid ? 'test_private' : undefined,
    VAPID_EMAIL: vapid ? 'test@test.com' : undefined,
  };
}

const payload = {
  title_vi: 'Thông báo',
  title_en: 'Notification',
  body_vi: 'Nội dung',
  body_en: 'Content',
  data: { orderId: 'ORD_1' },
  tag: 'test-tag',
  requireInteraction: true,
};

// ── Tests ─────────────────────────────────────────────────────────────

describe('sendPushToUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 0 when VAPID keys missing', async () => {
    const db = makeDb([{ endpoint: 'https://push.example.com/s1', auth_key: 'auth', p256dh_key: 'p256' }]);
    const env = makeEnv(db, false);
    const sent = await sendPushToUser(env, 'USR_1', payload);
    expect(sent).toBe(0);
  });

  it('returns 0 when no subscriptions', async () => {
    const db = makeDb([]);
    const env = makeEnv(db, true);
    const sent = await sendPushToUser(env, 'USR_1', payload);
    expect(sent).toBe(0);
  });

  it('sends to 1 subscription', async () => {
    const db = makeDb([
      { endpoint: 'https://push.example.com/s1', auth_key: 'auth1', p256dh_key: 'p256_1' },
    ]);
    const env = makeEnv(db, true);
    const sent = await sendPushToUser(env, 'USR_1', payload);
    expect(sent).toBe(1);
  });

  it('sends to multiple subscriptions', async () => {
    const db = makeDb([
      { endpoint: 'https://push.example.com/s1', auth_key: 'a1', p256dh_key: 'p1' },
      { endpoint: 'https://push.example.com/s2', auth_key: 'a2', p256dh_key: 'p2' },
      { endpoint: 'https://push.example.com/s3', auth_key: 'a3', p256dh_key: 'p3' },
    ]);
    const env = makeEnv(db, true);
    const sent = await sendPushToUser(env, 'USR_1', payload);
    expect(sent).toBe(3);
  });

  it('skips stale subscription (410) and deletes it', async () => {
    const { sendPushToCustomer } = await import('../../tree/push/notifier');
    vi.mocked(sendPushToCustomer).mockImplementationOnce(() => {
      const err = new Error('Gone') as any;
      err.statusCode = 410;
      throw err;
    });

    const db = makeDb([
      { endpoint: 'https://push.example.com/stale', auth_key: 'auth', p256dh_key: 'p256' },
    ]);
    const env = makeEnv(db, true);
    const sent = await sendPushToUser(env, 'USR_1', payload);
    expect(sent).toBe(0);
  });
});
