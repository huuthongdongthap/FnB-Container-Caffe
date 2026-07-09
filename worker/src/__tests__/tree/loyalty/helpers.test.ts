import { describe, it, expect, vi } from 'vitest';
import { genId, nowSqlTimestamp, throttle } from '../../../tree/loyalty/helpers';

describe('loyalty helpers', () => {
  describe('genId', () => {
    it('prepends the given prefix', () => {
      expect(genId('test_')).toMatch(/^test_/);
    });
    it('produces unique values', () => {
      expect(genId('u_')).not.toBe(genId('u_'));
    });
    it('returns a string', () => {
      expect(typeof genId('x')).toBe('string');
    });
  });

  describe('nowSqlTimestamp', () => {
    it('returns "YYYY-MM-DD HH:MM:SS" format', () => {
      expect(nowSqlTimestamp()).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });
    it('returns a non-empty string containing today\'s date', () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(nowSqlTimestamp().startsWith(today)).toBe(true);
    });
  });

  describe('throttle', () => {
    function ctx(headerVal: string, kvGet: string = '0') {
      return {
        env: { AUTH_KV: { get: async() => kvGet, put: vi.fn() } },
        req: { header: (_n: string) => headerVal }
      };
    }

    it('returns true when no KV namespace', async() => {
      const c = {
        env: { AUTH_KV: undefined },
        req: { header: () => undefined }
      };
      expect(await throttle(c, 'k', 5, 60)).toBe(true);
    });

    it('skips throttle for localhost IP', async() => {
      const c = ctx('127.0.0.1');
      expect(await throttle(c, 'k', 1, 60)).toBe(true);
    });

    it('allows when under limit', async() => {
      const c = ctx('203.0.113.42', '0');
      expect(await throttle(c, 'k', 5, 60)).toBe(true);
    });

    it('blocks when at limit', async() => {
      const c = ctx('203.0.113.42', '5');
      expect(await throttle(c, 'k', 5, 60)).toBe(false);
    });
  });
});
