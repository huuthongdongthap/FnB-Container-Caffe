// @vitest-environment node
/**
 * Row preservation across the D1 table rebuilds.
 *
 * D1 pins `foreign_keys = 1` and commits per statement, so a tenant-scoped
 * UNIQUE constraint can only be introduced by rebuilding the table: stage the
 * surviving rows, empty the children, drop the parent, recreate it, repopulate.
 * The whole technique rests on one claim — every staged row comes back — and
 * nothing else in the suite asserts it, so a mistyped column list or a missed
 * child table would silently delete production data at deploy time.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const migrationDir = resolve(__dirname, '../../../db/migrations');
const readMigration = (file: string) => readFileSync(resolve(migrationDir, file), 'utf8');

/** Canonical schema with foreign keys enforced, the way D1 runs it. */
function createSchemaDb(): DatabaseSync {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  sqlite.exec(readFileSync(resolve(__dirname, '../../../schema.sql'), 'utf8'));
  return sqlite;
}

function rowCount(sqlite: DatabaseSync, table: string): number {
  return Number((sqlite.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get() as { c: number }).c);
}

/** Indexes a parent rebuild must hand back, keyed by the table they sit on. */
function indexNames(sqlite: DatabaseSync, table: string): string[] {
  return (
    sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL ORDER BY name")
      .all(table) as Array<{ name: string }>
  ).map((r) => r.name);
}

/** Rows staged by a rebuild must never outlive it. */
function stagingTables(sqlite: DatabaseSync): string[] {
  return (
    sqlite
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE '\\_skip\\_%' ESCAPE '\\' ORDER BY name")
      .all() as Array<{ name: string }>
  ).map((r) => r.name);
}

/**
 * Every NO ACTION child that can hold a `customers` row, plus `customers`
 * itself. `feedback` is created only by the 2026-07-07 lineage and carries no
 * writers, so it is exercised separately as the live-D1-only case.
 */
const CUSTOMER_CHILDREN = [
  'birthday_redemptions',
  'campaign_logs',
  'cashback_wallets',
  'cashback_transactions',
  'checkins',
  'consents',
  'customer_events',
  'customer_identities',
  'loyalty_point_logs',
  'notification_audit_log',
  'referral_codes',
  'referrals',
  'user_rewards',
  'visits',
] as const;

function seedCustomerGraph(sqlite: DatabaseSync): void {
  const run = (sql: string, ...params: Array<string | number | null>) => sqlite.prepare(sql).run(...params);

  run(
    `INSERT INTO customers (id, tenant_id, email, phone, name, loyalty_points, total_spent, auth_version)
     VALUES ('cust-1', 'default', 'row@aura.test', '0901234567', 'Row Preserved', 120, 250000, 4)`
  );
  run(`INSERT INTO rewards (tenant_id, id, title, point_cost, discount_value) VALUES ('default', 'rew-1', 'Free drink', 100, 10000)`);

  run(`INSERT INTO birthday_redemptions (tenant_id, id, customer_id, order_id) VALUES ('default', 'bd-1', 'cust-1', 'ord-1')`);
  run(`INSERT INTO campaign_logs (tenant_id, id, customer_id, trigger, channel) VALUES ('default', 'cl-1', 'cust-1', 'winback', 'zalo')`);
  run(`INSERT INTO cashback_wallets (id, customer_id, balance, total_earned, tenant_id) VALUES ('wal-1', 'cust-1', 6000, 6000, 'default')`);
  run(
    `INSERT INTO cashback_transactions (id, wallet_id, customer_id, type, amount, balance_after, tenant_id)
     VALUES ('tx-1', 'wal-1', 'cust-1', 'earn', 6000, 6000, 'default')`
  );
  run(
    `INSERT INTO checkins (id, customer_id, checkin_date, checkin_time, tenant_id)
     VALUES ('ck-1', 'cust-1', '2026-11-01', '09:00', 'default')`
  );
  run(
    `INSERT INTO consents (tenant_id, id, customer_id, purpose, source, granted_at)
     VALUES ('default', 'cn-1', 'cust-1', 'marketing', 'checkout', '2026-11-01')`
  );
  run(
    `INSERT INTO customer_events (tenant_id, id, customer_id, event_type, recorded_at)
     VALUES ('default', 'ce-1', 'cust-1', 'VisitRecorded', '2026-11-01')`
  );
  run(
    `INSERT INTO customer_identities (tenant_id, id, customer_id, identifier_type, identifier_value)
     VALUES ('default', 'ci-1', 'cust-1', 'phone', '0901234567')`
  );
  run(
    `INSERT INTO loyalty_point_logs (tenant_id, id, customer_id, points_change, balance_after)
     VALUES ('default', 'lpl-1', 'cust-1', 120, 120)`
  );
  run(`INSERT INTO notification_audit_log (tenant_id, id, channel, status) VALUES ('default', 'nal-1', 'zalo', 'sent')`);
  run(`INSERT INTO referral_codes (id, customer_id, code, tenant_id) VALUES ('rc-1', 'cust-1', 'ROWCODE', 'default')`);
  run(`INSERT INTO referrals (id, referrer_id, referral_code, tenant_id) VALUES ('rf-1', 'cust-1', 'ROWCODE', 'default')`);
  run(`INSERT INTO user_rewards (tenant_id, id, customer_id, reward_id, code) VALUES ('default', 'ur-1', 'cust-1', 'rew-1', 'UR-1')`);
  run(`INSERT INTO visits (tenant_id, id, customer_id, visited_at) VALUES ('default', 'v-1', 'cust-1', '2026-11-01')`);
}

