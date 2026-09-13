import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('worker/src/middleware/logger', () => ({
  createLogger: () => ({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {}, child: () => ({}) }),
}));

import { lookupProfile, toCrmView } from '../index';
import type { CrmProfile } from '../index';

type Row = Record<string, unknown>;

function createMockDB(seed: Record<string, Row[]> = {}) {
  const store = new Map<string, Row[]>(Object.entries(seed));

  function matchSeed(sql: string): Row[] {
    for (const [key, rows] of store.entries()) {
      if (key.startsWith('__MATCH__')) {
        const literal = key.slice(9);
        if (sql.includes(literal)) return rows;
      }
    }
    return [];
  }

  return {
    prepare(sql: string) {
      const stmt = {
        bind(..._args: unknown[]) {
          return stmt;
        },
        async first<T = unknown>(): Promise<T | null> {
          const rows = matchSeed(sql);
          if (rows.length > 0) return rows.shift() as T;
          return null;
        },
        async all<T = unknown>() {
          const rows = matchSeed(sql);
          return { results: rows as T[], success: true };
        },
      };
      return stmt;
    },
  } as unknown as D1Database;
}

function sqlMatcher(literal: string): string {
  return `__MATCH__${literal}`;
}

function customerSeed() {
  return {
    [sqlMatcher('customer_identities')]: [{ customer_id: 'cus_1', value: '0909123456' }],
    [sqlMatcher('FROM customers')]: [{ id: 'cus_1', name: 'Test', phone: '0909123456', email: 't@x.com', tier: 'member', total_visits: 5, last_visit_at: '2026-09-13T10:00:00Z' }],
    [sqlMatcher('FROM consents')]: [{ purpose: 'marketing', granted: 1 }, { purpose: 'order', granted: 1 }],
    [sqlMatcher('FROM visits')]: [{ visited_at: '2026-09-13T10:00:00Z', channel: 'instore' }],
    [sqlMatcher('FROM orders')]: [{ id: 'ord_1', total_cents: 50000, placed_at: '2026-09-13T10:00:00Z' }],
  };
}

describe('lookup-profile', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty-but-typed profile when phone not found', async () => {
    const db = createMockDB();
    const profile = await lookupProfile(db, '0999999999');
    expect(profile.found).toBe(false);
    expect(profile.customerId).toBeNull();
    expect(profile.tier).toBe('anonymous');
  });

  it('returns merged profile when phone matches', async () => {
    const db = createMockDB(customerSeed());
    const profile = await lookupProfile(db, '0909123456');
    expect(profile.found).toBe(true);
    expect(profile.customerId).toBe('cus_1');
    expect(profile.name).toBe('Test');
    expect(profile.consentMarketing).toBe(true);
    expect(profile.consentOrder).toBe(true);
    expect(profile.recentVisits).toHaveLength(1);
    expect(profile.recentOrders).toHaveLength(1);
  });

  it('consent summary reduces rows correctly', async () => {
    const seedCopy = { ...customerSeed() };
    const consentsSql = sqlMatcher('FROM consents');
    seedCopy[consentsSql] = [{ purpose: 'marketing', granted: 0 }];
    const db = createMockDB(seedCopy);
    const profile = await lookupProfile(db, '0909123456');
    expect(profile.consentMarketing).toBe(false);
    expect(profile.consentOrder).toBe(false);
  });
});

describe('toCrmView', () => {
  it('shapes profile for staff surface', () => {
    const profile: CrmProfile = {
      customerId: 'cus_1',
      name: 'Test',
      phone: '0909123456',
      email: 't@x.com',
      tier: 'member',
      totalVisits: 5,
      lastVisitAt: '2026-09-13T10:00:00Z',
      consentMarketing: true,
      consentOrder: true,
      recentVisits: [],
      recentOrders: [],
      found: true,
    };
    const view = toCrmView(profile);
    expect(view.displayName).toBe('Test');
    expect(view.canMarket).toBe(true);
    expect(view.canOrder).toBe(true);
  });

  it('falls back to phone when name missing', () => {
    const profile: CrmProfile = {
      customerId: 'cus_1',
      name: null,
      phone: '0909123456',
      email: null,
      tier: 'anonymous',
      totalVisits: 0,
      lastVisitAt: null,
      consentMarketing: false,
      consentOrder: false,
      recentVisits: [],
      recentOrders: [],
      found: false,
    };
    const view = toCrmView(profile);
    expect(view.displayName).toBe('0909123456');
  });
});
