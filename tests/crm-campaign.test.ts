import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderTemplate } from 'packages/domain/crm/commands/campaign/templates';
import { deduplicate, logSend } from 'packages/domain/crm/commands/campaign/dedup';
import {
  detectWelcomeCandidates,
  detectBirthdayCandidates,
  detectWinbackCandidates,
  detectPostVisitCandidates,
  detectCashbackExpiry,
  markExpiryNotified,
} from 'packages/domain/crm/commands/campaign/detect';

const mockDb = (rows: any[] = []) => {
  const calls: { sql: string; args: any[] }[] = [];
  const prepare = (sql: string) => {
    const bind = (...args: any[]) => {
      calls.push({ sql, args });
      return {
        first: async () => rows[0] ?? null,
        all: async () => ({ results: rows }),
        run: async () => ({ success: true }),
      };
    };
    return { bind };
  };
  return {
    prepare,
    batch: async (stmts: any[]) => [],
    __calls: calls,
  };
};

describe('renderTemplate', () => {
  it('returns bilingual welcome content', () => {
    const r = renderTemplate('welcome', { name: 'Alice' });
    expect(r.sms).toContain('Alice');
    expect(r.sms).toContain('AURA CAFE');
    expect(r.subject).toContain('Chào mừng');
  });

  it('defaults name to "bạn"', () => {
    const r = renderTemplate('winback', {});
    expect(r.sms).toContain('bạn');
  });

  it('renders cashback_expiry with amount and days', () => {
    const r = renderTemplate('cashback_expiry', { name: 'Bob', amount: 50000, days_left: 3 });
    expect(r.sms).toContain('50.000');
    expect(r.sms).toContain('3');
  });

  it('covers all triggers', () => {
    const triggers = ['welcome', 'birthday', 'winback', 'post_visit', 'cashback_expiry'] as const;
    for (const t of triggers) {
      const r = renderTemplate(t, { name: 'X', amount: 100, days_left: 1 });
      expect(r.sms.length).toBeGreaterThan(0);
      expect(r.subject.length).toBeGreaterThan(0);
      expect(r.html.length).toBeGreaterThan(0);
    }
  });

  it('throws on unknown trigger', () => {
    // @ts-expect-error invalid trigger
    expect(() => renderTemplate('nope', {})).toThrow(/Unknown trigger/);
  });
});

describe('deduplicate', () => {
  it('returns true when a recent log exists', async () => {
    const db = mockDb([{ id: 'camp_1' }]);
    const blocked = await deduplicate(db as any, 'cust_1', 'welcome', 30);
    expect(blocked).toBe(true);
  });

  it('returns false when no recent log', async () => {
    const db = mockDb([]);
    const blocked = await deduplicate(db as any, 'cust_1', 'welcome', 30);
    expect(blocked).toBe(false);
  });

  it('passes customerId, trigger, and cutoff to query', async () => {
    const db = mockDb([]);
    await deduplicate(db as any, 'cust_42', 'birthday', 365);
    const call = db.__calls[0];
    expect(call.args[0]).toBe('cust_42');
    expect(call.args[1]).toBe('birthday');
    expect(typeof call.args[2]).toBe('string');
  });
});

describe('logSend', () => {
  it('inserts a row with status sent', async () => {
    const db = mockDb([]);
    await logSend(db as any, {
      trigger: 'welcome',
      channel: 'sms',
      customer_id: 'cust_1',
      sent: true,
    });
    const call = db.__calls[0];
    expect(call.args[2]).toBe('welcome');
    expect(call.args[3]).toBe('sms');
    expect(call.args[5]).toBe('sent');
  });

  it('inserts status failed when sent=false', async () => {
    const db = mockDb([]);
    await logSend(db as any, {
      trigger: 'winback',
      channel: 'sms',
      customer_id: 'cust_2',
      sent: false,
      error: 'sms gateway down',
    });
    const call = db.__calls[0];
    expect(call.args[5]).toBe('failed');
    expect(call.args[6]).toBe('sms gateway down');
  });
});

describe('detectors', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('detectWelcomeCandidates uses 24h cutoff', async () => {
    const db = mockDb([]);
    await detectWelcomeCandidates(db as any);
    const call = db.__calls[0];
    expect(call.sql).toContain('campaign_logs');
    expect(call.sql).toContain('welcome');
    expect(call.sql).toContain('created_at > ?');
  });

  it('detectBirthdayCandidates uses month + year filter', async () => {
    const db = mockDb([]);
    await detectBirthdayCandidates(db as any);
    const call = db.__calls[0];
    expect(call.sql).toContain('substr');
    expect(call.args).toHaveLength(2);
  });

  it('detectWinbackCandidates filters 30d inactive', async () => {
    const db = mockDb([]);
    await detectWinbackCandidates(db as any);
    const call = db.__calls[0];
    expect(call.sql).toContain('winback');
    expect(call.sql).toContain('MAX(o.created_at)');
  });

  it('detectPostVisitCandidates uses 24-48h window', async () => {
    const db = mockDb([]);
    await detectPostVisitCandidates(db as any);
    const call = db.__calls[0];
    expect(call.sql).toContain('BETWEEN');
    expect(call.sql).toContain('post_visit');
  });

  it('detectCashbackExpiry joins cashback_transactions', async () => {
    const db = mockDb([]);
    await detectCashbackExpiry(db as any);
    const call = db.__calls[0];
    expect(call.sql).toContain('cashback_transactions');
    expect(call.sql).toContain('last_expiry_warning_at');
  });

  it('markExpiryNotified batches UPDATEs', async () => {
    let batched = 0;
    const db = {
      prepare: (sql: string) => ({
        bind: (...args: any[]) => {
          batched++;
          return { run: async () => ({}) };
        },
      }),
      batch: async (stmts: any[]) => [],
    };
    await markExpiryNotified(db as any, ['c1', 'c2', 'c3']);
    expect(batched).toBe(3);
  });

  it('markExpiryNotified returns 0 for empty list', async () => {
    const db = mockDb([]);
    const n = await markExpiryNotified(db as any, []);
    expect(n).toBe(0);
  });
});