describe('20261124_02 tenant-scoped customer keys', () => {
  it('returns every staged child and customer row, leaving no staging tables behind', () => {
    const sqlite = createSchemaDb();
    try {
      seedCustomerGraph(sqlite);
      const before = Object.fromEntries(CUSTOMER_CHILDREN.map((t) => [t, rowCount(sqlite, t)]));
      expect(Object.values(before).every((n) => n === 1)).toBe(true);

      sqlite.exec(readMigration('20261124_02_tenant_scoped_unique_keys.sql'));

      for (const table of CUSTOMER_CHILDREN) {
        expect({ table, rows: rowCount(sqlite, table) }).toEqual({ table, rows: before[table] });
      }
      expect(rowCount(sqlite, 'customers')).toBe(1);
      expect(stagingTables(sqlite)).toEqual([]);

      // Values survive, not just row counts.
      expect(sqlite.prepare("SELECT email, phone, loyalty_points, total_spent, auth_version FROM customers WHERE id = 'cust-1'").get())
        .toEqual({ email: 'row@aura.test', phone: '0901234567', loyalty_points: 120, total_spent: 250000, auth_version: 4 });
      expect(sqlite.prepare("SELECT customer_id, balance FROM cashback_wallets WHERE id = 'wal-1'").get())
        .toEqual({ customer_id: 'cust-1', balance: 6000 });

      // Foreign keys still resolve against the rebuilt parent.
      expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it('runs on the live-D1 lineage where the legacy feedback table exists', () => {
    const sqlite = createSchemaDb();
    try {
      // `feedback` exists only on live D1 (migration 2026-07-07); it is a NO ACTION
      // child of customers, so it must be empty for the parent drop to succeed.
      sqlite.exec(`
        CREATE TABLE feedback (
          id TEXT PRIMARY KEY,
          order_id TEXT NOT NULL REFERENCES orders(id),
          customer_id TEXT REFERENCES customers(id),
          customer_name TEXT NOT NULL,
          table_id INTEGER REFERENCES cafe_tables(id),
          rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5)
        );
      `);
      seedCustomerGraph(sqlite);

      expect(() => sqlite.exec(readMigration('20261124_02_tenant_scoped_unique_keys.sql'))).not.toThrow();

      expect(rowCount(sqlite, 'customers')).toBe(1);
      expect(rowCount(sqlite, 'cashback_wallets')).toBe(1);
      expect(stagingTables(sqlite)).toEqual([]);
      expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      sqlite.close();
    }
  });

  it('recreates the customer indexes live D1 carries but the canonical schema never declared', () => {
    const sqlite = createSchemaDb();
    try {
      // `idx_customers_phone` and `idx_customers_tier` exist only on live D1. A parent
      // rebuild drops every index on the table, so the migration has to recreate them
      // by name or the wifi session lookup and campaign enrollment silently lose their
      // access path. They are created here to reproduce that live-only pre-state.
      sqlite.exec(`
        CREATE INDEX idx_customers_phone ON customers(phone);
        CREATE INDEX idx_customers_tier ON customers(tier);
      `);
      seedCustomerGraph(sqlite);

      sqlite.exec(readMigration('20261124_02_tenant_scoped_unique_keys.sql'));

      expect(indexNames(sqlite, 'customers')).toEqual(
        expect.arrayContaining(['idx_customers_phone', 'idx_customers_tier'])
      );
    } finally {
      sqlite.close();
    }
  });

  it('keeps the tenant-scoped keys usable for two tenants and rejects a repeat inside one tenant', () => {
    const sqlite = createSchemaDb();
    try {
      seedCustomerGraph(sqlite);
      sqlite.exec(readMigration('20261124_02_tenant_scoped_unique_keys.sql'));

      const insert = sqlite.prepare(
        `INSERT INTO customers (id, tenant_id, email, phone, name, auth_version) VALUES (?, ?, ?, ?, ?, 1)`
      );
      insert.run('cust-b', 'tenant-b', 'row@aura.test', '0901234567', 'Other Tenant');

      expect(() => insert.run('cust-dup', 'default', 'row@aura.test', '0909999999', 'Same Tenant')).toThrow();

      expect(sqlite.prepare("SELECT tenant_id FROM customers WHERE id = 'cust-b'").get()).toEqual({ tenant_id: 'tenant-b' });
    } finally {
      sqlite.close();
    }
  });
});

/** Tables whose rebuild moves a global UNIQUE onto (tenant_id, key). */
const TENANT_KEY_TABLES = [
  'suppliers',
  'inventory_items',
  'inventory_transactions',
  'inventory_snapshots',
  'ingredients',
  'recipes',
  'recipe_items',
  'stock_movements',
  'waste_log',
  'purchase_orders',
  'purchase_order_items',
  'mrr_snapshots',
  'subscription_plans',
  'subscriptions',
  'subscription_invoices',
  'franchise_locations',
] as const;

function seedTenantKeyGraph(sqlite: DatabaseSync): void {
  const run = (sql: string, ...params: Array<string | number | null>) => sqlite.prepare(sql).run(...params);

  run(`INSERT INTO suppliers (tenant_id, id, name) VALUES ('default', 'sup-1', 'Viva Star')`);
  run(`INSERT INTO inventory_items (id, sku, tenant_id, name) VALUES ('ii-1', 'SKU-1', 'default', 'Arabica')`);
  run(
    `INSERT INTO inventory_transactions (tenant_id, id, item_id, type, quantity)
     VALUES ('default', 'it-1', 'ii-1', 'in', 10)`
  );
  run(
    `INSERT INTO inventory_snapshots (tenant_id, id, item_id, date, opening_stock, closing_stock)
     VALUES ('default', 'is-1', 'ii-1', '2026-11-01', 0, 10)`
  );
  run(`INSERT INTO ingredients (tenant_id, id, name, sku) VALUES ('default', 'ing-1', 'Sugar', 'ISKU-1')`);
  run(`INSERT INTO recipes (tenant_id, id, product_id, name) VALUES ('default', 'rec-1', 'prod-1', 'Latte')`);
  run(
    `INSERT INTO recipe_items (tenant_id, id, recipe_id, ingredient_id, quantity)
     VALUES ('default', 'ri-1', 'rec-1', 'ing-1', 5)`
  );
  run(
    `INSERT INTO stock_movements (tenant_id, id, ingredient_id, type, quantity)
     VALUES ('default', 'sm-1', 'ing-1', 'in', 5)`
  );
  run(`INSERT INTO waste_log (id, ingredient_id, quantity, unit, reason) VALUES ('wl-1', 'ing-1', 1, 'g', 'spill')`);
  run(
    `INSERT INTO purchase_orders (tenant_id, id, po_number, supplier_id, order_date)
     VALUES ('default', 'po-1', 'PO-1', 'sup-1', '2026-11-01')`
  );
  run(
    `INSERT INTO purchase_order_items (tenant_id, id, purchase_order_id, ingredient_id, quantity, unit_price, total_price)
     VALUES ('default', 'poi-1', 'po-1', 'ing-1', 5, 1000, 5000)`
  );
  run(`INSERT INTO mrr_snapshots (id, snapshot_date, mrr_vnd) VALUES ('mrr-1', '2026-11-01', 100000)`);
  run(
    `INSERT INTO subscription_plans (tenant_id, id, name, slug, monthly_price_vnd)
     VALUES ('default', 'sp-1', 'Pro', 'pro', 1500000)`
  );
  run(
    `INSERT INTO subscriptions (tenant_id, id, plan_id, customer_name, customer_email, customer_phone,
       current_period_start, current_period_end, next_billing_date, amount_vnd)
     VALUES ('default', 'sub-1', 'sp-1', 'Khách', 'k@aura.test', '0901234567',
       '2026-11-01', '2026-11-30', '2026-11-30', 1500000)`
  );
  run(
    `INSERT INTO subscription_invoices (tenant_id, id, subscription_id, amount_vnd, period_start, period_end, invoice_number)
     VALUES ('default', 'inv-1', 'sub-1', 1500000, '2026-12-01', '2026-12-31', 'INV-1')`
  );
  run(`INSERT INTO franchise_locations (id, tenant_id, code, name) VALUES ('fl-1', 'default', 'FL-1', 'Quận 1')`);
}

describe('20261125_01 tenant-scoped inventory, subscription and SaaS keys', () => {
  it('recreates the shipper dispatch index on orders', () => {
    const sqlite = createSchemaDb();
    try {
      // `idx_orders_tenant_shipper_status` ships in the canonical schema but live D1
      // predates both it and the `assigned_shipper_id` column it depends on. Rolling
      // back reconstructs that pre-state; the forward migration is then the only
      // thing that can put the index back, and nothing else in the chain recreates it.
      sqlite.exec(readMigration('20261125_01_unified_kds_shifts_inventory_saas_schema.down.sql'));
      expect(indexNames(sqlite, 'orders')).not.toContain('idx_orders_tenant_shipper_status');
      seedTenantKeyGraph(sqlite);

      sqlite.exec(readMigration('20261125_01_unified_kds_shifts_inventory_saas_schema.sql'));

      expect(indexNames(sqlite, 'orders')).toContain('idx_orders_tenant_shipper_status');
    } finally {
      sqlite.close();
    }
  });

  it('round-trips down/up preserving every row and installing each tenant-scoped UNIQUE', () => {
    const sqlite = createSchemaDb();
    try {
      // The canonical schema already carries the columns this migration adds, so the
      // rollback is what reconstructs the pre-migration shape live D1 is in.
      sqlite.exec(readMigration('20261125_01_unified_kds_shifts_inventory_saas_schema.down.sql'));
      seedTenantKeyGraph(sqlite);

      const before = Object.fromEntries(TENANT_KEY_TABLES.map((t) => [t, rowCount(sqlite, t)]));
      expect(Object.values(before).every((n) => n === 1)).toBe(true);

      sqlite.exec(readMigration('20261125_01_unified_kds_shifts_inventory_saas_schema.sql'));

      for (const table of TENANT_KEY_TABLES) {
        expect({ table, rows: rowCount(sqlite, table) }).toEqual({ table, rows: before[table] });
      }
      expect(stagingTables(sqlite)).toEqual([]);
      expect(sqlite.prepare('PRAGMA foreign_key_check').all()).toEqual([]);

      const ddl = (table: string) =>
        (sqlite.prepare('SELECT sql FROM sqlite_master WHERE name = ?').get(table) as { sql: string }).sql;
      expect(ddl('inventory_items')).toContain('UNIQUE(tenant_id, sku)');
      expect(ddl('ingredients')).toContain('UNIQUE(tenant_id, sku)');
      expect(ddl('purchase_orders')).toContain('UNIQUE(tenant_id, po_number)');
      expect(ddl('mrr_snapshots')).toContain('UNIQUE(tenant_id, snapshot_date)');
      expect(ddl('subscription_plans')).toContain('UNIQUE(tenant_id, slug)');
      expect(ddl('subscription_invoices')).toContain('UNIQUE(tenant_id, invoice_number)');
      expect(ddl('franchise_locations')).toContain('UNIQUE(tenant_id, code)');

      // Historical snapshots predate the tenant column and belong to the flagship tenant.
      expect(sqlite.prepare("SELECT tenant_id FROM mrr_snapshots WHERE id = 'mrr-1'").get()).toEqual({ tenant_id: 'default' });

      const orderColumns = (sqlite.prepare('PRAGMA table_info(orders)').all() as Array<{ name: string }>).map((c) => c.name);
      expect(orderColumns).toEqual(expect.arrayContaining(['previous_status', 'cancel_alert']));
    } finally {
      sqlite.close();
    }
  });

  it('keeps the tenant-scoped inventory key usable for two tenants and rejects a repeat inside one tenant', () => {
    const sqlite = createSchemaDb();
    try {
      sqlite.exec(readMigration('20261125_01_unified_kds_shifts_inventory_saas_schema.down.sql'));
      seedTenantKeyGraph(sqlite);
      sqlite.exec(readMigration('20261125_01_unified_kds_shifts_inventory_saas_schema.sql'));

      const insert = sqlite.prepare(`INSERT INTO inventory_items (id, sku, tenant_id, name) VALUES (?, ?, ?, ?)`);
      insert.run('ii-b', 'SKU-1', 'tenant-b', 'Arabica B');

      expect(() => insert.run('ii-dup', 'SKU-1', 'default', 'Duplicate')).toThrow();

      expect(sqlite.prepare("SELECT tenant_id FROM inventory_items WHERE id = 'ii-b'").get()).toEqual({ tenant_id: 'tenant-b' });
    } finally {
      sqlite.close();
    }
  });
});
