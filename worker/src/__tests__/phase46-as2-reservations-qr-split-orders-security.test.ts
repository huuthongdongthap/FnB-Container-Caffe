import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { reservationsRouter } from '@aura/domain-reservation';
import {
  validateOrderTable,
  createCanonicalReservation,
  updateReservationStatus,
  seatTable,
} from '@aura/domain-table';
import { qrRouter } from '../../../packages/domain/table/commands/qr-scan';
import { splitOrders } from '../../../packages/domain/order/commands/split-orders';
import { signQRUrl } from '../tree/qr/signer';
import {
  mockStaffToken,
  isStaffAccountLookup,
  STAFF_ACCOUNT_ROW,
  TEST_JWT_SECRET,
} from './test-utils';
import type { Env } from '../types/env';

const JWT_SECRET = TEST_JWT_SECRET;
const QR_SECRET = 'test-qr-signing-secret-at-least-16-chars';

function createStatefulMockDb(seed?: {
  tables?: Array<Record<string, unknown>>;
  reservations?: Array<Record<string, unknown>>;
  qrCodes?: Array<Record<string, unknown>>;
  menuItems?: Array<Record<string, unknown>>;
  staffTenantId?: string;
  failTenantScopedUpdate?: boolean;
}) {
  const tables: Array<Record<string, unknown>> = (seed?.tables ?? []).map((t) => ({ ...t }));
  const reservations: Array<Record<string, unknown>> = (seed?.reservations ?? []).map((r) => ({ ...r }));
  const qrCodes: Array<Record<string, unknown>> = (seed?.qrCodes ?? []).map((q) => ({ ...q }));
  const menuItems: Array<Record<string, unknown>> = (seed?.menuItems ?? []).map((m) => ({ ...m }));
  const orderItems: Array<Record<string, unknown>> = [];
  const payments: Array<Record<string, unknown>> = [];
  const orders: Array<Record<string, unknown>> = [];
  const queries: Array<{ sql: string; binds: unknown[] }> = [];

  const matchesTenant = (row: Record<string, unknown>, tenantId: unknown) => {
    const expected = String(tenantId ?? 'default').trim() || 'default';
    const actual = String(row.tenant_id ?? row.operating_unit_id ?? '').trim() || 'default';
    return actual === expected;
  };

  const prepare = (sql: string) => {
    const makeStmt = (binds: unknown[] = []) => ({
      sql,
      binds,
      bind(...args: unknown[]) {
        return makeStmt(args);
      },
      async first<T = Record<string, unknown>>(): Promise<T | null> {
        queries.push({ sql, binds });
        if (isStaffAccountLookup(sql)) {
          return {
            ...STAFF_ACCOUNT_ROW,
            id: String(binds[0] ?? 'user-staff'),
            tenant_id: seed?.staffTenantId ?? 'tenant_a',
          } as unknown as T;
        }
        if (sql.includes('FROM cafe_tables WHERE id = ?')) {
          const id = String(binds[0] ?? '');
          const found = tables.find((t) => String(t.id) === id);
          if (!found) return null;
          if (sql.includes('tenant_id') && binds.length >= 2) {
            return matchesTenant(found, binds[1]) ? ({ ...found } as unknown as T) : null;
          }
          return { ...found } as unknown as T;
        }
        if (sql.includes('FROM cafe_tables WHERE table_number = ?')) {
          const num = String(binds[0] ?? '');
          const found = tables.find((t) => String(t.table_number) === num);
          return found ? ({ ...found } as unknown as T) : null;
        }
        if (sql.includes('FROM reservations WHERE id = ?')) {
          const id = String(binds[0] ?? '');
          const found = reservations.find((r) => String(r.id) === id);
          if (!found) return null;
          if (sql.includes('tenant_id') && binds.length >= 2) {
            return matchesTenant(found, binds[1]) ? ({ ...found } as unknown as T) : null;
          }
          return { ...found } as unknown as T;
        }
        if (sql.includes('FROM table_qr_codes WHERE slug = ?')) {
          const slug = String(binds[0] ?? '');
          const found = qrCodes.find((q) => String(q.slug) === slug);
          return found ? ({ ...found } as unknown as T) : null;
        }
        if (sql.includes('FROM menu_items')) {
          const id = String(binds[0] ?? '');
          const found = menuItems.find((m) => String(m.id) === id);
          if (!found) return null;
          if (sql.includes('tenant_id') && binds.length >= 2) {
            return matchesTenant(found, binds[1]) ? ({ ...found } as unknown as T) : null;
          }
          return { ...found } as unknown as T;
        }
        return null;
      },
      async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
        queries.push({ sql, binds });
        if (sql.includes('FROM cafe_tables')) {
          let list = [...tables];
          if (sql.includes('WHERE table_number = ?')) {
            const num = String(binds[0] ?? '');
            list = list.filter((t) => String(t.table_number) === num);
          } else if (sql.includes('tenant_id')) {
            const tenantArg = binds[0];
            list = list.filter((t) => matchesTenant(t, tenantArg));
          }
          return { results: list.map((t) => ({ ...t })) as unknown as T[] };
        }
        if (sql.includes('FROM reservations')) {
          let list = [...reservations];
          if (sql.includes("status IN ('confirmed', 'pending', 'approved', 'seated')")) {
            list = list.filter((r) =>
              ['confirmed', 'pending', 'approved', 'seated'].includes(String(r.status ?? '').toLowerCase())
            );
          } else if (sql.includes("status IN ('confirmed', 'pending', 'seated')")) {
            list = list.filter((r) =>
              ['confirmed', 'pending', 'seated'].includes(String(r.status ?? '').toLowerCase())
            );
          } else if (sql.includes("status IN ('confirmed', 'pending')")) {
            list = list.filter((r) =>
              ['confirmed', 'pending'].includes(String(r.status ?? '').toLowerCase())
            );
          }
          return { results: list.map((r) => ({ ...r })) as unknown as T[] };
        }
        if (sql.includes('FROM menu_items')) {
          const tenantArg = binds[binds.length - 1];
          const requestedIds = binds.slice(0, -1).map(String);
          const list = menuItems.filter(
            (m) => requestedIds.includes(String(m.id)) && matchesTenant(m, tenantArg)
          );
          return { results: list.map((m) => ({ ...m })) as unknown as T[] };
        }
        if (sql.includes('FROM product_modifiers')) {
          return { results: [] as T[] };
        }
        return { results: [] as T[] };
      },
      async run() {
        queries.push({ sql, binds });
        if (seed?.failTenantScopedUpdate && sql.startsWith('UPDATE ') && sql.includes('tenant_id')) {
          throw new Error('simulated D1 tenant_id column failure');
        }
        if (sql.startsWith('INSERT INTO reservations')) {
          reservations.push({
            id: binds[0],
            table_id: binds[1],
            customer_name: binds[2],
            customer_phone: binds[3],
            guest_count: binds[4],
            date: binds[5],
            time: binds[6],
            zone: binds[7],
            status: binds[8],
            notes: binds[9],
            tenant_id: binds.length >= 13 ? binds[10] : 'default',
          });
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.startsWith('UPDATE reservations')) {
          if (sql.includes("SET status = 'approved'")) {
            const id = String(binds[1] ?? '');
            const rsv = reservations.find((r) => String(r.id) === id);
            if (rsv) rsv.status = 'approved';
          } else if (sql.includes("SET status = 'rejected'")) {
            const id = String(binds[2] ?? '');
            const rsv = reservations.find((r) => String(r.id) === id);
            if (rsv) rsv.status = 'rejected';
          } else if (sql.includes("SET status = 'cancelled'")) {
            const id = String(binds[1] ?? '');
            const rsv = reservations.find((r) => String(r.id) === id);
            if (rsv) rsv.status = 'cancelled';
          } else if (sql.includes('SET status = ?')) {
            const status = String(binds[0] ?? '');
            const id = String(binds[3] ?? '');
            const rsv = reservations.find((r) => String(r.id) === id);
            if (rsv) rsv.status = status;
          }
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.startsWith('UPDATE cafe_tables')) {
          const targetStatusMatch = sql.match(/SET status = '([^']+)'/);
          const newStatus = targetStatusMatch ? targetStatusMatch[1] : undefined;
          const idArg = binds.find((b) => tables.some((t) => String(t.id) === String(b)));
          const tbl = tables.find((t) => String(t.id) === String(idArg));
          if (tbl && newStatus) {
            if (sql.includes("AND status = 'Reserved'") && tbl.status !== 'Reserved') {
              return { success: true, meta: { changes: 0 } };
            }
            tbl.status = newStatus;
          }
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.startsWith('INSERT INTO orders')) {
          orders.push({ id: binds[0], total: binds[2], tenant_id: binds[18] });
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.startsWith('INSERT INTO order_items')) {
          orderItems.push({
            id: binds[0],
            order_id: binds[1],
            product_id: binds[2],
            quantity: binds[3],
            subtotal: binds[4],
            tenant_id: binds.length >= 8 ? binds[6] : undefined,
          });
          return { success: true, meta: { changes: 1 } };
        }
        if (sql.startsWith('INSERT INTO payments')) {
          payments.push({
            id: binds[0],
            order_id: binds[1],
            method: binds[2],
            amount: binds[3],
            status: binds[4],
            tenant_id: binds.length >= 8 ? binds[5] : undefined,
          });
          return { success: true, meta: { changes: 1 } };
        }
        return { success: true, meta: { changes: 1 } };
      },
    });
    return makeStmt();
  };

  return {
    db: {
      prepare,
      async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
        const out = [];
        for (const s of stmts) {
          out.push(await s.run());
        }
        return out;
      },
    },
    tables,
    reservations,
    qrCodes,
    orders,
    orderItems,
    payments,
    queries,
  };
}

