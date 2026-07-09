import { describe, it, expect, vi, beforeEach } from 'vitest';

// Inject a test-only template ID so sendZNS bypasses the YOUR_ guard and
// actually calls fetch / audit code. Vitest hoists this before imports.
// @ts-ignore hoisted mock factory
vi.mock('../../../tree/zalo/zns-templates.js', () => ({
  TEMPLATE_IDS: {
    welcome_signup: 'YOUR_WELCOME_TEMPLATE_ID',
    cashback_earned: 'YOUR_CASHBACK_TEMPLATE_ID',
    tier_upgrade: 'YOUR_TIER_TEMPLATE_ID',
    cashback_expiry_warning: 'YOUR_EXPIRY_TEMPLATE_ID',
    general_promotion: 'YOUR_GENERAL_PROMO_TEMPLATE_ID',
    _test_cfg: 'ZNS_TEST_TMPL_ID'
  },
  buildTemplateData: () => ({})
}));

import { sendZNS } from '../../../tree/zalo/zns-sender.js';
import type { ZnsData } from '../../../tree/zalo/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ZALO_URL = 'https://business.openapi.zalo.me/message/template';

function makeZaloEnv(overrides?: Record<string, unknown>): Record<string, unknown> {
  return { ZALO_ACCESS_TOKEN: 'test-zalo-token', AURA_DB: undefined, ...overrides };
}

function makeParams(overrides?: { phone?: string; template_key?: string; data?: ZnsData }) {
  return { phone: '0912345678', template_key: 'welcome_signup', data: { name: 'Test User' }, ...overrides };
}

function mockFetchOK() {
  const calls: Array<{ url: string; body: string; headers: Record<string, string> }> = [];
  vi.stubGlobal('fetch', async(_url: unknown, _init?: RequestInit) => {
    const url = typeof _url === 'string' ? _url : String(_url);
    const init = (_init as Record<string, unknown>) || {};
    const bodyStr = typeof init.body === 'string' ? init.body : '';
    const headers = (init.headers as Record<string, string>) || {};
    calls.push({ url, body: bodyStr, headers });
    return { ok: true, status: 200, json: async() => ({ error: 0 }), text: async() => '{"error":0}' };
  });
  return { getCalls: () => calls };
}

