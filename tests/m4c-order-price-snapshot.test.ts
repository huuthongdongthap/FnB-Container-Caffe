/**
 * M4-C Phase 02: Server-Authoritative Order Price Snapshotting & Line Items Tests
 *
 * Verifies:
 * 1. Snapshotting evaluates canonical base prices from menu_items (client price tampered → discarded).
 * 2. Channel deltas, modifier deltas, and happy hour discounts resolve accurately.
 * 3. Unavailable items (available = 0) result in rejection.
 * 4. Immutable line items and server-evaluated totals are written to DB.
 */
import { describe, it, expect } from 'vitest';
import { calculateOrderSnapshot, createOrder } from '../packages/domain/order';
import type { RawOrderItemInput } from '../packages/domain/order';

interface MockMenuItem {
  id: string;
  name: string;
  price: number;
  available: number;
}

interface MockHappyHour {
  id: string;
  name: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  discount_rate: number;
  active: number;
  priority: number;
}

function createMockD1Database(options: {
  menuItems?: MockMenuItem[];
  happyHours?: MockHappyHour[];
  tables?: Array<{ id: string; table_number: string; status: string }>;
} = {}) {
  const menuItems = options.menuItems || [];
  const happyHours = options.happyHours || [];
  const tables = options.tables || [];
  const insertedOrders: Array<Record<string, unknown>> = [];
  const insertedPayments: Array<Record<string, unknown>> = [];

  return {
    insertedOrders,
    insertedPayments,
    db: {
      prepare(sql: string) {
        return {
          bind(...args: unknown[]) {
            return {
              async first<T = unknown>(): Promise<T | null> {
                if (sql.includes('FROM menu_items WHERE id = ?')) {
                  const id = args[0] as string;
                  const item = menuItems.find((m) => m.id === id);
                  return (item as unknown as T) || null;
                }
                if (sql.includes('FROM cafe_tables WHERE table_number = ?')) {
                  const num = args[0] as string;
                  const table = tables.find((t) => t.table_number === num);
                  return (table as unknown as T) || null;
                }
                if (sql.includes('FROM customers WHERE email = ?')) {
                  return null;
                }
                return null;
              },
              async all<T = unknown>(): Promise<{ results?: T[] } | T[]> {
                if (sql.includes('FROM happy_hour_windows WHERE active = 1')) {
                  const active = happyHours.filter((h) => h.active === 1);
                  return { results: active as unknown as T[] };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes('INSERT INTO orders')) {
                  insertedOrders.push({ sql, args });
                }
                if (sql.includes('INSERT INTO payments')) {
                  insertedPayments.push({ sql, args });
                }
                return { success: true };
              },
            };
          },
        };
      },
      async batch(stmts: Array<{ run: () => Promise<unknown> }>) {
        for (const s of stmts) {
          await s.run();
        }
        return [];
      },
    },
  };
}

