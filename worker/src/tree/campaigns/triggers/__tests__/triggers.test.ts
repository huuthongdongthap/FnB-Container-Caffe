/**
 * Campaign Triggers Tests — TDD
 */
import { describe, it, expect, vi } from 'vitest';
import { createMockDB } from '../../../../__tests__/test-utils';
import type { D1Result } from '@cloudflare/workers-types';
import type { CampaignTrigger, CampaignCustomer } from '../../types';

function mockResult<T>(results: T[]): D1Result<T> {
  return { results, success: true, meta: {} } as D1Result<T>;
}

// Will import real implementations after testing

describe('detectWelcomeCandidates', () => {
  it('detects customers created within last 24h without welcome sent', async() => {
    const mockDb = createMockDB();
    vi.spyOn(mockDb, 'prepare').mockImplementation((sql: string) => {
      const stmt = createMockDB().prepare(sql);
      // Match welcome query (has created_at filter)
      if (sql.includes('created_at >')) {
        vi.spyOn(stmt, 'all').mockResolvedValue(mockResult([
          { id: 'cust-w1', name: 'Nguyen Van A', phone: '84901111111', email: 'a@test.com' }
        ]));
      }
      return stmt;
    });

    const { detectWelcomeCandidates } = await import('../welcome');
    const result = await detectWelcomeCandidates(mockDb);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cust-w1');
  });

  it('returns empty when no new customers', async() => {
    const { detectWelcomeCandidates } = await import('../welcome');
    const result = await detectWelcomeCandidates(createMockDB());
    expect(result).toHaveLength(0);
  });
});

describe('detectBirthdayCandidates', () => {
  it('detects customers with birthday this month not yet contacted', async() => {
    const mockDb = createMockDB();
    vi.spyOn(mockDb, 'prepare').mockImplementation((sql: string) => {
      const stmt = createMockDB().prepare(sql);
      if (sql.includes('date_of_birth') && sql.includes('campaign_logs')) {
        vi.spyOn(stmt, 'all').mockResolvedValue(mockResult([
          { id: 'cust-b1', name: 'Tran Thi B', phone: '84902222222', date_of_birth: '2026-07-15' }
        ]));
      }
      return stmt;
    });

    const { detectBirthdayCandidates } = await import('../birthday');
    const result = await detectBirthdayCandidates(mockDb);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cust-b1');
  });

  it('returns empty when no birthday customers this month', async() => {
    const { detectBirthdayCandidates } = await import('../birthday');
    const result = await detectBirthdayCandidates(createMockDB());
    expect(result).toHaveLength(0);
  });
});

describe('detectWinbackCandidates', () => {
  it('detects customers inactive for 30+ days', async() => {
    const mockDb = createMockDB();
    vi.spyOn(mockDb, 'prepare').mockImplementation((sql: string) => {
      const stmt = createMockDB().prepare(sql);
      if (sql.includes('orders') && sql.includes('MAX')) {
        vi.spyOn(stmt, 'all').mockResolvedValue(mockResult([
          { id: 'cust-wb1', name: 'Le Van C', phone: '84903333333', last_order_date: new Date(Date.now() - 45 * 86400000).toISOString() }
        ]));
      }
      return stmt;
    });

    const { detectWinbackCandidates } = await import('../winback');
    const result = await detectWinbackCandidates(mockDb);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cust-wb1');
  });

  it('does not detect active customers', async() => {
    const { detectWinbackCandidates } = await import('../winback');
    const result = await detectWinbackCandidates(createMockDB());
    expect(result).toHaveLength(0);
  });
});

describe('detectPostVisitCandidates', () => {
  it('detects orders completed 24-48h ago', async() => {
    const mockDb = createMockDB();
    vi.spyOn(mockDb, 'prepare').mockImplementation((sql: string) => {
      const stmt = createMockDB().prepare(sql);
      if (sql.includes('orders') && sql.includes('BETWEEN')) {
        vi.spyOn(stmt, 'all').mockResolvedValue(mockResult([{
          id: 'cust-p1', name: 'Pham Van D', phone: '84904444444',
          order_id: 'ord-p1', last_order_date: new Date(Date.now() - 36 * 60 * 60 * 1000).toISOString()
        }]));
      }
      return stmt;
    });

    const { detectPostVisitCandidates } = await import('../post-visit');
    const result = await detectPostVisitCandidates(mockDb);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cust-p1');
  });

  it('returns empty when no orders in 24-48h window', async() => {
    const { detectPostVisitCandidates } = await import('../post-visit');
    const result = await detectPostVisitCandidates(createMockDB());
    expect(result).toHaveLength(0);
  });
});

describe('detectCashbackExpiry', () => {
  it('detects cashback expiring within 7 days', async() => {
    const mockDb = createMockDB();
    vi.spyOn(mockDb, 'prepare').mockImplementation((sql: string) => {
      const stmt = createMockDB().prepare(sql);
      if (sql.includes('cashback_transactions')) {
        vi.spyOn(stmt, 'all').mockResolvedValue(mockResult([{
          customer_id: 'cust-c1', phone: '84905555555',
          name: 'Hoang Van E', total_expiring: 100000, days_left: 5
        }]));
      }
      return stmt;
    });

    const { detectCashbackExpiry } = await import('../cashback-expiry');
    const result = await detectCashbackExpiry(mockDb);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('cust-c1');
  });

  it('returns empty when no cashback expiring', async() => {
    const { detectCashbackExpiry } = await import('../cashback-expiry');
    const result = await detectCashbackExpiry(createMockDB());
    expect(result).toHaveLength(0);
  });
});
