/**
 * Unit tests for src/tree/campaigns/triggers/welcome.ts
 * Tests: happy path, no-match, DB error → empty array
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vitest hoists vi.mock() to the top automatically.
// ---------------------------------------------------------------------------
vi.mock('../../../../utils/logger', () => ({
  createLogger: () => ({
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  })
}));

// ---------------------------------------------------------------------------
// Real imports
// ---------------------------------------------------------------------------
import { detectWelcomeCandidates } from '../../../../tree/campaigns/triggers/welcome.js';
import { createMockDB } from '../../../test-utils';

// ---------------------------------------------------------------------------
// Shared mutable state
// ---------------------------------------------------------------------------
let mockResults: Record<string, unknown>[] = [];

function makeWelcomeDB(): ReturnType<typeof createMockDB> {
  const db = createMockDB();

  db.prepare = ((sql: string) => {
    const stmt: Record<string, unknown> = {
      _sql: sql,
      _binds: [] as unknown[],
      bind: (...args: unknown[]) => {
        stmt._binds = args;
        return stmt;
      },
      run: async() => ({ success: true, changes: 1, lastRowId: 1 } as never),
      first: async() => null as never,
      all: async() => {
        return { results: mockResults as never, success: true } as never;
      },
      raw: async() => mockResults
    };
    return stmt as never;
  }) as typeof db.prepare;

  return db;
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------
const WELCOME_CUSTOMERS: Record<string, unknown>[] = [
  {
    id: 'cust-new-1',
    name: 'New Customer A',
    phone: '0909111111',
    email: 'newcust@example.com',
    loyalty_tier: 'basic',
    created_at: '2026-07-08T10:00:00Z'
  },
  {
    id: 'cust-new-2',
    name: 'New Customer B',
    phone: null,
    email: 'newb@example.com',
    loyalty_tier: 'silver',
    created_at: '2026-07-08T08:30:00Z'
  }
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('detectWelcomeCandidates', () => {
  beforeEach(() => {
    mockResults = [];
  });

  it('returns new customers created in the last 24 hours', async() => {
    mockResults = [...WELCOME_CUSTOMERS];
    const db = makeWelcomeDB();

    const result = await detectWelcomeCandidates(db as never);

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('cust-new-1');
    expect(result[0]!.name).toBe('New Customer A');
    expect(result[0]!.created_at).toBe('2026-07-08T10:00:00Z');
    expect(result[1]!.id).toBe('cust-new-2');
  });

  it('returns empty array when no new customers exist', async() => {
    mockResults = [];
    const db = makeWelcomeDB();

    const result = await detectWelcomeCandidates(db as never);

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns empty array when the database throws', async() => {
    const db = {
      prepare: () => {
        throw new Error('D1 timeout');
      }
    } as never;

    const result = await detectWelcomeCandidates(db);

    expect(result).toEqual([]);
  });

  it('returns customers via email-only contact', async() => {
    mockResults = [WELCOME_CUSTOMERS[1]!];
    const db = makeWelcomeDB();

    const result = await detectWelcomeCandidates(db as never);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('cust-new-2');
    expect(result[0]!.email).toBe('newb@example.com');
    expect(result[0]!.phone).toBeNull();
  });

  it('preserves all CampaignCustomer fields in the returned records', async() => {
    mockResults = [WELCOME_CUSTOMERS[0]!];
    const db = makeWelcomeDB();

    const result = await detectWelcomeCandidates(db as never);

    expect(result[0]).toMatchObject({
      id: 'cust-new-1',
      name: 'New Customer A',
      phone: '0909111111',
      email: 'newcust@example.com',
      loyalty_tier: 'basic',
      created_at: '2026-07-08T10:00:00Z'
    });
  });
});
