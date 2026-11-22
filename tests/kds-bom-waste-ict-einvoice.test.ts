// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { paymentSqliteDB } from '../worker/src/__tests__/helpers/payment-sqlite-db';
import { createMockEnv } from '../worker/src/__tests__/test-utils';
import { convertRecipeQuantity } from '../packages/domain/inventory/src/policies/inventory-recipe-policy';
import { restoreInventoryForOrder } from '../packages/domain/inventory/src/routes/order-deduction';
import { handleGetKdsOrders } from '../worker/src/routes/orders-hono-handlers/kds-handlers';
import { collectCodPayment } from '../packages/domain/kitchen/commands/collect-cod-payment';
import { handleCancelOrder } from '../worker/src/routes/openapi-orders-handlers/order-cancel-handlers';
import { reservationsRouter } from '../packages/domain/reservation/src/routes/reservations';
import { resolveOrderCreationTable } from '../packages/domain/order/policies/order-creation-scope';
import { getStats } from '../packages/domain/order/queries/stats';

const databases: ReturnType<typeof paymentSqliteDB>['sqlite'][] = [];
afterEach(() => {
  databases.splice(0).forEach((db) => {
    try {
      db.close();
    } catch {
      // closed
    }
  });
});

function setupTestDb() {
  const { db, sqlite } = paymentSqliteDB();
  databases.push(sqlite);
  sqlite.exec(`
    ALTER TABLE orders ADD COLUMN order_type TEXT DEFAULT 'dine_in';
    ALTER TABLE orders ADD COLUMN previous_status TEXT;
    ALTER TABLE orders ADD COLUMN cancelled_at TEXT;
    ALTER TABLE orders ADD COLUMN cancel_alert INTEGER DEFAULT 0;

    CREATE TABLE IF NOT EXISTS cafe_tables (
      id TEXT PRIMARY KEY,
      table_number TEXT,
      name TEXT,
      zone TEXT,
      capacity INTEGER DEFAULT 4,
      status TEXT DEFAULT 'Available',
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      table_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      guest_count INTEGER,
      date TEXT,
      time TEXT,
      zone TEXT,
      notes TEXT,
      status TEXT DEFAULT 'confirmed',
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_active_slot
      ON reservations(tenant_id, table_id, date, time)
      WHERE status NOT IN ('cancelled', 'no_show', 'rejected');

    CREATE TABLE IF NOT EXISTS inventory_items (
      id TEXT PRIMARY KEY,
      sku TEXT,
      tenant_id TEXT DEFAULT 'default',
      name TEXT,
      unit TEXT DEFAULT 'kg',
      current_stock REAL DEFAULT 0,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id TEXT PRIMARY KEY,
      item_id TEXT,
      type TEXT,
      quantity REAL,
      reference_id TEXT,
      reference_type TEXT,
      notes TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      name TEXT,
      sku TEXT,
      unit TEXT DEFAULT 'kg',
      current_stock REAL DEFAULT 0,
      tenant_id TEXT DEFAULT 'default',
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      ingredient_id TEXT,
      type TEXT,
      quantity REAL,
      reference_id TEXT,
      reference_type TEXT,
      notes TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS waste_log (
      id TEXT PRIMARY KEY,
      ingredient_id TEXT,
      quantity REAL,
      unit TEXT,
      reason TEXT,
      notes TEXT,
      tenant_id TEXT DEFAULT 'default',
      order_id TEXT,
      item_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS staff_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id TEXT,
      tenant_id TEXT DEFAULT 'default',
      date TEXT,
      clock_in TEXT,
      clock_out TEXT,
      cash_sales REAL DEFAULT 0,
      total_sales REAL DEFAULT 0,
      order_count INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS erpnext_mappings (
      id TEXT PRIMARY KEY,
      local_type TEXT,
      local_id TEXT,
      aura_order_id TEXT,
      erpnext_id TEXT,
      erpnext_invoice_id TEXT,
      sync_status TEXT,
      tenant_id TEXT DEFAULT 'default'
    );
  `);
  const env = createMockEnv({ AURA_DB: db, PILOT_TENANT_ID: 'default', AUTH_KV: null });
  return { db, sqlite, env };
}