describe('calculateOrderSnapshot Policy', () => {
  const menuItems: MockMenuItem[] = [
    { id: 'item_cf_den', name: 'Cà Phê Đen', price: 25000, available: 1 },
    { id: 'item_cf_sua', name: 'Cà Phê Sữa', price: 29000, available: 1 },
    { id: 'item_banh_mi', name: 'Bánh Mì Thịt', price: 35000, available: 1 },
    { id: 'item_out_of_stock', name: 'Trà Sen Vàng', price: 45000, available: 0 },
  ];

  it('evaluates canonical base prices and ignores client-injected prices', async () => {
    const { db } = createMockD1Database({ menuItems });
    const rawItems: RawOrderItemInput[] = [
      { id: 'item_cf_den', name: 'Tampered Name', price: 1000, quantity: 2 }, // Client claimed 1,000 VND
      { id: 'item_cf_sua', price: 500, quantity: 1 }, // Client claimed 500 VND
    ];

    const snapshot = await calculateOrderSnapshot(db, {
      items: rawItems,
      order_type: 'dine_in',
    });

    expect(snapshot.rejected).toBeNull();
    expect(snapshot.items).toHaveLength(2);

    // Item 1: 25,000 * 2 = 50,000
    expect(snapshot.items[0].unitPriceCents).toBe(25000);
    expect(snapshot.items[0].subtotalCents).toBe(50000);
    expect(snapshot.items[0].name).toBe('Cà Phê Đen');

    // Item 2: 29,000 * 1 = 29,000
    expect(snapshot.items[1].unitPriceCents).toBe(29000);
    expect(snapshot.items[1].subtotalCents).toBe(29000);

    expect(snapshot.subtotal).toBe(79000);
    expect(snapshot.total).toBe(79000);
  });

  it('correctly calculates total with shipping, discount, tip, and service fees', async () => {
    const { db } = createMockD1Database({ menuItems });
    const rawItems: RawOrderItemInput[] = [
      { id: 'item_banh_mi', quantity: 2 }, // 35,000 * 2 = 70,000
    ];

    const snapshot = await calculateOrderSnapshot(db, {
      items: rawItems,
      order_type: 'delivery',
      shipping_fee: 15000,
      discount: 10000,
      service_fee: 5000,
      tip_amount: 10000,
    });

    expect(snapshot.rejected).toBeNull();
    expect(snapshot.subtotal).toBe(70000);
    expect(snapshot.shipping_fee).toBe(15000);
    expect(snapshot.discount).toBe(10000);
    expect(snapshot.service_fee).toBe(5000);
    expect(snapshot.tip_amount).toBe(10000);
    // 70,000 + 15,000 - 10,000 + 5,000 + 10,000 = 90,000
    expect(snapshot.total).toBe(90000);
  });

  it('rejects order when item is marked unavailable (available = 0)', async () => {
    const { db } = createMockD1Database({ menuItems });
    const rawItems: RawOrderItemInput[] = [
      { id: 'item_cf_den', quantity: 1 },
      { id: 'item_out_of_stock', quantity: 1 },
    ];

    const snapshot = await calculateOrderSnapshot(db, {
      items: rawItems,
      order_type: 'dine_in',
    });

    expect(snapshot.rejected).not.toBeNull();
    expect(snapshot.rejected?.code).toBe('item_unavailable');
    expect(snapshot.rejected?.message).toContain('item_out_of_stock');
  });

  it('applies modifiers price deltas to unit price', async () => {
    const { db } = createMockD1Database({ menuItems });
    const rawItems: RawOrderItemInput[] = [
      {
        id: 'item_cf_sua', // base: 29,000
        quantity: 2,
        modifiers: [
          { id: 'extra_shot', group_id: 'g1', name: 'Extra Shot', price_delta: 10000, is_default: 0, sort_order: 1 },
          { id: 'oat_milk', group_id: 'g2', name: 'Oat Milk', price_delta: 5000, is_default: 0, sort_order: 2 },
        ],
      },
    ];

    const snapshot = await calculateOrderSnapshot(db, {
      items: rawItems,
      order_type: 'dine_in',
    });

    expect(snapshot.rejected).toBeNull();
    // Unit price: 29,000 + 10,000 + 5,000 = 44,000
    expect(snapshot.items[0].unitPriceCents).toBe(44000);
    // Subtotal: 44,000 * 2 = 88,000
    expect(snapshot.items[0].subtotalCents).toBe(88000);
    expect(snapshot.total).toBe(88000);
  });

  it('applies happy hour discounts from DB windows', async () => {
    // 2026-09-16 is a Wednesday (day 3)
    const happyHours: MockHappyHour[] = [
      {
        id: 'hh_wednesday',
        name: 'Wednesday Afternoons',
        day_of_week: 3,
        start_time: '14:00',
        end_time: '17:00',
        discount_rate: 20, // 20% discount
        active: 1,
        priority: 1,
      },
    ];

    const { db } = createMockD1Database({ menuItems, happyHours });
    const snapshot = await calculateOrderSnapshot(db, {
      items: [{ id: 'item_cf_den', quantity: 2 }], // 25,000 * 2 = 50,000
      order_type: 'dine_in',
      now: new Date('2026-09-16T15:00:00'), // Wednesday 15:00 inside window
    });

    expect(snapshot.rejected).toBeNull();
    // 25,000 - 20% (5,000) = 20,000 unit price
    expect(snapshot.items[0].unitPriceCents).toBe(20000);
    expect(snapshot.items[0].subtotalCents).toBe(40000);
    expect(snapshot.total).toBe(40000);
  });
});

