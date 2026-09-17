/**
 * CRM Events Read-Model Tests — /api/crm/customers/:id/events
 *
 * Seed data shape matches the post-SQL projection (id, type, source, timestamp, payload)
 * because the mock D1 does not evaluate SQL aliases.
 */
import { describe, test, expect, vi } from 'vitest';

vi.mock('worker/src/middleware/logger', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => ({}),
  }),
}));

function createMockD1(seedData: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {
    customer_identities: [...(seedData.customer_identities || [])],
    consents: [...(seedData.consents || [])],
    visits: [...(seedData.visits || [])],
    orders: [...(seedData.orders || [])],
    loyalty_point_logs: [...(seedData.loyalty_point_logs || [])],
    customers: [...(seedData.customers || [])],
  };

  function matchTable(sql: string): string | null {
    const m = sql.match(/\bFROM\s+(\w+)/i);
    return m ? m[1] : null;
  }

  return {
    prepare: (sql: string) => ({
      bind: (..._args: any[]) => ({
        first: async <T>() => {
          if (sql.includes('SELECT phone FROM customers WHERE id')) {
            const row = tables.customers[0];
            return { phone: row?.phone ?? null } as T;
          }
          const table = matchTable(sql);
          if (!table) return null;
          return tables[table]?.[0] ?? null as T;
        },
        all: async <T>() => {
          const table = matchTable(sql);
          if (!table) return { results: [] };
          return { results: tables[table] || [] } as { results: T[] };
        },
        run: async () => ({}),
      }),
    }),
  } as unknown as D1Database;
}