describe('BOM Unit Conversions', () => {
  it('converts units within the same dimension with floating-point stability', () => {
    // 18 grams -> kg
    expect(convertRecipeQuantity(18, 'g', 'kg')).toBe(0.018);
    // 2 kg stock minus 18g deduction -> 1.982 kg remaining
    const remaining = 2 - convertRecipeQuantity(18, 'g', 'kg');
    expect(remaining).toBe(1.982);

    // 180 ml -> liters
    expect(convertRecipeQuantity(180, 'ml', 'l')).toBe(0.18);
    // 1.5 l -> ml
    expect(convertRecipeQuantity(1.5, 'l', 'ml')).toBe(1500);

    // Units matching or empty stay identity
    expect(convertRecipeQuantity(2, 'portion', 'portion')).toBe(2);
    expect(convertRecipeQuantity(3, null, null)).toBe(3);
  });

  it('rejects conversions between incompatible dimensions', () => {
    expect(() => convertRecipeQuantity(100, 'g', 'ml')).toThrow(/Incompatible inventory units/);
    expect(() => convertRecipeQuantity(1, 'portion', 'kg')).toThrow(/Incompatible inventory units/);
  });
});

describe('KDS Prepaid Gate & Cancel Alerts', () => {
  it('gates unpaid online prepaid orders across all order types until paid', async () => {
    const { sqlite, env } = setupTestDb();
    sqlite.exec(`
      INSERT INTO orders (id, tenant_id, order_type, payment_method, payment_status, status, items, customer_name, created_at)
      VALUES
        ('ord_dinein_unpaid', 'default', 'dine_in', 'payos', 'unpaid', 'confirmed', '[]', 'Dine In Guest', datetime('now')),
        ('ord_takeaway_unpaid', 'default', 'takeaway', 'payos', 'unpaid', 'confirmed', '[]', 'Takeaway Guest', datetime('now')),
        ('ord_delivery_unpaid', 'default', 'delivery', 'payos', 'unpaid', 'confirmed', '[]', 'Delivery Guest', datetime('now')),
        ('ord_dinein_paid', 'default', 'dine_in', 'payos', 'paid', 'confirmed', '[]', 'Paid Dine In', datetime('now')),
        ('ord_cod_delivery', 'default', 'delivery', 'cod', 'unpaid', 'confirmed', '[]', 'COD Delivery', datetime('now')),
        ('ord_counter_cash', 'default', 'dine_in', 'cash', 'unpaid', 'confirmed', '[]', 'Cash Counter', datetime('now'));
    `);

    const app = new Hono();
    app.get('/kds', async (c) => {
      c.set('user' as any, { role: 'kitchen', tenantId: 'default' });
      return handleGetKdsOrders(c as any);
    });

    const res = await app.request('http://localhost/kds', {
      headers: { 'X-Tenant-ID': 'default' },
    }, env as any);

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: Array<{ id: string }> };
    const queueIds = body.data.map((o) => o.id);

    expect(queueIds).not.toContain('ord_dinein_unpaid');
    expect(queueIds).not.toContain('ord_takeaway_unpaid');
    expect(queueIds).not.toContain('ord_delivery_unpaid');
    expect(queueIds).toContain('ord_dinein_paid');
    expect(queueIds).toContain('ord_cod_delivery');
    expect(queueIds).toContain('ord_counter_cash');
  });

  it('surfaces recently cancelled orders that had entered preparation as cancel alerts', async () => {
    const { sqlite, env } = setupTestDb();
    sqlite.exec(`
      INSERT INTO orders (id, tenant_id, order_type, payment_method, payment_status, status, previous_status, items, customer_name, created_at, cancelled_at)
      VALUES
        ('ord_cancelled_prep', 'default', 'dine_in', 'cash', 'unpaid', 'cancelled', 'preparing', '[]', 'Alert Customer', datetime('now', '-2 minutes'), datetime('now', '-1 minute')),
        ('ord_cancelled_pending', 'default', 'dine_in', 'cash', 'unpaid', 'cancelled', 'pending', '[]', 'Silent Customer', datetime('now', '-2 minutes'), datetime('now', '-1 minute'));
    `);

    const app = new Hono();
    app.get('/kds', async (c) => {
      c.set('user' as any, { role: 'kitchen', tenantId: 'default' });
      return handleGetKdsOrders(c as any);
    });

    const res = await app.request('http://localhost/kds', {
      headers: { 'X-Tenant-ID': 'default' },
    }, env as any);

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: Array<{ id: string; cancel_alert?: boolean }> };
    const alertOrder = body.data.find((o) => o.id === 'ord_cancelled_prep');
    const silentOrder = body.data.find((o) => o.id === 'ord_cancelled_pending');

    expect(alertOrder).toBeDefined();
    expect(alertOrder?.cancel_alert).toBe(true);
    expect(silentOrder).toBeUndefined();
  });
});

