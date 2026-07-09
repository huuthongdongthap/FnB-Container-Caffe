/** Campaign Engine — deduplicate + logSend */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockDB } from '../../../__tests__/test-utils';
import type { CampaignTrigger, CampaignResult } from '../../../tree/campaigns/types';

let deduplicate: (
  db: import('@cloudflare/workers-types').D1Database,
  customerId: string,
  trigger: CampaignTrigger,
  sinceDays: number,
) => Promise<boolean>;
let logSend: (
  db: import('@cloudflare/workers-types').D1Database,
  result: CampaignResult,
) => Promise<void>;
let generateId: () => string;

beforeEach(async() => {
  vi.resetModules();
  const engine = await import('../../../tree/campaigns/campaign-engine');
  deduplicate = (engine as Record<string, unknown>).deduplicate as typeof deduplicate;
  logSend = (engine as Record<string, unknown>).logSend as typeof logSend;
  generateId = (engine as Record<string, unknown>).generateId as typeof generateId;
});

// ── generateId ──────────────────────────────────────────────────────────────

describe('generateId', () => {
  it('starts with camp_ prefix', () => {
    expect(generateId()).toMatch(/^camp_/);
  });
  it('produces unique values', () => {
    expect(generateId()).not.toBe(generateId());
  });
  it('returns a string', () => {
    expect(typeof generateId()).toBe('string');
  });
});

// ── deduplicate ─────────────────────────────────────────────────────────────

describe('deduplicate', () => {
  it('returns false for a customer never sent a campaign', async() => {
    const db = createMockDB();
    const result = await deduplicate(db, 'cust-001', 'welcome', 7);
    expect(result).toBe(false);
  });

  it('returns true when a recent send exists within the cooldown window', async() => {
    const db = createMockDB();
    const recent = new Date(Date.now() - 2 * 86400000).toISOString();
    const stmt = db.prepare('');
    // capture the SQL and override first()
    const originalPrepare = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      const s = originalPrepare(sql);
      if (sql.includes('campaign_logs')) {
        vi.spyOn(s, 'first').mockResolvedValue({ id: 'log-1', sent_at: recent });
      }
      return s;
    });
    const result = await deduplicate(db, 'cust-001', 'welcome', 7);
    expect(result).toBe(true);
  });

  it('returns false when the last send is outside the cooldown window', async() => {
    const db = createMockDB();
    const oldDate = new Date(Date.now() - 30 * 86400000).toISOString();
    const originalPrepare = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      const s = originalPrepare(sql);
      if (sql.includes('campaign_logs')) {
        // Simulate WHERE clause filtering out old rows — FIRST returns null
        vi.spyOn(s, 'first').mockResolvedValue(null);
      }
      return s;
    });
    const result = await deduplicate(db, 'cust-001', 'winback', 7);
    expect(result).toBe(false);
  });

  it('returns false on database error (fail-safe)', async() => {
    const db = createMockDB();
    vi.spyOn(db, 'prepare').mockImplementation(() => {
      throw new Error('D1 down');
    });
    const result = await deduplicate(db, 'cust-001', 'welcome', 7);
    expect(result).toBe(false);
  });

  it('queries with the correct cutoff timestamp relative to sinceDays', async() => {
    const db = createMockDB();
    let capturedBind: unknown[] = [];
    const originalPrepare = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      const s = originalPrepare(sql);
      if (sql.includes('campaign_logs')) {
        const origBind = s.bind.bind(s);
        s.bind = (...args: unknown[]) => {
          capturedBind = args;
          return origBind(...args);
        };
      }
      return s;
    });
    await deduplicate(db, 'cust-1', 'birthday', 14);
    expect(capturedBind.length).toBe(3);
    // third bind arg is the cutoff date — should be ~14 days ago
    const cutoff = capturedBind[2] as string;
    const cutoffMs = new Date(cutoff).getTime();
    const diffDays = (Date.now() - cutoffMs) / 86400000;
    expect(diffDays).toBeGreaterThanOrEqual(13);
    expect(diffDays).toBeLessThanOrEqual(15);
  });

  it('ORDER BY sent_at DESC LIMIT 1 is present in the SQL', async() => {
    const db = createMockDB();
    let capturedSql = '';
    const originalPrepare = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      capturedSql = sql;
      return originalPrepare(sql);
    });
    await deduplicate(db, 'cust-1', 'welcome', 1);
    expect(capturedSql).toContain('ORDER BY sent_at DESC LIMIT 1');
  });
});

