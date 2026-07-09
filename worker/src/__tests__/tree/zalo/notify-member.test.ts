import { describe, it, expect, vi } from 'vitest';
import { notifyMember } from '../../../tree/zalo/notify-member.js';
import * as znsModule from '../../../tree/zalo/zns-sender.js';
const sendZNS = znsModule.sendZNS;
import type { ZnsData } from '../../../tree/zalo/types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNotifEnv(overrides?: Record<string, unknown>): Record<string, unknown> {
  return { ZALO_ACCESS_TOKEN: 'test-token', AURA_DB: undefined, ...overrides };
}

function makeParams(overrides?: { customer_id?: string; template_key?: string; data?: ZnsData }) {
  return { customer_id: 'cust_1', template_key: 'tier_upgrade', data: { new_tier: 'GOLD' }, ...overrides };
}

/** Replace sendZNS on the imported module with a spy that records calls. */
function mockSendZNS() {
  const calls: Array<[Record<string, unknown>, Record<string, unknown>]> = [];
  const mock = vi.fn(async(_env: Record<string, unknown>, params: Record<string, unknown>) => {
    calls.push([_env, params]);
    return { ok: true, channel: 'zalo' };
  });
  // Swap the live export so notifyMember picks up the spy when it resolves the binding
  Object.defineProperty(znsModule, 'sendZNS', { value: mock, configurable: true, writable: true });
  return { mock, calls, restore: () => {
    Object.defineProperty(
      znsModule, 'sendZNS',
      { value: sendZNS, configurable: true, writable: true }
    );
  } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('notifyMember', () => {
  // --- customer resolution ---

  describe('customer resolution', () => {
    it('returns customer_not_found when DB returns null', async() => {
      const db = {
        prepare: (_sql: string) => ({
          bind: () => ({
            first: async() => null
          })
        })
      };
      const env = makeNotifEnv({ AURA_DB: db as unknown as Record<string, unknown> });
      const result = await notifyMember(env, makeParams());

      expect(result).toEqual({ ok: false, channel: 'pos_only', reason: 'customer_not_found' });
    });

    it('returns customer_not_found when AURA_DB is absent', async() => {
      const env = makeNotifEnv({ AURA_DB: undefined });
      const result = await notifyMember(env, makeParams());

      expect(result).toEqual({ ok: false, channel: 'pos_only', reason: 'customer_not_found' });
    });

    it('returns no_phone when customer has no phone or zalo', async() => {
      const db = {
        prepare: (_sql: string) => ({
          bind: () => ({
            first: async() => ({ id: 'cust_1', name: 'Test', phone: '', zalo: null })
          })
        })
      };
      const env = makeNotifEnv({ AURA_DB: db as unknown as Record<string, unknown> });
      const result = await notifyMember(env, makeParams());

      expect(result).toEqual({ ok: false, channel: 'pos_only', reason: 'no_phone' });
    });

    it('prefers zalo number over phone when both exist', async() => {
      const { mock, restore } = mockSendZNS();
      try {
        const db = {
          prepare: () => ({
            bind: () => ({
              first: async() => ({
                id: 'cust_1', name: 'Nguyen Van A', phone: '0912345678', zalo: '0909999888'
              })
            })
          })
        };
        const env = makeNotifEnv({ AURA_DB: db as unknown as Record<string, unknown> });
        await notifyMember(env, makeParams());
        expect(mock.mock.calls[0]?.[1].phone).toBe('0909999888');
      } finally {
        restore();
      }
    });

    it('falls back to regular phone when zalo is null', async() => {
      const { mock, restore } = mockSendZNS();
      try {
        const db = {
          prepare: () => ({
            bind: () => ({
              first: async() => ({
                id: 'cust_1', name: 'Test', phone: '0912345678', zalo: null
              })
            })
          })
        };
        const env = makeNotifEnv({ AURA_DB: db as unknown as Record<string, unknown> });
        await notifyMember(env, makeParams());
        expect(mock.mock.calls[0]?.[1].phone).toBe('0912345678');
      } finally {
        restore();
      }
    });
  });

  // --- sendZNS delegation ---

  describe('sendZNS delegation', () => {
    it('injects customer name into the data sent to sendZNS', async() => {
      const { mock, restore } = mockSendZNS();
      try {
        const db = {
          prepare: () => ({
            bind: () => ({
              first: async() => ({
                id: 'cust_1', name: 'Nguyen Van A', phone: '0912345678', zalo: null
              })
            })
          })
        };
        const env = makeNotifEnv({ AURA_DB: db as unknown as Record<string, unknown> });
        await notifyMember(env, makeParams());

        const data = mock.mock.calls[0]?.[1].data as ZnsData;
        expect(data.name).toBe('Nguyen Van A');
        expect(data.new_tier).toBe('GOLD');
      } finally {
        restore();
      }
    });

    it('returns ok:true channel:zalo when sendZNS succeeds', async() => {
      const { restore } = mockSendZNS();
      try {
        const db = {
          prepare: () => ({
            bind: () => ({
              first: async() => ({
                id: 'cust_1', name: 'Test', phone: '0912345678', zalo: null
              })
            })
          })
        };
        const env = makeNotifEnv({ AURA_DB: db as unknown as Record<string, unknown> });
        const result = await notifyMember(env, makeParams());
        expect(result).toEqual({ ok: true, channel: 'zalo' });
      } finally {
        restore();
      }
    });

    it('forwards the zalo failure reason as pos_only when sendZNS fails', async() => {
      const failMock = vi.fn(async() => ({
        ok: false, channel: 'zalo', reason: 'template_not_configured'
      }));
      Object.defineProperty(znsModule, 'sendZNS', {
        value: failMock, configurable: true, writable: true
      });
      const db = {
        prepare: () => ({
          bind: () => ({
            first: async() => ({
              id: 'cust_1', name: 'Test', phone: '0912345678', zalo: null
            })
          })
        })
      };
      const env = makeNotifEnv({ AURA_DB: db as unknown as Record<string, unknown> });
      const result = await notifyMember(env, makeParams());

      expect(result).toEqual({ ok: false, channel: 'pos_only', reason: 'template_not_configured' });
      Object.defineProperty(znsModule, 'sendZNS', { value: sendZNS, configurable: true, writable: true });
    });

    it('forwards template_key to sendZNS without modification', async() => {
      const { mock, restore } = mockSendZNS();
      try {
        const db = {
          prepare: () => ({
            bind: () => ({
              first: async() => ({
                id: 'cust_1', name: 'Test', phone: '0912345678', zalo: null
              })
            })
          })
        };
        const env = makeNotifEnv({ AURA_DB: db as unknown as Record<string, unknown> });
        await notifyMember(env, makeParams({ template_key: 'cashback_earned' }));
        expect(mock.mock.calls[0]?.[1].template_key).toBe('cashback_earned');
      } finally {
        restore();
      }
    });
  });

  // --- DB errors ---

  describe('DB error handling', () => {
    it('gracefully handles a DB throw — result is pos_only', async() => {
      const db = {
        prepare: () => ({
          bind: () => ({
            first: async() => {
              throw new Error('D1 connection failed');
            }
          })
        })
      };
      const env = makeNotifEnv({ AURA_DB: db as unknown as Record<string, unknown> });
      const result = await notifyMember(env, makeParams());

      expect(result.channel).toBe('pos_only');
    });
  });
});