describe('COD Payment & Shift Sales Attribution', () => {
  it('attributes collected COD amount to the open cashier shift atomically', async () => {
    const { db, sqlite } = setupTestDb();
    sqlite.exec(`
      ALTER TABLE payments ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'default';
      CREATE TABLE shift_reconciliations (shift_id TEXT, tenant_id TEXT);
      CREATE TABLE cash_payment_attributions (
        payment_id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, shift_id TEXT NOT NULL,
        collected_by TEXT NOT NULL, settled_at TEXT NOT NULL
      );
      INSERT INTO staff_shifts (staff_id, tenant_id, date, clock_in, clock_out, cash_sales, total_sales, order_count)
      VALUES ('cashier_1', 'default', '2026-11-15', datetime('now', '-1 hour'), NULL, 0, 0, 0);
      INSERT INTO orders (id, tenant_id, total, payment_method, payment_status, status, is_cod)
      VALUES ('ord_cod_1', 'default', 55000, 'cod', 'unpaid', 'confirmed', 1);
    `);

    const result = await collectCodPayment(db as any, 'ord_cod_1', 'default', 'cashier_1');
    expect(result.success).toBe(true);

    const shift = sqlite.prepare('SELECT cash_sales, total_sales, order_count FROM staff_shifts WHERE staff_id = ?').get('cashier_1') as {
      cash_sales: number;
      total_sales: number;
      order_count: number;
    };

    expect(shift.cash_sales).toBe(55000);
    expect(shift.total_sales).toBe(55000);
    expect(shift.order_count).toBe(1);
  });
});

describe('Append-Only Inventory Ledger (Restock vs Waste)', () => {
  it('restores stock and writes release transaction when cancelling pre-prep order', async () => {
    const { env, sqlite } = setupTestDb();
    sqlite.exec(`
      INSERT INTO inventory_items (id, sku, tenant_id, unit, current_stock)
      VALUES ('item_coffee', 'CF-01', 'default', 'kg', 1.982);
      INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, tenant_id)
      VALUES ('tx_res_1', 'item_coffee', 'reserve', 0.018, 'ord_cancel_pending', 'order', 'default');
      INSERT INTO orders (id, tenant_id, status) VALUES ('ord_cancel_pending', 'default', 'pending');
    `);

    await restoreInventoryForOrder(env as any, 'ord_cancel_pending', 'default', 'pending');

    const item = sqlite.prepare('SELECT current_stock FROM inventory_items WHERE id = ?').get('item_coffee') as { current_stock: number };
    // Stock restored from 1.982 + 0.018 -> 2.0
    expect(Math.round(item.current_stock * 1e4) / 1e4).toBe(2);

    const txs = sqlite.prepare("SELECT type, quantity FROM inventory_transactions WHERE reference_id = ? AND type = 'release'").all('ord_cancel_pending') as Array<{ type: string; quantity: number }>;
    expect(txs.length).toBe(1);
    expect(txs[0].type).toBe('release');
  });

  it('keeps clean stock unchanged and writes waste transaction when cancelling post-prep order', async () => {
    const { env, sqlite } = setupTestDb();
    sqlite.exec(`
      INSERT INTO inventory_items (id, sku, tenant_id, unit, current_stock)
      VALUES ('item_milk', 'ML-01', 'default', 'l', 1.82);
      INSERT INTO inventory_transactions (id, item_id, type, quantity, reference_id, reference_type, tenant_id)
      VALUES ('tx_res_2', 'item_milk', 'reserve', 0.18, 'ord_cancel_prep', 'order', 'default');
      INSERT INTO ingredients (id, name, sku, unit, current_stock, tenant_id)
      VALUES ('item_milk', 'Fresh Milk', 'ML-01', 'l', 1.82, 'default');
      INSERT INTO orders (id, tenant_id, status) VALUES ('ord_cancel_prep', 'default', 'preparing');
    `);

    await restoreInventoryForOrder(env as any, 'ord_cancel_prep', 'default', 'preparing');

    const item = sqlite.prepare('SELECT current_stock FROM inventory_items WHERE id = ?').get('item_milk') as { current_stock: number };
    // Stock remains 1.82 without inflation
    expect(item.current_stock).toBe(1.82);

    const wasteTx = sqlite.prepare("SELECT type, quantity FROM inventory_transactions WHERE reference_id = ? AND type = 'waste'").all('ord_cancel_prep') as Array<{ type: string; quantity: number }>;
    expect(wasteTx.length).toBe(1);
    expect(wasteTx[0].quantity).toBe(0.18);

    const wasteLogs = sqlite.prepare('SELECT quantity, reason FROM waste_log WHERE order_id = ?').all('ord_cancel_prep') as Array<{ quantity: number; reason: string }>;
    expect(wasteLogs.length).toBe(1);
    expect(wasteLogs[0].reason).toBe('order_cancelled_after_prep');
  });
});

