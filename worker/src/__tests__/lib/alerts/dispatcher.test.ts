/**
 * Unit tests for modular alert dispatcher (env-based dispatchAlerts / dispatchDigest).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dispatchAlerts } from '../../../lib/alerts/dispatcher';
import { dispatchDigest } from '../../../lib/alerts/digest';
import type { Env } from '../../../types/env';

function createMockDb(overrides: Record<string, any> = {}) {
  const firstFn = vi.fn().mockResolvedValue(null);
  const allFn = vi.fn().mockResolvedValue({ results: [] });
  const runFn = vi.fn().mockResolvedValue({ meta: { changes: 1, last_row_id: 1 } });
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({ run: runFn, first: firstFn, all: allFn }),
      first: firstFn,
      all: allFn,
      run: runFn
    }),
    _first: firstFn,
    _all: allFn,
    _run: runFn,
    ...overrides
  } as any;
}

function createEnv(db: any, overrides: Partial<Env> = {}): Env {
  return {
    AURA_DB: db,
    TELEGRAM_BOT_TOKEN: 'test-token',
    TELEGRAM_CHAT_ID: 'test-chat',
    ...overrides
  } as Env;
}

describe('modular alert dispatcher', () => {
  let fetchMock: any;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('dispatchAlerts (env-based)', () => {
    it('skips silently when Telegram is not configured', async() => {
      const db = createMockDb();
      const env = createEnv(db, { TELEGRAM_BOT_TOKEN: undefined });
      const result = await dispatchAlerts(env);
      expect(result).toEqual({ dispatched: 0 });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns 0 when no undelivered alerts exist', async() => {
      const db = createMockDb();
      db._all.mockResolvedValue({ results: [] });
      const result = await dispatchAlerts(createEnv(db));
      expect(result).toEqual({ dispatched: 0 });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends alert and marks dispatched on success', async() => {
      const db = createMockDb();
      db._all.mockResolvedValue({
        results: [
          {
            id: 1,
            alert_key: 'order_stuck',
            message: 'Order stuck',
            severity: 'critical',
            created_at: '2024-01-15T10:00:00Z'
          }
        ]
      });
      const result = await dispatchAlerts(createEnv(db));
      expect(result).toEqual({ dispatched: 1 });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(db._run).toHaveBeenCalled();
    });

    it('does not mark dispatched when Telegram send fails', async() => {
      fetchMock.mockResolvedValue({ ok: false });
      const db = createMockDb();
      db._all.mockResolvedValue({
        results: [
          {
            id: 1,
            alert_key: 'order_stuck',
            message: 'Order stuck',
            severity: 'critical',
            created_at: '2024-01-15T10:00:00Z'
          }
        ]
      });
      const result = await dispatchAlerts(createEnv(db));
      expect(result).toEqual({ dispatched: 0 });
      expect(db._run).not.toHaveBeenCalled();
    });

    it('returns 0 and logs on DB error', async() => {
      const db = createMockDb();
      db.prepare.mockImplementation(() => {
        throw new Error('DB down');
      });
      const result = await dispatchAlerts(createEnv(db));
      expect(result).toEqual({ dispatched: 0 });
    });

    it('handles multiple alerts in one pass', async() => {
      const db = createMockDb();
      db._all.mockResolvedValue({
        results: [
          { id: 1, alert_key: 'a', message: 'A', severity: 'info', created_at: 'x' },
          { id: 2, alert_key: 'b', message: 'B', severity: 'warning', created_at: 'y' }
        ]
      });
      const result = await dispatchAlerts(createEnv(db));
      expect(result).toEqual({ dispatched: 2 });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('dispatchDigest (env-based)', () => {
    it('does nothing when Telegram is not configured', async() => {
      const db = createMockDb();
      await dispatchDigest(createEnv(db, { TELEGRAM_CHAT_ID: undefined }));
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends digest with 24h stats', async() => {
      const db = createMockDb();
      db._first
        .mockResolvedValueOnce({ c: 42 })
        .mockResolvedValueOnce({ s: 5000000 })
        .mockResolvedValueOnce({ c: 3 })
        .mockResolvedValueOnce({ c: 1000 });
      await dispatchDigest(createEnv(db));
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(body.text).toContain('AURA CAFE Daily Digest');
      expect(body.text).toContain('42');
    });

    it('swallows DB errors without throwing', async() => {
      const db = createMockDb();
      db.prepare.mockImplementation(() => {
        throw new Error('DB down');
      });
      await expect(dispatchDigest(createEnv(db))).resolves.toBeUndefined();
    });
  });
});