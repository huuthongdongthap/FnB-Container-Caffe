// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { reservationsRouter } from '@aura/domain-reservation/src/routes/reservations';
import { tablesRouter } from '@aura/domain-table/commands/tables';
import { releaseTableIfNoActiveOrders } from '@aura/domain-order/policies/table-occupancy-release';
import { floorPlanRouter } from '../../routes/floor-plan';
import { mockStaffToken } from '../test-utils';
import { orderCreationFixture } from './order-creation-fixture';

function createStaffApp() {
  const { sqlite, env } = orderCreationFixture();
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS reservation_waitlist (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      guest_count INTEGER DEFAULT 2,
      preferred_date TEXT,
      preferred_time TEXT,
      zone TEXT DEFAULT 'Indoor',
      notes TEXT,
      status TEXT DEFAULT 'waiting',
      assigned_table_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const app = new Hono<{ Bindings: typeof env; Variables: Record<string, unknown> }>();
  app.use('*', async (c, next) => {
    c.set('tenantId', 'cafe-a');
    c.set('user', { id: 'staff-1', role: 'manager', tenant_id: 'cafe-a' });
    await next();
  });
  app.route('/api/reservations', reservationsRouter as never);
  app.route('/api/tables', tablesRouter as never);
  app.route('/api/floor-plan', floorPlanRouter as never);
  app.get('/api/tables/zones', (c) => c.json({ success: true, data: ['Indoor', 'Outdoor'] }));

  return { app, sqlite, env };
}

describe('Table & Reservation lifecycle regressions (#178, #181)', () => {
  it('filters GET /api/tables?status=occupied case-insensitively and does not shadow /zones', async () => {
    const { app, sqlite, env } = createStaffApp();
    try {
      sqlite.exec("UPDATE cafe_tables SET status = 'Occupied' WHERE id = 'table-a'");

      const res = await app.request('/api/tables?status=occupied', {}, env);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { success: boolean; data: Array<{ id: string; status: string }> };
      expect(body.success).toBe(true);
      expect(body.data.some((t) => t.id === 'table-a')).toBe(true);

      const zonesRes = await app.request('/api/tables/zones', {}, env);
      expect(zonesRes.status).toBe(200);
    } finally {
      sqlite.close();
    }
  });

  it('does not mark table Reserved for future-date booking, and marks Occupied + creates session on seat', async () => {
    const { app, sqlite, env } = createStaffApp();
    try {
      const futureDate = '2099-12-31';
      const createRes = await app.request(
        '/api/reservations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: 'Future Guest',
            customer_phone: '0901234567',
            date: futureDate,
            time: '19:00',
            guest_count: 2,
            table_id: 'table-a',
          }),
        },
        env,
      );
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { success: boolean; data: { id: string } };
      expect(created.success).toBe(true);

      const tableAfterCreate = sqlite
        .prepare("SELECT status FROM cafe_tables WHERE id = 'table-a'")
        .get() as { status: string };
      expect(tableAfterCreate.status).toBe('Available');

      const seatRes = await app.request(
        `/api/reservations/${created.data.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'seated' }),
        },
        env,
      );
      expect(seatRes.status).toBe(200);

      const tableAfterSeat = sqlite
        .prepare("SELECT status, current_session_id FROM cafe_tables WHERE id = 'table-a'")
        .get() as { status: string; current_session_id: string | null };
      expect(tableAfterSeat.status).toBe('Occupied');
      expect(tableAfterSeat.current_session_id).toBeTruthy();

      const sessionRow = sqlite
        .prepare('SELECT id, status FROM table_sessions WHERE id = ?')
        .get(tableAfterSeat.current_session_id) as { id: string; status: string } | undefined;
      expect(sessionRow?.id).toBe(tableAfterSeat.current_session_id);
      expect(['active', 'open']).toContain(sessionRow?.status);
    } finally {
      sqlite.close();
    }
  });

  it('rejects invalid reservation status transitions with 400 and writes rejected on /reject', async () => {
    const { app, sqlite, env } = createStaffApp();
    try {
      const createRes = await app.request(
        '/api/reservations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: 'Reject Guest',
            customer_phone: '0901234568',
            date: '2099-12-31',
            time: '20:00',
            guest_count: 2,
            table_id: 'table-a',
          }),
        },
        env,
      );
      const created = (await createRes.json()) as { data: { id: string } };

      const badStatus = await app.request(
        `/api/reservations/${created.data.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'invalid_state' }),
        },
        env,
      );
      expect(badStatus.status).toBe(400);

      const rejectRes = await app.request(
        `/api/reservations/${created.data.id}/reject`,
        { method: 'PATCH' },
        env,
      );
      expect(rejectRes.status).toBe(200);
      const row = sqlite
        .prepare('SELECT status FROM reservations WHERE id = ?')
        .get(created.data.id) as { status: string };
      expect(row.status).toBe('rejected');
    } finally {
      sqlite.close();
    }
  });

  it('blocks setting table to Reserved when an unpaid active order exists and releases Overdue tables when clear', async () => {
    const { app, sqlite, env } = createStaffApp();
    try {
      sqlite.exec(`
        UPDATE cafe_tables SET status = 'Occupied' WHERE id = 'table-a';
        INSERT INTO orders (id, table_id, items, total, customer_name, customer_phone, payment_method, status, payment_status, tenant_id)
        VALUES ('ord-unpaid', 'table-a', '[]', 50000, 'Guest', '0900000011', 'cod', 'preparing', 'unpaid', 'cafe-a');
      `);

      const reserveRes = await app.request(
        '/api/tables/table-a/status',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Reserved' }),
        },
        env,
      );
      expect(reserveRes.status).toBe(409);

      sqlite.exec("UPDATE orders SET status = 'completed', payment_status = 'paid' WHERE id = 'ord-unpaid'");
      sqlite.exec("UPDATE cafe_tables SET status = 'Overdue', current_session_id = 'stale-session-id' WHERE id = 'table-a'");

      const released = await releaseTableIfNoActiveOrders(env.AURA_DB, 'A1', 'cafe-a');
      expect(released).toBe(true);
      const tableAfter = sqlite
        .prepare("SELECT status, current_session_id FROM cafe_tables WHERE id = 'table-a'")
        .get() as { status: string; current_session_id: string | null };
      expect(tableAfter.status).toBe('Available');
      expect(tableAfter.current_session_id).toBeNull();
    } finally {
      sqlite.close();
    }
  });

  it('closes owned table_sessions and releases table on seat -> complete, but keeps Occupied if unpaid order exists', async () => {
    const { app, sqlite, env } = createStaffApp();
    const todayVN = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    try {
      const createRes = await app.request(
        '/api/reservations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: 'Seated Guest',
            customer_phone: '0901234568',
            date: todayVN,
            time: '23:59',
            guest_count: 2,
            table_id: 'table-a',
          }),
        },
        env,
      );
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { data: { id: string } };

      const seatRes = await app.request(
        `/api/reservations/${created.data.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'seated' }),
        },
        env,
      );
      expect(seatRes.status).toBe(200);

      const seatedTable = sqlite
        .prepare("SELECT status, current_session_id FROM cafe_tables WHERE id = 'table-a'")
        .get() as { status: string; current_session_id: string | null };
      expect(seatedTable.status).toBe('Occupied');
      expect(seatedTable.current_session_id).toBeTruthy();

      const ownedSession = sqlite
        .prepare('SELECT notes FROM table_sessions WHERE id = ?')
        .get(seatedTable.current_session_id) as { notes: string | null };
      expect(ownedSession.notes).toBe(`reservation:${created.data.id}`);

      // Complete without unpaid orders -> session closes and table releases
      const completeRes = await app.request(
        `/api/reservations/${created.data.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        },
        env,
      );
      expect(completeRes.status).toBe(200);

      const releasedTable = sqlite
        .prepare("SELECT status, current_session_id FROM cafe_tables WHERE id = 'table-a'")
        .get() as { status: string; current_session_id: string | null };
      expect(releasedTable.status).toBe('Available');
      expect(releasedTable.current_session_id).toBeNull();

      const closedSession = sqlite
        .prepare('SELECT status, closed_at FROM table_sessions WHERE id = ?')
        .get(seatedTable.current_session_id) as { status: string; closed_at: string | null };
      expect(closedSession.status).toBe('completed');
      expect(closedSession.closed_at).toBeTruthy();

      // Now verify table stays Occupied if an unpaid active order exists
      const createRes2 = await app.request(
        '/api/reservations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: 'Unpaid Guest',
            customer_phone: '0901234569',
            date: todayVN,
            time: '23:59',
            guest_count: 2,
            table_id: 'table-a',
          }),
        },
        env,
      );
      expect(createRes2.status).toBe(201);
      const created2 = (await createRes2.json()) as { data: { id: string } };

      await app.request(
        `/api/reservations/${created2.data.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'seated' }),
        },
        env,
      );

      sqlite.exec(`
        INSERT INTO orders (id, table_id, items, total, customer_name, customer_phone, payment_method, status, payment_status, tenant_id)
        VALUES ('ord-seated-unpaid', 'table-a', '[]', 75000, 'Unpaid Guest', '0901234569', 'cod', 'preparing', 'unpaid', 'cafe-a');
      `);

      const completeRes2 = await app.request(
        `/api/reservations/${created2.data.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed' }),
        },
        env,
      );
      expect(completeRes2.status).toBe(200);

      const stillOccupiedTable = sqlite
        .prepare("SELECT status FROM cafe_tables WHERE id = 'table-a'")
        .get() as { status: string };
      expect(stillOccupiedTable.status).toBe('Occupied');
    } finally {
      sqlite.close();
    }
  });

  it('creates table_sessions without guest_count column on PATCH /api/tables/:id Occupied transition', async () => {
    const { app, sqlite, env } = createStaffApp();
    try {
      const res = await app.request(
        '/api/tables/table-a',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'Occupied' }),
        },
        env,
      );
      expect(res.status).toBe(200);

      const tbl = sqlite
        .prepare("SELECT status, current_session_id FROM cafe_tables WHERE id = 'table-a'")
        .get() as { status: string; current_session_id: string | null };
      expect(tbl.status).toBe('Occupied');
      expect(tbl.current_session_id).toBeTruthy();

      const sess = sqlite
        .prepare('SELECT id, status, table_id FROM table_sessions WHERE id = ?')
        .get(tbl.current_session_id) as { id: string; status: string; table_id: string } | undefined;
      expect(sess?.id).toBe(tbl.current_session_id);
      expect(sess?.table_id).toBe('table-a');
    } finally {
      sqlite.close();
    }
  });

  it('preserves today walk-in session when cancelling or completing a stale reservation on the same table', async () => {
    const { app, sqlite, env } = createStaffApp();
    const yesterdayVN = new Date(Date.now() + 7 * 3600_000 - 86400_000).toISOString().slice(0, 10);
    try {
      sqlite.exec(`
        INSERT INTO reservations (id, table_id, customer_name, customer_phone, guest_count, date, time, zone, status, tenant_id)
        VALUES ('rsv-stale-seated', 'table-a', 'Old Guest', '0901112233', 2, '${yesterdayVN}', '10:00', 'Indoor', 'seated', 'cafe-a');
        INSERT INTO table_sessions (id, table_id, status, notes, tenant_id, started_at)
        VALUES ('sess-walkin-today', 'table-a', 'active', NULL, 'cafe-a', CURRENT_TIMESTAMP);
        UPDATE cafe_tables SET status = 'Occupied', current_session_id = 'sess-walkin-today' WHERE id = 'table-a';
      `);

      const cancelRes = await app.request(
        '/api/reservations/rsv-stale-seated/cancel',
        { method: 'POST' },
        env,
      );
      expect(cancelRes.status).toBe(200);

      const walkinSess = sqlite
        .prepare("SELECT status FROM table_sessions WHERE id = 'sess-walkin-today'")
        .get() as { status: string };
      expect(walkinSess.status).toBe('active');

      const tbl = sqlite
        .prepare("SELECT status, current_session_id FROM cafe_tables WHERE id = 'table-a'")
        .get() as { status: string; current_session_id: string | null };
      expect(tbl.status).toBe('Occupied');
      expect(tbl.current_session_id).toBe('sess-walkin-today');
    } finally {
      sqlite.close();
    }
  });

  it('allows metadata/party updates on past-time today reservations when date/time are unchanged, rejects moving into past, and returns 409 on slot unique conflict', async () => {
    const { app, sqlite, env } = createStaffApp();
    const todayVN = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
    const yesterdayVN = new Date(Date.now() + 7 * 3600_000 - 86400_000).toISOString().slice(0, 10);
    try {
      sqlite.exec(`
        INSERT INTO reservations (id, table_id, customer_name, customer_phone, guest_count, date, time, zone, status, notes, tenant_id)
        VALUES
          ('rsv-today-past', 'table-a', 'Morning Guest', '0902223344', 2, '${yesterdayVN}', '09:00', 'Indoor', 'confirmed', 'Window', 'cafe-a'),
          ('rsv-slot-taken', 'table-b', 'Taken Guest', '0903334455', 2, '2099-12-31', '18:00', 'Indoor', 'confirmed', NULL, 'cafe-a'),
          ('rsv-slot-edit', 'table-a', 'Edit Guest', '0904445566', 2, '2099-12-31', '18:00', 'Indoor', 'confirmed', NULL, 'cafe-a');
      `);

      // Full-form PATCH with unchanged past date/time succeeds and updates guest_count + notes
      const editNotesRes = await app.request(
        '/api/reservations/rsv-today-past',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: 'Morning Guest',
            customer_phone: '0902223344',
            date: yesterdayVN,
            time: '09:00',
            guest_count: 4,
            notes: 'Quiet corner',
            table_id: 'table-a',
          }),
        },
        env,
      );
      expect(editNotesRes.status).toBe(200);
      const updatedRow = sqlite
        .prepare("SELECT guest_count, notes FROM reservations WHERE id = 'rsv-today-past'")
        .get() as { guest_count: number; notes: string };
      expect(updatedRow.guest_count).toBe(4);
      expect(updatedRow.notes).toBe('Quiet corner');

      // Rescheduling date/time into the past still fails with 400
      const movePastRes = await app.request(
        '/api/reservations/rsv-slot-edit',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: yesterdayVN,
            time: '09:00',
          }),
        },
        env,
      );
      expect(movePastRes.status).toBe(400);

      // Concurrent/direct SQLite UNIQUE constraint violation during UPDATE returns 409 instead of falling through
      sqlite.exec(`
        DROP TRIGGER IF EXISTS block_rsv_slot_update;
        CREATE TRIGGER block_rsv_slot_update
        BEFORE UPDATE OF time ON reservations
        WHEN NEW.id = 'rsv-slot-edit' AND NEW.time = '20:00'
        BEGIN
          SELECT RAISE(ABORT, 'UNIQUE constraint failed: idx_reservations_active_slot');
        END;
      `);
      const uniqueConflictRes = await app.request(
        '/api/reservations/rsv-slot-edit',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: todayVN < '2099-12-31' ? '2099-12-31' : todayVN,
            time: '20:00',
            guest_count: 3,
          }),
        },
        env,
      );
      expect(uniqueConflictRes.status).toBe(409);
      const conflictBody = (await uniqueConflictRes.json()) as { code?: string };
      expect(conflictBody.code).toBe('TABLE_SLOT_ALREADY_BOOKED');

      // Confirm fields were not partially overwritten
      const unchangedRow = sqlite
        .prepare("SELECT guest_count, time FROM reservations WHERE id = 'rsv-slot-edit'")
        .get() as { guest_count: number; time: string };
      expect(unchangedRow.guest_count).toBe(2);
      expect(unchangedRow.time).toBe('18:00');
    } finally {
      sqlite.close();
    }
  });

  it('POST /api/floor-plan/:id/no-show marks only the due/targeted booking no_show and leaves later bookings confirmed', async () => {
    const { app, sqlite, env } = createStaffApp();
    const vnNow = new Date(Date.now() + 7 * 3600_000);
    const todayVN = vnNow.toISOString().slice(0, 10);
    const tomorrowVN = new Date(Date.now() + 7 * 3600_000 + 86400_000).toISOString().slice(0, 10);
    const nowMin = vnNow.getUTCHours() * 60 + vnNow.getUTCMinutes();
    try {
      sqlite.exec(`
        INSERT OR IGNORE INTO users (id, name, role, tenant_id, is_active, auth_version, password_hash)
        VALUES ('staff-1', 'Manager', 'manager', 'cafe-a', 1, 1, 'hash');
        UPDATE cafe_tables SET status = 'Reserved' WHERE id = 'table-a';
        INSERT INTO reservations (id, table_id, customer_name, customer_phone, guest_count, date, time, zone, status, tenant_id)
        VALUES
          ('rsv-due', 'table-a', 'Due Guest', '0901111111', 2, '${todayVN}', '00:00', 'Indoor', 'confirmed', 'cafe-a'),
          ('rsv-tomorrow', 'table-a', 'Tomorrow Guest', '0902222222', 2, '${tomorrowVN}', '19:00', 'Indoor', 'confirmed', 'cafe-a');
      `);
      if (nowMin < 22 * 60) {
        sqlite.exec(`
          INSERT INTO reservations (id, table_id, customer_name, customer_phone, guest_count, date, time, zone, status, tenant_id)
          VALUES ('rsv-later-today', 'table-a', 'Evening Guest', '0903333333', 2, '${todayVN}', '23:59', 'Indoor', 'confirmed', 'cafe-a');
        `);
      }

      const token = await mockStaffToken({ id: 'staff-1', role: 'manager', tenantId: 'cafe-a' });
      const noShowRes = await app.request(
        '/api/floor-plan/table-a/no-show',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ timeout_minutes: 15 }),
        },
        env,
      );
      expect(noShowRes.status).toBe(200);

      const dueRow = sqlite.prepare("SELECT status FROM reservations WHERE id = 'rsv-due'").get() as { status: string };
      const tomorrowRow = sqlite.prepare("SELECT status FROM reservations WHERE id = 'rsv-tomorrow'").get() as { status: string };
      expect(dueRow.status).toBe('no_show');
      expect(tomorrowRow.status).toBe('confirmed');

      if (nowMin < 22 * 60) {
        const laterTodayRow = sqlite
          .prepare("SELECT status FROM reservations WHERE id = 'rsv-later-today'")
          .get() as { status: string };
        expect(laterTodayRow.status).toBe('confirmed');
      }

      // Explicit reservation_id targets only that single reservation
      sqlite.exec(`
        INSERT INTO reservations (id, table_id, customer_name, customer_phone, guest_count, date, time, zone, status, tenant_id)
        VALUES ('rsv-targeted', 'table-a', 'Targeted Guest', '0904444444', 2, '${tomorrowVN}', '18:00', 'Indoor', 'confirmed', 'cafe-a');
      `);
      const targetedRes = await app.request(
        '/api/floor-plan/table-a/no-show',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ timeout_minutes: 15, reservation_id: 'rsv-targeted' }),
        },
        env,
      );
      expect(targetedRes.status).toBe(200);

      const targetedRow = sqlite.prepare("SELECT status FROM reservations WHERE id = 'rsv-targeted'").get() as { status: string };
      const tomorrowAfter = sqlite.prepare("SELECT status FROM reservations WHERE id = 'rsv-tomorrow'").get() as { status: string };
      expect(targetedRow.status).toBe('no_show');
      expect(tomorrowAfter.status).toBe('confirmed');
    } finally {
      sqlite.close();
    }
  });
});
