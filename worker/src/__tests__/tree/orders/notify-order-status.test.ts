/**
 * Unit tests for src/tree/orders/notify-order-status.ts
 * Tests: notifyOrderStatus — ZNS, SMS channels, skip on missing config
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ── mock logger ── */
vi.mock('../../../middleware/logger', () => ({
  createLogger: () => ({
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  })
}));

/* ── mock ZNS sender ── */
vi.mock('../../../tree/zalo/zns-sender', () => ({
  sendZNS: vi.fn(async() => ({ success: true, messageId: 'zns_123' }))
}));

/* ── mock SpeedSMS sender ── */
vi.mock('../../../lib/speedsms-client', () => ({
  sendSMS: vi.fn(async() => ({ success: true }))
}));

/* ── DB helpers ── */
function makeChain(
  firstResult: unknown = null,
  allResults: unknown[] = [],
  runResult: { success: boolean; changes: number } = { success: true, changes: 0 }
) {
  const chain: Record<string, unknown> = {};
  chain.bind = vi.fn(() => {
    return chain;
  });
  chain.first = vi.fn(async() => firstResult);
  chain.all = vi.fn(async() => ({ results: allResults }));
  chain.run = vi.fn(async() => runResult);
  return chain as never;
}

function makeDB(chains: Record<string, unknown>[] = [makeChain()]) {
  const queue = [...chains];
  return {
    prepare: vi.fn((_sql: string) => queue.shift() ?? makeChain())
  } as unknown as import('@cloudflare/workers-types').D1Database;
}

function makeEnv(db: import('@cloudflare/workers-types').D1Database, overrides: Record<string, unknown> = {}) {
  return {
    AURA_DB: db,
    ...overrides
  };
}

/* ── imports under test ── */
import { notifyOrderStatus } from '../../../tree/orders/notify-order-status';