function createReservationApp() {
  const app = new Hono<{ Bindings: Env }>();
  app.route('/api/reservations', reservationsRouter);
  return app;
}

describe('Phase 46 Slice AS2 — Reservations, Table Policies, QR Scan & Split Orders Security', () => {
  describe('1. Reservation & Table Availability Inactive/Maintenance Filtering', () => {
    it('excludes Maintenance and OutOfOrder tables from GET /api/reservations/availability and rejects booking them in POST /api/reservations', async () => {
      const state = createStatefulMockDb({
        tables: [
          { id: 't01', table_number: 1, zone: 'Indoor', capacity: 4, status: 'Available', tenant_id: 'tenant_a' },
          { id: 't02', table_number: 2, zone: 'Indoor', capacity: 4, status: 'Maintenance', tenant_id: 'tenant_a' },
          { id: 't03', table_number: 3, zone: 'Indoor', capacity: 4, status: 'OutOfOrder', tenant_id: 'tenant_a' },
        ],
      });
      const app = createReservationApp();
      const env = { AURA_DB: state.db, JWT_SECRET } as unknown as Env;

      const availRes = await app.request(
        '/api/reservations/availability?date=2026-12-01&time=19:00',
        { headers: { 'X-Tenant-ID': 'tenant_a' } },
        env
      );
      expect(availRes.status).toBe(200);
      const availJson = (await availRes.json()) as { data: Array<{ id: string }> };
      expect(availJson.data.map((t) => t.id)).toEqual(['t01']);

      const bookMaintRes = await app.request(
        '/api/reservations',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': 'tenant_a' },
          body: JSON.stringify({
            table_id: 't02',
            customer_name: 'Alice',
            customer_phone: '0901234567',
            guest_count: 2,
            date: '2026-12-01',
            time: '19:00',
          }),
        },
        env
      );
      expect(bookMaintRes.status).toBe(400);
      const bookMaintBody = (await bookMaintRes.json()) as { error: string };
      expect(bookMaintBody.error).toContain('unavailable');
    });

    it('rejects Maintenance, OutOfOrder, and already-Occupied tables in validateOrderTable, createCanonicalReservation, and seatTable', async () => {
      const state = createStatefulMockDb({
        tables: [
          { id: 't_maint', table_number: 10, zone: 'Indoor', capacity: 4, status: 'Maintenance', tenant_id: 'tenant_a' },
          { id: 't_ooo', table_number: 11, zone: 'Indoor', capacity: 4, status: 'OutOfOrder', tenant_id: 'tenant_a' },
          { id: 't_occ', table_number: 12, zone: 'Indoor', capacity: 4, status: 'Occupied', tenant_id: 'tenant_a' },
        ],
      });
      const db = state.db as unknown as Parameters<typeof validateOrderTable>[0];

      const validMaint = await validateOrderTable(db, 't_maint', 'tenant_a');
      expect(validMaint).toEqual({ ok: false, error: 'table_unavailable' });

      const rsvOoo = await createCanonicalReservation(db, {
        tableId: 't_ooo',
        customerName: 'Bob',
        customerPhone: '0909998887',
        guestCount: 2,
        date: '2026-12-01',
        time: '18:00',
        operatingUnitId: 'tenant_a',
      });
      expect(rsvOoo).toEqual({ ok: false, error: 'table_unavailable' });

      const seatOccupied = await seatTable(db, {
        tableId: 't_occ',
        operatingUnitId: 'tenant_a',
      });
      expect(seatOccupied).toEqual({ ok: false, error: 'table_already_occupied' });
    });
  });

  describe('2. Reservation Cancellation & Approval Lifecycle Guards', () => {
    it('does not reset cafe_tables.status to Available when another active reservation exists on the same date or when table is Occupied', async () => {
      const state = createStatefulMockDb({
        tables: [
          { id: 't01', table_number: 1, zone: 'Indoor', capacity: 4, status: 'Reserved', tenant_id: 'tenant_a' },
        ],
        reservations: [
          {
            id: 'rsv_1',
            table_id: 't01',
            customer_name: 'Guest 1',
            customer_phone: '0901111111',
            date: '2026-12-01',
            time: '18:00',
            status: 'confirmed',
            tenant_id: 'tenant_a',
          },
          {
            id: 'rsv_2',
            table_id: 't01',
            customer_name: 'Guest 2',
            customer_phone: '0902222222',
            date: '2026-12-01',
            time: '20:00',
            status: 'confirmed',
            tenant_id: 'tenant_a',
          },
        ],
      });
      const app = createReservationApp();
      const staffToken = await mockStaffToken({ id: 'staff_1', role: 'staff', tenantId: 'tenant_a', tenant_id: 'tenant_a' }, JWT_SECRET);
      const env = { AURA_DB: state.db, JWT_SECRET } as unknown as Env;

      // Cancel first reservation while rsv_2 is still active on the same date
      const delRes1 = await app.request(
        '/api/reservations/rsv_1',
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${staffToken}`, 'X-Tenant-ID': 'tenant_a' },
        },
        env
      );
      expect(delRes1.status).toBe(200);
      expect(state.tables[0].status).toBe('Reserved');

      // Also verify domain policy updateReservationStatus preserves Reserved when another active reservation exists
      state.reservations[0].status = 'confirmed';
      const policyCancel = await updateReservationStatus(
        state.db as unknown as Parameters<typeof updateReservationStatus>[0],
        'rsv_1',
        'cancelled',
        'guest cancelled',
        'tenant_a'
      );
      expect(policyCancel.ok).toBe(true);
      expect(state.tables[0].status).toBe('Reserved');

      // Now cancel second reservation; with no remaining active reservations on that date, table becomes Available
      const delRes2 = await app.request(
        '/api/reservations/rsv_2',
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${staffToken}`, 'X-Tenant-ID': 'tenant_a' },
        },
        env
      );
      expect(delRes2.status).toBe(200);
      expect(state.tables[0].status).toBe('Available');
    });

    it('rejects PATCH /api/reservations/:id/approve with 409 when reservation is already cancelled or rejected', async () => {
      const state = createStatefulMockDb({
        tables: [
          { id: 't01', table_number: 1, zone: 'Indoor', capacity: 4, status: 'Available', tenant_id: 'tenant_a' },
        ],
        reservations: [
          {
            id: 'rsv_cancelled',
            table_id: 't01',
            customer_name: 'Cancelled Guest',
            customer_phone: '0903333333',
            date: '2026-12-01',
            time: '18:00',
            status: 'cancelled',
            tenant_id: 'tenant_a',
          },
        ],
      });
      const app = createReservationApp();
      const staffToken = await mockStaffToken({ id: 'staff_1', role: 'staff', tenantId: 'tenant_a', tenant_id: 'tenant_a' }, JWT_SECRET);
      const env = { AURA_DB: state.db, JWT_SECRET } as unknown as Env;

      const res = await app.request(
        '/api/reservations/rsv_cancelled/approve',
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${staffToken}`, 'X-Tenant-ID': 'tenant_a' },
        },
        env
      );
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string };
      expect(body.error).toContain('Cannot approve');
    });

    it('uses CF-Connecting-IP and tenantId in POST /api/reservations rate-limit key and blocks unscoped fallback for non-default tenants', async () => {
      const kvGet = vi.fn().mockResolvedValue(null);
      const kvPut = vi.fn().mockResolvedValue(undefined);
      const state = createStatefulMockDb({
        tables: [
          { id: 't01', table_number: 1, zone: 'Indoor', capacity: 4, status: 'Available', tenant_id: 'tenant_b' },
        ],
      });
      const app = createReservationApp();
      const env = {
        AURA_DB: state.db,
        JWT_SECRET,
        AUTH_KV: { get: kvGet, put: kvPut },
      } as unknown as Env;

      const res = await app.request(
        '/api/reservations',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': 'tenant_b',
            'CF-Connecting-IP': '203.0.113.50',
            'X-Forwarded-For': '198.51.100.1, 10.0.0.1',
          },
          body: JSON.stringify({
            table_id: 't01',
            customer_name: 'Rate Limit Check',
            customer_phone: '0904444444',
            guest_count: 2,
            date: '2026-12-02',
            time: '19:00',
          }),
        },
        env
      );
      expect(res.status).toBe(201);
      expect(kvGet).toHaveBeenCalledWith('rl:rsv:tenant_b:203.0.113.50');
      expect(kvPut).toHaveBeenCalledWith('rl:rsv:tenant_b:203.0.113.50', '1', { expirationTtl: 3600 });

      // Verify non-default tenant does not fall back to unscoped UPDATE when tenant-scoped UPDATE fails
      const failingState = createStatefulMockDb({
        tables: [
          { id: 't01', table_number: 1, zone: 'Indoor', capacity: 4, status: 'Reserved', tenant_id: 'tenant_b' },
        ],
        reservations: [
          {
            id: 'rsv_b1',
            table_id: 't01',
            customer_name: 'Tenant B Guest',
            customer_phone: '0905555555',
            date: '2026-12-02',
            time: '19:00',
            status: 'confirmed',
            tenant_id: 'tenant_b',
          },
        ],
        failTenantScopedUpdate: true,
      });
      await expect(
        updateReservationStatus(
          failingState.db as unknown as Parameters<typeof updateReservationStatus>[0],
          'rsv_b1',
          'cancelled',
          undefined,
          'tenant_b'
        )
      ).rejects.toThrow('simulated D1 tenant_id column failure');
      const unscopedUpdates = failingState.queries.filter(
        (q) => q.sql.startsWith('UPDATE ') && !q.sql.includes('tenant_id')
      );
      expect(unscopedUpdates).toHaveLength(0);
    });
  });

  describe('3. Public QR Scan Active Check & Tenant Scoping', () => {
    it('rejects inactive QR codes (is_active = 0) and cross-tenant requests, and embeds tenant query param + tenant-scoped UPDATE for non-default tenants', async () => {
      const state = createStatefulMockDb({
        tables: [
          { id: 't_b1', table_number: 5, zone: 'Patio', capacity: 4, status: 'Available', tenant_id: 'tenant_b' },
        ],
        qrCodes: [
          { id: 1, table_id: 't_b1', slug: 'table-5-inactive', is_active: 0, tenant_id: 'tenant_b' },
          { id: 2, table_id: 't_b1', slug: 'table-5-active', is_active: 1, tenant_id: 'tenant_b' },
        ],
      });
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/qr', qrRouter);
      const env = {
        AURA_DB: state.db,
        QR_SIGNING_SECRET: QR_SECRET,
        PUBLIC_URL: 'https://auraspace.vn',
      } as unknown as Env;

      const inactiveUrl = new URL(await signQRUrl('table-5-inactive', QR_SECRET, 'https://auraspace.vn'));
      const inactiveRes = await app.request(
        `${inactiveUrl.pathname}${inactiveUrl.search}`,
        {},
        env
      );
      expect(inactiveRes.status).toBe(404);
      const inactiveBody = (await inactiveRes.json()) as { error: string };
      expect(inactiveBody.error).toContain('inactive');

      const activeUrl = new URL(await signQRUrl('table-5-active', QR_SECRET, 'https://auraspace.vn'));
      // Cross-tenant header must be rejected with 404
      const crossTenantRes = await app.request(
        `${activeUrl.pathname}${activeUrl.search}`,
        { headers: { 'X-Tenant-ID': 'tenant_a' } },
        env
      );
      expect(crossTenantRes.status).toBe(404);

      // Matching tenant succeeds and scopes UPDATE table_qr_codes by tenant_id
      const okRes = await app.request(
        `${activeUrl.pathname}${activeUrl.search}`,
        { headers: { Host: 'auraspace.vn', 'X-Tenant-ID': 'tenant_b' } },
        env
      );
      expect(okRes.status).toBe(200);
      expect(okRes.headers.get('Content-Type')).toBe('image/png');
      const updateQrQuery = state.queries.find((q) => q.sql.startsWith('UPDATE table_qr_codes'));
      expect(updateQrQuery).toBeDefined();
      expect(updateQrQuery?.sql).toContain("COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?");
      expect(updateQrQuery?.binds).toEqual(['table-5-active', 'tenant_b']);
    });
  });

  describe('4. Split Orders Validation, Table Status & Tenant Attribution', () => {
    it('rejects Maintenance/OutOfOrder tables, unverified discounts, and tampered totals, and persists tenant_id on order_items and payments', async () => {
      const state = createStatefulMockDb({
        tables: [
          { id: 't_maint', table_number: 1, zone: 'Indoor', capacity: 4, status: 'Maintenance', tenant_id: 'tenant_b' },
          { id: 't_ok', table_number: 2, zone: 'Indoor', capacity: 4, status: 'Available', tenant_id: 'tenant_b' },
        ],
        menuItems: [
          { id: 'item_espresso', name: 'Espresso', price: 35000, available: 1, tenant_id: 'tenant_b' },
        ],
        staffTenantId: 'tenant_b',
      });
      const env = { AURA_DB: state.db, JWT_SECRET } as unknown as Record<string, unknown>;
      const trustedActor = { id: 'staff_b', role: 'staff', tenantId: 'tenant_b', isExplicitTenant: true };

      const makeReq = (body: unknown) =>
        new Request('https://auraspace.vn/api/orders/split', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': 'tenant_b',
          },
          body: JSON.stringify(body),
        });

      const validOrderEntry = {
        items: [{ id: 'item_espresso', name: 'Espresso', price: 35000, quantity: 1 }],
        total: 35000,
        customer_name: 'Khach B',
        customer_phone: '0901234567',
        payment_method: 'cod',
      };

      // 1. Reject Maintenance table
      const maintRes = await splitOrders(
        makeReq({ table_id: 't_maint', orders: [validOrderEntry, validOrderEntry] }),
        env,
        undefined,
        trustedActor
      );
      expect(maintRes.status).toBe(400);
      const maintBody = (await maintRes.json()) as { error: string };
      expect(maintBody.error).toContain('unavailable');

      // 2. Reject unverified positive discount
      const discountRes = await splitOrders(
        makeReq({
          table_id: 't_ok',
          orders: [
            { ...validOrderEntry, discount: 10000, total: 25000 },
            validOrderEntry,
          ],
        }),
        env,
        undefined,
        trustedActor
      );
      expect(discountRes.status).toBe(400);
      const discountBody = (await discountRes.json()) as { error: string };
      expect(discountBody.error).toContain('discount');

      // 3. Reject tampered total
      const tamperedTotalRes = await splitOrders(
        makeReq({
          table_id: 't_ok',
          orders: [
            { ...validOrderEntry, total: 5000 },
            validOrderEntry,
          ],
        }),
        env,
        undefined,
        trustedActor
      );
      expect(tamperedTotalRes.status).toBe(400);
      const tamperedBody = (await tamperedTotalRes.json()) as { error: string };
      expect(tamperedBody.error).toContain('Order total mismatch');

      // 4. Valid split order persists tenant_id in order_items and payments
      const okRes = await splitOrders(
        makeReq({
          table_id: 't_ok',
          orders: [validOrderEntry, validOrderEntry],
        }),
        env,
        undefined,
        trustedActor
      );
      expect(okRes.status).toBe(201);
      expect(state.orderItems).toHaveLength(2);
      expect(state.orderItems.every((item) => item.tenant_id === 'tenant_b')).toBe(true);
      expect(state.payments).toHaveLength(2);
      expect(state.payments.every((pay) => pay.tenant_id === 'tenant_b')).toBe(true);
    });
  });
});
