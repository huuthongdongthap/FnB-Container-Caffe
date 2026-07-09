/**
 * Unit tests for src/tree/campaigns/triggers/post-visit.ts
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
import { detectPostVisitCandidates } from '../../../../tree/campaigns/triggers/post-visit.js';
import { createMockDB } from '../../../test-utils';

// ---------------------------------------------------------------------------
// Shared mutable state
// ---------------------------------------------------------------------------
let mockResults: Record<string, unknown>[] = [];

function makePostVisitDB(): ReturnType<typeof createMockDB> {
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
const POST_VISIT_ROWS: Record<string, unknown>[] = [
  {
    id: 'cust-pv-1',
    name: 'Nguyen Van A',
    phone: '0909123456',
    email: 'nguyenvana@example.com',
    loyalty_tier: 'gold',
    last_order_date: '2026-07-07T14:00:00Z',
    order_id: 'ord-pv-1'
  },
  {
    id: 'cust-pv-2',
    name: 'Tran Thi B',
    phone: null,
    email: 'tranthib@example.com',
    loyalty_tier: 'silver',
    last_order_date: '2026-07-07T10:00:00Z',
    order_id: 'ord-pv-2'
  }
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('detectPostVisitCandidates', () => {
  beforeEach(() => {
    mockResults = [];
  });

  it('returns customers whose qualifies for post-visit follow-up', async() => {
    mockResults = [...POST_VISIT_ROWS];
    const db = makePostVisitDB();

    const result = await detectPostVisitCandidates(db as never);

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('cust-pv-1');
    expect(result[0]!.name).toBe('Nguyen Van A');
    expect(result[0]!.last_order_date).toBe('2026-07-07T14:00:00Z');
    expect(result[1]!.id).toBe('cust-pv-2');
  });

  it('returns empty array when no post-visit candidates exist', async() => {
    mockResults = [];
    const db = makePostVisitDB();

    const result = await detectPostVisitCandidates(db as never);

    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns empty array when the database throws', async() => {
    const db = {
      prepare: () => {
        throw new Error('D1 connection lost');
      }
    } as never;

    const result = await detectPostVisitCandidates(db);

    expect(result).toEqual([]);
  });

  it('returns customers via email-only contact', async() => {
    mockResults = [POST_VISIT_ROWS[1]!];
    const db = makePostVisitDB();

    const result = await detectPostVisitCandidates(db as never);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('cust-pv-2');
    expect(result[0]!.email).toBe('tranthib@example.com');
    expect(result[0]!.phone).toBeNull();
  });

  it('preserves all CampaignCustomer fields including last_order_date and order_id', async() => {
    mockResults = [POST_VISIT_ROWS[0]!];
    const db = makePostVisitDB();

    const result = await detectPostVisitCandidates(db as never);

    expect(result[0]).toMatchObject({
      id: 'cust-pv-1',
      name: 'Nguyen Van A',
      phone: '0909123456',
      email: 'nguyenvana@example.com',
      loyalty_tier: 'gold',
      last_order_date: '2026-07-07T14:00:00Z',
      order_id: 'ord-pv-1'
    });
  });
});
