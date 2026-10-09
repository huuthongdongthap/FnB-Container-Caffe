/**
 * Canonical Table & Reservation Contract Integration Tests
 * Flow: TABLE → RESERVATION → SEATING → ORDER → CHECKOUT → TABLE RELEASE
 * Invariants: Availability, overlap prevention, seating, order-table integrity, release (< 200 LOC).
 */
import { describe, it, expect } from 'vitest';
import {
  checkTableAvailability,
  createCanonicalReservation,
  updateReservationStatus,
  seatTable,
  releaseTable,
  validateOrderTable,
} from '@aura/domain-table';

describe('Table / Reservation Contract', () => {
  function createMockDb() {
    const cafe_tables = [
      { id: 'tbl_01', table_number: 1, capacity: 4, zone: 'Indoor', status: 'Available' },
      { id: 'tbl_02', table_number: 2, capacity: 2, zone: 'Outdoor', status: 'Occupied' },
      { id: 'tbl_03', table_number: 3, capacity: 6, zone: 'VIP', status: 'Available' },
    ];
    const reservations: any[] = [];

    const db = {
      cafe_tables,
      reservations,
      prepare: (sql: string) => {
        let binds: unknown[] = [];
        const stmt = {
          bind: (...args: unknown[]) => { binds = args; return stmt; },
          first: async <T = unknown>() => {
            if (sql.includes('cafe_tables') && (sql.includes('WHERE id = ?') || sql.includes('WHERE table_number = ?'))) {
              return (cafe_tables.find(t => t.id === binds[0] || String(t.table_number) === String(binds[0])) || null) as T;
            }
            if (sql.includes('reservations') && sql.includes('date = ?') && sql.includes('time = ?')) {
              return (reservations.find(r => (r.table_id === binds[0] || r.table_id === binds[1]) && r.date === binds[2] && r.time === binds[3] && ['confirmed', 'pending', 'seated'].includes(r.status)) || null) as T;
            }
            if (sql.includes('reservations') && sql.includes('WHERE id = ?')) {
              return (reservations.find(r => r.id === binds[0]) || null) as T;
            }
            return null as T;
          },
          all: async <T = unknown>() => {
            if (sql.includes('FROM cafe_tables')) {
              let res = [...cafe_tables];
              if (sql.includes('zone = ?')) res = res.filter(t => t.zone === binds[0]);
              return { results: res as unknown as T[] };
            }
            if (sql.includes('FROM reservations')) {
              const res = reservations.filter(r => r.date === binds[0] && ['confirmed', 'pending', 'seated'].includes(r.status));
              return { results: res as unknown as T[] };
            }
            return { results: [] as unknown as T[] };
          },
          run: async () => {
            if (sql.includes('INSERT INTO reservations')) {
              reservations.push({
                id: binds[0], table_id: binds[1], customer_name: binds[2], customer_phone: binds[3],
                guest_count: binds[4], date: binds[5], time: binds[6], zone: binds[7], status: binds[8],
                notes: binds[9], created_at: binds[10], updated_at: binds[11],
              });
            } else if (sql.includes('cafe_tables') && sql.includes("status = 'Occupied'")) {
              const t = cafe_tables.find(item => item.id === binds[1]);
              if (t) { t.status = 'Occupied'; }
            } else if (sql.includes('cafe_tables') && sql.includes("status = 'Available'")) {
              const t = cafe_tables.find(item => item.id === binds[1]);
              if (t) { t.status = 'Available'; }
            } else if (sql.includes('reservations') && sql.includes('status = ?')) {
              const r = reservations.find(item => item.id === binds[binds.length - 1]);
              if (r) { r.status = binds[0] as any; }
            }
            return { success: true };
          },
        };
        return stmt as any;
      },
    };
    return db;
  }

  it('1. table availability: queries available tables excluding occupied ones', async () => {
    const db = createMockDb();
    const res = await checkTableAvailability(db as any, { date: '2026-10-15', time: '18:00' });
    expect(res.ok).toBe(true);
    expect(res.tables.find(t => t.id === 'tbl_01')?.available).toBe(true);
    expect(res.tables.find(t => t.id === 'tbl_02')?.available).toBe(false); // Occupied
  });

  it('2. reservation create: creates valid confirmed reservation for available table', async () => {
    const db = createMockDb();
    const res = await createCanonicalReservation(db as any, {
      tableId: 'tbl_01', customerName: 'Anh Long', customerPhone: '0901234567',
      date: '2026-10-15', time: '18:30', guestCount: 4, zone: 'Indoor',
    });
    expect(res.ok).toBe(true);
    expect(res.reservation?.status).toBe('confirmed');
    expect(res.reservation?.table_id).toBe('tbl_01');
  });

  it('3. overlapping reservations: strictly rejects duplicate booking for same table and time slot', async () => {
    const db = createMockDb();
    await createCanonicalReservation(db as any, {
      tableId: 'tbl_01', customerName: 'Anh Long', customerPhone: '0901234567',
      date: '2026-10-15', time: '18:30', guestCount: 4,
    });
    const dup = await createCanonicalReservation(db as any, {
      tableId: 'tbl_01', customerName: 'Chị Mai', customerPhone: '0912345678',
      date: '2026-10-15', time: '18:30', guestCount: 2,
    });
    expect(dup.ok).toBe(false);
    expect(dup.error).toBe('overlapping_reservation');
  });

  it('4. guest check-in & seating: marks table Occupied and updates reservation to seated', async () => {
    const db = createMockDb();
    const rsvRes = await createCanonicalReservation(db as any, {
      tableId: 'tbl_01', customerName: 'Anh Long', customerPhone: '0901234567',
      date: '2026-10-15', time: '18:30',
    });
    const seatRes = await seatTable(db as any, { tableId: 'tbl_01', reservationId: rsvRes.reservation!.id });
    expect(seatRes.ok).toBe(true);
    expect(seatRes.table?.status).toBe('Occupied');
    expect(seatRes.reservation?.status).toBe('seated');
    expect(db.cafe_tables[0].status).toBe('Occupied');
  });

  it('5. order-table integrity: validates table exists and rejects invalid table reference', async () => {
    const db = createMockDb();
    const valid = await validateOrderTable(db as any, 'tbl_01');
    expect(valid.ok).toBe(true);
    const invalid = await validateOrderTable(db as any, 'nonexistent_tbl');
    expect(invalid.ok).toBe(false);
    expect(invalid.error).toBe('table_not_found');
  });

  it('6. table release: frees occupied table back to Available upon checkout', async () => {
    const db = createMockDb();
    const releaseRes = await releaseTable(db as any, { tableId: 'tbl_02' });
    expect(releaseRes.ok).toBe(true);
    expect(releaseRes.table?.status).toBe('Available');
    expect(db.cafe_tables[1].status).toBe('Available');
  });

  it('7. idempotent seating & release: repeated release of Available table succeeds gracefully', async () => {
    const db = createMockDb();
    const first = await releaseTable(db as any, { tableId: 'tbl_01' });
    expect(first.ok).toBe(true);
    expect(first.alreadyReleased).toBe(true);
  });

  it('8. reservation cancel: updates reservation status to cancelled', async () => {
    const db = createMockDb();
    const rsvRes = await createCanonicalReservation(db as any, {
      tableId: 'tbl_01', customerName: 'Khách Huỷ', customerPhone: '0909999999',
      date: '2026-10-15', time: '19:00',
    });
    const cancelRes = await updateReservationStatus(db as any, rsvRes.reservation!.id, 'cancelled');
    expect(cancelRes.ok).toBe(true);
    expect(cancelRes.reservation?.status).toBe('cancelled');
    expect(db.reservations[0].status).toBe('cancelled');
  });

  it('9. cross-operating-unit / zone mismatch: rejects reservation for wrong zone', async () => {
    const db = createMockDb();
    const res = await createCanonicalReservation(db as any, {
      tableId: 'tbl_01', customerName: 'Khách VIP', customerPhone: '0908888888',
      date: '2026-10-15', time: '19:00', zone: 'VIP', // tbl_01 is Indoor
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('cross_operating_unit_mismatch');
  });
});