describe('createOrder Command Integration with Authoritative Snapshot', () => {
  const menuItems: MockMenuItem[] = [
    { id: 'item_cf_den', name: 'Cà Phê Đen', price: 25000, available: 1 },
    { id: 'item_cf_sua', name: 'Cà Phê Sữa', price: 30000, available: 1 },
    { id: 'item_out_of_stock', name: 'Trà Sen Vàng', price: 45000, available: 0 },
  ];

  it('discards client total and writes authoritative total and snapshot items to D1', async () => {
    const { db, insertedOrders, insertedPayments } = createMockD1Database({
      menuItems,
      tables: [{ id: 'tbl_uuid_1', table_number: 'B01', status: 'Available' }],
    });

    const env = {
      AURA_DB: db,
      AUTH_KV: {
        get: async () => null,
        put: async () => {},
      },
    };

    const req = new Request('https://api.aura.cafe/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Nguyen Van A',
        customer_phone: '0901234567',
        payment_method: 'cod',
        order_type: 'dine_in',
        table_id: 'B01',
        total: 1000, // Malicious client claims 1,000 VND total
        items: [
          { id: 'item_cf_den', name: 'Cà Phê Đen', quantity: 2, price: 500 }, // 2 * 25,000 = 50,000
          { id: 'item_cf_sua', name: 'Cà Phê Sữa', quantity: 1, price: 500 }, // 1 * 30,000 = 30,000
        ],
      }),
    });

    const res = await createOrder(req, env as unknown as Record<string, unknown>);
    expect(res.status).toBe(201);

    const body = await res.json() as { success: boolean; data: { total: number; items: Array<{ unitPriceCents: number; subtotalCents: number }> } };
    expect(body.success).toBe(true);
    // Authoritative total: 50,000 + 30,000 = 80,000
    expect(body.data.total).toBe(80000);
    expect(body.data.items[0].unitPriceCents).toBe(25000);
    expect(body.data.items[0].subtotalCents).toBe(50000);
    expect(body.data.items[1].unitPriceCents).toBe(30000);
    expect(body.data.items[1].subtotalCents).toBe(30000);

    // Verify D1 order insert binding has authoritative 80,000
    expect(insertedOrders).toHaveLength(1);
    const orderBindArgs = insertedOrders[0].args as unknown[];
    const boundTotal = orderBindArgs[2];
    expect(boundTotal).toBe(80000);

    // Verify payment record has authoritative 80,000
    expect(insertedPayments).toHaveLength(1);
    const paymentBindArgs = insertedPayments[0].args as unknown[];
    const paymentAmount = paymentBindArgs[3];
    expect(paymentAmount).toBe(80000);
  });

  it('returns 400 Bad Request when customer orders an unavailable item', async () => {
    const { db } = createMockD1Database({ menuItems });
    const env = {
      AURA_DB: db,
    };

    const req = new Request('https://api.aura.cafe/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: 'Tran B',
        customer_phone: '0901234567',
        payment_method: 'cod',
        order_type: 'takeaway',
        total: 45000,
        items: [
          { id: 'item_out_of_stock', name: 'Trà Sen Vàng', quantity: 1 },
        ],
      }),
    });

    const res = await createOrder(req, env as unknown as Record<string, unknown>);
    expect(res.status).toBe(400);

    const body = await res.json() as { success: boolean; error: string };
    expect(body.success).toBe(false);
    expect(body.error).toContain('item_out_of_stock');
  });
});
