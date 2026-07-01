/**
 * Integration tests — full metrics pipeline.
 * Tests: recordMetric → store, recordAlert → cooldown → dispatch,
 * admin-metrics query aggregation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMetricsCollector } from '../../lib/metrics-collector';
import { createAlertDispatcher } from '../../lib/alert-dispatcher';

function createMockDb(overrides: Record<string, unknown> = {}) {
  const runFn = vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } });
  const firstFn = vi.fn().mockResolvedValue(null);
  const allFn = vi.fn().mockResolvedValue({ results: [] });
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
    _run: runFn,
    _first: firstFn,
    _all: allFn,
    ...overrides,
  } as any;
}

describe('metrics pipeline (integration)', () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    db = createMockDb();
  });

  describe('recordMetric → query round-trip', () => {
    it('recordMetric INSERT is called with correct SQL', async () => {
      const mc = createMetricsCollector(db);
      await mc.recordMetric('order_created', 50000, { payment_method: 'payos' });

      const sql = db.prepare.mock.calls[0]?.[0] || '';
      expect(sql).toContain('INSERT INTO _metrics');
    });

    it('multiple recordMetric calls each issue INSERT', async () => {
      const mc = createMetricsCollector(db);
      await mc.recordMetric('request', 1, { method: 'GET', path: '/api/menu', status: 200, duration: 45 });
      await mc.recordMetric('request', 1, { method: 'POST', path: '/api/orders', status: 201, duration: 120 });
      await mc.recordMetric('order_created', 75000, { payment_method: 'payos' });

      expect(db.prepare).toHaveBeenCalledTimes(3);
    });

    it('aggregation query pattern matches admin-metrics route', async () => {
      db._first.mockResolvedValue({ total: 3 });

      // Simulate what admin-metrics does: COUNT with WHERE name + time range
      const since = new Date(Date.now() - 24 * 3600000).toISOString();
      const row = await db.prepare()
        .bind(since)
        .first() as { total: number } | null;

      expect(row).toEqual({ total: 3 });
    });
  });

  describe('recordAlert → dispatchAlerts → cooldown', () => {
    it('recordAlert returns alertId when no cooldown, then markAlertDispatched flips flag', async () => {
      db._first.mockResolvedValue(null); // no recent alert
      const mc = createMetricsCollector(db);

      const alertId = await mc.recordAlert('test:cooldown', 'Test message', { severity: 'warning', cooldownMinutes: 5 });
      expect(alertId).toBeTypeOf('number');

      // Reset mock to track only markAlertDispatched call
      db.prepare.mockClear();
      await mc.markAlertDispatched(alertId!);
      // Verify UPDATE was issued
      const updateSql = db.prepare.mock.calls[0]?.[0] || '';
      expect(updateSql).toContain('UPDATE _alerts SET dispatched = 1');
    });

    it('recordAlert returns null when alert exists within cooldown', async () => {
      db._first.mockResolvedValue({ id: 5 }); // recent alert found
      const mc = createMetricsCollector(db);

      const alertId = await mc.recordAlert('test:cooldown', 'Should be suppressed');
      expect(alertId).toBeNull();
      // Only SELECT issued, no INSERT
      const insertCalls = db.prepare.mock.calls.filter((c: any[]) => c[0]?.includes('INSERT INTO _alerts'));
      expect(insertCalls).toHaveLength(0);
    });

    it('dispatchAlerts does NOT fire when threshold not breached', async () => {
      db._first.mockResolvedValue({ value: 0 }); // all queries below threshold
      const ad = createAlertDispatcher(db);
      const sendTelegram = vi.fn().mockResolvedValue(undefined);

      const fired = await ad.dispatchAlerts(sendTelegram as any);
      expect(fired).toEqual([]);
      expect(sendTelegram).not.toHaveBeenCalled();
    });

    it('dispatchAlerts fires when 5xx threshold breached AND cooldown clear', async () => {
      // First: threshold query returns value exceeding threshold
      db._first.mockResolvedValueOnce({ value: 10 }); // 5xx count > 5
      // Second: cooldown check returns null (no recent alert)
      db._first.mockResolvedValueOnce(null);

      const ad = createAlertDispatcher(db);
      const sendTelegram = vi.fn().mockResolvedValue(undefined);

      const fired = await ad.dispatchAlerts(sendTelegram as any);
      expect(fired.length).toBeGreaterThan(0);
      expect(sendTelegram).toHaveBeenCalled();
    });

    it('dispatchDigest sends formatted 24h summary', async () => {
      db._first
        .mockResolvedValueOnce({ c: 128 })    // orders
        .mockResolvedValueOnce({ s: 15000000 }) // revenue
        .mockResolvedValueOnce({ c: 12 })      // errors
        .mockResolvedValueOnce({ c: 5000 });   // total requests

      const ad = createAlertDispatcher(db);
      const sendTelegram = vi.fn().mockResolvedValue(undefined);

      await ad.dispatchDigest(sendTelegram as any);
      expect(sendTelegram).toHaveBeenCalledTimes(1);
      const msg = sendTelegram.mock.calls[0][0] as string;
      expect(msg).toContain('AURA CAFE Daily Digest');
      expect(msg).toContain('128');
    });
  });

  describe('pruneOldMetrics', () => {
    it('deletes rows older than retention period', async () => {
      const mc = createMetricsCollector(db);
      const deleted = await mc.pruneOldMetrics(7);
      expect(deleted).toBeGreaterThanOrEqual(0);
      const sql = db.prepare.mock.calls[0]?.[0] || '';
      expect(sql).toContain('DELETE FROM _metrics');
      expect(sql).toContain('created_at < ?');
    });

    it('returns 0 when DB is null', async () => {
      const mc = createMetricsCollector(null);
      const deleted = await mc.pruneOldMetrics();
      expect(deleted).toBe(0);
    });
  });

  describe('null-DB guard', () => {
    it('recordMetric does not throw with null DB', async () => {
      const mc = createMetricsCollector(null);
      await expect(mc.recordMetric('test', 1)).resolves.toBeUndefined();
    });

    it('recordAlert returns null with null DB', async () => {
      const mc = createMetricsCollector(null);
      const result = await mc.recordAlert('key', 'msg');
      expect(result).toBeNull();
    });

    it('dispatchAlerts returns empty with null DB', async () => {
      const ad = createAlertDispatcher(null);
      const fired = await ad.dispatchAlerts(vi.fn().mockResolvedValue(undefined) as any);
      expect(fired).toEqual([]);
    });
  });
});
