/**
 * Unit tests for alert-dispatcher.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAlertDispatcher } from '../../lib/alert-dispatcher';

function createMockDb(overrides: Record<string, any> = {}) {
  const firstFn = vi.fn().mockResolvedValue(null);
  const allFn = vi.fn().mockResolvedValue({ results: [] });
  const runFn = vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } });
  // D1 supports both prepare(sql).first() and prepare(sql).bind(...).first()
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: runFn,
        first: firstFn,
        all: allFn,
      }),
      first: firstFn,
      all: allFn,
      run: runFn,
    }),
    _first: firstFn,
    _all: allFn,
    ...overrides,
  } as any;
}

describe('alert-dispatcher', () => {
  let db: ReturnType<typeof createMockDb>;
  let sendTelegram: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    db = createMockDb();
    sendTelegram = vi.fn<(...args: any[]) => Promise<void>>().mockResolvedValue(undefined);
  });

  describe('dispatchAlerts', () => {
    it('returns empty array when no thresholds breached', async () => {
      // All queries return 0 (below threshold)
      db._first.mockResolvedValue({ value: 0 });
      const ad = createAlertDispatcher(db);
      const fired = await ad.dispatchAlerts(sendTelegram as any);
      expect(fired).toEqual([]);
      expect(sendTelegram).not.toHaveBeenCalled();
    });

 it('fires alert when 5xx errors exceed threshold (5)', async () => {

  // Call order for 6 thresholds: each breach triggers 1 extra .first() for cooldown

  // Values: 3 thresholds that do NOT breach (0), then worker_5xx_rate BREACHES (7>=5) + cooldown, rest 0

  const q = [

    { value: 0 }, // order_stuck (0 < 1)

    { value: 0 }, // payment_failure (0 < 1)

    { value: 7 }, // worker_5xx_rate (7 >= 5) BREACHES

    null,         // worker_5xx_rate cooldown: no prior alert

    { value: 0 }, // d1_latency_high (0 < 500)

    { value: 0 }, // failed_login_spike (0 < 10)

    { value: 0 }, // order_volume_anomaly (0 < 3)

  ];

  db._first.mockImplementation(() => Promise.resolve(q.shift()));



  const ad = createAlertDispatcher(db);

  const fired = await ad.dispatchAlerts(sendTelegram as any);

  expect(fired.length).toBeGreaterThan(0);

  expect(fired).toContain('worker_5xx_rate');

  expect(sendTelegram).toHaveBeenCalled();

});

    it('does NOT fire when threshold not breached', async () => {
      db._first.mockResolvedValue({ value: 3 }); // 5xx: 3 < 5 threshold
      const ad = createAlertDispatcher(db);
      const fired = await ad.dispatchAlerts(sendTelegram as any);
      expect(fired).toEqual([]);
      expect(sendTelegram).not.toHaveBeenCalled();
    });

    it('respects cooldown — does NOT fire when recent alert exists', async () => {
      // First query: threshold breached (7 > 5)
      db._first.mockResolvedValueOnce({ value: 7 });
      // Second query (recordAlert cooldown check): recent alert found → returns null
      db._first.mockResolvedValueOnce({ id: 1 });
      // Remaining threshold queries: below threshold
      db._first.mockResolvedValue({ value: 0 });

      const ad = createAlertDispatcher(db);
      const fired = await ad.dispatchAlerts(sendTelegram as any);
      expect(fired).toEqual([]);
      expect(sendTelegram).not.toHaveBeenCalled();
    });

    it('handles DB query errors gracefully', async () => {
      db.prepare.mockImplementation(() => { throw new Error('DB error'); });
      const ad = createAlertDispatcher(db);
      const fired = await ad.dispatchAlerts(sendTelegram as any);
      expect(fired).toEqual([]);
    });

    it('returns empty when DB is null', async () => {
      const ad = createAlertDispatcher(null);
      const fired = await ad.dispatchAlerts(sendTelegram as any);
      expect(fired).toEqual([]);
    });
  });

  describe('dispatchDigest', () => {
    it('sends formatted Telegram message to sendTelegram callback', async () => {
      db._first
        .mockResolvedValueOnce({ c: 42 })   // orders
        .mockResolvedValueOnce({ s: 5000000 }) // revenue
        .mockResolvedValueOnce({ c: 3 })    // errors
        .mockResolvedValueOnce({ c: 1000 }); // total requests

      const ad = createAlertDispatcher(db);
      await ad.dispatchDigest(sendTelegram as any, 'en');
      expect(sendTelegram).toHaveBeenCalledTimes(1);
      const msg = sendTelegram.mock.calls[0][0];
      expect(msg).toContain('AURA CAFE Daily Digest');
      expect(msg).toContain('42'); // order count
    });

    it('does nothing when DB is null', async () => {
      const ad = createAlertDispatcher(null);
      await ad.dispatchDigest(sendTelegram as any);
      expect(sendTelegram).not.toHaveBeenCalled();
    });
  });
});
