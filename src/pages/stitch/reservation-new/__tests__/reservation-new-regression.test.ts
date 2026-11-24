import { describe, it, expect } from 'vitest';
import { parseGuestCount, parseDateToISO } from '../index';

describe('Reservation parsing regressions (#180)', () => {
  it('parses guest counts including 8+ and localized labels without NaN', () => {
    expect(parseGuestCount('2')).toBe(2);
    expect(parseGuestCount('8+')).toBe(8);
    expect(parseGuestCount('4 người')).toBe(4);
    expect(parseGuestCount('3 - 4 khách')).toBe(4);
    expect(parseGuestCount('5 - 8 khách')).toBe(8);
    expect(parseGuestCount('Nhóm 10+')).toBe(10);
    expect(parseGuestCount('invalid')).toBe(2);
  });

  it('parses ISO and DD/MM/YYYY dates to YYYY-MM-DD', () => {
    expect(parseDateToISO('2026-12-01')).toBe('2026-12-01');
    expect(parseDateToISO('15/11/2026')).toBe('2026-11-15');
    expect(parseDateToISO('15/11/2027')).toBe('2027-11-15');
    expect(parseDateToISO('5/3/2026')).toBe('2026-03-05');
    // Dec 31 -> 02/01 year rollover (VN time)
    const dec31Ms = Date.UTC(2026, 11, 31, 5, 0, 0);
    expect(parseDateToISO('02/01', dec31Ms)).toBe('2027-01-02');
  });
});
