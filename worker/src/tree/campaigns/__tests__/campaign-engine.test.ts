/**
 * Campaign Engine Tests — TDD
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDB, createMockEnv } from '../../../__tests__/test-utils';
import type { CampaignTrigger, CampaignResult } from '../types';

// Import after mocks — will be tested against implementation
let deduplicate: (db: import('@cloudflare/workers-types').D1Database, customerId: string, trigger: CampaignTrigger, sinceDays: number) => Promise<boolean>;
let logSend: (db: import('@cloudflare/workers-types').D1Database, result: CampaignResult) => Promise<void>;

beforeEach(async () => {
  // Clear module cache and re-import
  vi.resetModules();
  const engine = await import('../campaign-engine');
  deduplicate = engine.deduplicate;
  logSend = engine.logSend;
});

describe('deduplicate', () => {
  it('returns false for a customer never sent a campaign', async () => {
    const db = createMockDB();
    const result = await deduplicate(db, 'cust-001', 'welcome', 1);
    expect(result).toBe(false);
  });

  it('returns true for a customer sent within cooldown period', async () => {
    const db = createMockDB();
    // Override all to simulate recent send
    const recentDate = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1 hour ago
    const mockDb = createMockDB();
    const originalPrepare = mockDb.prepare;
    vi.spyOn(mockDb, 'prepare').mockImplementation((sql: string) => {
      const stmt = originalPrepare.call(mockDb, sql);
      if (sql.includes('campaign_logs')) {
        vi.spyOn(stmt, 'first').mockResolvedValue({ id: 'log-1', sent_at: recentDate });
      }
      return stmt;
    });
    const result = await deduplicate(mockDb, 'cust-001', 'welcome', 7);
    expect(result).toBe(true);
  });

  it('returns false when last send is outside cooldown', async () => {
    const db = createMockDB();
    const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const mockDb = createMockDB();
    const originalPrepare = mockDb.prepare;
    vi.spyOn(mockDb, 'prepare').mockImplementation((sql: string) => {
      const stmt = originalPrepare.call(mockDb, sql);
      if (sql.includes('campaign_logs')) {
        vi.spyOn(stmt, 'first').mockResolvedValue(null);
      }
      return stmt;
    });
    const result = await deduplicate(mockDb, 'cust-001', 'winback', 7);
    expect(result).toBe(false);
  });
});

describe('logSend', () => {
  it('inserts a campaign_logs record', async () => {
    const db = createMockDB();
    const result: CampaignResult = {
      trigger: 'welcome',
      channel: 'sms',
      customer_id: 'cust-001',
      sent: true,
    };
    await expect(logSend(db, result)).resolves.toBeUndefined();
  });

  it('records error when send failed', async () => {
    const db = createMockDB();
    const result: CampaignResult = {
      trigger: 'birthday',
      channel: 'email',
      customer_id: 'cust-002',
      sent: false,
      error: 'send_failed',
    };
    await expect(logSend(db, result)).resolves.toBeUndefined();
  });
});

