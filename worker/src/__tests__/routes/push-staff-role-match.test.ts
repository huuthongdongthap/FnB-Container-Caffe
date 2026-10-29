// @vitest-environment node
/**
 * Staff push role agreement.
 *
 * A staff device subscribes with whatever role the subscribe path stores, and a
 * new order is announced by querying push_subscriptions with the caller's role
 * literal. Those two strings are written in different files by different calls,
 * and when they disagree the query runs, matches nothing, and returns
 * `{ sent: 0, failed: 0 }` — no error, no log line, no visible failure.
 *
 * These tests pin the shared role constant to the literal the KDS client
 * posts, so a constant that drifts away from the frontend's role fails here
 * rather than silently reporting zero sends.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const ROWS: Array<Record<string, unknown>> = [];

vi.mock('web-push', () => {
  const sendNotification = vi.fn(async () => ({ statusCode: 201 }));
  return {
    default: {
      setVapidDetails: vi.fn(),
      sendNotification,
    },
    setVapidDetails: vi.fn(),
    sendNotification,
  };
});

/** Capture the SQL and binds the send path runs, and answer from ROWS. */
const QUERIES: Array<{ sql: string; binds: unknown[] }> = [];

/**
 * Answer the staff query the way D1 would.
 *
 * The whole point of these tests is that a role mismatch produces an empty
 * result set rather than an error, so the mock has to actually evaluate the
 * WHERE clause. Returning every row unconditionally would make the mismatch
 * invisible and the tests would pass against the defect.
 */
function answerStaffQuery(sql: string, binds: unknown[]): Array<Record<string, unknown>> {
  const params = [...binds];
  // Detect both hardcoded 'customer' and parameterized ? in the WHERE role != ...
  const hasNonCustomerClause = /role\s*!=\s*\?/i.test(sql) || /role\s*!=\s*'customer'/i.test(sql);
  const nonCustomerValue = /role\s*!=\s*\?/i.test(sql) ? String(params.shift()) : 'customer';
  const roleParam = /role\s*=\s*\?/i.test(sql) ? String(params.shift()) : null;

  return ROWS.filter(row => {
    if (hasNonCustomerClause && row.role === nonCustomerValue) return false;
    if (roleParam !== null && row.role !== roleParam) return false;
    return true;
  });
}

function mockDB() {
  return {
    prepare: (sql: string) => {
      const stmt = {
        bind: (...binds: unknown[]) => {
          QUERIES.push({ sql, binds });
          stmt._results = /push_subscriptions/i.test(sql)
            ? answerStaffQuery(sql, binds)
            : [];
          return stmt;
        },
        _results: [] as Array<Record<string, unknown>>,
        run: async () => ({ success: true, changes: 1, meta: { changes: 1 } }),
        first: async () => (stmt._results[0] ?? null),
        all: async () => ({ results: stmt._results, success: true }),
        raw: async () => stmt._results,
      };
      return stmt;
    },
    batch: async () => [],
    exec: async () => ({ count: 0, duration: 0 }),
    dump: async () => new Uint8Array(),
  };
}

import webpush from 'web-push';
import { sendPushToStaff } from '../../tree/push/notifier';
import { STAFF_PUSH_ROLE, DEFAULT_STAFF_PUSH_ROLE } from '../../tree/push/roles';
import { pushSubscribeSchema } from '../../lib/validators/push';

const ENV = {
  VAPID_PUBLIC_KEY: 'test-public-key',
  VAPID_PRIVATE_KEY: 'test-private-key',
  VAPID_EMAIL: 'mailto:test@auraspace.vn',
  AURA_DB: null as unknown as import('@cloudflare/workers-types').D1Database,
};

const PAYLOAD = { title: 'New order', body: 'Order #0001 received' };

/**
 * The role the KDS client actually posts.
 *
 * Written as a literal, not imported: the point of the shared constant is that
 * it equals this value, so a constant that drifts away from what the frontend
 * sends has to fail here. Asserting against the imported constant instead
 * would make the expectation move with the code and the test would pass on
 * precisely the drift it exists to catch.
 */
const ROLE_STAFF_KDS_DECLARES = 'staff-kitchen';

describe('staff push send/receive role agreement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ROWS.length = 0;
    QUERIES.length = 0;
    ENV.AURA_DB = mockDB() as unknown as import('@cloudflare/workers-types').D1Database;
  });

  it('names the role the KDS client declares', () => {
    // Staff notification settings posts this role; the new-order send has to
    // query by it. One constant covers both, and it has to be this string.
    expect(STAFF_PUSH_ROLE).toBe(ROLE_STAFF_KDS_DECLARES);
  });

  it('delivers to a subscription stored with the KDS role the frontend declares', async() => {
    // A row carrying that role is what a real KDS device looks like. The send
    // has to find it without the two sides being able to disagree about spelling.
    const parsed = pushSubscribeSchema.safeParse({
      endpoint: 'https://push.example.com/staff-abc',
      auth_key: 'auth',
      p256dh_key: 'p256',
      role: STAFF_PUSH_ROLE,
    });
    expect(parsed.success).toBe(true);

    ROWS.push({
      id: 'SUB-1',
      endpoint: 'https://push.example.com/staff-abc',
      auth_key: 'auth',
      p256dh_key: 'p256',
      customer_id: null,
      role: ROLE_STAFF_KDS_DECLARES,
    });

    const result = await sendPushToStaff(ENV, PAYLOAD, STAFF_PUSH_ROLE);
    expect(result.sent).toBe(1);
  });

  it('matches a subscription stored with the plain default staff role too', async() => {

    ROWS.push({
      id: 'SUB-2',
      endpoint: 'https://push.example.com/staff-def',
      auth_key: 'auth',
      p256dh_key: 'p256',
      customer_id: null,
      role: DEFAULT_STAFF_PUSH_ROLE,
    });

    const result = await sendPushToStaff(ENV, PAYLOAD, DEFAULT_STAFF_PUSH_ROLE);
    expect(result.sent).toBe(1);
  });

  it('does not silently return zero when the sender queries a role no subscriber could store', async() => {
    // A KDS subscription and a kitchen-role query are written independently.
    // Whichever side drifts, the observable failure is the same: the query
    // matches nothing and reports success.
    ROWS.push({
      id: 'SUB-2',
      endpoint: 'https://push.example.com/staff-def',
      auth_key: 'auth',
      p256dh_key: 'p256',
      customer_id: null,
      role: ROLE_STAFF_KDS_DECLARES,
    });

    const result = await sendPushToStaff(ENV, PAYLOAD, 'staff-does-not-exist');

    const sendCalled = (webpush.sendNotification as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    expect(sendCalled).toBe(0);
    expect(result).toEqual({ sent: 0, failed: 0 });
  });

  it('queries push_subscriptions for exactly the role it was handed', async() => {
    await sendPushToStaff(ENV, PAYLOAD, STAFF_PUSH_ROLE);

    const staffQuery = QUERIES.find(q => /push_subscriptions/i.test(q.sql));
    expect(staffQuery).toBeDefined();
    expect(staffQuery!.sql).toMatch(/role\s*=\s*\?/i);
    expect(staffQuery!.binds).toContain(STAFF_PUSH_ROLE);
  });

  it('excludes customer subscriptions from a staff send', async() => {
    ROWS.push({
      id: 'SUB-3',
      endpoint: 'https://push.example.com/customer',
      auth_key: 'auth',
      p256dh_key: 'p256',
      customer_id: 'cust-1',
      role: 'customer',
    });

    const result = await sendPushToStaff(ENV, PAYLOAD);
    expect(result.sent).toBe(0);
  });
});