describe('E-Invoice Immutability Guard', () => {
  it('blocks raw order cancellation with 409 when an e-invoice is already issued', async () => {
    const { sqlite, env } = setupTestDb();
    sqlite.exec(`
      INSERT INTO orders (id, tenant_id, status, payment_status)
      VALUES ('ord_invoiced', 'default', 'completed', 'paid');
      INSERT INTO erpnext_mappings (id, local_type, local_id, aura_order_id, erpnext_invoice_id, sync_status, tenant_id)
      VALUES ('map_1', 'order', 'ord_invoiced', 'ord_invoiced', 'ACC-SINV-2026-0001', 'submitted', 'default');
    `);

    const app = new Hono();
    app.post('/orders/:id/cancel', async (c) => {
      c.set('user' as any, { id: 'admin_1', role: 'admin', tenantId: 'default' });
      return handleCancelOrder(c as any);
    });

    const res = await app.request('http://localhost/orders/ord_invoiced/cancel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': 'default',
      },
      body: JSON.stringify({ reason: 'Guest changed mind' }),
    }, env as any);

    expect(res.status).toBe(409);
    const body = await res.json() as { success: boolean; code: string };
    expect(body.code).toBe('EINVOICE_ADJUSTMENT_REQUIRED');
  });
});

describe('Table Reservation Slots and Ordering Availability', () => {
  it('serializes table reservation slots and returns 409 on unique conflict', async () => {
    const { sqlite, env } = setupTestDb();
    sqlite.exec(`
      INSERT INTO cafe_tables (id, table_number, name, status, tenant_id)
      VALUES ('table_10', '10', 'Window Table 10', 'Available', 'default');
    `);

    const payload = {
      table_id: 'table_10',
      customer_name: 'Minh',
      customer_phone: '0901234567',
      party_size: 2,
      reservation_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      reservation_time: '19:00',
    };

    const firstRes = await reservationsRouter.request('/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': 'default',
      },
      body: JSON.stringify(payload),
    }, env as any);

    expect(firstRes.status).toBe(201);

    const secondRes = await reservationsRouter.request('/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': 'default',
      },
      body: JSON.stringify(payload),
    }, env as any);

    expect(secondRes.status).toBe(409);
    const secondBody = await secondRes.json() as { success: boolean; code?: string; error?: string };
    expect(secondBody.success).toBe(false);
  });

  it('rejects order creation for tables in maintenance or disabled status', async () => {
    const { db, sqlite } = setupTestDb();
    sqlite.exec(`
      INSERT INTO cafe_tables (id, table_number, name, status, tenant_id)
      VALUES
        ('t_ok', '01', 'Table 1', 'Available', 'default'),
        ('t_maintenance', '02', 'Table 2', 'Maintenance', 'default'),
        ('t_disabled', '03', 'Table 3', 'disabled', 'default');
    `);

    const validId = await resolveOrderCreationTable(db as any, '01', 'default');
    expect(validId).toBe('t_ok');

    await expect(resolveOrderCreationTable(db as any, '02', 'default')).rejects.toThrow(/Table is unavailable for service/);
    await expect(resolveOrderCreationTable(db as any, '03', 'default')).rejects.toThrow(/Table is unavailable for service/);
  });
});

describe('Vietnam ICT (+07:00) SQL Boundary Alignment', () => {
  it('counts early morning 00:15 ICT orders in today stats instead of dropping them', async () => {
    const { sqlite, env } = setupTestDb();
    const ictNowMs = Date.now() + 7 * 3600_000;
    const todayIct = new Date(ictNowMs).toISOString().slice(0, 10);
    // 00:15:00 ICT is 17:15:00 UTC previous day
    const utcTimestamp = new Date(`${todayIct}T00:15:00+07:00`).toISOString().replace('T', ' ').slice(0, 19);

    sqlite.exec(`
      INSERT INTO orders (id, tenant_id, total, status, payment_status, created_at)
      VALUES
        ('ord_morning_ict', 'default', 45000, 'completed', 'paid', '${utcTimestamp}');
    `);

    const req = new Request('http://localhost/stats');
    const res = await getStats(req, env as any, 'default');
    expect(res.status).toBe(200);

    const body = await res.json() as { success: boolean; stats: { orders_today: number; revenue_today: number } };
    expect(body.stats.orders_today).toBe(1);
    expect(body.stats.revenue_today).toBe(45000);
  });
});