// ── logSend ─────────────────────────────────────────────────────────────────

describe('logSend', () => {
  it('inserts a sent record with correct status', async() => {
    const db = createMockDB();
    let insertedStatus = '';
    const originalPrep = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      const s = originalPrep(sql);
      if (sql.includes('INSERT INTO campaign_logs')) {
        const origBind = s.bind.bind(s);
        s.bind = (...args: unknown[]) => {
          // status is bind index 5 (0:id, 1:customer_id, 2:trigger, 3:channel, 4:sent_at, 5:status)
          insertedStatus = args[5] as string;
          return origBind(...args);
        };
      }
      return s;
    });

    const result: CampaignResult = {
      trigger: 'welcome',
      channel: 'sms',
      customer_id: 'cust-1',
      sent: true
    };
    await logSend(db, result);
    expect(insertedStatus).toBe('sent');
  });

  it('records failed status when send failed with error', async() => {
    const db = createMockDB();
    let insertedStatus = '';
    let insertedError: string | undefined;
    const originalPrep = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      const s = originalPrep(sql);
      if (sql.includes('INSERT INTO campaign_logs')) {
        const origBind = s.bind.bind(s);
        s.bind = (...args: unknown[]) => {
          insertedStatus = args[5] as string;
          insertedError = args[6] as string | undefined;
          return origBind(...args);
        };
      }
      return s;
    });

    const result: CampaignResult = {
      trigger: 'birthday',
      channel: 'email',
      customer_id: 'cust-2',
      sent: false,
      error: 'connection_timeout'
    };
    await logSend(db, result);
    expect(insertedStatus).toBe('failed');
    expect(insertedError).toBe('connection_timeout');
  });

  it('stores null error when sent succeeded', async() => {
    const db = createMockDB();
    let insertedError: string | undefined;
    const originalPrep = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      const s = originalPrep(sql);
      if (sql.includes('INSERT INTO campaign_logs')) {
        const origBind = s.bind.bind(s);
        s.bind = (...args: unknown[]) => {
          insertedError = args[6] as string | undefined;
          return origBind(...args);
        };
      }
      return s;
    });

    const result: CampaignResult = {
      trigger: 'winback',
      channel: 'zalo',
      customer_id: 'cust-3',
      sent: true
    };
    await logSend(db, result);
    expect(insertedError).toBeNull();
  });

  it('resolves even if the INSERT fails (error swallowing)', async() => {
    const db = createMockDB();
    let calls = 0;
    vi.spyOn(db, 'prepare').mockImplementation(() => {
      calls++;
      return {
        bind: () => ({
          run: async() => {
            throw new Error('D1 write fail');
          }
        })
      } as never;
    });

    const result: CampaignResult = {
      trigger: 'post_visit',
      channel: 'sms',
      customer_id: 'cust-4',
      sent: true
    };
    await expect(logSend(db, result)).resolves.toBeUndefined();
    expect(calls).toBeGreaterThan(0);
  });

  it('fills customer_id and trigger from the CampaignResult', async() => {
    const db = createMockDB();
    let captured: Record<string, unknown> = {};
    const originalPrep = db.prepare.bind(db);
    vi.spyOn(db, 'prepare').mockImplementation((sql: string) => {
      const s = originalPrep(sql);
      if (sql.includes('INSERT INTO campaign_logs')) {
        const origBind = s.bind.bind(s);
        s.bind = (...args: unknown[]) => {
          captured = {
            id: args[0],
            customer_id: args[1],
            trigger: args[2],
            channel: args[3]
          };
          return origBind(...args);
        };
      }
      return s;
    });

    const result: CampaignResult = {
      trigger: 'cashback_expiry',
      channel: 'zalo',
      customer_id: 'cust-5',
      sent: true
    };
    await logSend(db, result);
    expect(captured.customer_id).toBe('cust-5');
    expect(captured.trigger).toBe('cashback_expiry');
    expect(captured.channel).toBe('zalo');
    expect(captured.id).toMatch(/^camp_/);
  });
});