describe('aggregateEvents (pure function)', () => {
  test('returns empty result for unknown customer', async () => {
    const { aggregateEvents } = await import('../packages/domain/crm/commands/aggregate-events');
    const db = createMockD1();
    const result = await aggregateEvents(db, 'cust_unknown');
    expect(result.customerId).toBe('cust_unknown');
    expect(result.events).toEqual([]);
    expect(result.total).toBe(0);
  });

  test('aggregates identity events', async () => {
    const { aggregateEvents } = await import('../packages/domain/crm/commands/aggregate-events');
    const db = createMockD1({
      customer_identities: [
        {
          id: 'ci_1',
          type: 'CustomerIdentified',
          source: 'identity',
          timestamp: '2026-09-15T10:00:00Z',
          payload: '{"identifier_type":"phone","identifier_value":"0912345678","is_primary":1}',
        },
      ],
      customers: [{ id: 'cust_1', phone: '0912345678' }],
    });
    const result = await aggregateEvents(db, 'cust_1');
    expect(result.total).toBe(1);
    expect(result.events[0].type).toBe('CustomerIdentified');
    expect(result.events[0].source).toBe('identity');
  });

  test('sorts events descending by timestamp', async () => {
    const { aggregateEvents } = await import('../packages/domain/crm/commands/aggregate-events');
    const db = createMockD1({
      visits: [
        { id: 'v_old', type: 'VisitRecorded', source: 'visit', timestamp: '2026-01-01T00:00:00Z', payload: '{"channel":"in_store","spent":50000}' },
        { id: 'v_new', type: 'VisitRecorded', source: 'visit', timestamp: '2026-09-15T00:00:00Z', payload: '{"channel":"online_pickup","spent":75000}' },
      ],
      customers: [{ id: 'cust_1', phone: '0912345678' }],
    });
    const result = await aggregateEvents(db, 'cust_1');
    expect(result.events).toHaveLength(2);
    expect(result.events[0].id).toBe('v_new');
    expect(result.events[1].id).toBe('v_old');
  });

  test('trims to limit', async () => {
    const { aggregateEvents } = await import('../packages/domain/crm/commands/aggregate-events');
    const visits = Array.from({ length: 150 }, (_, i) => ({
      id: `v_${i}`,
      type: 'VisitRecorded',
      source: 'visit',
      timestamp: `2026-09-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
      payload: '{"channel":"in_store","spent":50000}',
    }));
    const db = createMockD1({ visits, customers: [{ id: 'cust_1', phone: '0912345678' }] });
    const result = await aggregateEvents(db, 'cust_1', { limit: 50 });
    expect(result.total).toBe(50);
    expect(result.events).toHaveLength(50);
  });

  test('parses payload JSON correctly', async () => {
    const { aggregateEvents } = await import('../packages/domain/crm/commands/aggregate-events');
    const db = createMockD1({
      consents: [
        {
          id: 'c_1',
          type: 'ConsentGiven',
          source: 'consent',
          timestamp: '2026-09-14T00:00:00Z',
          payload: '{"purpose":"marketing","granted":1,"source":"checkout"}',
        },
      ],
      customers: [{ id: 'cust_1', phone: '0912345678' }],
    });
    const result = await aggregateEvents(db, 'cust_1');
    expect(result.events[0].type).toBe('ConsentGiven');
    expect(result.events[0].payload.purpose).toBe('marketing');
    expect(result.events[0].payload.granted).toBe(1);
  });

  test('consent revoke produces ConsentRevoked type', async () => {
    const { aggregateEvents } = await import('../packages/domain/crm/commands/aggregate-events');
    const db = createMockD1({
      consents: [
        {
          id: 'c_1',
          type: 'ConsentRevoked',
          source: 'consent',
          timestamp: '2026-09-14T00:00:00Z',
          payload: '{"purpose":"marketing","granted":0,"source":"customer_portal"}',
        },
      ],
      customers: [{ id: 'cust_1', phone: '0912345678' }],
    });
    const result = await aggregateEvents(db, 'cust_1');
    expect(result.events[0].type).toBe('ConsentRevoked');
  });

  test('mixed sources all appear in result', async () => {
    const { aggregateEvents } = await import('../packages/domain/crm/commands/aggregate-events');
    const db = createMockD1({
      customer_identities: [
        { id: 'ci_1', type: 'CustomerIdentified', source: 'identity', timestamp: '2026-09-15T10:00:00Z', payload: '{}' },
      ],
      consents: [
        { id: 'c_1', type: 'ConsentGiven', source: 'consent', timestamp: '2026-09-14T00:00:00Z', payload: '{}' },
      ],
      visits: [
        { id: 'v_1', type: 'VisitRecorded', source: 'visit', timestamp: '2026-09-13T00:00:00Z', payload: '{}' },
      ],
      orders: [
        { id: 'o_1', type: 'OrderLinked', source: 'order', timestamp: '2026-09-12T00:00:00Z', payload: '{}' },
      ],
      loyalty_point_logs: [
        { id: 'l_1', type: 'PointsEarned', source: 'loyalty', timestamp: '2026-09-11T00:00:00Z', payload: '{}' },
      ],
      customers: [{ id: 'cust_1', phone: '0912345678' }],
    });
    const result = await aggregateEvents(db, 'cust_1');
    expect(result.total).toBe(5);
    const sources = result.events.map((e) => e.source).sort();
    expect(sources).toEqual(['consent', 'identity', 'loyalty', 'order', 'visit']);
  });
});

describe('CRM Routes — /api/crm', () => {
  test('GET /customers/:id/events returns 401 without auth', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const db = createMockD1({ customers: [{ id: 'cust_1', phone: '0912345678' }] });
    const env = { AURA_DB: db, JWT_SECRET: 'test_secret_at_least_16_chars' } as any;

    const req = new Request('http://localhost/customers/cust_1/events');
    const res = await crmRouter.fetch(req, env, {} as any);
    expect(res.status).toBe(401);
  });

  test('GET /customers/:id/events returns 401 with invalid token', async () => {
    const { crmRouter } = await import('../worker/src/routes/crm');
    const db = createMockD1({ customers: [{ id: 'cust_1', phone: '0912345678' }] });
    const env = { AURA_DB: db, JWT_SECRET: 'test_secret_at_least_16_chars' } as any;

    const req = new Request('http://localhost/customers/cust_1/events', {
      headers: { Authorization: 'Bearer invalid_token' },
    });
    const res = await crmRouter.fetch(req, env, {} as any);
    expect(res.status).toBe(401);
  });
});
