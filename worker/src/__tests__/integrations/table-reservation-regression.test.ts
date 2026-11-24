// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { reservationsRouter } from '@aura/domain-reservation/src/routes/reservations';
import { tablesRouter } from '@aura/domain-table/commands/tables';
import { releaseTableIfNoActiveOrders } from '@aura/domain-order/policies/table-occupancy-release';
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
      sqlite.exec("UPDATE cafe_tables SET status = 'Overdue' WHERE id = 'table-a'");

      const released = await releaseTableIfNoActiveOrders(env.AURA_DB, 'A1', 'cafe-a');
      expect(released).toBe(true);
      const tableAfter = sqlite
        .prepare("SELECT status FROM cafe_tables WHERE id = 'table-a'")
        .get() as { status: string };
      expect(tableAfter.status).toBe('Available');
    } finally {
      sqlite.close();
    }
  });

  it('closes table_sessions and releases table on seat -> complete, but keeps Occupied if unpaid order exists', async () => {
    const { app, sqlite, env } = createStaffApp();
    try {
      const createRes = await app.request(
        '/api/reservations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_name: 'Seated Guest',
            customer_phone: '0901234568',
            date: '2099-12-31',
            time: '19:00',
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
            date: '2099-12-31',
            time: '21:00',
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
});