function mockDB() {
  const inserts: Array<{ sql: string; binds: unknown[] }> = [];
  const db = {
    prepare: (_sql: string) => ({
      bind: (...args: unknown[]) => ({
        run: async() => {
          inserts.push({ sql: _sql, binds: args }); return { success: true };
        }
      })
    })
  };
  return { db, getInserts: () => inserts };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('sendZNS', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  // --- no_token ---

  describe('no_token preconditions', () => {
    it('returns no_token when ZALO_ACCESS_TOKEN is absent', async() => {
      const result = await sendZNS(makeZaloEnv({ ZALO_ACCESS_TOKEN: undefined }), makeParams());
      expect(result).toEqual({ ok: false, channel: 'zalo', reason: 'no_token' });
    });

    it('returns no_token when ZALO_ACCESS_TOKEN is empty string', async() => {
      const result = await sendZNS(makeZaloEnv({ ZALO_ACCESS_TOKEN: '' }), makeParams());
      expect(result.reason).toBe('no_token');
    });
  });

  // --- template_not_configured short-circuit ---

  describe('template_not_configured preconditions', () => {
    it('returns template_not_configured for an unknown template key', async() => {
      const result = await sendZNS(makeZaloEnv(), makeParams({ template_key: 'totally_unknown_key' }));
      expect(result).toEqual({ ok: false, channel: 'zalo', reason: 'template_not_configured' });
    });

    it('returns template_not_configured when template value starts with YOUR_', async() => {
      const result = await sendZNS(makeZaloEnv(), makeParams({ template_key: 'tier_upgrade' }));
      expect(result).toEqual({ ok: false, channel: 'zalo', reason: 'template_not_configured' });
    });
  });

  // --- phone normalization ---

  describe('phone normalization', () => {
    it('strips leading 0 and adds 84 prefix for VN numbers', async() => {
      const { getCalls } = mockFetchOK();
      await sendZNS(makeZaloEnv(), makeParams({ phone: '0912345678', template_key: '_test_cfg' }));
      expect(JSON.parse(getCalls()[0].body).phone).toBe('84912345678');
    });

    it('strips +84 prefix and normalizes to country code without leading +', async() => {
      const { getCalls } = mockFetchOK();
      await sendZNS(makeZaloEnv(), makeParams({ phone: '+84912345678', template_key: '_test_cfg' }));
      expect(JSON.parse(getCalls()[0].body).phone).toBe('84912345678');
    });

    it('passes through an already-84-prefixed number without double prefix', async() => {
      const { getCalls } = mockFetchOK();
      await sendZNS(makeZaloEnv(), makeParams({ phone: '84912345678', template_key: '_test_cfg' }));
      expect(JSON.parse(getCalls()[0].body).phone).toBe('84912345678');
    });
  });

  // --- fetch body & auth ---

  describe('fetch body & auth', () => {
    it('builds JSON body with the correct phone payload', async() => {
      const { getCalls } = mockFetchOK();
      await sendZNS(makeZaloEnv(), makeParams({ template_key: '_test_cfg' }));
      const call = getCalls()[0];
      const body = JSON.parse(call.body);
      expect(body.phone).toBe('84912345678');
      expect(body.template_id).toBe('ZNS_TEST_TMPL_ID');
      expect(typeof body.tracking_id).toBe('string');
      expect(body.tracking_id.startsWith('aura_')).toBe(true);
    });

    it('forwards ZALO_ACCESS_TOKEN via access_token header', async() => {
      const { getCalls } = mockFetchOK();
      await sendZNS(makeZaloEnv(), makeParams({ template_key: '_test_cfg' }));
      expect(getCalls()[0].headers.access_token).toBe('test-zalo-token');
      expect(getCalls()[0].headers['Content-Type']).toBe('application/json');
    });

    it('normalizes VN phone before sending', async() => {
      const original = '0912345678';
      const expected = '84912345678';
      const { getCalls } = mockFetchOK();
      await sendZNS(makeZaloEnv(), makeParams({ phone: original, template_key: '_test_cfg' }));
      expect(JSON.parse(getCalls()[0].body).phone).toBe(expected);
    });
  });

  // --- zalo response mapping ---

  describe('zalo response mapping', () => {
    it('returns ok:true when zalo responds with error: 0', async() => {
      vi.stubGlobal('fetch', async() => ({
        ok: true, status: 200,
        json: async() => ({ error: 0 }),
        text: async() => '{"error":0}'
      }));
      const result = await sendZNS(makeZaloEnv(), makeParams({ template_key: '_test_cfg' }));
      expect(result.ok).toBe(true);
      expect(result.channel).toBe('zalo');
    });

    it('returns ok:false when zalo responds with non-zero error code', async() => {
      vi.stubGlobal('fetch', async() => ({
        ok: false, status: 400,
        json: async() => ({ error: 1, message: 'Invalid params' }),
        text: async() => '{"error":1}'
      }));
      const result = await sendZNS(makeZaloEnv(), makeParams({ template_key: '_test_cfg' }));
      expect(result.ok).toBe(false);
      expect(result.channel).toBe('zalo');
    });
  });

  // --- audit log ---

  describe('audit log', () => {
    it('inserts a row into notification_audit_log when AURA_DB is present', async() => {
      const { db, getInserts } = mockDB();
      const { getCalls } = mockFetchOK();
      await sendZNS(
        makeZaloEnv({ AURA_DB: db as unknown as Record<string, unknown> }),
        makeParams({ phone: '0912345678', template_key: '_test_cfg' })
      );
      const inserts = getInserts();
      expect(inserts.length).toBeGreaterThan(0);
      const audit = inserts.find((i: { sql: string }) => i.sql.includes('notification_audit_log'));
      expect(audit).toBeDefined();
      expect(audit!.binds[0]).toBe('0912345678');
      expect(audit!.binds[1]).toBe('_test_cfg');
      expect(audit!.binds[3]).toBe('sent');
    });

    it('returns success even when audit insert throws', async() => {
      vi.stubGlobal('fetch', async() => ({
        ok: true, status: 200,
        json: async() => ({ error: 0 }),
        text: async() => '{"error":0}'
      }));
      const failingDB = {
        prepare: () => ({
          bind: () => ({
            run: async() => {
              throw new Error('DB down');
            }
          })
        })
      };
      const result = await sendZNS(
        makeZaloEnv({ AURA_DB: failingDB as unknown as Record<string, unknown> }),
        makeParams({ template_key: '_test_cfg' })
      );
      expect(result.ok).toBe(true);
    });

    it('skips audit entirely when AURA_DB is absent', async() => {
      const { getCalls } = mockFetchOK();
      const result = await sendZNS(
        makeZaloEnv({ AURA_DB: undefined }),
        makeParams({ template_key: '_test_cfg' })
      );
      expect(result.ok).toBe(true);
    });
  });

  // --- network/parse failures ---

  describe('network/parse failures', () => {
    it('returns failed when fetch throws', async() => {
      vi.stubGlobal('fetch', async() => {
        throw new Error('fetch failed');
      });
      const result = await sendZNS(
        makeZaloEnv(),
        makeParams({ template_key: '_test_cfg' })
      );
      expect(result.ok).toBe(false);
      expect(result.channel).toBe('zalo');
      expect(result.result).toBeDefined();
    });

    it('returns failed when response body is invalid JSON', async() => {
      vi.stubGlobal('fetch', async() => ({
        ok: true, status: 200,
        json: async() => {
          throw new Error('invalid json');
        },
        text: async() => 'not json'
      }));
      const result = await sendZNS(
        makeZaloEnv(),
        makeParams({ template_key: '_test_cfg' })
      );
      expect(result.ok).toBe(false);
      expect(result.channel).toBe('zalo');
    });

    it('records an audit row when non-zero zalo error and AURA_DB present', async() => {
      vi.stubGlobal('fetch', async() => ({
        ok: true, status: 400,
        json: async() => ({ error: 99, message: 'Service unavailable' }),
        text: async() => '{"error":99}'
      }));
      const { db, getInserts } = mockDB();
      const result = await sendZNS(
        makeZaloEnv({ AURA_DB: db as unknown as Record<string, unknown> }),
        makeParams({ template_key: '_test_cfg' })
      );
      expect(result.ok).toBe(false);
      expect(result.channel).toBe('zalo');
      const inserts = getInserts();
      expect(inserts.length).toBeGreaterThan(0);
      const audit = inserts.find((i: { sql: string }) => i.sql.includes('notification_audit_log'));
      expect(audit).toBeDefined();
      expect(audit!.binds[3]).toBe('failed');
    });
  });
});
