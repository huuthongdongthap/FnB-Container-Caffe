import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getNotifications,
  markNotificationRead,
  subscribePush,
} from '../../routes/notifications-mobile';
import { TEST_JWT_SECRET } from '../test-utils';

// ── Helpers ───────────────────────────────────────────────────────────

function makeDb(notifications: any[] = [], updateSuccess = true): any {
  return {
    prepare: (_sql: string) => {
      const stmt: any = { _sql: _sql, _binds: [] };
      stmt.bind = (...args: unknown[]) => {
        stmt._binds = args;
        return stmt;
      };
      stmt.all = async () => {
        if (_sql.includes('FROM notifications')) return { results: notifications, success: true };
        return { results: [], success: true };
      };
      stmt.first = async () => null;
      stmt.run = async () => ({ success: updateSuccess, changes: 1, lastRowId: 1 });
      stmt.raw = async () => [];
      return stmt;
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new Uint8Array(),
  };
}

function makeCtx(
  role: string,
  userId: string = 'USR_1',
  path: string = '/mobile/notifications',
  method: string = 'GET',
  body?: any,
  db: any = makeDb(),
  notifId: string = 'NTF_1',
): any {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const init: any = { method, headers };
  if (body !== undefined && method !== 'GET') init.body = JSON.stringify(body);

  return {
    req: {
      raw: new Request('https://test.aura' + path, init),
      json: async () => body ?? {},
      query: (_n: string) => '',
      param: (n: string) => (n === 'id' ? notifId : ''),
      header: (_n: string) => 'Mozilla/5.0',
    },
    env: { AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET },
    get: (key: string) =>
      key === 'user' ? { id: userId, email: `${userId}@t.co`, name: 'T', role } : undefined,
    set: vi.fn(),
    json: (_data: unknown, status = 200) =>
      new Response(JSON.stringify(_data), { status, headers: { 'Content-Type': 'application/json' } }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getNotifications ──────────────────────────────────────────────────

describe('getNotifications', () => {
  const sampleNotifs = [
    { id: 'NTF_1', type: 'order_ready', title_vi: 'Món đã sẵn sàng', title_en: 'Order ready', body_vi: 'Đơn hàng #123', body_en: 'Order #123 ready', data: '{}', read_at: null, created_at: '2026-07-10T10:00:00Z' },
    { id: 'NTF_2', type: 'shift_reminder', title_vi: 'Nhắc ca làm việc', title_en: 'Shift reminder', body_vi: null, body_en: null, data: '{"shift":"morning"}', read_at: '2026-07-10T08:00:00Z', created_at: '2026-07-10T06:00:00Z' },
  ];

  it('200 + notifications for logged-in user', async () => {
    const ctx: any = makeCtx('waiter', 'USR_W', '/mobile/notifications', 'GET', undefined, makeDb(sampleNotifs));
    const res = await getNotifications(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.notifications).toHaveLength(2);
    expect(body.notifications[0].title_vi).toBe('Món đã sẵn sàng');
  });

  it('200 + empty array when no notifications', async () => {
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/notifications', 'GET', undefined, makeDb([]));
    const res = await getNotifications(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications).toEqual([]);
  });

  it('401 when no user in context', async () => {
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/notifications', 'GET', undefined, makeDb([]));
    ctx.get = (_key: string) => undefined;
    const res = await getNotifications(ctx);
    expect(res.status).toBe(401);
  });

  it('data field is parsed JSON', async () => {
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/notifications', 'GET', undefined, makeDb(sampleNotifs));
    const res = await getNotifications(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications[1].data).toEqual({ shift: 'morning' });
  });

  it('data field falls back to {} on invalid JSON', async () => {
    const badData = [{ ...sampleNotifs[0], data: 'not-json' }];
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/notifications', 'GET', undefined, makeDb(badData));
    const res = await getNotifications(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notifications[0].data).toEqual({});
  });

  it('200 for manager', async () => {
    const ctx: any = makeCtx('manager', 'USR_MGR', '/mobile/notifications', 'GET', undefined, makeDb(sampleNotifs));
    const res = await getNotifications(ctx);
    expect(res.status).toBe(200);
  });

  it('200 for staff role', async () => {
    const ctx: any = makeCtx('staff', 'USR_KITCHEN', '/mobile/notifications', 'GET', undefined, makeDb(sampleNotifs));
    const res = await getNotifications(ctx);
    expect(res.status).toBe(200);
  });

  it('500 on DB error', async () => {
    const badDb: any = {
      prepare: () => ({
        bind: () => ({}),
        all: async () => { throw new Error('D1 fail'); },
        first: async () => null,
        run: async () => ({ success: true }),
        raw: async () => [],
      }),
      batch: async () => [],
      exec: async () => ({ count: 0 }),
    };
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/notifications', 'GET', undefined, badDb);
    const res = await getNotifications(ctx);
    expect(res.status).toBe(500);
  });
});

// ── markNotificationRead ──────────────────────────────────────────────

describe('markNotificationRead', () => {
  it('200 on valid read mark', async () => {
    const db = makeDb();
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/notifications/NTF_1/read', 'POST', undefined, db, 'NTF_1');
    const res = await markNotificationRead(ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('200 marks other users notification (scoped by user_id in SQL)', async () => {
    const db = makeDb();
    const ctx: any = makeCtx('waiter', 'USR_W', '/mobile/notifications/NTF_W/read', 'POST', undefined, db, 'NTF_W');
    const res = await markNotificationRead(ctx);
    expect(res.status).toBe(200);
  });

  it('400 when id param missing', async () => {
    const db = makeDb();
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/notifications//read', 'POST', undefined, db, '');
    const res = await markNotificationRead(ctx);
    expect(res.status).toBe(400);
  });

  it('401 when no user in context', async () => {
    const db = makeDb();
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/notifications/NTF_1/read', 'POST', undefined, db, 'NTF_1');
    ctx.get = (_key: string) => undefined;
    const res = await markNotificationRead(ctx);
    expect(res.status).toBe(400); // missing userId → 400
  });

  it('500 on DB error', async () => {
    const badDb: any = {
      prepare: () => ({
        bind: () => ({}),
        run: async () => { throw new Error('D1 update fail'); },
        all: async () => ({ results: [] }),
        first: async () => null,
        raw: async () => [],
      }),
      batch: async () => [],
      exec: async () => ({ count: 0 }),
    };
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/notifications/NTF_1/read', 'POST', undefined, badDb, 'NTF_1');
    const res = await markNotificationRead(ctx);
    expect(res.status).toBe(500);
  });
});

// ── subscribePush ─────────────────────────────────────────────────────

describe('subscribePush', () => {
  const validPayload = {
    endpoint: 'https://push.example.com/sub/abc123',
    keys: { p256dh: 'B_key_p256dh_AUTH_key_p256dh_test', auth: 'AUTH_test_key_16b' },
    user_agent: 'Mozilla/5.0',
  };

  it('201 on valid push subscription', async () => {
    const db = makeDb();
    const ctx: any = makeCtx('waiter', 'USR_W', '/mobile/notifications/subscribe', 'POST', validPayload, db);
    const res = await subscribePush(ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.message).toContain('thành công');
  });

  it('400 on missing endpoint', async () => {
    const db = makeDb();
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/notifications/subscribe', 'POST', { keys: {} }, db);
    const res = await subscribePush(ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('endpoint');
  });

  it('400 on empty endpoint', async () => {
    const db = makeDb();
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/notifications/subscribe', 'POST', { endpoint: '', keys: {} }, db);
    const res = await subscribePush(ctx);
    expect(res.status).toBe(400);
  });

  it('400 on non-string endpoint', async () => {
    const db = makeDb();
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/notifications/subscribe', 'POST', { endpoint: 123, keys: {} }, db);
    const res = await subscribePush(ctx);
    expect(res.status).toBe(400);
  });

  it('201 for owner role', async () => {
    const db = makeDb();
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/notifications/subscribe', 'POST', validPayload, db);
    const res = await subscribePush(ctx);
    expect(res.status).toBe(201);
  });

  it('201 ON CONFLICT updates existing subscription', async () => {
    const db = makeDb();
    db.prepare = (_sql: string) => {
      const stmt: any = { _sql: _sql, _binds: [] };
      stmt.bind = (...args: unknown[]) => { stmt._binds = args; return stmt; };
      stmt.run = async () => ({ success: true, changes: 1, lastRowId: 1 });
      stmt.all = async () => ({ results: [], success: true });
      stmt.first = async () => null;
      stmt.raw = async () => [];
      return stmt;
    };
    const ctx: any = makeCtx('manager', 'USR_MGR', '/mobile/notifications/subscribe', 'POST', validPayload, db);
    const res = await subscribePush(ctx);
    expect(res.status).toBe(201);
  });

  it('401 when no user in context', async () => {
    const db = makeDb();
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/notifications/subscribe', 'POST', validPayload, db);
    ctx.get = (_key: string) => undefined;
    const res = await subscribePush(ctx);
    expect(res.status).toBe(401);
  });

  it('400 on invalid JSON body', async () => {
    const badReq = new Request('https://test.aura/post', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'not-json',
    });
    const ctx: any = {
      req: {
        raw: badReq,
        json: async () => { throw new Error('not json'); },
        query: () => '',
        param: () => '',
        header: () => '',
      },
      env: { AURA_DB: makeDb(), JWT_SECRET: TEST_JWT_SECRET },
      get: (key: string) => (key === 'user' ? { id: 'USR_1', email: 'u@t.co', name: 'T', role: 'owner' } : undefined),
      set: vi.fn(),
      json: (_data: unknown, status = 200) =>
        new Response(JSON.stringify(_data), { status, headers: { 'Content-Type': 'application/json' } }),
    };
    const res = await subscribePush(ctx);
    expect(res.status).toBe(400);
  });

  it('500 on DB error', async () => {
    const badDb: any = {
      prepare: () => ({
        bind: () => ({}),
        run: async () => { throw new Error('D1 insert fail'); },
        all: async () => ({ results: [] }),
        first: async () => null,
        raw: async () => [],
      }),
      batch: async () => [],
      exec: async () => ({ count: 0 }),
    };
    const ctx: any = makeCtx('owner', 'USR_1', '/mobile/notifications/subscribe', 'POST', validPayload, badDb);
    const res = await subscribePush(ctx);
    expect(res.status).toBe(500);
  });
});
