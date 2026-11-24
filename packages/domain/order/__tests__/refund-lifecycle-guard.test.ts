// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { transitionOrderStatus, type OrderStatusDb } from '../policies/order-status-transition';
import { updateOrder } from '../commands/update-order';
import { isHeldOutOfKds } from '../../kitchen/policies/kds-hold-policy';
import { paymentSqliteDB } from '../../../../worker/src/__tests__/helpers/payment-sqlite-db';

afterEach(() => vi.restoreAllMocks());

function makeMockDb(orderRow: Record<string, unknown>): OrderStatusDb {
  return {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => orderRow),
        run: vi.fn(async () => ({ meta: { changes: 1 } })),
        all: vi.fn(async () => ({ results: [] })),
      })),
    })),
  } as unknown as OrderStatusDb;
}

describe('Refunded order lifecycle guards (#172)', () => {
  it('blocks forward status transitions when payment_status is refunded', async () => {
    const db = makeMockDb({
      id: 'ord-ref-1',
      status: 'preparing',
      payment_status: 'refunded',
      payment_method: 'payos',
      order_type: 'dine_in',
      table_id: 't1',
      tenant_id: 'default',
    });

    const res = await transitionOrderStatus(db, 'ord-ref-1', 'ready', 'admin', {
      tenantId: 'default',
    });

    expect(res.success).toBe(false);
    expect(res.statusCode).toBe(409);
    expect(String(res.error ?? '')).toContain('hoàn tiền');
  });

  it('holds refunded orders out of active KDS queue', () => {
    expect(
      isHeldOutOfKds({
        status: 'preparing',
        payment_method: 'payos',
        payment_status: 'refunded',
        order_type: 'dine_in',
      }),
    ).toBe(true);
  });

  it('blocks switching a delivery order payment_method to cod or cash', async () => {
    let capturedSql = '';
    const db = {
      prepare: vi.fn((sql: string) => {
        if (!capturedSql && sql.includes('SELECT')) capturedSql = sql;
        return {
          bind: vi.fn(() => ({
            all: vi.fn(async () => ({
              results: [
                {
                  id: 'ord-deliv-1',
                  status: 'pending',
                  items: '[]',
                  total: 55000,
                  payment_status: 'unpaid',
                  order_type: 'delivery',
                  customer_name: 'Tester',
                  customer_phone: '0901234567',
                  table_id: null,
                  created_at: '2026-11-24T00:00:00Z',
                  tenant_id: 'default',
                  session_id: null,
                },
              ],
            })),
            first: vi.fn(async () => null),
            run: vi.fn(async () => ({ meta: { changes: 1 } })),
          })),
        };
      }),
    };

    const req = new Request('http://localhost/api/orders/ord-deliv-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method: 'cod' }),
    });
    const res = await updateOrder(
      req,
      { AURA_DB: db } as unknown as Parameters<typeof updateOrder>[1],
      'ord-deliv-1',
      'admin',
      'default',
    );

    expect(capturedSql).toContain('order_type');
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error?: string };
    expect(String(json.error ?? '')).toContain('PayOS');
  });

  it('preserves order_type in the fallback SELECT when session_id is absent and still blocks delivery cash/cod switch', async () => {
    const { db, sqlite } = paymentSqliteDB();
    sqlite.exec("ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in'");
    sqlite
      .prepare(
        `INSERT INTO orders (id, total, status, payment_status, payment_method, order_type, tenant_id)
         VALUES ('ord-no-session-deliv', 55000, 'pending', 'unpaid', 'payos', 'delivery', 'default')`,
      )
      .run();

    const req = new Request('http://localhost/api/orders/ord-no-session-deliv', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_method: 'cash' }),
    });
    const res = await updateOrder(
      req,
      { AURA_DB: db } as unknown as Parameters<typeof updateOrder>[1],
      'ord-no-session-deliv',
      'admin',
      'default',
    );
    expect(res.status).toBe(400);
    expect(sqlite.prepare("SELECT payment_method FROM orders WHERE id = 'ord-no-session-deliv'").get()?.payment_method).toBe('payos');
  });

  it('persists payment_method atomically with status transition and cancels open PayOS attempts when switching away from payos', async () => {
    const { db, sqlite } = paymentSqliteDB();
    sqlite.exec("ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in'");
    sqlite
      .prepare(
        `INSERT INTO orders (id, total, status, payment_status, payment_method, order_type, tenant_id)
         VALUES ('ord-switch-prep', 45000, 'confirmed', 'unpaid', 'payos', 'dine_in', 'default')`,
      )
      .run();
    sqlite
      .prepare(
        `INSERT INTO payments (id, order_id, method, amount, status, transaction_id, payment_url)
         VALUES ('pay-open-1', 'ord-switch-prep', 'payos', 45000, 'pending', '778899', 'https://pay.payos.vn/web/778899')`,
      )
      .run();

    const cancelCalls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      cancelCalls.push(String(url));
      return new Response(JSON.stringify({ code: '00' }), { status: 200 });
    });

    const req = new Request('http://localhost/api/orders/ord-switch-prep', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'preparing', payment_method: 'cash' }),
    });
    const res = await updateOrder(
      req,
      {
        AURA_DB: db,
        PAYOS_CLIENT_ID: 'cid',
        PAYOS_API_KEY: 'akey',
        PAYOS_CHECKSUM_KEY: 'ckey',
      } as unknown as Parameters<typeof updateOrder>[1],
      'ord-switch-prep',
      'admin',
      'default',
    );

    expect(res.status).toBe(200);
    expect(sqlite.prepare("SELECT status, payment_method FROM orders WHERE id = 'ord-switch-prep'").get()).toMatchObject({
      status: 'preparing',
      payment_method: 'cash',
    });
    expect(cancelCalls).toContain('https://api-merchant.payos.vn/v2/payment-requests/778899/cancel');
    expect(sqlite.prepare("SELECT status FROM payments WHERE id = 'pay-open-1'").get()?.status).toBe('cancelled');
  });

  it('enforces prepaid online payment gate when transitioning to preparing while simultaneously switching payment_method to payos', async () => {
    const { db, sqlite } = paymentSqliteDB();
    sqlite.exec("ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in'");
    sqlite
      .prepare(
        `INSERT INTO orders (id, total, status, payment_status, payment_method, order_type, tenant_id)
         VALUES ('ord-switch-payos', 45000, 'confirmed', 'unpaid', 'cash', 'dine_in', 'default')`,
      )
      .run();

    const req = new Request('http://localhost/api/orders/ord-switch-payos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'preparing', payment_method: 'payos' }),
    });
    const res = await updateOrder(
      req,
      { AURA_DB: db } as unknown as Parameters<typeof updateOrder>[1],
      'ord-switch-payos',
      'admin',
      'default',
    );

    expect(res.status).toBe(409);
    expect(sqlite.prepare("SELECT status, payment_method FROM orders WHERE id = 'ord-switch-payos'").get()).toMatchObject({
      status: 'confirmed',
      payment_method: 'cash',
    });
  });

  it('guards payment_method updates against settled orders and preserves partially_refunded completion', async () => {
    const { db, sqlite } = paymentSqliteDB();
    sqlite
      .prepare(
        `INSERT INTO orders (id, total, status, payment_status, payment_method, tenant_id)
         VALUES
           ('ord-unpaid-close', 40000, 'served', 'unpaid', 'payos', 'default'),
           ('ord-paid-close', 40000, 'served', 'paid', 'payos', 'default'),
           ('ord-partial-close', 40000, 'served', 'partially_refunded', 'payos', 'default')`,
      )
      .run();

    // Unpaid order cannot complete by injecting payment_method: 'cash'
    const unpaidClose = await transitionOrderStatus(db, 'ord-unpaid-close', 'completed', 'staff', {
      tenantId: 'default',
      fields: { payment_method: 'cash' },
    });
    expect(unpaidClose).toMatchObject({ success: false, statusCode: 409 });
    expect(sqlite.prepare("SELECT status, payment_method FROM orders WHERE id = 'ord-unpaid-close'").get()).toMatchObject({
      status: 'served',
      payment_method: 'payos',
    });

    // Settled order cannot have payment_method overwritten during transition
    const paidRewrite = await transitionOrderStatus(db, 'ord-paid-close', 'completed', 'staff', {
      tenantId: 'default',
      fields: { payment_method: 'cash' },
    });
    expect(paidRewrite).toMatchObject({ success: false, statusCode: 409 });
    expect(sqlite.prepare("SELECT status, payment_method FROM orders WHERE id = 'ord-paid-close'").get()).toMatchObject({
      status: 'served',
      payment_method: 'payos',
    });

    // Partially refunded order completes cleanly when payment_method is not mutated
    const partialClose = await transitionOrderStatus(db, 'ord-partial-close', 'completed', 'staff', {
      tenantId: 'default',
    });
    expect(partialClose).toMatchObject({ success: true });
    expect(sqlite.prepare("SELECT status FROM orders WHERE id = 'ord-partial-close'").get()?.status).toBe('completed');
  });
});
