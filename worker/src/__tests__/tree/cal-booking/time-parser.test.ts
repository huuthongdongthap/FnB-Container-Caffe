import { describe, it, expect } from 'vitest';
import { parseBookingTime } from '../../../tree/cal-booking/time-parser.js';
describe('Cal Booking: time parser', () => {
  it('parseBookingTime extracts date and time from ISO startTime', () => {
    const r = parseBookingTime('2026-07-10T14:30:00+07:00');
    expect(r.date).toBe('2026-07-10');
    expect(r.time).toBe('14:30');
  });
  it('parseBookingTime handles midnight edge', () => {
    const r = parseBookingTime('2026-07-10T00:00:00Z');
    expect(r.time).toBe('00:00');
  });
  it('parseBookingTime handles end-of-day', () => {
    const r = parseBookingTime('2026-12-31T23:59:59+07:00');
    expect(r.date).toBe('2026-12-31');
    expect(r.time).toBe('23:59');
  });
});
