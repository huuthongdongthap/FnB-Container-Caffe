// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../../types/env';
import { issueStaffSession, type StaffAccount } from '../../lib/staff-session';
import {
  extractRequestedPaymentTenant,
  hasPaymentTenantMismatch,
  resolvePaymentTenantScope,
} from '../../../../packages/domain/payment/policies/payment-access';
import { splitOrders } from '../../../../packages/domain/order/commands/split-orders';
import { resolveOrderCreationScope } from '../../../../packages/domain/order/policies/order-creation-scope';
import { updateOrder } from '../../../../packages/domain/order/commands/update-order';
import { executeKdsStatusTransition } from '../../../../packages/domain/kitchen/commands/kds-status-transition';
import { openApiInventoryRouter } from '../../routes/openapi-inventory';
import { inventoryTransactions } from '../../../../packages/domain/inventory/src/routes/inventory-transactions';
import { restoreInventoryForOrder } from '../../../../packages/domain/inventory/src/routes/order-deduction';
import { purchasing } from '../../../../packages/domain/inventory/src/routes/purchasing';
import { productsRouter } from '../../../../packages/domain/catalog/commands/products';
import { dynamicPricingRouter } from '../../routes/dynamic-pricing';
import { happyHourRouter } from '../../../../packages/domain/catalog/commands/happy-hour';
import { menuModifiersRouter } from '../../../../packages/domain/catalog/commands/menu-modifiers';
import { resolveServerProductPrice } from '../../../../packages/domain/catalog/policies/pricing-resolver';
import { getCustomerMenuItem } from '../../../../packages/domain/catalog/commands/get-customer-menu';
import { checkinRouter } from '../../routes/checkin';
import { reviewsRouter } from '../../routes/reviews';
import { applyAccrual } from '../../../../packages/domain/crm/commands/accrual';
import { reverseAccrual } from '../../../../packages/domain/crm/commands/refund-reversal';
import type { LoyaltyPolicy } from '../../../../packages/domain/crm/commands/loyalty-policy';

const DEFAULT_LOYALTY_POLICY: LoyaltyPolicy = {
  tiers: [{ tierName: 'bronze', minPoints: 0, cashbackRate: 0.05, pointMultiplier: 1.0, expiryDays: 365 }],
  defaultTier: { tierName: 'bronze', minPoints: 0, cashbackRate: 0.05, pointMultiplier: 1.0, expiryDays: 365 },
  campaignMultiplier: 1.0,
  maxCapPerTx: 50_000,
  campaignCode: null,
  expiresAt: null,
};

const JWT_SECRET = 'phase64-bk1-bk4-test-jwt-secret-key-2026';