describe('notify-order-status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('notifyOrderStatus', () => {
    it('sends both ZNS and SMS when env is configured and order exists', async() => {
      const orderRow = {
        customer_name: 'Nguyen Van A',
        customer_phone: '0909123456',
        total: 250000,
        status: 'confirmed'
      };

      const db = makeDB([makeChain(orderRow)]);
      const env = makeEnv(db, {
        ZALO_ACCESS_TOKEN: 'zalo-token-123',
        SPEEDSMS_API_KEY: 'sms-key',
        SPEEDSMS_API_SECRET: 'sms-secret'
      });

      await notifyOrderStatus(env, 'ORD_001');

      const { sendZNS } = await import('../../../tree/zalo/zns-sender');
      const { sendSMS } = await import('../../../lib/speedsms-client');

      expect(sendZNS).toHaveBeenCalledTimes(1);
      const znsCall = (sendZNS as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(znsCall[1].phone).toBe('0909123456');
      expect(znsCall[1].template_key).toBe('order_status_update');
      expect(znsCall[1].data.name).toBe('Nguyen Van A');
      expect(znsCall[1].data.order_id).toBe('ORD_001');
      expect(znsCall[1].data.status).toBe('da xac nhan');

      expect(sendSMS).toHaveBeenCalledTimes(1);
      const smsCall = (sendSMS as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(smsCall[1].phone).toBe('0909123456');
      expect(smsCall[1].message).toContain('AURA CAFE');
      expect(smsCall[1].message).toContain('ORD_001');
    });

    it('returns early when env has no AURA_DB', async() => {
      const env = {} as Record<string, unknown>;

      await notifyOrderStatus(env, 'ORD_001');

      // Should not throw and should not call ZNS/SMS
      const { sendZNS } = await import('../../../tree/zalo/zns-sender');
      expect(sendZNS).not.toHaveBeenCalled();
    });

    it('returns early when DB fetch returns null', async() => {
      const db = makeDB([makeChain(null)]); // order not found
      const env = makeEnv(db, { ZALO_ACCESS_TOKEN: 'token' });

      await notifyOrderStatus(env, 'ORD_MISSING');

      const { sendZNS } = await import('../../../tree/zalo/zns-sender');
      expect(sendZNS).not.toHaveBeenCalled();
    });

    it('returns early when order has no customer_phone', async() => {
      const orderRow = {
        customer_name: 'Test',
        customer_phone: null,
        total: 50000,
        status: 'ready'
      };

      const db = makeDB([makeChain(orderRow)]);
      const env = makeEnv(db, { ZALO_ACCESS_TOKEN: 'token' });

      await notifyOrderStatus(env, 'ORD_NOPHONE');

      const { sendZNS } = await import('../../../tree/zalo/zns-sender');
      expect(sendZNS).not.toHaveBeenCalled();
    });

    it('sends ZNS only (no SMS credentials)', async() => {
      const orderRow = {
        customer_name: 'Test User',
        customer_phone: '0909123456',
        total: 100000,
        status: 'preparing'
      };

      const db = makeDB([makeChain(orderRow)]);
      const env = makeEnv(db, { ZALO_ACCESS_TOKEN: 'zalo-token' }); // no SPEEDSMS creds

      await notifyOrderStatus(env, 'ORD_ZNS_ONLY');

      const { sendZNS } = await import('../../../tree/zalo/zns-sender');
      const { sendSMS } = await import('../../../lib/speedsms-client');

      expect(sendZNS).toHaveBeenCalledTimes(1);
      expect(sendSMS).not.toHaveBeenCalled();
    });

    it('sends SMS only (no ZALO_ACCESS_TOKEN)', async() => {
      const orderRow = {
        customer_name: 'Test User',
        customer_phone: '0909123456',
        total: 80000,
        status: 'ready'
      };

      const db = makeDB([makeChain(orderRow)]);
      const env = makeEnv(db, {
        SPEEDSMS_API_KEY: 'sms-key',
        SPEEDSMS_API_SECRET: 'sms-secret'
      }); // no ZALO token

      await notifyOrderStatus(env, 'ORD_SMS_ONLY');

      const { sendZNS } = await import('../../../tree/zalo/zns-sender');
      const { sendSMS } = await import('../../../lib/speedsms-client');

      expect(sendZNS).not.toHaveBeenCalled();
      expect(sendSMS).toHaveBeenCalledTimes(1);
      const smsCall = (sendSMS as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(smsCall[1].message).toContain('da san sang');
    });

    it('defaults customer name to "Khach hang" when null', async() => {
      const orderRow = {
        customer_name: null,
        customer_phone: '0909123456',
        total: 50000,
        status: 'confirmed'
      };

      const db = makeDB([makeChain(orderRow)]);
      const env = makeEnv(db, {
        ZALO_ACCESS_TOKEN: 'token',
        SPEEDSMS_API_KEY: 'k',
        SPEEDSMS_API_SECRET: 's'
      });

      await notifyOrderStatus(env, 'ORD_NONAME');

      const { sendZNS } = await import('../../../tree/zalo/zns-sender');
      const znsCall = (sendZNS as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(znsCall[1].data.name).toBe('Khach hang');
    });

    it('handles DB query error gracefully (no throw)', async() => {
      const db = makeDB([]);
      db.prepare = vi.fn(() => {
        throw new Error('D1 connection lost');
      }) as never;
      const env = makeEnv(db, { ZALO_ACCESS_TOKEN: 'token' });

      // Should not throw — caught internally
      await expect(notifyOrderStatus(env, 'ORD_001')).resolves.toBeUndefined();
    });

    it('formats total with locale (vi-VN)', async() => {
      const orderRow = {
        customer_name: 'Test',
        customer_phone: '0909123456',
        total: 150000,
        status: 'served'
      };

      const db = makeDB([makeChain(orderRow)]);
      const env = makeEnv(db, {
        ZALO_ACCESS_TOKEN: 'token',
        SPEEDSMS_API_KEY: 'k',
        SPEEDSMS_API_SECRET: 's'
      });

      await notifyOrderStatus(env, 'ORD_TOTAL');

      const { sendZNS } = await import('../../../tree/zalo/zns-sender');
      const znsCall = (sendZNS as ReturnType<typeof vi.fn>).mock.calls[0];
      // VND formatting with locale vi-VN adds grouping
      expect(znsCall[1].data.amount).toBe(150000);
    });

    it('handles the "served" status with correct ZNS label', async() => {
      const orderRow = {
        customer_name: 'Test',
        customer_phone: '0909123456',
        total: 50000,
        status: 'served'
      };

      const db = makeDB([makeChain(orderRow)]);
      const env = makeEnv(db, { ZALO_ACCESS_TOKEN: 'token' });

      await notifyOrderStatus(env, 'ORD_SERVED');

      const { sendZNS } = await import('../../../tree/zalo/zns-sender');
      const znsCall = (sendZNS as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(znsCall[1].data.status).toBe('da phuc vu');
    });

    it('falls back to raw status when not in STATUS_LABELS', async() => {
      const orderRow = {
        customer_name: 'Test',
        customer_phone: '0909123456',
        total: 100000,
        status: 'custom_status'
      };

      const db = makeDB([makeChain(orderRow)]);
      const env = makeEnv(db, { ZALO_ACCESS_TOKEN: 'token' });

      await notifyOrderStatus(env, 'ORD_CUSTOM');

      const { sendZNS } = await import('../../../tree/zalo/zns-sender');
      const znsCall = (sendZNS as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(znsCall[1].data.status).toBe('custom_status');
    });
  });
});
