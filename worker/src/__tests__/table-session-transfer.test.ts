// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { closeCanonicalD1s, createCanonicalD1 } from '../../../tests/helpers/canonical-d1-harness';
import type { Env } from '../types/env';
import { registerTransferHandler } from '../routes/table-sessions-handlers/transfer-handler';
import { registerSessionHandlers } from '../routes/table-sessions-handlers/session-handlers';

interface AuthUser {
  id: string;
  role?: string;
  tenantId?: string;
  tenant_id?: string;
}

interface TransferTestVariables {
  user?: AuthUser;
  tenantId?: string;
}

interface SeedTableInput {
  id: string;
  tableNumber: string;
  capacity?: number;
  status?: string;
  isActive?: number;
  currentSessionId?: string | null;
  tenantId?: string;
  zone?: string;
}

interface SeedSessionInput {
  id: string;
  tableId: string;
  status?: string;
  tenantId?: string;
  updatedAt?: string | null;
}

interface SeedOrderInput {
  id: string;
  tableId: string | null;
  sessionId?: string | null;
  status?: string;
  tenantId?: string;
  total?: number;
}

interface SeedReservationInput {
  id: string;
  tableId: string;
  status?: string;
  guestCount?: number;
  date?: string;
  reservationDate?: string | null;
  reservationTime?: string | null;
  tenantId?: string;
}

interface TableRow {
  id: string;
  table_number: string;
  capacity: number;
  status: string;
  is_active: number;
  current_session_id: string | null;
  tenant_id: string;
}

interface SessionRow {
  id: string;
  table_id: string;
  status: string;
  tenant_id: string;
  updated_at: string | null;
}

interface OrderRow {
  id: string;
  table_id: string | null;
  session_id: string | null;
  status: string;
  tenant_id: string;
}

interface ReservationRow {
  id: string;
  table_id: string;
  status: string;
  guest_count: number;
  tenant_id: string;
}

interface TransferResponseBody {
  success: boolean;
  error?: string;
  code?: string;
  data?: {
    session_id: string;
    source_table_id: string;
    table_id: string;
    reservation_id: string | null;
    transferred_orders: number;
  };
}

afterEach(() => {
  closeCanonicalD1s();
});