async function makeStaffToken(account: { id: string; role: string; tenantId?: string; name?: string }) {
  const fullAccount: StaffAccount = {
    id: account.id,
    name: account.name ?? account.id,
    phone: null,
    role: account.role,
    tenant_id: account.tenantId ?? 'default',
    is_active: 1,
    auth_version: 1,
  };
  const session = await issueStaffSession(
    { JWT_SECRET },
    fullAccount,
    { sessionType: 'staff-web', email: `${account.id}@aura.vn` }
  );
  return session.token;
}

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      email TEXT,
      role TEXT,
      tenant_id TEXT DEFAULT 'default',
      is_active INTEGER DEFAULT 1,
      auth_version INTEGER DEFAULT 1
    );
    INSERT OR IGNORE INTO users (id, name, phone, email, role, tenant_id, is_active, auth_version)
    VALUES
      ('mgr-a', 'Manager A', NULL, 'mgr-a@aura.vn', 'manager', 'store-a', 1, 1),
      ('staff-99', 'Barista', NULL, 'staff-99@aura.vn', 'staff', 'store-a', 1, 1),
      ('staff-a', 'Staff A', NULL, 'staff-a@aura.vn', 'cashier', 'store-a', 1, 1);
  `);
  const prepare = (sql: string) => {
    let params: unknown[] = [];
    const stmt = {
      bind(...values: unknown[]) {
        params = values;
        return stmt;
      },
      async first<T = Record<string, unknown>>(colName?: string): Promise<T | null> {
        const s = sqlite.prepare(sql);
        const row = s.get(...(params as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return ((row[colName] as T) ?? null);
        return row as unknown as T;
      },
      async all<T = Record<string, unknown>>(): Promise<{ results: T[]; success: boolean }> {
        const s = sqlite.prepare(sql);
        const rows = s.all(...(params as never[])) as unknown as T[];
        return { results: rows, success: true };
      },
      async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
        const s = sqlite.prepare(sql);
        const info = s.run(...(params as never[]));
        return {
          success: true,
          meta: {
            changes: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0),
          },
        };
      },
    };
    return stmt;
  };

  return {
    prepare,
    async batch(statements: Array<{ run: () => Promise<unknown> }>) {
      sqlite.exec('SAVEPOINT d1_batch');
      try {
        const out = [];
        for (const st of statements) {
          out.push(await st.run());
        }
        sqlite.exec('RELEASE SAVEPOINT d1_batch');
        return out;
      } catch (err) {
        sqlite.exec('ROLLBACK TO SAVEPOINT d1_batch');
        sqlite.exec('RELEASE SAVEPOINT d1_batch');
        throw err;
      }
    },
    async exec(script: string) {
      sqlite.exec(script);
      return { count: 1, duration: 0 };
    },
    async dump() {
      return new ArrayBuffer(0);
    },
    withSession() {
      return this as unknown as ReturnType<D1Database['withSession']>;
    },
  } as unknown as D1Database;
}

describe('Phase 64 Security & Domain Integrity Regression Suite (BK1..BK4)', () => {
  describe('Cluster BK1: Payment Access, Split Orders, Order Creation Scope & Cancellation Cleanup', () => {
    it('enforces store_id/storeId/tenantId overrides and rejects non-HQ wildcard claims in payment-access', () => {
      const mockCtx = (user: Record<string, unknown>, query: Record<string, string>) => ({
        get: (k: string) => (k === 'user' ? user : undefined),
        req: {
          query: (k: string) => query[k],
          header: () => undefined,
        },
      });

      expect(
        extractRequestedPaymentTenant(mockCtx({ role: 'cashier', tenantId: 'store-a' }, { store_id: 'store-b' }))
      ).toBe('store-b');
      expect(
        hasPaymentTenantMismatch(mockCtx({ role: 'cashier', tenantId: 'store-a' }, { store_id: 'store-b' }))
      ).toBe(true);
      expect(
        hasPaymentTenantMismatch(mockCtx({ role: 'manager', tenantId: '*' }, {}))
      ).toBe(true);
      expect(
        resolvePaymentTenantScope(mockCtx({ role: 'owner', tenantId: 'hq' }, { storeId: 'store-b' }))
      ).toEqual({ tenantId: 'store-b', wildcard: false });
    });

    it('rejects excessive tax (>10% statutory ceiling) on splitOrders', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE products (id TEXT PRIMARY KEY, name TEXT, price INTEGER, is_available INTEGER, tenant_id TEXT);
        CREATE TABLE cafe_tables (id TEXT PRIMARY KEY, table_number TEXT, status TEXT, tenant_id TEXT);
        INSERT INTO products VALUES ('prod-1', 'Espresso', 50000, 1, 'store-a');
        INSERT INTO cafe_tables VALUES ('tbl-1', 'T1', 'occupied', 'store-a');
      `);
      const db = createSqliteD1(sqlite);

      const req = new Request('http://localhost/api/orders/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: 'T1',
          orders: [
            {
              items: [{ id: 'prod-1', product_id: 'prod-1', name: 'Espresso', price: 50000, quantity: 1 }],
              customer_name: 'Guest A',
              customer_phone: '0901234567',
              payment_method: 'cod',
              tax: 25000, // 50% tax > 10% ceiling
            },
            {
              items: [{ id: 'prod-1', product_id: 'prod-1', name: 'Espresso', price: 50000, quantity: 1 }],
              customer_name: 'Guest B',
              customer_phone: '0901234568',
              payment_method: 'cod',
            },
          ],
        }),
      });

      const res = await splitOrders(req, { AURA_DB: db, JWT_SECRET }, undefined, {
        id: 'staff-a',
        role: 'cashier',
        tenantId: 'store-a',
      });
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error?: string };
      expect(body.error).toContain('tax exceeds maximum statutory rate');
    });

    it('rejects wildcard tenant claim for non-HQ staff in resolveOrderCreationScope and updateOrder, and cancels pending payments on order cancel', async () => {
      await expect(
        resolveOrderCreationScope(
          new Request('http://localhost/api/orders', { method: 'POST' }),
          { JWT_SECRET },
          { id: 'mgr-1', role: 'manager', tenantId: '*' }
        )
      ).rejects.toThrow(/Forbidden wildcard tenant claim/);

      const hqScope = await resolveOrderCreationScope(
        new Request('http://localhost/api/orders?store_id=store-b', { method: 'POST' }),
        { JWT_SECRET },
        { id: 'owner-1', role: 'owner', tenant_id: 'hq' }
      );
      expect(hqScope.tenantId).toBe('store-b');

      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          status TEXT,
          items TEXT,
          total INTEGER,
          payment_status TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          table_id TEXT,
          created_at TEXT,
          updated_at TEXT,
          tenant_id TEXT
        );
        CREATE TABLE payments (
          id TEXT PRIMARY KEY,
          order_id TEXT,
          status TEXT,
          tenant_id TEXT,
          updated_at TEXT
        );
        INSERT INTO orders VALUES ('ord-1', 'pending', '[]', 50000, 'pending', 'Nguyen', '0901112222', NULL, '2026-11-05T00:00:00Z', '2026-11-05T00:00:00Z', 'store-a');
        INSERT INTO payments VALUES ('pay-1', 'ord-1', 'pending', 'store-a', '2026-11-05T00:00:00Z');
      `);
      const db = createSqliteD1(sqlite);

      // Non-HQ wildcard rejected on updateOrder
      const forbiddenRes = await updateOrder(
        new Request('http://localhost/api/orders/ord-1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' }),
        }),
        { AURA_DB: db },
        'ord-1',
        'manager',
        '*'
      );
      expect(forbiddenRes.status).toBe(403);

      // Valid KDS cancel transitions pending payment to cancelled
      const kdsRes = await executeKdsStatusTransition(db as never, 'ord-1', 'cancelled', 'manager', {
        tenantId: 'store-a',
      });
      expect(kdsRes.success).toBe(true);
      const paymentRow = sqlite.prepare('SELECT status FROM payments WHERE id = ?').get('pay-1') as { status: string };
      expect(paymentRow.status).toBe('cancelled');
    });
  });

  describe('Cluster BK2: OpenAPI Purchase Orders, Outbound Stock CAS, Concurrent Order Restoration & Purchasing Scope', () => {
    it('rejects duplicate ingredientId on PO receive and empty items array on PO PATCH', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE purchase_orders (
          id TEXT PRIMARY KEY,
          po_number TEXT,
          supplier_id TEXT,
          status TEXT,
          total_amount REAL,
          notes TEXT,
          tenant_id TEXT,
          created_at TEXT,
          updated_at TEXT
        );
        CREATE TABLE purchase_order_items (
          id TEXT PRIMARY KEY,
          purchase_order_id TEXT,
          ingredient_id TEXT,
          quantity REAL,
          received_quantity REAL DEFAULT 0,
          unit_price REAL,
          tenant_id TEXT
        );
        INSERT INTO purchase_orders VALUES ('po-1', 'PO-001', 'sup-1', 'ordered', 100000, NULL, 'store-a', '2026-11-05', '2026-11-05');
        INSERT INTO purchase_order_items VALUES ('poi-1', 'po-1', 'ing-1', 10, 0, 10000, 'store-a');
      `);
      const db = createSqliteD1(sqlite);
      const token = await makeStaffToken({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });

      // Duplicate ingredientId in receive payload -> 400
      const dupRes = await openApiInventoryRouter.request(
        '/api/inventory/purchase-orders/po-1/receive',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: [
              { ingredientId: 'ing-1', receivedQuantity: 5 },
              { ingredientId: 'ing-1', receivedQuantity: 5 },
            ],
          }),
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(dupRes.status).toBe(400);

      // Empty items array in PATCH -> 400
      sqlite.prepare("UPDATE purchase_orders SET status = 'draft' WHERE id = 'po-1'").run();
      const emptyPatchRes = await openApiInventoryRouter.request(
        '/api/inventory/purchase-orders/po-1',
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ items: [] }),
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(emptyPatchRes.status).toBe(400);
    });

    it('enforces atomic CAS on outbound stock deduction and serializes concurrent restoreInventoryForOrder calls', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE inventory_items (
          id TEXT PRIMARY KEY,
          sku TEXT,
          name TEXT,
          current_stock REAL,
          unit TEXT,
          min_stock REAL,
          active INTEGER DEFAULT 1,
          tenant_id TEXT,
          updated_at TEXT
        );
        CREATE TABLE inventory_transactions (
          id TEXT PRIMARY KEY,
          item_id TEXT,
          type TEXT,
          quantity REAL,
          stock_before REAL,
          stock_after REAL,
          unit_cost REAL,
          reference_id TEXT,
          reference_type TEXT,
          notes TEXT,
          created_by TEXT,
          tenant_id TEXT,
          created_at TEXT
        );
        INSERT INTO inventory_items VALUES ('item-1', 'SKU-1', 'Coffee Beans', 10, 'kg', 2, 1, 'store-a', '2026-11-05');
        INSERT INTO inventory_transactions VALUES ('tx-1', 'item-1', 'reserve', -4, 14, 10, 0, 'ord-race-1', 'order', 'Reserve', 'system', 'store-a', '2026-11-05');
      `);
      const db = createSqliteD1(sqlite);

      // Concurrent restoration calls for the same order must only restore stock once (+4 -> 14, not +8 -> 18)
      await Promise.all([
        restoreInventoryForOrder({ AURA_DB: db }, 'ord-race-1', 'store-a'),
        restoreInventoryForOrder({ AURA_DB: db }, 'ord-race-1', 'store-a'),
      ]);
      const afterRestore = sqlite.prepare('SELECT current_stock FROM inventory_items WHERE id = ?').get('item-1') as {
        current_stock: number;
      };
      expect(afterRestore.current_stock).toBe(14);

      // Purchasing cross-tenant store_id query parameter rejected with 403
      const purchasingApp = new Hono<{ Bindings: Env }>();
      purchasingApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      purchasing(purchasingApp as never);
      const crossStoreSuppliers = await purchasingApp.request(
        '/suppliers?store_id=store-b',
        { method: 'GET' },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(crossStoreSuppliers.status).toBe(403);

      // Outbound transaction exceeding stock rejected
      const txApp = new Hono<{ Bindings: Env }>();
      txApp.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } as never);
        await next();
      });
      inventoryTransactions(txApp as never);
      const outRes = await txApp.request(
        '/item-1/transactions',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'out', quantity: 50, notes: 'Too much' }),
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(outRes.status).toBe(409);
    });
  });

  describe('Cluster BK3: Catalog Products RBAC, Dynamic Pricing Authority, Happy Hour & Modifiers', () => {
    it('blocks Barista display-name RBAC bypass on /api/products and blocks cross-tenant read overrides', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          name TEXT,
          slug TEXT,
          price INTEGER,
          category_id TEXT,
          is_available INTEGER DEFAULT 1,
          tenant_id TEXT
        );
        INSERT INTO products VALUES ('p-1', 'Latte', 'latte', 45000, 'cat-1', 1, 'store-a');
      `);
      const db = createSqliteD1(sqlite);

      // Staff user with tenantId='store-a' and name='Barista' MUST NOT bypass productCreateAuth
      const baristaStaffToken = await makeStaffToken({
        id: 'staff-99',
        role: 'staff',
        tenantId: 'store-a',
        name: 'Barista',
      });
      const app = new Hono<{ Bindings: Env }>();
      app.route('/api/products', productsRouter);

      const createRes = await app.request(
        '/api/products',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${baristaStaffToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Hacked Product',
            slug: 'hacked-product',
            price: 1000,
            category_id: 'cat-1',
          }),
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(createRes.status).toBe(403);

      // Cross-tenant read override (?store_id=store-b) for store-a staff -> 403
      const crossReadRes = await app.request(
        '/api/products?store_id=store-b',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${baristaStaffToken}` },
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(crossReadRes.status).toBe(403);
    });

    it('rejects client category spoofing in dynamic-pricing and cross-tenant apply_ids in happy-hour', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          name TEXT,
          price INTEGER,
          cost_price INTEGER,
          category TEXT,
          category_id TEXT,
          is_available INTEGER DEFAULT 1,
          tenant_id TEXT
        );
        CREATE TABLE categories (
          id TEXT PRIMARY KEY,
          name TEXT,
          tenant_id TEXT
        );
        CREATE TABLE dynamic_pricing_rules (
          id TEXT PRIMARY KEY,
          name TEXT,
          rule_type TEXT,
          discount_percent INTEGER,
          target_category TEXT,
          target_product_id TEXT,
          min_margin_percent INTEGER,
          days_of_week TEXT,
          start_time TEXT,
          end_time TEXT,
          is_active INTEGER,
          tenant_id TEXT
        );
        INSERT INTO products VALUES ('prod-coffee', 'Espresso', 50000, 10000, 'coffee', 'cat-coffee', 1, 'store-a');
        INSERT INTO categories VALUES ('cat-store-b', 'Store B Category', 'store-b');
        INSERT INTO dynamic_pricing_rules VALUES (
          'rule-1', 'Tea Flash', 'category_flash', 30, 'tea', NULL, 20, '0,1,2,3,4,5,6', '00:00', '23:59', 1, 'store-a'
        );
      `);
      const db = createSqliteD1(sqlite);

      // Client spoofs category='tea' on 'prod-coffee' (whose server category is 'coffee') -> no discount applied
      const mgrToken = await makeStaffToken({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const dpApp = new Hono<{ Bindings: Env }>();
      dpApp.route('/api/pricing/dynamic', dynamicPricingRouter);
      const calcRes = await dpApp.request(
        '/api/pricing/dynamic/calculate',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            items: [{ product_id: 'prod-coffee', price: 50000, category: 'tea', quantity: 1 }],
          }),
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(calcRes.status).toBe(200);
      const calcBody = (await calcRes.json()) as { data: { total_savings: number } };
      expect(calcBody.data.total_savings).toBe(0);

      // Happy Hour creation with cross-tenant category ID in apply_ids -> 403
      const hhApp = new Hono<{ Bindings: Env }>();
      hhApp.route('/api', happyHourRouter);
      const hhRes = await hhApp.request(
        '/api/happy-hour',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${mgrToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'Cross Tenant HH',
            day_of_week: 1,
            start_time: '14:00',
            end_time: '17:00',
            discount_rate: 0.2,
            apply_to: 'category',
            apply_ids: ['cat-store-b'],
          }),
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(hhRes.status).toBe(403);
    });

    it('isolates product tenant in resolveServerProductPrice and filters unavailable items in getCustomerMenuItem', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE products (
          id TEXT PRIMARY KEY,
          name TEXT,
          description TEXT,
          price INTEGER,
          category_id TEXT,
          image_url TEXT,
          tags TEXT,
          is_available INTEGER,
          tenant_id TEXT
        );
        CREATE TABLE happy_hour_windows (
          id TEXT PRIMARY KEY,
          name TEXT,
          start_hour INTEGER,
          end_hour INTEGER,
          days_of_week TEXT,
          discount_percent INTEGER,
          apply_to TEXT,
          apply_ids TEXT,
          active INTEGER,
          tenant_id TEXT
        );
        CREATE TABLE modifier_groups (id TEXT PRIMARY KEY, name TEXT, tenant_id TEXT);
        CREATE TABLE modifier_choices (id TEXT PRIMARY KEY, group_id TEXT, name TEXT, price_adjustment INTEGER, tenant_id TEXT);
        CREATE TABLE product_modifier_groups (product_id TEXT, group_id TEXT, tenant_id TEXT);
        INSERT INTO products VALUES ('prod-a', 'Cold Brew', 'Desc', 60000, 'cat-1', NULL, '[]', 1, 'store-a');
        INSERT INTO products VALUES ('prod-unavail', 'Sold Out', 'Desc', 40000, 'cat-1', NULL, '[]', 0, 'store-a');
        INSERT INTO happy_hour_windows VALUES ('hh-b', 'Store B HH', 0, 24, '0,1,2,3,4,5,6', 50, 'all', NULL, 1, 'store-b');
        INSERT INTO modifier_groups VALUES ('grp-1', 'Size', 'store-a');
        INSERT INTO modifier_choices VALUES ('ch-1', 'grp-1', 'Large', 10000, 'store-a');
      `);
      const db = createSqliteD1(sqlite);

      // Even when input.tenantId is '*', prod-a belongs to store-a and must NOT get store-b's 50% Happy Hour discount
      const resolved = await resolveServerProductPrice(db as never, {
        productId: 'prod-a',
        tenantId: '*',
      });
      expect(resolved.unitPriceCents).toBe(60000);
      expect(resolved.basePriceCents).toBe(60000);

      // Unavailable product returns null in getCustomerMenuItem when includeUnavailable is not set
      const item = await getCustomerMenuItem(db, 'prod-unavail', { tenantId: 'store-a' });
      expect(item).toBeNull();

      // Deleting modifier group cascades to modifier_choices
      const mgrToken = await makeStaffToken({ id: 'mgr-a', role: 'manager', tenantId: 'store-a' });
      const modApp = new Hono<{ Bindings: Env }>();
      modApp.route('/api/menu-modifiers', menuModifiersRouter);
      const delRes = await modApp.request(
        '/api/menu-modifiers/groups/grp-1',
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${mgrToken}` },
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(delRes.status).toBe(200);
      const remainingChoices = sqlite.prepare('SELECT COUNT(*) as cnt FROM modifier_choices WHERE group_id = ?').get('grp-1') as {
        cnt: number;
      };
      expect(remainingChoices.cnt).toBe(0);
    });
  });

  describe('Cluster BK4: Check-In Spoofing, Guest Review Verification, Multi-Refund Reversal & Unpaid Accrual', () => {
    it('blocks unauthenticated customer_id spoofing on check-in and customer_name bypass on order reviews', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          name TEXT,
          phone TEXT,
          tenant_id TEXT
        );
        CREATE TABLE customer_checkins (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          table_number TEXT,
          party_size INTEGER,
          reward_type TEXT,
          reward_value TEXT,
          status TEXT,
          tenant_id TEXT,
          created_at TEXT
        );
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          customer_name TEXT,
          customer_phone TEXT,
          status TEXT,
          tenant_id TEXT
        );
        INSERT INTO customers VALUES ('cust-victim', 'Victim Name', '0909998888', 'default');
        INSERT INTO orders VALUES ('ord-review-1', 'cust-victim', 'Victim Name', '0909998888', 'completed', 'default');
      `);
      const db = createSqliteD1(sqlite);

      // Unauthenticated check-in with customer_id + customer_name but no matching phone -> 403
      const checkinApp = new Hono<{ Bindings: Env }>();
      checkinApp.route('/api/checkin', checkinRouter);
      const spoofCheckin = await checkinApp.request(
        '/api/checkin',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            customer_id: 'cust-victim',
            customer_name: 'Victim Name',
          }),
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(spoofCheckin.status).toBe(403);

      // Guest review on order with only customer_name (omitting customer_phone) -> 403
      const reviewApp = new Hono<{ Bindings: Env }>();
      reviewApp.route('/api/reviews', reviewsRouter);
      const spoofReview = await reviewApp.request(
        '/api/reviews',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            order_id: 'ord-review-1',
            customer_name: 'Victim Name',
            rating: 5,
            comment: 'Spoofed verified review',
          }),
        },
        { AURA_DB: db, JWT_SECRET } as unknown as Env
      );
      expect(spoofReview.status).toBe(403);
    });

    it('rejects loyalty accrual on unpaid orders and preserves accurate proportional clawback across two 50% partial refunds', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE orders (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          total INTEGER,
          total_amount INTEGER,
          cashback_used INTEGER DEFAULT 0,
          points_earned INTEGER DEFAULT 0,
          cashback_earned INTEGER DEFAULT 0,
          status TEXT,
          payment_status TEXT,
          tenant_id TEXT,
          updated_at TEXT
        );
        CREATE TABLE customers (
          id TEXT PRIMARY KEY,
          loyalty_points INTEGER DEFAULT 0,
          lifetime_points INTEGER DEFAULT 0,
          loyalty_tier TEXT DEFAULT 'bronze',
          cashback_balance INTEGER DEFAULT 0,
          total_spent INTEGER DEFAULT 0,
          visit_count INTEGER DEFAULT 0,
          tenant_id TEXT,
          updated_at TEXT
        );
        CREATE TABLE loyalty_point_logs (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          order_id TEXT,
          points_change INTEGER,
          reason TEXT,
          balance_after INTEGER,
          description TEXT,
          tenant_id TEXT,
          created_at TEXT
        );
        CREATE TABLE cashback_transactions (
          id TEXT PRIMARY KEY,
          customer_id TEXT,
          order_id TEXT,
          type TEXT,
          amount INTEGER,
          balance_after INTEGER,
          description TEXT,
          expires_at TEXT,
          tenant_id TEXT,
          created_at TEXT
        );
        CREATE TABLE cashback_wallets (
          customer_id TEXT PRIMARY KEY,
          balance INTEGER DEFAULT 0,
          total_earned INTEGER DEFAULT 0,
          tenant_id TEXT,
          updated_at TEXT
        );
        INSERT INTO customers VALUES ('cust-1', 100, 100, 'bronze', 5000, 100000, 1, 'store-a', '2026-11-05');
        INSERT INTO cashback_wallets VALUES ('cust-1', 5000, 5000, 'store-a', '2026-11-05');
        INSERT INTO orders VALUES ('ord-unpaid', 'cust-1', 100000, 100000, 0, 0, 0, 'confirmed', 'pending', 'store-a', '2026-11-05');
        INSERT INTO orders VALUES ('ord-paid', 'cust-1', 100000, 100000, 0, 100, 5000, 'completed', 'paid', 'store-a', '2026-11-05');
      `);
      const db = createSqliteD1(sqlite);

      // 1. Unpaid order is rejected by applyAccrual
      const unpaidAccrual = await applyAccrual(db, DEFAULT_LOYALTY_POLICY, {
        orderId: 'ord-unpaid',
        customerId: 'cust-1',
        orderTotalVnd: 100000,
        tenantId: 'store-a',
      });
      expect(unpaidAccrual).toEqual({ ok: false, reason: 'order_not_eligible' });

      // 2. Two sequential 50% partial refunds on ord-paid (100 points, 5000 cashback)
      const refund1 = await reverseAccrual(db, DEFAULT_LOYALTY_POLICY, {
        orderId: 'ord-paid',
        customerId: 'cust-1',
        refundAmountVnd: 50000,
        tenantId: 'store-a',
      });
      expect(refund1.ok).toBe(true);
      if (refund1.ok) {
        expect(refund1.pointsDeducted).toBe(50);
      }

      const refund2 = await reverseAccrual(db, DEFAULT_LOYALTY_POLICY, {
        orderId: 'ord-paid',
        customerId: 'cust-1',
        refundAmountVnd: 50000,
        tenantId: 'store-a',
      });
      expect(refund2.ok).toBe(true);
      if (refund2.ok) {
        expect(refund2.pointsDeducted).toBe(50);
      }

      const finalCustomer = sqlite.prepare('SELECT loyalty_points FROM customers WHERE id = ?').get('cust-1') as {
        loyalty_points: number;
      };
      const finalWallet = sqlite.prepare('SELECT balance FROM cashback_wallets WHERE customer_id = ?').get('cust-1') as {
        balance: number;
      };
      expect(finalCustomer.loyalty_points).toBe(0);
      expect(finalWallet.balance).toBe(0);
    });
  });
});
