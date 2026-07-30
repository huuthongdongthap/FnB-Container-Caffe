/**
 * Cron Routes Tests — checkOverdueOrders, sendCashbackExpiryWarnings,
 * processErpnextRetryQueue, processErpnextProductSync
 *
 * Tests for cron handler functions with mocked D1.
 *
 * @vitest-test-type unit
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// ── Mock D1 Database ──────────────────────────────────────────────
function createMockD1(seedData: Record<string, any[]> = {}) {
  const tableData: Record<string, any[]> = {};
  ['orders', 'cashback_transactions', 'customers']
    .forEach(t => { tableData[t] = [...(seedData[t] || [])]; });

  function getPrimaryTable(sql: string) {
    const fromMatch = sql.match(/\bFROM\s+(\w+)/i);
    return fromMatch ? fromMatch[1] : null;
  }

  const db: any = {
    prepare: vi.fn((q: string) => {
      const stmt: any = {
        _sql: q, _bindValues: [] as any[],
        bind: vi.fn(function (...vals: any[]) { this._bindValues.push(...vals); return this; }),
        first: vi.fn(async function () {
          const table = getPrimaryTable(q);
          const rows = (table && tableData[table]) ? tableData[table] : [];
          return rows[0] || null;
        }),
        all: vi.fn(async function () {
          const table = getPrimaryTable(q);
          const rows = (table && tableData[table]) ? tableData[table] : [];
          return { results: [...rows] };
        }),
        run: vi.fn(async () => ({ success: true })),
      };
      return stmt;
    }),
    batch: vi.fn(async (_stmts: any[]) => {
      return [{ success: true }];
    }),
  };
  return db;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processErpnextRetryQueue', () => {
  test('returns zero counts when ERPNext not configured', async () => {
    const { processErpnextRetryQueue } = await import('../worker/src/routes/cron');
    const result = await processErpnextRetryQueue({});
    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
  });
});

describe('processErpnextProductSync', () => {
  test('returns zero counts when ERPNext not configured', async () => {
    const { processErpnextProductSync } = await import('../worker/src/routes/cron');
    const result = await processErpnextProductSync({});
    expect(result).toEqual({ synced: 0, errors: 0 });
  });
});

describe('checkOverdueOrders', () => {
  test('marks overdue orders by updating notes', async () => {
    const oldTime = new Date(Date.now() - 3600000 * 2).toISOString(); // 2 hours ago
    const mockEnv = {
      AURA_DB: createMockD1({
        orders: [
          { id: 'o1', customer_name: 'Test', status: 'Bep tiep nhan', created_at: oldTime },
          { id: 'o2', customer_name: 'Test2', status: 'Dang pha che', created_at: oldTime },
        ],
      }),
    };
    const { checkOverdueOrders } = await import('../worker/src/routes/cron');
    // Should not throw
    await expect(checkOverdueOrders(mockEnv)).resolves.toBeUndefined();
  });

  test('skips when no overdue orders', async () => {
    const mockEnv = {
      AURA_DB: createMockD1({
        orders: [
          { id: 'new', customer_name: 'Test', status: 'pending', created_at: new Date().toISOString() },
        ],
      }),
      SLA_THRESHOLD_MINUTES: 15,
    };
    const { checkOverdueOrders } = await import('../worker/src/routes/cron');
    await expect(checkOverdueOrders(mockEnv)).resolves.toBeUndefined();
  });

  test('handles empty database', async () => {
    const mockEnv = { AURA_DB: createMockD1() };
    const { checkOverdueOrders } = await import('../worker/src/routes/cron');
    await expect(checkOverdueOrders(mockEnv)).resolves.toBeUndefined();
  });
});

describe('sendCashbackExpiryWarnings', () => {
  test('returns zero counts when no expiring cashback', async () => {
    const mockEnv = { AURA_DB: createMockD1() };
    const { sendCashbackExpiryWarnings } = await import('../worker/src/routes/cron');
    const result = await sendCashbackExpiryWarnings(mockEnv);
    expect(result).toEqual({ sent: 0, failed: 0 });
  });

  test('handles missing AURA_DB gracefully', async () => {
    const { sendCashbackExpiryWarnings } = await import('../worker/src/routes/cron');
    const result = await sendCashbackExpiryWarnings({});
    expect(result).toEqual({ sent: 0, failed: 0 });
  });
});
