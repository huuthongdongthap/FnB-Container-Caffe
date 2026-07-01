/**
 * Unit tests for metrics-collector.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMetricsCollector } from '../../lib/metrics-collector';

function createMockDb() {
  const runFn = vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } });
  const firstFn = vi.fn().mockResolvedValue(null);
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: runFn,
        first: firstFn,
      }),
    }),
    _run: runFn,
    _first: firstFn,
  } as any;
}

describe('metrics-collector', () => {
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => { db = createMockDb(); });

  describe('recordMetric', () => {
    it('calls INSERT into _metrics with correct params', async () => {
      const mc = createMetricsCollector(db);
      await mc.recordMetric('test_metric', 42, { foo: 'bar' });
      expect(db.prepare).toHaveBeenCalled();
      const sql = db.prepare.mock.calls[0][0];
      expect(sql).toContain('INSERT INTO _metrics');
    });

    it('returns without throwing when DB is null', async () => {
      const mc = createMetricsCollector(null);
      await expect(mc.recordMetric('test', 1)).resolves.toBeUndefined();
    });

    it('does not throw when DB write fails', async () => {
      db.prepare.mockReturnValue({
        bind: vi.fn().mockReturnValue({
          run: vi.fn().mockRejectedValue(new Error('DB error')),
        }),
      });
      const mc = createMetricsCollector(db);
      await expect(mc.recordMetric('test', 1)).resolves.toBeUndefined();
    });

    it('defaults value to 1 when not provided', async () => {
      const mc = createMetricsCollector(db);
      await mc.recordMetric('test');
      // The bind call includes the value
      const bindFn = db.prepare().bind as ReturnType<typeof vi.fn>;
      expect(bindFn).toHaveBeenCalled();
      const args = bindFn.mock.calls[0];
      expect(args[1]).toBe(1); // value defaults to 1
    });

    it('records value as provided', async () => {
      const mc = createMetricsCollector(db);
      await mc.recordMetric('revenue', 50000, { provider: 'payos' });
      const bindFn = db.prepare().bind as ReturnType<typeof vi.fn>;
      expect(bindFn.mock.calls[0][1]).toBe(50000);
    });
  });

  describe('recordAlert', () => {
    it('inserts alert when no recent alert exists (cooldown passed)', async () => {
      db._first.mockResolvedValue(null); // no recent alert
      const mc = createMetricsCollector(db);
      const result = await mc.recordAlert('test:alert', 'Test alert', { severity: 'warning', cooldownMinutes: 5 });
      expect(result).toBeTypeOf('number'); // returns alert ID
      expect(db.prepare).toHaveBeenCalledTimes(2); // SELECT + INSERT
    });

    it('returns null when recent alert exists within cooldown', async () => {
      db._first.mockResolvedValue({ id: 1 }); // recent alert found
      const mc = createMetricsCollector(db);
      const result = await mc.recordAlert('test:alert', 'Test alert', { severity: 'warning', cooldownMinutes: 5 });
      expect(result).toBeNull();
      expect(db.prepare).toHaveBeenCalledTimes(1); // only SELECT, no INSERT
    });

    it('returns null when DB is null', async () => {
      const mc = createMetricsCollector(null);
      const result = await mc.recordAlert('key', 'msg');
      expect(result).toBeNull();
    });

    it('defaults severity to warning and cooldown to 30', async () => {
      db._first.mockResolvedValue(null);
      const mc = createMetricsCollector(db);
      await mc.recordAlert('key', 'msg');
      const bindFn = db.prepare().bind as ReturnType<typeof vi.fn>;
      // The INSERT bind call (second prepare)
      const insertCall = bindFn.mock.calls[1]; // second call = INSERT bind args
      expect(insertCall[2]).toBe('warning'); // severity
    });

    it('markAlertDispatched updates dispatched flag to 1', async () => {
      const mc = createMetricsCollector(db);
      await mc.markAlertDispatched(42);
      expect(db.prepare).toHaveBeenCalled();
      const sql = db.prepare.mock.calls[0][0];
      expect(sql).toContain('UPDATE _alerts SET dispatched = 1');
    });
  });

  describe('pruneOldMetrics', () => {
    it('calls DELETE with correct cutoff date', async () => {
      const mc = createMetricsCollector(db);
      const result = await mc.pruneOldMetrics(30);
      expect(db.prepare).toHaveBeenCalled();
      const sql = db.prepare.mock.calls[0][0];
      expect(sql).toContain('DELETE FROM _metrics');
      expect(sql).toContain('created_at < ?');
      expect(result).toBe(1);
    });

    it('returns 0 when DB is null', async () => {
      const mc = createMetricsCollector(null);
      const result = await mc.pruneOldMetrics(30);
      expect(result).toBe(0);
    });

    it('defaults to 30 days retention', async () => {
      const mc = createMetricsCollector(db);
      await mc.pruneOldMetrics();
      const bindFn = db.prepare().bind as ReturnType<typeof vi.fn>;
      const cutoff = bindFn.mock.calls[0][0];
      const date = new Date(cutoff as string);
      const daysAgo = (Date.now() - date.getTime()) / 86400000;
      expect(daysAgo).toBeCloseTo(30, 0);
    });
  });
});
