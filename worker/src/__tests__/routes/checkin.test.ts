import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv } from '../test-utils';
import { Hono } from 'hono';
import { checkinRouter } from '../../routes/checkin';
import { pushRouter } from '../../routes/push';

function makeDB(allResults: unknown[] = []) {
  const stmt = {
    bind: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue({ results: allResults }),
    first: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue({ success: true }),
  };
  return {
    prepare: vi.fn().mockReturnValue(stmt),
    _stmt: stmt,
  };
}

vi.mock('../../middleware/auth', () => ({
  requireAuth: () => (_c: any, next: any) => next()
}));

describe('checkin & push admin contract smoke', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('POST / — missing body returns 400', async() => {
    const app = new Hono();
    app.route('/api/checkin', checkinRouter);

    const req = new Request('https://test.aura/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });

    const env = { ...createMockEnv(), AURA_DB: makeDB() };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(400);
  });

  it('GET / — returns 200 with both data and checkins arrays mapped for Admin CheckinApprove', async() => {
    const app = new Hono();
    app.route('/api/admin/checkins', checkinRouter);

    const db = makeDB();
    db._stmt.all.mockResolvedValueOnce({
      results: [
        {
          id: 'ci_1',
          customer_id: 'cust-01',
          customer_name: 'Nguyen Van A',
          checkin_date: '2026-10-15',
          checkin_time: '2026-10-15T08:00:00Z',
          reward_amount: 5000,
          status: 'pending',
          staff_id: null,
          created_at: '2026-10-15T08:00:00Z',
        },
      ],
    });

    const req = new Request('https://test.aura/api/admin/checkins', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    const env = { ...createMockEnv(), AURA_DB: db };
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const data = await res.json() as {
      success: boolean;
      checkins: Array<{ id: string; memberId: string; memberName: string; submittedAt: string }>;
    };
    expect(data.success).toBe(true);
    expect(data.checkins).toHaveLength(1);
    expect(data.checkins[0]).toMatchObject({
      id: 'ci_1',
      memberId: 'cust-01',
      memberName: 'Nguyen Van A',
      submittedAt: '2026-10-15T08:00:00Z',
    });
  });

  it('pushRouter supports manual staff subscribe, list-subscriptions, send-staff test, and delete', async() => {
    const app = new Hono();
    app.route('/api/push', pushRouter);

    const db = makeDB();
    const env = { ...createMockEnv(), AURA_DB: db };

    // 1. Manual staff subscribe via { name, role }
    const subRes = await app.fetch(
      new Request('https://test.aura/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Barista Minh', role: 'staff' }),
      }),
      env
    );
    expect(subRes.status).toBe(201);

    // 2. List subscriptions returns mapped StaffSubscription[]
    db._stmt.all.mockResolvedValueOnce({
      results: [
        {
          id: 'SUB-1',
          customer_id: 'Barista Minh',
          endpoint: 'https://manual.auraspace.local/staff/barista%20minh',
          user_agent: 'Barista Minh',
          role: 'staff',
          created_at: '2026-10-15T08:00:00Z',
        },
      ],
    });
    const listRes = await app.fetch(
      new Request('https://test.aura/api/push/list-subscriptions', { method: 'GET' }),
      env
    );
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json() as {
      success: boolean;
      subscriptions: Array<{ name: string; role: string; subscribed: boolean }>;
    };
    expect(listBody.success).toBe(true);
    expect(listBody.subscriptions[0]).toMatchObject({
      name: 'Barista Minh',
      role: 'staff',
      subscribed: false,
    });

    // 3. Test send-staff via { targetRole, name }
    const sendRes = await app.fetch(
      new Request('https://test.aura/api/push/send-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRole: 'staff', name: 'Barista Minh' }),
      }),
      env
    );
    expect(sendRes.status).toBe(200);

    // 4. Delete subscription via { name }
    const delRes = await app.fetch(
      new Request('https://test.aura/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Barista Minh' }),
      }),
      env
    );
    expect(delRes.status).toBe(200);
  });
});
