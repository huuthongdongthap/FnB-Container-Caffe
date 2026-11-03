// @vitest-environment node
/**
 * Phase 45 Slice AR2 — Staff Shifts, Schedules, Attendance, Kitchen Stations,
 * Station Tickets & KDS Mobile Security & Invariant Regression Suite
 */
import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Hono } from 'hono';
import { paymentSqliteDB } from './helpers/payment-sqlite-db';
import { createMockEnv, TEST_JWT_SECRET } from './test-utils';
import { issueStaffSession, requireStaffAccount } from '../lib/staff-session';
import { openApiStaffRouter } from '../routes/openapi-staff-handlers/routes';
import { shiftsRouter } from '../../../packages/domain/shift/commands/shifts';
import { kitchenStationsRouter } from '../../../packages/domain/kitchen/commands/kitchen-stations';
import { stationTicketsRouter } from '../../../packages/domain/kitchen/commands/kitchen-station-tickets';
import { getKdsMobile, updateKdsStatus } from '../../../packages/domain/kitchen/commands/kds-mobile';

const databases: ReturnType<typeof paymentSqliteDB>['sqlite'][] = [];
afterEach(() => {
  databases.splice(0).forEach((db) => db.close());
});

function createAr2Fixture(pilotTenantId = 'cafe-a') {
  const { db, sqlite } = paymentSqliteDB();
  databases.push(sqlite);

  const schema = readFileSync(new URL('../../schema.sql', import.meta.url), 'utf8');
  sqlite.exec(schema.match(/CREATE TABLE IF NOT EXISTS staff_shifts \([\s\S]*?\);/)![0]);
  for (const index of schema.matchAll(/CREATE (?:UNIQUE )?INDEX idx_staff_shifts[^;]*;/g)) {
    sqlite.exec(index[0]);
  }

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS kitchen_stations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS category_stations (
      category_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      tenant_id TEXT DEFAULT 'default',
      PRIMARY KEY (category_id, station_id)
    );
    CREATE TABLE IF NOT EXISTS order_item_stations (
      order_item_id TEXT NOT NULL,
      station_id TEXT NOT NULL,
      started_at TEXT,
      ready_at TEXT,
      PRIMARY KEY (order_item_id, station_id)
    );
    CREATE TABLE IF NOT EXISTS cafe_tables (
      id TEXT PRIMARY KEY,
      table_number TEXT,
      tenant_id TEXT DEFAULT 'default'
    );
  `);

  for (const [id, role, tenant] of [
    ['staff', 'staff', 'cafe-a'],
    ['staff-2', 'staff', 'cafe-a'],
    ['barista', 'barista', 'cafe-a'],
    ['kitchen', 'kitchen', 'cafe-a'],
    ['waiter', 'waiter', 'cafe-a'],
    ['cashier', 'cashier', 'cafe-a'],
    ['manager', 'manager', 'cafe-a'],
    ['owner', 'owner', 'cafe-a'],
    ['admin', 'admin', 'cafe-a'],
    ['default-manager', 'manager', 'default'],
    ['default-staff', 'staff', 'default'],
    ['other-staff', 'staff', 'cafe-b'],
    ['other-manager', 'manager', 'cafe-b'],
  ]) {
    sqlite
      .prepare('INSERT INTO users (id, name, role, tenant_id) VALUES (?, ?, ?, ?)')
      .run(id, `User ${id}`, role, tenant);
  }

  const env = createMockEnv({
    AURA_DB: db,
    ENVIRONMENT: 'production',
    PILOT_TENANT_ID: pilotTenantId,
  });

  const token = async (id: string) =>
    (
      await issueStaffSession(
        { JWT_SECRET: TEST_JWT_SECRET },
        await requireStaffAccount(db, id),
        { sessionType: 'staff-web' },
      )
    ).token;

  return { db, sqlite, env, token };
}

describe('Phase 45 Slice AR2 — Shifts, Schedules, Attendance, Kitchen Stations & KDS Security', () => {
  describe('Staff schedules & attendance invariants', () => {
    it('rejects schedule creation and updates when startTime >= endTime', async () => {
      const { env, token } = createAr2Fixture('cafe-a');
      const mgrToken = await token('manager');

      const invertedCreate = await openApiStaffRouter.request(
        '/api/staff/shifts',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            staffId: 'staff',
            date: '2026-11-04',
            startTime: '17:00',
            endTime: '09:00',
          }),
        },
        env,
      );
      expect(invertedCreate.status).toBe(400);

      const equalCreate = await openApiStaffRouter.request(
        '/api/staff/shifts',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            staffId: 'staff',
            date: '2026-11-04',
            startTime: '09:00',
            endTime: '09:00',
          }),
        },
        env,
      );
      expect(equalCreate.status).toBe(400);

      const validCreate = await openApiStaffRouter.request(
        '/api/staff/shifts',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            staffId: 'staff',
            date: '2026-11-04',
            startTime: '09:00',
            endTime: '17:00',
          }),
        },
        env,
      );
      expect(validCreate.status).toBe(201);
      const shiftId = ((await validCreate.json()) as { data: { id: string } }).data.id;

      const invalidPatch = await openApiStaffRouter.request(
        `/api/staff/shifts/${shiftId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startTime: '18:00',
          }),
        },
        env,
      );
      expect(invalidPatch.status).toBe(400);
    });

    it('prevents reviving or modifying a cancelled shift while keeping DELETE idempotent', async () => {
      const { env, token } = createAr2Fixture('cafe-a');
      const mgrToken = await token('manager');

      const createRes = await openApiStaffRouter.request(
        '/api/staff/shifts',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            staffId: 'staff',
            date: '2026-11-05',
            startTime: '08:00',
            endTime: '16:00',
          }),
        },
        env,
      );
      expect(createRes.status).toBe(201);
      const shiftId = ((await createRes.json()) as { data: { id: string } }).data.id;

      const cancelRes = await openApiStaffRouter.request(
        `/api/staff/shifts/${shiftId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${mgrToken}` },
        },
        env,
      );
      expect(cancelRes.status).toBe(200);

      const repeatCancelRes = await openApiStaffRouter.request(
        `/api/staff/shifts/${shiftId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${mgrToken}` },
        },
        env,
      );
      expect(repeatCancelRes.status).toBe(200);

      const reviveRes = await openApiStaffRouter.request(
        `/api/staff/shifts/${shiftId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: 'scheduled',
            notes: 'Attempted revival',
          }),
        },
        env,
      );
      expect(reviveRes.status).toBe(409);
    });

    it('propagates clock-out notes on /clock-out and rejects mismatched staffId + attendanceId on /attendance/check-out', async () => {
      const { env, token } = createAr2Fixture('cafe-a');
      const mgrToken = await token('manager');
      const staffToken = await token('staff');

      const clockInRes = await shiftsRouter.request(
        '/clock-in',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${staffToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ staff_id: 'staff', notes: 'opening setup' }),
        },
        env,
      );
      expect(clockInRes.status).toBe(201);
      const attendanceId = ((await clockInRes.json()) as { data: { id: string } }).data.id;

      // Manager attempts to check out staff's attendance record while passing staffId = staff-2
      const mismatchRes = await openApiStaffRouter.request(
        '/api/staff/attendance/check-out',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            attendanceId,
            staffId: 'staff-2',
            notes: 'wrong staff id',
          }),
        },
        env,
      );
      expect(mismatchRes.status).toBe(409);

      // Legitimate clock-out via shiftsRouter /clock-out preserves and appends notes
      const clockOutRes = await shiftsRouter.request(
        '/clock-out',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${staffToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ staff_id: 'staff', notes: 'cash drawer balanced' }),
        },
        env,
      );
      expect(clockOutRes.status).toBe(200);
      const clockOutData = (await clockOutRes.json()) as { data: { notes: string } };
      expect(clockOutData.data.notes).toBe('opening setup; cash drawer balanced');
    });

    it('matches legacy default-tenant rows with empty tenant_id in staff_shifts while isolating other tenants', async () => {
      const { sqlite, env, token } = createAr2Fixture('default');
      sqlite
        .prepare(
          `INSERT INTO staff_shifts (id, tenant_id, staff_id, staff_name, role, date, shift, start_time, end_time, attendance_state)
           VALUES (901, '', 'default-staff', 'Default Staff', 'staff', '2026-11-03', 'scheduled', '08:00', '16:00', 'scheduled'),
                  (902, 'cafe-b', 'other-staff', 'Other Staff', 'staff', '2026-11-03', 'scheduled', '08:00', '16:00', 'scheduled')`,
        )
        .run();

      const defaultMgrToken = await token('default-manager');
      const listRes = await openApiStaffRouter.request(
        '/api/staff/shifts',
        {
          headers: { Authorization: `Bearer ${defaultMgrToken}` },
        },
        env,
      );
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as { data: { shifts: Array<{ id: string }> } };
      expect(listBody.data.shifts.map((s) => s.id)).toContain('901');
      expect(listBody.data.shifts.map((s) => s.id)).not.toContain('902');
    });
  });

  describe('Kitchen stations RBAC & tenant scoping', () => {
    it('blocks non-manager roles (staff, kitchen) from station and category mapping mutations while allowing managers', async () => {
      const { env, token } = createAr2Fixture('cafe-a');
      const mgrToken = await token('manager');
      const staffToken = await token('staff');
      const kitchenToken = await token('kitchen');

      const stationApp = new Hono<{ Bindings: any }>();
      stationApp.route('/api/kitchen-stations', kitchenStationsRouter);

      // Staff cannot create a station
      const staffCreate = await stationApp.request(
        '/api/kitchen-stations',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${staffToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Bar Station', slug: 'bar' }),
        },
        env,
      );
      expect(staffCreate.status).toBe(403);

      // Manager creates station
      const mgrCreate = await stationApp.request(
        '/api/kitchen-stations',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Bar Station', slug: 'bar' }),
        },
        env,
      );
      expect(mgrCreate.status).toBe(201);
      const stationId = ((await mgrCreate.json()) as { data: { id: string } }).data.id;

      // Kitchen role can read stations but cannot PATCH/DELETE or mutate category mappings
      const kitchenGet = await stationApp.request(
        '/api/kitchen-stations',
        {
          headers: { Authorization: `Bearer ${kitchenToken}` },
        },
        env,
      );
      expect(kitchenGet.status).toBe(200);

      const kitchenPatch = await stationApp.request(
        `/api/kitchen-stations/${stationId}`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${kitchenToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Hacked Station' }),
        },
        env,
      );
      expect(kitchenPatch.status).toBe(403);

      const staffMapCategory = await stationApp.request(
        '/api/kitchen-stations/categories',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${staffToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ category_id: 'cat-drinks', station_id: stationId }),
        },
        env,
      );
      expect(staffMapCategory.status).toBe(403);

      const staffDeleteStation = await stationApp.request(
        `/api/kitchen-stations/${stationId}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${staffToken}` },
        },
        env,
      );
      expect(staffDeleteStation.status).toBe(403);
    });
  });

  describe('Kitchen station tickets direct /ready upsert, index/ID keys & KDS mobile RBAC', () => {
    it('upserts order_item_stations when /ready is called directly without /start and supports both item ID and index keys', async () => {
      const { sqlite, env, token } = createAr2Fixture('cafe-a');
      const baristaToken = await token('barista');

      sqlite
        .prepare(
          `INSERT INTO kitchen_stations (id, name, slug, sort_order, active, tenant_id)
           VALUES ('ks-bar-a', 'Bar A', 'bar-a', 1, 1, 'cafe-a')`,
        )
        .run();

      sqlite
        .prepare(
          `INSERT INTO orders (id, table_id, status, items, total, tenant_id, created_at, updated_at)
           VALUES ('ord-direct-ready', 'T1', 'preparing', ?, 90000, 'cafe-a', datetime('now'), datetime('now'))`,
        )
        .run(
          JSON.stringify([
            { id: 'item-espresso', name: 'Espresso', qty: 1, price: 45000, category_id: 'cat-coffee' },
            { id: 'item-latte', name: 'Latte', qty: 1, price: 45000, category_id: 'cat-coffee' },
          ]),
        );

      const stationApp = new Hono<{ Bindings: any }>();
      stationApp.use('*', async (c, next) => {
        (c as any).set('tenantId', 'cafe-a');
        await next();
      });
      stationApp.route('/api/kitchen-stations', kitchenStationsRouter);

      // Call /ready directly on item 1 by ID without calling /start first
      const ready1 = await stationApp.request(
        '/api/kitchen-stations/tickets/ord-direct-ready/items/item-espresso/ready?station_id=ks-bar-a',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${baristaToken}` },
        },
        env,
      );
      expect(ready1.status).toBe(200);
      const ready1Body = (await ready1.json()) as {
        success: boolean;
        all_items_ready: boolean;
        order_status: string;
      };
      expect(ready1Body.all_items_ready).toBe(false);
      expect(ready1Body.order_status).toBe('preparing');

      // Call /ready on item 2 using its 0-based index ("1") without calling /start
      const ready2 = await stationApp.request(
        '/api/kitchen-stations/tickets/ord-direct-ready/items/1/ready?station_id=ks-bar-a',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${baristaToken}` },
        },
        env,
      );
      expect(ready2.status).toBe(200);
      const ready2Body = (await ready2.json()) as {
        success: boolean;
        all_items_ready: boolean;
        order_status: string;
      };
      expect(ready2Body.all_items_ready).toBe(true);
      expect(ready2Body.order_status).toBe('ready');
    });

    it('rejects unauthenticated station ticket item mutations on real D1 even when JWT_SECRET is omitted', async () => {
      const { db } = createAr2Fixture('cafe-a');
      const subApp = new Hono<{ Bindings: any }>();
      subApp.route('/api/kitchen-stations', stationTicketsRouter);

      const res = await subApp.request(
        '/api/kitchen-stations/tickets/ord-1/items/i1/start?station_id=ks-1',
        { method: 'POST' },
        { AURA_DB: db } as any,
      );
      expect([401, 500]).toContain(res.status);
    });

    it('allows cashier to view KDS mobile orders but blocks cashier from mutating KDS order status', async () => {
      const { sqlite, env } = createAr2Fixture('cafe-a');
      const kdsApp = new Hono<{ Bindings: any }>();
      let currentRole = 'cashier';
      kdsApp.use('*', async (c, next) => {
        (c as any).set('user', { id: 'cashier', role: currentRole, tenant_id: 'cafe-a' });
        (c as any).set('tenantId', 'cafe-a');
        await next();
      });
      kdsApp.get('/mobile/kds/orders', (c) => getKdsMobile(c as any));
      kdsApp.patch('/mobile/kds/orders/:id/status', (c) => updateKdsStatus(c as any));

      sqlite
        .prepare(
          `INSERT INTO orders (id, table_id, status, items, total, tenant_id, created_at, updated_at)
           VALUES ('ord-kds-1', 'T1', 'confirmed', '[]', 50000, 'cafe-a', datetime('now'), datetime('now'))`,
        )
        .run();

      const viewRes = await kdsApp.request('/mobile/kds/orders', { method: 'GET' }, env);
      expect(viewRes.status).toBe(200);

      const mutateRes = await kdsApp.request(
        '/mobile/kds/orders/ord-kds-1/status',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'preparing' }),
        },
        env,
      );
      expect(mutateRes.status).toBe(403);

      currentRole = 'waiter';
      const waiterPrep = await kdsApp.request(
        '/mobile/kds/orders/ord-kds-1/status',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'preparing' }),
        },
        env,
      );
      expect(waiterPrep.status).toBe(403);
    });
  });
});
