import { describe, it, expect } from 'vitest';
import { parseBookingTime } from '../../../tree/cal-booking/time-parser.js';
describe('Cal Booking: time parser (Asia/Ho_Chi_Minh ICT)', () => {
  it('parseBookingTime preserves +07:00 ICT ISO startTime', () => {
    const r = parseBookingTime('2026-07-10T14:30:00+07:00');
    expect(r.date).toBe('2026-07-10');
    expect(r.time).toBe('14:30');
  });
  it('parseBookingTime converts UTC midnight to 07:00 ICT', () => {
    const r = parseBookingTime('2026-07-10T00:00:00Z');
    expect(r.date).toBe('2026-07-10');
    expect(r.time).toBe('07:00');
  });
  it('parseBookingTime rolls UTC evening across midnight into next ICT date', () => {
    const r = parseBookingTime('2026-07-10T18:30:00Z');
    expect(r.date).toBe('2026-07-11');
    expect(r.time).toBe('01:30');
  });
  it('parseBookingTime handles end-of-day in ICT', () => {
    const r = parseBookingTime('2026-12-31T23:59:59+07:00');
    expect(r.date).toBe('2026-12-31');
    expect(r.time).toBe('23:59');
  });
});
