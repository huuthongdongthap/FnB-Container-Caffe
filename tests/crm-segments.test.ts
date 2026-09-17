/**
 * CRM Segments Tests — Phase 03
 *
 * Unit tests for segment classification + KV override + pagination.
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

// ─── helpers ────────────────────────────────────────────────────────────

function createMockD1(customers: any[] = [], orders: any[] = []) {
  return {
    prepare: (sql: string) => ({
      // segments.ts calls prepare().all() directly (no bind)
      all: async <T>() => {
        if (sql.includes('FROM customers') && sql.includes('LEFT JOIN orders')) {
          const grouped = new Map<string, any>();
          for (const c of customers) {
            grouped.set(c.id, {
              id: c.id,
              name: c.name,
              phone: c.phone,
              loyalty_tier: c.loyalty_tier,
              lifetime_points: c.lifetime_points,
              last_order_at: null,
            });
          }
          for (const o of orders) {
            const cust = customers.find((c) => c.phone === o.customer_phone);
            if (cust) {
              const row = grouped.get(cust.id);
              if (row) {
                if (!row.last_order_at || o.created_at > row.last_order_at) {
                  row.last_order_at = o.created_at;
                }
              }
            }
          }
          return { results: Array.from(grouped.values()) } as { results: T[] };
        }
        return { results: [] as T[] };
      },
      first: async <T>() => null as T,
      run: async () => ({}),
    }),
  } as unknown as D1Database;
}

// ─── segment classification tests ───────────────────────────────────────

describe('buildSegment (classification)', async () => {
  const { buildSegment, DEFAULT_SEGMENTS } = await import('../packages/domain/crm/commands/segments');

  const now = new Date('2026-09-15T00:00:00Z');

  test('new_first_week: customer with order 3 days ago', async () => {
    const db = createMockD1(
      [{ id: 'c1', name: 'Alice', phone: '0911', loyalty_tier: 'bronze', lifetime_points: 10 }],
      [{ id: 'o1', customer_phone: '0911', created_at: '2026-09-12T00:00:00Z' }],
    );
    const result = await buildSegment(db, 'new_first_week', undefined, { limit: 0 }, now);
    expect(result.count).toBe(1);
    expect(result.customers[0].id).toBe('c1');
  });

  test('new_first_week: excludes customer with order 10 days ago', async () => {
    const db = createMockD1(
      [{ id: 'c1', name: 'Bob', phone: '0922', loyalty_tier: 'bronze', lifetime_points: 10 }],
      [{ id: 'o1', customer_phone: '0922', created_at: '2026-09-05T00:00:00Z' }],
    );
    const result = await buildSegment(db, 'new_first_week', undefined, { limit: 0 }, now);
    expect(result.count).toBe(0);
  });

  test('regular: customer with order 45 days ago', async () => {
    const db = createMockD1(
      [{ id: 'c1', name: 'Charlie', phone: '0933', loyalty_tier: 'silver', lifetime_points: 50 }],
      [{ id: 'o1', customer_phone: '0933', created_at: '2026-08-01T00:00:00Z' }],
    );
    const result = await buildSegment(db, 'regular', undefined, { limit: 0 }, now);
    expect(result.count).toBe(1);
  });

  test('lapsing_30d: customer with order 100 days ago', async () => {
    const db = createMockD1(
      [{ id: 'c1', name: 'Dave', phone: '0944', loyalty_tier: 'gold', lifetime_points: 200 }],
      [{ id: 'o1', customer_phone: '0944', created_at: '2026-06-07T00:00:00Z' }],
    );
    const result = await buildSegment(db, 'lapsing_30d', undefined, { limit: 0 }, now);
    expect(result.count).toBe(1);
  });

  test('dormant_60d: customer with order 150 days ago', async () => {
    const db = createMockD1(
      [{ id: 'c1', name: 'Eve', phone: '0955', loyalty_tier: 'bronze', lifetime_points: 5 }],
      [{ id: 'o1', customer_phone: '0955', created_at: '2026-04-19T00:00:00Z' }],
    );
    const result = await buildSegment(db, 'dormant_60d', undefined, { limit: 0 }, now);
    expect(result.count).toBe(1);
  });

  test('regular_high_value: excludes low-spend customer', async () => {
    const db = createMockD1(
      [{ id: 'c1', name: 'Frank', phone: '0966', loyalty_tier: 'bronze', lifetime_points: 10 }],
      [{ id: 'o1', customer_phone: '0966', created_at: '2026-08-01T00:00:00Z' }],
    );
    const result = await buildSegment(db, 'regular_high_value', undefined, { limit: 0 }, now);
    expect(result.count).toBe(0);
  });

  test('regular_high_value: includes high-spend customer', async () => {
    const db = createMockD1(
      [{ id: 'c1', name: 'Grace', phone: '0977', loyalty_tier: 'platinum', lifetime_points: 200 }],
      [{ id: 'o1', customer_phone: '0977', created_at: '2026-08-01T00:00:00Z' }],
    );
    const result = await buildSegment(db, 'regular_high_value', undefined, { limit: 0 }, now);
    expect(result.count).toBe(1);
  });

  test('returns empty for unknown segment key', async () => {
    const db = createMockD1([], []);
    const result = await buildSegment(db, 'nonexistent', undefined, { limit: 0 }, now);
    expect(result.count).toBe(0);
    expect(result.customers).toEqual([]);
  });
});

// ─── pagination tests ─────────────────────────────────────────────────

describe('buildSegment (pagination)', async () => {
  const { buildSegment } = await import('../packages/domain/crm/commands/segments');

  const now = new Date('2026-09-15T00:00:00Z');

  const customers = Array.from({ length: 10 }, (_, i) => ({
    id: `c${i}`,
    name: `User ${i}`,
    phone: `09${i.toString().padStart(3, '0')}`,
    loyalty_tier: 'bronze',
    lifetime_points: 10,
  }));

  const orders = customers.map((c, i) => ({
    id: `o${i}`,
    customer_phone: c.phone,
    created_at: `2026-09-1${i < 5 ? 2 : 5}T00:00:00Z`,
  }));

  test('returns all when limit=0', async () => {
    const db = createMockD1(customers, orders);
    const result = await buildSegment(db, 'new_first_week', undefined, { limit: 0 }, now);
    expect(result.count).toBe(10);
    expect(result.customers).toHaveLength(10);
  });

  test('paginates with limit=3 offset=0', async () => {
    const db = createMockD1(customers, orders);
    const result = await buildSegment(db, 'new_first_week', undefined, { limit: 3, offset: 0 }, now);
    expect(result.count).toBe(10);
    expect(result.customers).toHaveLength(3);
  });

  test('paginates with limit=3 offset=3', async () => {
    const db = createMockD1(customers, orders);
    const result = await buildSegment(db, 'new_first_week', undefined, { limit: 3, offset: 3 }, now);
    expect(result.count).toBe(10);
    expect(result.customers).toHaveLength(3);
  });

  test('offset beyond count returns empty list', async () => {
    const db = createMockD1(customers, orders);
    const result = await buildSegment(db, 'new_first_week', undefined, { limit: 5, offset: 20 }, now);
    expect(result.count).toBe(10);
    expect(result.customers).toHaveLength(0);
  });
});

// ─── KV override tests ─────────────────────────────────────────────────

describe('loadSegmentDefinitions (KV override)', async () => {
  const { loadSegmentDefinitions, DEFAULT_SEGMENTS } = await import('../packages/domain/crm/commands/segments');

  test('returns defaults when KV is undefined', async () => {
    const result = await loadSegmentDefinitions(undefined);
    expect(result).toEqual(DEFAULT_SEGMENTS);
    expect(result).toHaveLength(5);
  });

  test('returns defaults when KV has no key', async () => {
    const kv = { get: async () => null } as any;
    const result = await loadSegmentDefinitions(kv);
    expect(result).toEqual(DEFAULT_SEGMENTS);
  });

  test('KV override replaces defaults entirely', async () => {
    const custom = [
      { key: 'vip_platinum', labelVi: 'Khách VIP', labelEn: 'VIP Platinum', description: 'Platinum only' },
      { key: 'student', labelVi: 'Sinh viên', labelEn: 'Student', description: 'Student segment' },
    ];
    const kv = { get: async () => JSON.stringify(custom) } as any;
    const result = await loadSegmentDefinitions(kv);
    expect(result).toHaveLength(2);
    expect(result[0].key).toBe('vip_platinum');
    expect(result[1].key).toBe('student');
  });

  test('falls back to defaults on invalid JSON', async () => {
    const kv = { get: async () => 'not json' } as any;
    const result = await loadSegmentDefinitions(kv);
    expect(result).toEqual(DEFAULT_SEGMENTS);
  });

  test('falls back to defaults on empty array', async () => {
    const kv = { get: async () => '[]' } as any;
    const result = await loadSegmentDefinitions(kv);
    expect(result).toEqual(DEFAULT_SEGMENTS);
  });

  test('falls back to defaults on malformed entries (missing key)', async () => {
    const malformed = [{ labelVi: 'No key here' }];
    const kv = { get: async () => JSON.stringify(malformed) } as any;
    const result = await loadSegmentDefinitions(kv);
    expect(result).toEqual(DEFAULT_SEGMENTS);
  });
});

// ─── listSegments tests ────────────────────────────────────────────────

describe('listSegments', async () => {
  const { listSegments } = await import('../packages/domain/crm/commands/segments');

  const now = new Date('2026-09-15T00:00:00Z');

  test('returns all segments with counts', async () => {
    const db = createMockD1(
      [
        { id: 'c1', name: 'A', phone: '0901', loyalty_tier: 'bronze', lifetime_points: 10 },
        { id: 'c2', name: 'B', phone: '0902', loyalty_tier: 'silver', lifetime_points: 50 },
      ],
      [
        { id: 'o1', customer_phone: '0901', created_at: '2026-09-12T00:00:00Z' },
        { id: 'o2', customer_phone: '0902', created_at: '2026-09-10T00:00:00Z' },
      ],
    );
    const result = await listSegments(db, undefined, now);
    expect(result).toHaveLength(5);
    expect(result[0].key).toBe('new_first_week');
    expect(result[0].count).toBe(2);
  });
});