function createTransferHarness(options?: {
  user?: AuthUser | null;
  tenantId?: string;
  beforeBatch?: (sqlite: ReturnType<typeof createCanonicalD1>['sqlite']) => void | Promise<void>;
  beforeRun?: (sql: string) => void | Promise<void>;
}) {
  const { sqlite, db } = createCanonicalD1();

  const originalStatements = new WeakMap<D1PreparedStatement, D1PreparedStatement>();
  const statementSql = new WeakMap<D1PreparedStatement, string>();
  let intercepted = false;
  const wrappedDb: D1Database = {
    ...db,
    prepare: (sql: string) => {
      const statement = db.prepare(sql);
      const wrapped = {
        bind(...values: unknown[]) { statement.bind(...values); return wrapped; },
        first: statement.first.bind(statement),
        all: statement.all.bind(statement),
        raw: statement.raw.bind(statement),
        async run() {
          await options?.beforeRun?.(sql);
          return statement.run();
        },
      };
      originalStatements.set(wrapped as D1PreparedStatement, statement);
      statementSql.set(wrapped as D1PreparedStatement, sql);
      return wrapped as D1PreparedStatement;
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]) {
      if (!intercepted && options?.beforeBatch) {
        intercepted = true;
        await options.beforeBatch(sqlite);
      }
      const pendingMutation = statements.map((statement) => originalStatements.get(statement) ?? statement);
      for (const statement of statements) {
        await options?.beforeRun?.(statementSql.get(statement) ?? '');
      }
      return db.batch<T>(pendingMutation);
    },
  } as D1Database;

  const app = new Hono<{ Bindings: Env; Variables: TransferTestVariables }>();
  app.use('*', async (c, next) => {
    if (options?.user !== null) {
      const user: AuthUser = options?.user ?? {
        id: 'staff-1',
        role: 'waiter',
        tenantId: 'default',
      };
      c.set('user', user);
    }
    if (options?.tenantId !== undefined) {
      c.set('tenantId', options.tenantId);
    }
    await next();
  });

  registerTransferHandler(app as unknown as Hono<{ Bindings: Env }>);
  registerSessionHandlers(app as unknown as Hono<{ Bindings: Env }>);

  const todayRow = sqlite.prepare("SELECT DATE('now', '+7 hours') AS today").get() as { today: string };
  const todayVn = todayRow.today;

  const seedTable = (input: SeedTableInput) => {
    sqlite
      .prepare(
        `INSERT INTO cafe_tables (
           id, table_number, capacity, zone, status, is_active, current_session_id, tenant_id
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.tableNumber,
        input.capacity ?? 4,
        input.zone ?? 'Indoor',
        input.status ?? 'Available',
        input.isActive ?? 1,
        input.currentSessionId ?? null,
        input.tenantId ?? 'default',
      );
  };

  const seedSession = (input: SeedSessionInput) => {
    sqlite
      .prepare(
        `INSERT INTO table_sessions (id, table_id, status, tenant_id, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.tableId,
        input.status ?? 'active',
        input.tenantId ?? 'default',
        input.updatedAt === undefined ? '2026-11-21T08:00:00.000Z' : input.updatedAt,
      );
  };

  const seedOrder = (input: SeedOrderInput) => {
    // Historical numeric table references predate canonical foreign keys.
    const legacyTable = input.tableId !== null && !sqlite.prepare('SELECT id FROM cafe_tables WHERE id = ?').get(input.tableId);
    if (legacyTable) sqlite.exec('PRAGMA foreign_keys = OFF');
    try {
      sqlite
        .prepare(
          `INSERT INTO orders (
             id, items, total, status, customer_name, customer_phone, payment_method,
             table_id, session_id, tenant_id
           ) VALUES (?, '[]', ?, ?, 'Guest', '0900000000', 'cod', ?, ?, ?)`,
        )
        .run(
          input.id,
          input.total ?? 55000,
          input.status ?? 'pending',
          input.tableId,
          input.sessionId ?? null,
          input.tenantId ?? 'default',
        );
    } finally {
      if (legacyTable) sqlite.exec('PRAGMA foreign_keys = ON');
    }
  };

  const seedReservation = (input: SeedReservationInput) => {
    const dateVal = input.date ?? todayVn;
    sqlite
      .prepare(
        `INSERT INTO reservations (
           id, table_id, customer_name, customer_phone, guest_count, date, time, zone,
           status, tenant_id, reservation_date, reservation_time
         ) VALUES (?, ?, 'Guest', '0900000000', ?, ?, ?, 'Indoor', ?, ?, ?, ?)`,
      )
      .run(
        input.id,
        input.tableId,
        input.guestCount ?? 2,
        dateVal,
        input.reservationTime ?? '18:00',
        input.status ?? 'seated',
        input.tenantId ?? 'default',
        input.reservationDate === undefined ? dateVal : input.reservationDate,
        input.reservationTime === undefined ? '18:00' : input.reservationTime,
      );
  };

  const getTable = (id: string) =>
    sqlite.prepare('SELECT id, table_number, capacity, status, is_active, current_session_id, tenant_id FROM cafe_tables WHERE id = ?').get(id) as TableRow | undefined;

  const getSession = (id: string) =>
    sqlite.prepare('SELECT id, table_id, status, tenant_id, updated_at FROM table_sessions WHERE id = ?').get(id) as SessionRow | undefined;

  const getOrder = (id: string) =>
    sqlite.prepare('SELECT id, table_id, session_id, status, tenant_id FROM orders WHERE id = ?').get(id) as OrderRow | undefined;

  const getReservation = (id: string) =>
    sqlite.prepare('SELECT id, table_id, status, guest_count, tenant_id FROM reservations WHERE id = ?').get(id) as ReservationRow | undefined;

  const postTransfer = async (
    sessionId: string,
    body: unknown,
    extra?: { headers?: Record<string, string>; query?: string; rawBody?: string },
  ) => {
    const querySuffix = extra?.query ? `?${extra.query}` : '';
    const response = await app.request(
      `/${sessionId}/transfer${querySuffix}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(extra?.headers ?? {}),
        },
        body: extra?.rawBody ?? JSON.stringify(body),
      },
      { AURA_DB: wrappedDb } as unknown as Env,
    );
    const json = (await response.json()) as TransferResponseBody;
    return { status: response.status, body: json };
  };

  return {
    sqlite,
    todayVn,
    seedTable,
    seedSession,
    seedOrder,
    seedReservation,
    getTable,
    getSession,
    getOrder,
    getReservation,
    postTransfer,
    requestSession: (path: string, method: string, body: unknown) => app.request(path, {
      method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }, { AURA_DB: wrappedDb } as unknown as Env),
  };
}

describe('POST /api/table-sessions/:id/transfer (real SQLite canonical harness)', () => {
  describe('authenticated success and order migration', () => {
    it('transfers an active session, moves open orders, leaves terminal orders untouched, and updates both tables', async () => {
      const h = createTransferHarness({
        user: { id: 'waiter-1', role: 'waiter', tenantId: 'default' },
        tenantId: 'default',
      });
      h.seedTable({ id: 'tbl-src', tableNumber: 'B01', capacity: 4, status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-dst', tableNumber: 'B02', capacity: 4, status: 'Available' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src', status: 'active' });
      h.seedOrder({ id: 'ord-open', tableId: 'tbl-src', sessionId: 'sess-1', status: 'preparing' });
      h.seedOrder({ id: 'ord-done', tableId: 'tbl-src', sessionId: 'sess-1', status: 'completed' });
      h.seedOrder({ id: 'ord-cancelled', tableId: 'tbl-src', sessionId: 'sess-1', status: 'cancelled' });

      const res = await h.postTransfer('sess-1', {
        source_table_id: 'tbl-src',
        destination_table_id: 'tbl-dst',
      });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        success: true,
        data: {
          session_id: 'sess-1',
          source_table_id: 'tbl-src',
          table_id: 'tbl-dst',
          reservation_id: null,
          // The canonical harness counts both the direct write and timestamp trigger.
          transferred_orders: 2,
        },
      });
      expect(h.getSession('sess-1')?.table_id).toBe('tbl-dst');
      expect(h.getTable('tbl-dst')).toMatchObject({ status: 'Occupied', current_session_id: 'sess-1' });
      expect(h.getTable('tbl-src')).toMatchObject({ status: 'Available', current_session_id: null });
      expect(h.getOrder('ord-open')).toMatchObject({ table_id: 'tbl-dst', session_id: 'sess-1' });
      expect(h.getOrder('ord-done')).toMatchObject({ table_id: 'tbl-src', session_id: 'sess-1' });
      expect(h.getOrder('ord-cancelled')).toMatchObject({ table_id: 'tbl-src', session_id: 'sess-1' });
    });

    it('migrates legacy numeric table_number orders with null/empty session_id and excludes other tenants', async () => {
      const h = createTransferHarness({
        user: { id: 'cashier-1', role: 'cashier', tenantId: 'store-a' },
        tenantId: 'store-a',
      });
      h.seedTable({ id: 'tbl-101', tableNumber: '101', capacity: 4, status: 'Occupied', currentSessionId: 'sess-a', tenantId: 'store-a' });
      h.seedTable({ id: 'tbl-102', tableNumber: '102', capacity: 6, status: 'Available', tenantId: 'store-a' });
      h.seedSession({ id: 'sess-a', tableId: 'tbl-101', status: 'ordering', tenantId: 'store-a' });
      h.seedOrder({ id: 'ord-legacy-null', tableId: '101', sessionId: null, status: 'pending', tenantId: 'store-a' });
      h.seedOrder({ id: 'ord-legacy-empty', tableId: '101', sessionId: '', status: 'confirmed', tenantId: 'store-a' });
      h.seedOrder({ id: 'ord-other-tenant', tableId: '101', sessionId: null, status: 'pending', tenantId: 'store-b' });

      const res = await h.postTransfer('sess-a', { destination_table_id: 'tbl-102' });

      expect(res.status).toBe(200);
      expect(res.body.data?.transferred_orders).toBe(4);
      expect(h.getOrder('ord-legacy-null')).toMatchObject({ table_id: 'tbl-102', session_id: 'sess-a' });
      expect(h.getOrder('ord-legacy-empty')).toMatchObject({ table_id: 'tbl-102', session_id: 'sess-a' });
      expect(h.getOrder('ord-other-tenant')).toMatchObject({ table_id: '101', session_id: null });
      expect(h.getTable('tbl-101')).toMatchObject({ status: 'Available', current_session_id: null });
    });
  });

  describe('authentication, RBAC, tenant isolation, and input validation', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const h = createTransferHarness({ user: null });
      const res = await h.postTransfer('sess-1', { destination_table_id: 'tbl-dst' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it.each(['customer', 'barista', 'kitchen', 'chef', ''])('rejects unauthorized role "%s" with 403', async (role) => {
      const h = createTransferHarness({ user: { id: 'u-1', role, tenantId: 'default' } });
      const res = await h.postTransfer('sess-1', { destination_table_id: 'tbl-dst' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Insufficient permissions');
    });

    it('rejects cross-tenant header override for non-HQ staff with 403', async () => {
      const h = createTransferHarness({
        user: { id: 'staff-a', role: 'manager', tenantId: 'store-a' },
        tenantId: 'store-a',
      });
      h.seedTable({ id: 'tbl-a1', tableNumber: 'A1', status: 'Occupied', currentSessionId: 'sess-a', tenantId: 'store-a' });
      h.seedTable({ id: 'tbl-a2', tableNumber: 'A2', status: 'Available', tenantId: 'store-a' });
      h.seedSession({ id: 'sess-a', tableId: 'tbl-a1', tenantId: 'store-a' });

      const res = await h.postTransfer(
        'sess-a',
        { destination_table_id: 'tbl-a2' },
        { headers: { 'x-tenant-id': 'store-b' } },
      );

      expect(res.status).toBe(403);
      expect(res.body.code).toBe('FORBIDDEN');
      expect(h.getSession('sess-a')?.table_id).toBe('tbl-a1');
    });

    it('rejects cross-tenant session and cross-tenant destination table with 404 without mutating state', async () => {
      const h = createTransferHarness({
        user: { id: 'staff-a', role: 'staff', tenantId: 'store-a' },
        tenantId: 'store-a',
      });
      h.seedTable({ id: 'tbl-a1', tableNumber: 'A1', status: 'Occupied', currentSessionId: 'sess-a', tenantId: 'store-a' });
      h.seedTable({ id: 'tbl-b1', tableNumber: 'B1', status: 'Occupied', currentSessionId: 'sess-b', tenantId: 'store-b' });
      h.seedTable({ id: 'tbl-b2', tableNumber: 'B2', status: 'Available', tenantId: 'store-b' });
      h.seedSession({ id: 'sess-a', tableId: 'tbl-a1', tenantId: 'store-a' });
      h.seedSession({ id: 'sess-b', tableId: 'tbl-b1', tenantId: 'store-b' });

      const crossSession = await h.postTransfer('sess-b', { destination_table_id: 'tbl-b2' });
      expect(crossSession.status).toBe(404);
      expect(h.getSession('sess-b')?.table_id).toBe('tbl-b1');

      const crossDest = await h.postTransfer('sess-a', { destination_table_id: 'tbl-b2' });
      expect(crossDest.status).toBe(404);
      expect(h.getSession('sess-a')?.table_id).toBe('tbl-a1');
      expect(h.getTable('tbl-b2')?.status).toBe('Available');
    });

    it('validates malformed payload, invalid field types, same-table target, and non-transferable session statuses', async () => {
      const h = createTransferHarness();
      h.seedTable({ id: 'tbl-1', tableNumber: 'T1', status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-2', tableNumber: 'T2', status: 'Available' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-1', status: 'active' });
      h.seedSession({ id: 'sess-closed', tableId: 'tbl-1', status: 'closed' });

      expect((await h.postTransfer('sess-1', null, { rawBody: '{bad-json' })).status).toBe(400);
      expect((await h.postTransfer('sess-1', { destination_table_id: '   ' })).status).toBe(400);
      expect((await h.postTransfer('sess-1', { destination_table_id: 'tbl-2', source_table_id: '' })).status).toBe(400);
      expect((await h.postTransfer('sess-1', { destination_table_id: 'tbl-2', transfer_reservation: 'yes' })).status).toBe(400);
      expect((await h.postTransfer('sess-1', { destination_table_id: 'tbl-1' })).status).toBe(400);
      expect((await h.postTransfer('sess-closed', { destination_table_id: 'tbl-2' })).status).toBe(409);
    });
  });

  describe('destination availability guards and capacity checks', () => {
    it('blocks transfer to inactive, non-available, or current_session_id-bound destination tables', async () => {
      const h = createTransferHarness();
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-inactive', tableNumber: 'T2', status: 'Available', isActive: 0 });
      h.seedTable({ id: 'tbl-occupied', tableNumber: 'T3', status: 'Occupied' });
      h.seedTable({ id: 'tbl-bound', tableNumber: 'T4', status: 'Available', currentSessionId: 'sess-other' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src', status: 'active' });

      expect((await h.postTransfer('sess-1', { destination_table_id: 'tbl-inactive' })).status).toBe(409);
      expect((await h.postTransfer('sess-1', { destination_table_id: 'tbl-occupied' })).status).toBe(409);
      expect((await h.postTransfer('sess-1', { destination_table_id: 'tbl-bound' })).status).toBe(409);
      expect(h.getSession('sess-1')?.table_id).toBe('tbl-src');
    });

    it('blocks transfer when destination has an open session, open order, or active reservation today despite Available status', async () => {
      const h = createTransferHarness();
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-open-sess', tableNumber: 'T2', status: 'Available' });
      h.seedTable({ id: 'tbl-open-ord', tableNumber: 'T3', status: 'Available' });
      h.seedTable({ id: 'tbl-reserved', tableNumber: 'T4', status: 'Available' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src', status: 'active' });

      // Ghost open session on T2
      h.seedSession({ id: 'sess-ghost', tableId: 'tbl-open-sess', status: 'paying' });
      // Open order matched via legacy table_number on T3
      h.seedOrder({ id: 'ord-dest', tableId: 'T3', sessionId: null, status: 'preparing' });
      // Confirmed reservation today on T4
      h.seedReservation({ id: 'res-dest', tableId: 'tbl-reserved', status: 'confirmed', date: h.todayVn });

      expect((await h.postTransfer('sess-1', { destination_table_id: 'tbl-open-sess' })).status).toBe(409);
      expect((await h.postTransfer('sess-1', { destination_table_id: 'tbl-open-ord' })).status).toBe(409);
      expect((await h.postTransfer('sess-1', { destination_table_id: 'tbl-reserved' })).status).toBe(409);
      expect(h.getSession('sess-1')?.table_id).toBe('tbl-src');
      expect(h.getTable('tbl-src')).toMatchObject({ status: 'Occupied', current_session_id: 'sess-1' });
    });

    it('enforces destination capacity against source table capacity fallback and seated reservation guest_count', async () => {
      const h = createTransferHarness();
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', capacity: 4, status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-small', tableNumber: 'T2', capacity: 2, status: 'Available' });
      h.seedTable({ id: 'tbl-med', tableNumber: 'T3', capacity: 4, status: 'Available' });
      h.seedTable({ id: 'tbl-large', tableNumber: 'T4', capacity: 6, status: 'Available' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src', status: 'active' });

      // Fails against source capacity (4 > 2)
      const tooSmall = await h.postTransfer('sess-1', { destination_table_id: 'tbl-small' });
      expect(tooSmall.status).toBe(409);
      expect(tooSmall.body.error).toContain('capacity');

      // Add seated reservation with 6 guests -> T3 (capacity 4) must fail, T4 (capacity 6) must succeed
      h.seedReservation({ id: 'res-party', tableId: 'tbl-src', status: 'seated', guestCount: 6, date: h.todayVn });
      const tooSmallForRes = await h.postTransfer('sess-1', { destination_table_id: 'tbl-med' });
      expect(tooSmallForRes.status).toBe(409);

      const fits = await h.postTransfer('sess-1', { destination_table_id: 'tbl-large' });
      expect(fits.status).toBe(200);
      expect(fits.body.data).toMatchObject({ table_id: 'tbl-large', reservation_id: 'res-party' });
    });
  });

  describe('seated reservation move/leave semantics', () => {
    it('moves today seated reservation by default and frees source table to Available', async () => {
      const h = createTransferHarness();
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', capacity: 4, status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-dst', tableNumber: 'T2', capacity: 4, status: 'Available' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src', status: 'active' });
      h.seedReservation({ id: 'res-1', tableId: 'tbl-src', status: 'seated', guestCount: 3, date: h.todayVn });

      const res = await h.postTransfer('sess-1', { destination_table_id: 'tbl-dst' });

      expect(res.status).toBe(200);
      expect(res.body.data?.reservation_id).toBe('res-1');
      expect(h.getReservation('res-1')?.table_id).toBe('tbl-dst');
      expect(h.getTable('tbl-src')).toMatchObject({ status: 'Available', current_session_id: null });
      expect(h.getTable('tbl-dst')).toMatchObject({ status: 'Occupied', current_session_id: 'sess-1' });
    });

    it('leaves seated reservation on source table when transfer_reservation is false and marks source Reserved', async () => {
      const h = createTransferHarness();
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', capacity: 4, status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-dst', tableNumber: 'T2', capacity: 4, status: 'Available' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src', status: 'active' });
      h.seedReservation({ id: 'res-1', tableId: 'tbl-src', status: 'seated', guestCount: 2, date: h.todayVn });

      const res = await h.postTransfer('sess-1', {
        destination_table_id: 'tbl-dst',
        transfer_reservation: false,
      });

      expect(res.status).toBe(200);
      expect(res.body.data?.reservation_id).toBeNull();
      expect(h.getReservation('res-1')?.table_id).toBe('tbl-src');
      expect(h.getTable('tbl-src')).toMatchObject({ status: 'Reserved', current_session_id: null });
      expect(h.getTable('tbl-dst')).toMatchObject({ status: 'Occupied', current_session_id: 'sess-1' });
    });

    it('rejects transfer_reservation=true without a seated reservation and rejects ambiguous multiple seated reservations', async () => {
      const h = createTransferHarness();
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', capacity: 4, status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-dst', tableNumber: 'T2', capacity: 4, status: 'Available' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src', status: 'active' });

      const noRes = await h.postTransfer('sess-1', {
        destination_table_id: 'tbl-dst',
        transfer_reservation: true,
      });
      expect(noRes.status).toBe(409);

      h.seedReservation({ id: 'res-a', tableId: 'tbl-src', status: 'seated', date: h.todayVn, reservationTime: '18:00' });
      h.seedReservation({ id: 'res-b', tableId: 'tbl-src', status: 'seated', date: h.todayVn, reservationTime: '19:00' });

      const multiRes = await h.postTransfer('sess-1', { destination_table_id: 'tbl-dst' });
      expect(multiRes.status).toBe(409);
      expect(h.getSession('sess-1')?.table_id).toBe('tbl-src');
    });
  });

  describe('session route interoperation', () => {
    it.each(['PATCH', 'POST'] as const)('rejects a stale %s close after transfer wins', async (method) => {
      let transfer: (() => Promise<void>) | undefined;
      const h = createTransferHarness({ beforeRun: async (sql) => {
        if (transfer && /UPDATE table_sessions/.test(sql)) {
          const run = transfer;
          transfer = undefined;
          await run();
        }
      } });
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-dst', tableNumber: 'T2' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src' });
      transfer = async () => {
        expect((await h.postTransfer('sess-1', { destination_table_id: 'tbl-dst' })).status).toBe(200);
      };
      const response = await h.requestSession(method === 'PATCH' ? '/sess-1' : '/sess-1/close', method, { status: 'closed' });
      expect(response.status).toBe(409);
      expect(h.getSession('sess-1')).toMatchObject({ table_id: 'tbl-dst', status: 'active' });
      expect(h.getTable('tbl-src')).toMatchObject({ status: 'Available', current_session_id: null });
      expect(h.getTable('tbl-dst')).toMatchObject({ status: 'Occupied', current_session_id: 'sess-1' });
    });

    it('rejects a stale open after transfer claims its destination', async () => {
      let transfer: (() => Promise<void>) | undefined;
      const h = createTransferHarness({ beforeRun: async (sql) => {
        if (transfer && /INSERT INTO table_sessions/.test(sql)) {
          const run = transfer;
          transfer = undefined;
          await run();
        }
      } });
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-dst', tableNumber: 'T2' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src' });
      transfer = async () => {
        expect((await h.postTransfer('sess-1', { destination_table_id: 'tbl-dst' })).status).toBe(200);
      };
      expect((await h.requestSession('/', 'POST', { table_id: 'tbl-dst' })).status).toBe(409);
      const count = h.sqlite.prepare("SELECT COUNT(*) AS n FROM table_sessions WHERE table_id = 'tbl-dst' AND status = 'active'").get();
      expect(count?.n).toBe(1);
    });

    it.each(['open', 'PATCH', 'POST'] as const)('rejects transfer when %s wins first', async (winner) => {
      let mutate: () => Promise<void>;
      const h = createTransferHarness({ beforeBatch: () => mutate() });
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-dst', tableNumber: 'T2' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src' });
      mutate = async () => {
        const response = winner === 'open'
          ? await h.requestSession('/', 'POST', { table_id: 'tbl-dst' })
          : await h.requestSession(winner === 'PATCH' ? '/sess-1' : '/sess-1/close', winner, { status: 'closed' });
        expect(response.status).toBe(winner === 'open' ? 201 : 200);
      };
      expect((await h.postTransfer('sess-1', { destination_table_id: 'tbl-dst' })).status).toBe(409);
      expect(h.getSession('sess-1')).toMatchObject({ table_id: 'tbl-src', status: winner === 'open' ? 'active' : 'closed' });
      expect(h.getTable('tbl-src')?.status).toBe(winner === 'open' ? 'Occupied' : 'Available');
      expect(h.getTable('tbl-dst')?.status).toBe(winner === 'open' ? 'Occupied' : 'Available');
    });

    it('rolls back close when releasing the table fails', async () => {
      const h = createTransferHarness();
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src' });
      h.sqlite.exec(`CREATE TRIGGER reject_release BEFORE UPDATE ON cafe_tables
        BEGIN SELECT RAISE(ABORT, 'table write failed'); END;`);
      expect((await h.requestSession('/sess-1/close', 'POST', {})).status).toBe(500);
      expect(h.getSession('sess-1')?.status).toBe('active');
      expect(h.getTable('tbl-src')).toMatchObject({ status: 'Occupied', current_session_id: 'sess-1' });
    });

    it('rolls back open when occupying the table fails', async () => {
      const h = createTransferHarness();
      h.seedTable({ id: 'tbl-dst', tableNumber: 'T2' });
      h.sqlite.exec(`CREATE TRIGGER reject_occupy BEFORE UPDATE ON cafe_tables
        BEGIN SELECT RAISE(ABORT, 'table write failed'); END;`);
      expect((await h.requestSession('/', 'POST', { table_id: 'tbl-dst' })).status).toBe(500);
      const count = h.sqlite.prepare("SELECT COUNT(*) AS n FROM table_sessions WHERE table_id = 'tbl-dst'").get();
      expect(count?.n).toBe(0);
      expect(h.getTable('tbl-dst')).toMatchObject({ status: 'Available', current_session_id: null });
    });

    it('closes a non-default tenant session cleanly when table_sessions has tenant_id and cafe_tables lacks it', async () => {
      const h = createTransferHarness({
        user: { id: 'staff-a', role: 'manager', tenantId: 'store-a' },
        tenantId: 'store-a',
      });
      h.sqlite.exec(`
        DROP TABLE cafe_tables;
        CREATE TABLE cafe_tables (
          id TEXT PRIMARY KEY,
          table_number TEXT NOT NULL,
          status TEXT DEFAULT 'Available',
          current_session_id TEXT,
          current_order_id TEXT
        );
        INSERT INTO cafe_tables (id, table_number, status, current_session_id)
        VALUES ('tbl-mixed', 'M1', 'Occupied', 'sess-mixed');
      `);
      h.seedSession({ id: 'sess-mixed', tableId: 'tbl-mixed', status: 'active', tenantId: 'store-a' });

      const res = await h.requestSession('/sess-mixed/close', 'POST', {});
      expect(res.status).toBe(200);
      expect(h.getSession('sess-mixed')?.status).toBe('closed');
      expect(
        h.sqlite.prepare("SELECT status, current_session_id FROM cafe_tables WHERE id = 'tbl-mixed'").get(),
      ).toMatchObject({ status: 'Available', current_session_id: null });
    });

    it('allows non-releasing PATCH when neither cafe_tables nor tables exists', async () => {
      const h = createTransferHarness();
      h.seedSession({ id: 'sess-only', tableId: 'tbl-missing', status: 'active' });
      h.sqlite.exec('DROP TABLE cafe_tables;');

      const res = await h.requestSession('/sess-only', 'PATCH', { notes: 'Updated without seating table' });
      expect(res.status).toBe(200);
      expect(h.getSession('sess-only')?.status).toBe('active');
    });

    it('opens a session when table_sessions requires both started_at and updated_at NOT NULL', async () => {
      const h = createTransferHarness();
      h.seedTable({ id: 'tbl-strict', tableNumber: 'S1' });
      h.sqlite.exec(`
        DROP TABLE table_sessions;
        CREATE TABLE table_sessions (
          id TEXT PRIMARY KEY,
          table_id TEXT NOT NULL,
          customer_id TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          status TEXT DEFAULT 'active',
          notes TEXT,
          tenant_id TEXT DEFAULT 'default',
          started_at TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);

      const res = await h.requestSession('/', 'POST', { table_id: 'tbl-strict' });
      expect(res.status).toBe(201);
      const row = h.sqlite
        .prepare("SELECT id, started_at, updated_at FROM table_sessions WHERE table_id = 'tbl-strict'")
        .get() as { id: string; started_at: string; updated_at: string } | undefined;
      expect(row?.started_at).toBeTruthy();
      expect(row?.updated_at).toBeTruthy();
    });

    it('opens a new session when cafe_tables.current_session_id points to a stale closed session', async () => {
      const h = createTransferHarness();
      h.seedTable({ id: 'tbl-stale', tableNumber: 'S2', status: 'Available', currentSessionId: 'sess-old' });
      h.seedSession({ id: 'sess-old', tableId: 'tbl-stale', status: 'closed' });

      const res = await h.requestSession('/', 'POST', { table_id: 'tbl-stale' });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { data?: { id?: string } };
      expect(body.data?.id).toBeTruthy();
      expect(h.getTable('tbl-stale')).toMatchObject({
        status: 'Occupied',
        current_session_id: body.data?.id,
      });
    });
  });

  describe('stale retry protection', () => {
    it('fails closed with 409 when a duplicate/stale request submits the previous source_table_id', async () => {
      const h = createTransferHarness();
      h.seedTable({ id: 'tbl-1', tableNumber: 'T1', capacity: 4, status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-2', tableNumber: 'T2', capacity: 4, status: 'Available' });
      h.seedTable({ id: 'tbl-3', tableNumber: 'T3', capacity: 4, status: 'Available' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-1', status: 'active' });

      const first = await h.postTransfer('sess-1', {
        source_table_id: 'tbl-1',
        destination_table_id: 'tbl-2',
      });
      expect(first.status).toBe(200);

      const staleRetry = await h.postTransfer('sess-1', {
        source_table_id: 'tbl-1',
        destination_table_id: 'tbl-3',
      });
      expect(staleRetry.status).toBe(409);
      expect(staleRetry.body.error).toContain('already moved');
      expect(h.getSession('sess-1')?.table_id).toBe('tbl-2');
      expect(h.getTable('tbl-2')).toMatchObject({ status: 'Occupied', current_session_id: 'sess-1' });
      expect(h.getTable('tbl-3')).toMatchObject({ status: 'Available', current_session_id: null });
    });
  });

  describe('concurrent race conditions via db.batch interception and atomic rollback', () => {
    it('aborts with 409 and preserves all rows when destination becomes Occupied before batch executes', async () => {
      const h = createTransferHarness({
        beforeBatch: (sqlite) => {
          sqlite.prepare("UPDATE cafe_tables SET status = 'Occupied', current_session_id = 'sess-racer' WHERE id = 'tbl-dst'").run();
        },
      });
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', capacity: 4, status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-dst', tableNumber: 'T2', capacity: 4, status: 'Available' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src', status: 'active' });
      h.seedOrder({ id: 'ord-1', tableId: 'tbl-src', sessionId: 'sess-1', status: 'pending' });
      h.seedReservation({ id: 'res-1', tableId: 'tbl-src', status: 'seated', date: h.todayVn });

      const res = await h.postTransfer('sess-1', { destination_table_id: 'tbl-dst' });

      expect(res.status).toBe(409);
      expect(h.getSession('sess-1')?.table_id).toBe('tbl-src');
      expect(h.getTable('tbl-src')).toMatchObject({ status: 'Occupied', current_session_id: 'sess-1' });
      expect(h.getTable('tbl-dst')).toMatchObject({ status: 'Occupied', current_session_id: 'sess-racer' });
      expect(h.getOrder('ord-1')?.table_id).toBe('tbl-src');
      expect(h.getReservation('res-1')?.table_id).toBe('tbl-src');
    });

    it('aborts with 409 when a racing session snapshot mutation changes updated_at', async () => {
      const h = createTransferHarness({
        beforeBatch: (sqlite) => {
          sqlite
            .prepare("UPDATE table_sessions SET updated_at = '2026-11-21T09:30:00.000Z' WHERE id = 'sess-1'")
            .run();
        },
      });
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', capacity: 4, status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-dst', tableNumber: 'T2', capacity: 4, status: 'Available' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src', status: 'active', updatedAt: '2026-11-21T08:00:00.000Z' });
      h.seedOrder({ id: 'ord-1', tableId: 'tbl-src', sessionId: 'sess-1', status: 'preparing' });

      const res = await h.postTransfer('sess-1', { destination_table_id: 'tbl-dst' });

      expect(res.status).toBe(409);
      expect(h.getSession('sess-1')).toMatchObject({
        table_id: 'tbl-src',
        updated_at: '2026-11-21T09:30:00.000Z',
      });
      expect(h.getTable('tbl-dst')).toMatchObject({ status: 'Available', current_session_id: null });
      expect(h.getOrder('ord-1')?.table_id).toBe('tbl-src');
    });

    it('aborts when a reservation grows and destination capacity shrinks before the batch', async () => {
      const h = createTransferHarness({
        beforeBatch: (sqlite) => {
          sqlite.exec(`UPDATE reservations SET guest_count = 6 WHERE id = 'res-1';
            UPDATE cafe_tables SET capacity = 4 WHERE id = 'tbl-dst';`);
        },
      });
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', capacity: 4, status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-dst', tableNumber: 'T2', capacity: 6, status: 'Available' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src', status: 'active' });
      h.seedReservation({ id: 'res-1', tableId: 'tbl-src', status: 'seated', guestCount: 2, date: h.todayVn });

      const res = await h.postTransfer('sess-1', { destination_table_id: 'tbl-dst' });

      expect(res.status).toBe(409);
      expect(h.getSession('sess-1')?.table_id).toBe('tbl-src');
      expect(h.getTable('tbl-dst')).toMatchObject({ status: 'Available', current_session_id: null });
      expect(h.getReservation('res-1')).toMatchObject({ table_id: 'tbl-src', guest_count: 6 });
    });

    it('aborts with 409 when source capacity or table_number mutates before batch executes', async () => {
      const h = createTransferHarness({
        beforeBatch: (sqlite) => {
          sqlite.prepare("UPDATE cafe_tables SET table_number = 'T1-RENAMED', capacity = 8 WHERE id = 'tbl-src'").run();
        },
      });
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', capacity: 4, status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-dst', tableNumber: 'T2', capacity: 4, status: 'Available' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src', status: 'active' });

      const res = await h.postTransfer('sess-1', { destination_table_id: 'tbl-dst' });

      expect(res.status).toBe(409);
      expect(h.getSession('sess-1')?.table_id).toBe('tbl-src');
      expect(h.getTable('tbl-dst')).toMatchObject({ status: 'Available', current_session_id: null });
    });

    it('aborts with 409 when another non-terminal session appears on source table before batch executes', async () => {
      const h = createTransferHarness({
        beforeBatch: (sqlite) => {
          sqlite
            .prepare("INSERT INTO table_sessions (id, table_id, status, tenant_id) VALUES ('sess-co-occupant', 'tbl-src', 'paused', 'default')")
            .run();
        },
      });
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', capacity: 4, status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-dst', tableNumber: 'T2', capacity: 4, status: 'Available' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src', status: 'active' });

      const res = await h.postTransfer('sess-1', { destination_table_id: 'tbl-dst' });

      expect(res.status).toBe(409);
      expect(h.getSession('sess-1')?.table_id).toBe('tbl-src');
      expect(h.getTable('tbl-dst')).toMatchObject({ status: 'Available', current_session_id: null });
    });

    it('blocks destination with NULL reservation status (treated as pending) or non-standard non-terminal session status', async () => {
      const h = createTransferHarness();
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', capacity: 4, status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-null-res', tableNumber: 'T2', capacity: 4, status: 'Available' });
      h.seedTable({ id: 'tbl-custom-sess', tableNumber: 'T3', capacity: 4, status: 'Available' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src', status: 'active' });
      h.sqlite
        .prepare(
          `INSERT INTO reservations (
             id, table_id, customer_name, customer_phone, guest_count, date, time, zone,
             status, tenant_id, reservation_date, reservation_time
           ) VALUES ('res-null', 'tbl-null-res', 'Guest', '0900000000', 2, ?, '18:00', 'Indoor', NULL, 'default', ?, '18:00')`,
        )
        .run(h.todayVn, h.todayVn);
      h.seedSession({ id: 'sess-custom', tableId: 'tbl-custom-sess', status: 'hold' });

      expect((await h.postTransfer('sess-1', { destination_table_id: 'tbl-null-res' })).status).toBe(409);
      expect((await h.postTransfer('sess-1', { destination_table_id: 'tbl-custom-sess' })).status).toBe(409);
      expect(h.getSession('sess-1')?.table_id).toBe('tbl-src');
    });

    it('aborts with 409 when a racing active reservation is inserted on destination before batch executes', async () => {
      const h = createTransferHarness({
        beforeBatch: (sqlite) => {
          const today = (sqlite.prepare("SELECT DATE('now', '+7 hours') AS today").get() as { today: string }).today;
          sqlite
            .prepare(
              `INSERT INTO reservations (
                 id, table_id, customer_name, customer_phone, guest_count, date, time, zone,
                 status, tenant_id, reservation_date, reservation_time
               ) VALUES ('res-race', 'tbl-dst', 'Guest', '0900000000', 2, ?, '19:00', 'Indoor', 'confirmed', 'default', ?, '19:00')`,
            )
            .run(today, today);
        },
      });
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', capacity: 4, status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-dst', tableNumber: 'T2', capacity: 4, status: 'Available' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src', status: 'active' });

      const res = await h.postTransfer('sess-1', { destination_table_id: 'tbl-dst' });

      expect(res.status).toBe(409);
      expect(h.getSession('sess-1')?.table_id).toBe('tbl-src');
      expect(h.getTable('tbl-dst')).toMatchObject({ status: 'Available', current_session_id: null });
    });

    it('rolls back the entire transaction when a downstream statement fails mid-batch and succeeds cleanly after recovery', async () => {
      const h = createTransferHarness();
      h.seedTable({ id: 'tbl-src', tableNumber: 'T1', capacity: 4, status: 'Occupied', currentSessionId: 'sess-1' });
      h.seedTable({ id: 'tbl-dst', tableNumber: 'T2', capacity: 4, status: 'Available' });
      h.seedSession({ id: 'sess-1', tableId: 'tbl-src', status: 'active', updatedAt: '2026-11-21T08:00:00.000Z' });
      h.seedOrder({ id: 'ord-1', tableId: 'tbl-src', sessionId: 'sess-1', status: 'preparing' });
      h.seedReservation({ id: 'res-1', tableId: 'tbl-src', status: 'seated', guestCount: 2, date: h.todayVn });

      h.sqlite.exec(`
        CREATE TRIGGER fail_order_transfer BEFORE UPDATE ON orders
        BEGIN
          SELECT RAISE(ABORT, 'simulated downstream order failure');
        END;
      `);

      const failed = await h.postTransfer('sess-1', { destination_table_id: 'tbl-dst' });

      expect(failed.status).toBe(500);
      expect(h.getSession('sess-1')).toMatchObject({
        table_id: 'tbl-src',
        updated_at: '2026-11-21T08:00:00.000Z',
      });
      expect(h.getTable('tbl-dst')).toMatchObject({ status: 'Available', current_session_id: null });
      expect(h.getTable('tbl-src')).toMatchObject({ status: 'Occupied', current_session_id: 'sess-1' });
      expect(h.getReservation('res-1')?.table_id).toBe('tbl-src');
      expect(h.getOrder('ord-1')).toMatchObject({ table_id: 'tbl-src', session_id: 'sess-1' });

      h.sqlite.exec('DROP TRIGGER fail_order_transfer');

      const recovered = await h.postTransfer('sess-1', { destination_table_id: 'tbl-dst' });
      expect(recovered.status).toBe(200);
      expect(h.getSession('sess-1')?.table_id).toBe('tbl-dst');
      expect(h.getTable('tbl-dst')).toMatchObject({ status: 'Occupied', current_session_id: 'sess-1' });
      expect(h.getTable('tbl-src')).toMatchObject({ status: 'Available', current_session_id: null });
      expect(h.getReservation('res-1')?.table_id).toBe('tbl-dst');
      expect(h.getOrder('ord-1')).toMatchObject({ table_id: 'tbl-dst', session_id: 'sess-1' });
    });
  });
});
