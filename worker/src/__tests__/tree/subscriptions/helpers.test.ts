import { describe, it, expect } from 'vitest';
import { generateId, today, nowStr, addMonths } from '../../../tree/subscriptions/helpers';

describe('subscriptions helpers', () => {
  describe('generateId', () => {
    it('prepends the given prefix', () => {
      expect(generateId('sub_')).toMatch(/^sub_/);
    });

    it('respects custom length', () => {
      const id = generateId('x', 4);
      expect(id.startsWith('x')).toBe(true);
      expect(id.length).toBeGreaterThanOrEqual(4);
    });

    it('produces unique values', () => {
      expect(generateId('p')).not.toBe(generateId('p'));
    });

    it('defaults length to 8 when not provided', () => {
      const id = generateId('inv_');
      expect(id.startsWith('inv_')).toBe(true);
      expect(id.length).toBeGreaterThanOrEqual(8);
    });
  });

  describe('today', () => {
    it('returns a YYYY-MM-DD string', () => {
      const d = today();
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns today\'s date', () => {
      const expected = new Date().toISOString().slice(0, 10);
      expect(today()).toBe(expected);
    });
  });

  describe('nowStr', () => {
    it('returns ISO datetime string', () => {
      const n = nowStr();
      expect(n).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('is within 5 seconds of current time', () => {
      const before = Date.now();
      const n = nowStr();
      const after = Date.now();
      const parsed = new Date(n).getTime();
      expect(parsed).toBeGreaterThanOrEqual(before);
      expect(parsed).toBeLessThanOrEqual(after + 5000);
    });
  });

  describe('addMonths', () => {
    it('adds 1 month to a date', () => {
      expect(addMonths('2026-06-15', 1)).toBe('2026-07-15');
    });

    it('adds 3 months for quarterly', () => {
      expect(addMonths('2026-06-01', 3)).toBe('2026-09-01');
    });

    it('adds 12 months for yearly', () => {
      expect(addMonths('2026-06-15', 12)).toBe('2027-06-15');
    });

    it('returns same date for 0 months', () => {
      expect(addMonths('2026-06-15', 0)).toBe('2026-06-15');
    });

    it('adds via getMonth arithmetic (year rollover)', () => {
      expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    });
  });
});
