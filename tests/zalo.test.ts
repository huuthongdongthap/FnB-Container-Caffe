/**
 * Zalo Routes Tests — sendZNS, notifyMember, handleZaloRequest
 *
 * Tests for Zalo ZNS notification service with mocked fetch.
 *
 * @vitest-test-type unit
 */

import { describe, test, expect, vi, beforeEach } from 'vitest';

// Import actual sendZNS from tree/zalo/zns-sender
import { sendZNS } from '../worker/src/tree/zalo/zns-sender';
import { notifyMember } from '../worker/src/tree/zalo/notify-member';

// Mock TEMPLATE_IDS to have valid template IDs for testing
vi.mock('../worker/src/tree/zalo/zns-templates', () => ({
  TEMPLATE_IDS: {
    welcome_signup: 'TEST_WELCOME_TEMPLATE_ID',
    cashback_earned: 'TEST_CASHBACK_TEMPLATE_ID',
    tier_upgrade: 'TEST_TIER_TEMPLATE_ID',
    cashback_expiry_warning: 'TEST_EXPIRY_TEMPLATE_ID',
    general_promotion: 'TEST_GENERAL_PROMO_TEMPLATE_ID'
  },
  buildTemplateData: vi.fn((template_key: string, data: any) => ({
    customer_name: data.name || '',
    amount: String(data.amount || 0),
    member_id: data.member_id || ''
  }))
}));

// Mock handleZaloRequest from routes/zalo - import real implementation
vi.mock('../worker/src/routes/zalo', async () => {
  const actual = await vi.importActual('../worker/src/routes/zalo');
  return actual;
});

// ── Mock D1 Database ──────────────────────────────────────────────
function createMockD1(seedData: Record<string, any[]>) {
  const tableData: Record<string, any[]> = {};
  Object.keys(seedData).forEach(t => { tableData[t] = [...(seedData[t] || [])]; });

  function getPrimaryTable(sql: string) {
    const fromMatch = sql.match(/\bFROM\s+(\w+)/i);
    return fromMatch ? fromMatch[1] : null;
  }

  const db = {
    prepare: vi.fn((q: string) => {
      const stmt: any = {
        _sql: q, _bindValues: [] as any[],
        bind: vi.fn(function (...vals: any[]) { this._bindValues.push(...vals); return this; }),
        first: vi.fn(async function () {
          const table = getPrimaryTable(q);
          const rows = (table && tableData[table]) ? tableData[table] : [];
          return rows[0] || null;
        }),
        run: vi.fn(async () => ({ success: true })),
      };
      return stmt;
    }),
  };
  return db;
}

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch = vi.fn();
  globalThis.fetch = mockFetch;
});

describe('sendZNS', () => {
  test('returns no_token when ZALO_ACCESS_TOKEN not set', async () => {
    const result = await sendZNS({}, { phone: '0901234567', template_key: 'welcome_signup', data: { name: 'Test' } });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_token');
  });

  test('returns template_not_configured for unconfigured templates', async () => {
    const result = await sendZNS(
      { ZALO_ACCESS_TOKEN: 'test-token' },
      { phone: '0901234567', template_key: 'unknown_template', data: { name: 'Test' } },
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('template_not_configured');
  });

  test('sends ZNS message via Zalo API successfully', async () => {
    // Mock fetch to return success from Zalo API
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: 0, data: { sent: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    const env = { ZALO_ACCESS_TOKEN: 'test-token', AURA_DB: createMockD1({ notification_audit_log: [] }) };
    const result = await sendZNS(env, {
      phone: '0901234567',
      template_key: 'cashback_earned',
      data: { amount: 10000 },
    });
    expect(result.ok).toBe(true);
    expect(result.channel).toBe('zalo');
    expect(mockFetch).toHaveBeenCalled();
  });

  test('handles Zalo API error response', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: 100, message: 'Invalid token' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    const env = { ZALO_ACCESS_TOKEN: 'test-token', AURA_DB: createMockD1({ notification_audit_log: [] }) };
    const result = await sendZNS(env, {
      phone: '0901234567',
      template_key: 'cashback_earned',
      data: { amount: 10000 },
    });
    expect(result.ok).toBe(false);
    expect(result.channel).toBe('zalo');
  });

  test('handles network error gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const env = { ZALO_ACCESS_TOKEN: 'test-token', AURA_DB: createMockD1({ notification_audit_log: [] }) };
    const result = await sendZNS(env, {
      phone: '0901234567',
      template_key: 'cashback_earned',
      data: { amount: 10000 },
    });
    expect(result.ok).toBe(false);
    expect(result.channel).toBe('zalo');
  });
});

describe('notifyMember', () => {
  test('returns customer_not_found when customer not found', async () => {
    const env = {
      ZALO_ACCESS_TOKEN: 'test-token',
      AURA_DB: createMockD1({ customers: [] })
    };
    const result = await notifyMember(env, {
      customer_id: 'NOT_FOUND',
      template_key: 'cashback_earned',
      data: { amount: 10000 }
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('customer_not_found');
  });

  test('returns no_phone when customer has no phone', async () => {
    const env = {
      ZALO_ACCESS_TOKEN: 'test-token',
      AURA_DB: createMockD1({ customers: [{ id: 'USR_001', name: 'Test', phone: null }] })
    };
    const result = await notifyMember(env, {
      customer_id: 'USR_001',
      template_key: 'cashback_earned',
      data: { amount: 10000 }
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_phone');
  });

  test('handles missing AURA_DB gracefully', async () => {
    const env = { ZALO_ACCESS_TOKEN: 'test-token', AURA_DB: undefined as any };
    const result = await notifyMember(env, {
      customer_id: 'USR_001',
      template_key: 'cashback_earned',
      data: { amount: 10000 }
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('customer_not_found');
  });

  test('sends ZNS when customer has phone and ZALO_ACCESS_TOKEN', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: 0, data: { sent: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    );
    const env = {
      ZALO_ACCESS_TOKEN: 'test-token',
      AURA_DB: createMockD1({ customers: [{ id: 'USR_001', name: 'Test', phone: '0901234567' }] })
    };
    const result = await notifyMember(env, {
      customer_id: 'USR_001',
      template_key: 'cashback_earned',
      data: { amount: 10000 }
    });
    expect(result.ok).toBe(true);
    expect(result.channel).toBe('zalo');
  });
});

describe('handleZaloRequest', () => {
  test('returns 400 when phone or customer_id missing', async () => {
    const { handleZaloRequest } = await import('../worker/src/routes/zalo');
    const req = new Request('https://test/api/zalo/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_key: 'cashback_earned', data: { amount: 10000 } }),
    });
    const env = { ZALO_ACCESS_TOKEN: 'test-token' };
    const res = await handleZaloRequest(req, env);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  test('returns 404 for unknown path', async () => {
    const { handleZaloRequest } = await import('../worker/src/routes/zalo');
    const req = new Request('https://test/api/zalo/unknown', { method: 'POST' });
    const env = { ZALO_ACCESS_TOKEN: 'test-token' };
    const res = await handleZaloRequest(req, env);
    expect(res.status).toBe(404);
  });

  test('routes to sendZNS when phone is provided', async () => {
    const { handleZaloRequest } = await import('../worker/src/routes/zalo');
    const req = new Request('https://test/api/zalo/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0901234567', template_key: 'cashback_earned', data: { amount: 10000 } }),
    });
    const env = { ZALO_ACCESS_TOKEN: 'test-token' };
    const res = await handleZaloRequest(req, env);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('success');
  });
});