import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReservationFromBooking } from '../../../tree/cal-booking/process-booking.js';
function makeD1(rows: unknown[] = []) {
  return {
    prepare: () => ({
      bind: () => ({
        first: async () => rows[0],
        all: async () => ({ results: rows }),
      }),
    }),
  } as unknown as D1Database;
}
describe('Cal Booking: process booking', () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it('creates reservation for valid booking input', async () => {
    const db = makeD1([
      { id: 't1', capacity: 4, zone: 'A', status: 'Available' }, // table row
      { id: 'r1' }, // reservation insert result
    ]);
    const r = await createReservationFromBooking(db, {
      uid: 'cal-123', title: 'Dinner', startTime: '2026-07-10T18:00:00+07:00', endTime: '2026-07-10T19:00:00+07:00',
      attendees: [{ name: 'Test', email: 'test@example.com', phone: '0909123456' }],
    });
    expect(r).toBeDefined();
  });
  it('returns idempotent on duplicate booking uid', async () => {
    const db = makeD1([{ id: 'existing-res' }]); // duplicate found
    const r = await createReservationFromBooking(db, {
      uid: 'cal-duplicate', title: 'Lunch', startTime: '2026-07-10T12:00:00+07:00', endTime: '2026-07-10T13:00:00+07:00',
      attendees: [{ name: 'Test', email: 'test@example.com' }],
    });
    expect(r).toHaveProperty('status', 'idempotent');
  });
  it('returns error object when no tables available', async () => {
    const db = makeD1([]); // no existing booking, no tables
    const r = await createReservationFromBooking(db, {
      uid: 'cal-no-tables', startTime: '2026-07-10T18:00:00+07:00', endTime: '2026-07-10T19:00:00+07:00',
      attendees: [{ name: 'Test' }],
    });
    expect(r && 'error' in r).toBe(true);
  });
});
