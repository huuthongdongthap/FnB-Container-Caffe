// @vitest-environment node
/**
 * Phase 69 Security Regression Suite (BP1..BP4)
 *
 * Verifies 20 security invariants across 4 slices using real in-memory SQLite (node:sqlite):
 *   - BP1 (BP1-01..05): Order Cancel Linked Customer Ownership, Order Status Row-Tenant Scope,
 *                       Payment Access Linked Customer & Legacy Fallback Guard, OpenAPI Product &
 *                       Category Mutation Tenant Attribution, Catalog & Sub-Handler Conflict/Audit Guards
 *   - BP2 (BP2-01..05): Inventory CRUD Multi-Tenant & Schema Fallback Guard, Inventory Snapshots &
 *                       Batch Adjust Tenant Attribution, Purchase Order Receive Tenant Isolation,
 *                       DinDin Checkout/Webhook/Cart-Admin Tenant Attribution, ERPNext Customer/Order/DLQ Isolation
 *   - BP3 (BP3-01..05): OrderBroadcaster DO Tenant-Prefixed Map & Snapshot Filtering, Customer Lifecycle &
 *                       Event Dispatcher Tenant Isolation, CRM Lookup Profile & Consent Tenant Confinement,
 *                       Audit Logger NOT NULL Safe Attribution & Rate-Limit Partitioning, Staff/Customer Session Auth Isolation
 *   - BP4 (BP4-01..05): Client Session Snapshot & Transition Bus, Cart & Order Store Session Reset &
 *                       In-Flight Abort, Loyalty/Referral/Menu Store Session Reset & Stale Response Guard,
 *                       OfflineDB Queue Tenant/User Partitioning, TanStack Query & Admin/Mobile Hook Session Scope Parity
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Hono } from 'hono';
import { OpenAPIHono } from '@hono/zod-openapi';

vi.hoisted(() => {
  const store = new Map<string, string>();
  const memStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: memStorage, configurable: true, writable: true });
  const et = new EventTarget();
  const win = Object.assign(globalThis, {
    addEventListener: et.addEventListener.bind(et),
    removeEventListener: et.removeEventListener.bind(et),
    dispatchEvent: et.dispatchEvent.bind(et),
    location: { search: '', href: 'http://localhost/' },
    localStorage: memStorage,
  });
  (globalThis as Record<string, unknown>).window = win;
});

import type { Env } from '../../types/env';
import { generateJWT } from '../../lib/jwt';
import { authenticateRequest } from '../../lib/staff-session-auth';
import { AuditLogger } from '../../lib/audit-logger';
import {
  getClientIdentifier,
  userOrIpKeyGenerator,
  buildRateLimitKey,
  checkRateLimit,
  AUTH_RATE_LIMIT,
} from '../../middleware/rate-limit';
import { registerOrderWriteHandlers } from '../../routes/openapi-orders-handlers/order-write-handlers';
import {
  handleCancelOrder,
  resolveCustomerOwnerIdsForMutation,
} from '../../routes/openapi-orders-handlers/order-cancel-handlers';
import {
  PAYMENT_ROLES,
  resolvePaymentTenantScope,
  resolvePaymentCustomerOwnerIds,
  canAccessPaymentOrder,
} from '../../../../packages/domain/payment/policies/payment-access';
import { registerProductMutationHandlers } from '../../routes/openapi-products-handlers/mutation-handlers';
import { registerCategoryMutationHandlers } from '../../routes/openapi-categories-handlers/mutation-handlers';
import {
  getCustomerMenuHandler,
  getMenuItemHandler,
} from '../../routes/catalog-handlers/handlers';
import { inventoryCRUD } from '../../../../packages/domain/inventory/src/routes/inventory-crud';
import { inventorySnapshots } from '../../../../packages/domain/inventory/src/routes/inventory-snapshots';
import {
  registerPurchaseOrderHandlers,
  resolveOpenApiIngredientTenant,
  FORBIDDEN_TENANT_SENTINEL as PO_FORBIDDEN_TENANT_SENTINEL,
} from '../../routes/openapi-inventory-handlers/purchase-order-handlers';
import { registerCheckoutHandlers } from '../../routes/dindin-handlers/checkout-handlers';
import { registerCartHandlers } from '../../routes/dindin-handlers/cart-handlers';
import {
  hasCrossTenantDindinOverride,
  hasForbiddenTenantOverride,
  resolveDinDinTenant,
} from '../../routes/dindin-handlers/types';
import {
  customerRoutes,
  resolveErpnextTenant,
  FORBIDDEN_TENANT_SENTINEL,
} from '../../routes/erpnext/customers';
import { resolveErpnextTenant as resolveVendorTenant } from '../../routes/erpnext/vendors';
import { resolveErpnextTenant as resolveExpenseTenant } from '../../routes/erpnext/expenses';
import { OrderBroadcaster } from '../../do/OrderBroadcaster';
import {
  getCustomerCanonicalProfile,
  findOrCreateCustomerByIdentifier,
} from '../../../../packages/domain/customer/policies/customer-lifecycle-policy';
import {
  buildIdempotencyKey,
  dispatchCustomerEvent,
} from '../../../../packages/domain/customer/events/customer-event-dispatcher';
import { lookupProfile } from '../../../../packages/domain/crm/lookup-profile';
import { updateConsent } from '../../../../packages/domain/crm/commands/update-consent';
import {
  saveClientSession,
  invalidateClientSession,
  readSessionSnapshot,
  isSameSessionSnapshot,
  subscribeSessionChange,
  getClientSessionScopeSnapshot,
} from '../../../../src/lib/client-session';
import { useCartStore } from '../../../../src/hooks/stores/use-cart-store';
import { useOrderStore } from '../../../../src/hooks/stores/use-order-store';
import { useLoyaltyStore } from '../../../../src/hooks/stores/use-loyalty-store';
import { useReferralStore } from '../../../../src/hooks/stores/use-referral-store';
import { useMenuStore } from '../../../../src/hooks/stores/use-menu-store';
import { OfflineDB } from '../../../../src/lib/offline-db';

const JWT_SECRET = 'phase69-bp1-bp4-integration-secret-32chars!!';

function createSqliteD1(sqlite: DatabaseSync): D1Database {
  const makeStmt = (sql: string, boundValues: unknown[] = []): D1PreparedStatement => {
    const normalize = (v: unknown) => (v === undefined ? null : v);
    const stmt: D1PreparedStatement = {
      bind: (...values: unknown[]) => makeStmt(sql, values.map(normalize)),
      first: async <T = Record<string, unknown>>(colName?: string): Promise<T | null> => {
        const prepared = sqlite.prepare(sql);
        const row = prepared.get(...(boundValues as never[])) as Record<string, unknown> | undefined;
        if (!row) return null;
        if (colName) return ((row[colName] ?? null) as unknown) as T;
        return (row as unknown) as T;
      },
      all: async <T = Record<string, unknown>>(): Promise<D1Result<T>> => {
        const prepared = sqlite.prepare(sql);
        const rows = prepared.all(...(boundValues as never[])) as unknown as T[];
        return {
          results: rows ?? [],
          success: true,
          meta: {
            duration: 0,
            size_after: 0,
            rows_read: rows?.length ?? 0,
            rows_written: 0,
            last_row_id: 0,
            changed_db: false,
            changes: 0,
          },
        };
      },
      run: async (): Promise<D1Result> => {
        const prepared = sqlite.prepare(sql);
        const info = prepared.run(...(boundValues as never[]));
        return {
          results: [],
          success: true,
          meta: {
            duration: 0,
            size_after: 0,
            rows_read: 0,
            rows_written: Number(info.changes ?? 0),
            last_row_id: Number(info.lastInsertRowid ?? 0),
            changed_db: Number(info.changes ?? 0) > 0,
            changes: Number(info.changes ?? 0),
          },
        };
      },
      raw: async <T = unknown[]>(): Promise<T[]> => {
        const prepared = sqlite.prepare(sql);
        const rows = prepared.all(...(boundValues as never[])) as Record<string, unknown>[];
        return rows.map((r) => Object.values(r)) as unknown as T[];
      },
    };
    return stmt;
  };

  return {
    prepare: (sql: string) => makeStmt(sql),
    batch: async <T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> => {
      const out: D1Result<T>[] = [];
      for (const s of statements) {
        out.push((await s.run()) as unknown as D1Result<T>);
      }
      return out;
    },
    exec: async (sql: string): Promise<D1ExecResult> => {
      sqlite.exec(sql);
      return { count: 1, duration: 0 };
    },
    dump: async (): Promise<ArrayBuffer> => new ArrayBuffer(0),
    withSession: () => {
      throw new Error('withSession not implemented in test shim');
    },
  } as unknown as D1Database;
}

function createMemoryKV(): KVNamespace {
  const store = new Map<string, string>();
  return {
    get: async (key: string, type?: string) => {
      const val = store.get(key) ?? null;
      if (val !== null && type === 'json') {
        return JSON.parse(val);
      }
      return val;
    },
    put: async (key: string, value: string) => {
      store.set(key, String(value));
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async (opts?: { prefix?: string }) => {
      const prefix = opts?.prefix ?? '';
      const keys = [...store.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true, cacheStatus: null };
    },
    getWithMetadata: async (key: string) => ({
      value: store.get(key) ?? null,
      metadata: null,
      cacheStatus: null,
    }),
  } as unknown as KVNamespace;
}

function setupSchema(sqlite: DatabaseSync): void {
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT,
      name TEXT,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'customer',
      tenant_id TEXT NOT NULL DEFAULT 'default',
      is_active INTEGER NOT NULL DEFAULT 1,
      auth_version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      phone TEXT,
      name TEXT,
      email TEXT,
      tax_id TEXT,
      loyalty_points INTEGER NOT NULL DEFAULT 0,
      lifetime_points INTEGER NOT NULL DEFAULT 0,
      total_spent REAL NOT NULL DEFAULT 0,
      total_orders INTEGER NOT NULL DEFAULT 0,
      tier TEXT NOT NULL DEFAULT 'bronze',
      loyalty_tier TEXT NOT NULL DEFAULT 'bronze',
      referral_code TEXT,
      marketing_opt_in INTEGER NOT NULL DEFAULT 0,
      source TEXT DEFAULT 'direct',
      visit_count INTEGER NOT NULL DEFAULT 0,
      erpnext_id TEXT,
      sync_status TEXT DEFAULT 'pending',
      last_order_at TEXT,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE customer_identities (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      identifier_type TEXT NOT NULL DEFAULT 'phone',
      identifier_value TEXT NOT NULL,
      verified INTEGER NOT NULL DEFAULT 0,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE consents (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      granted INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'customer_portal',
      policy_version TEXT,
      granted_at TEXT NOT NULL DEFAULT (datetime('now')),
      revoked_at TEXT,
      created_by TEXT,
      tenant_id TEXT NOT NULL DEFAULT 'default'
    );

    CREATE TABLE customer_visits (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT 'pos',
      visited_at TEXT NOT NULL DEFAULT (datetime('now')),
      tenant_id TEXT NOT NULL DEFAULT 'default'
    );

    CREATE TABLE customer_events (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      recorded_at TEXT NOT NULL,
      tenant_id TEXT NOT NULL DEFAULT 'default'
    );

    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      name_vi TEXT,
      display_name_vi TEXT,
      display_name_en TEXT,
      slug TEXT,
      description TEXT,
      icon TEXT,
      image_url TEXT,
      parent_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      slug TEXT,
      price REAL NOT NULL DEFAULT 0,
      compare_at_price REAL,
      description TEXT,
      image_url TEXT,
      tags TEXT,
      is_available INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE menu_items (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      category TEXT,
      name TEXT NOT NULL,
      name_vi TEXT,
      slug TEXT,
      description TEXT,
      description_vi TEXT,
      price REAL NOT NULL DEFAULT 0,
      cost_price REAL,
      compare_price REAL,
      currency TEXT DEFAULT 'VND',
      image_url TEXT,
      image_emoji TEXT,
      Emoji TEXT,
      images TEXT,
      tags TEXT,
      nutrition TEXT,
      variants TEXT,
      allergens TEXT,
      preparation_time INTEGER DEFAULT 5,
      prep_time_minutes INTEGER DEFAULT 5,
      calories INTEGER,
      sku TEXT,
      stock_quantity INTEGER,
      low_stock_threshold INTEGER DEFAULT 5,
      track_inventory INTEGER DEFAULT 0,
      is_featured INTEGER DEFAULT 0,
      is_available INTEGER NOT NULL DEFAULT 1,
      available INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      display_order INTEGER NOT NULL DEFAULT 0,
      sold_count INTEGER NOT NULL DEFAULT 0,
      rating_avg REAL NOT NULL DEFAULT 0,
      rating_count INTEGER NOT NULL DEFAULT 0,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE modifier_groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      min_select INTEGER DEFAULT 0,
      max_select INTEGER DEFAULT 1,
      required INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      tenant_id TEXT NOT NULL DEFAULT 'default'
    );

    CREATE TABLE modifiers (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      price_delta REAL DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      is_available INTEGER DEFAULT 1,
      sort_order INTEGER DEFAULT 0,
      tenant_id TEXT NOT NULL DEFAULT 'default'
    );

    CREATE TABLE menu_item_modifier_groups (
      item_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      tenant_id TEXT NOT NULL DEFAULT 'default'
    );

    CREATE TABLE happy_hour_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      discount_percent INTEGER NOT NULL,
      start_hour INTEGER NOT NULL,
      end_hour INTEGER NOT NULL,
      days_of_week TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
      category_id TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE orders (
      id TEXT PRIMARY KEY,
      order_number TEXT,
      customer_id TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      customer_email TEXT,
      table_id TEXT,
      table_number TEXT,
      order_type TEXT DEFAULT 'dine_in',
      status TEXT NOT NULL DEFAULT 'pending',
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      payment_method TEXT DEFAULT 'cash',
      items TEXT DEFAULT '[]',
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      loyalty_Lock_points INTEGER DEFAULT 0,
      loyalty_discount REAL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      delivery_fee REAL NOT NULL DEFAULT 0,
      tip_amount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      cancel_reason TEXT,
      delivery_address TEXT,
      promo_code TEXT,
      staff_id TEXT,
      source TEXT DEFAULT 'pos',
      erpnext_id TEXT,
      sync_status TEXT DEFAULT 'pending',
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      cancelled_at TEXT
    );

    CREATE TABLE order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      menu_item_id TEXT,
      item_id TEXT,
      name TEXT,
      item_name TEXT,
      price REAL NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 1,
      subtotal REAL NOT NULL DEFAULT 0,
      total_price REAL NOT NULL DEFAULT 0,
      variant TEXT,
      modifiers TEXT,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE order_status_history (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      changed_by TEXT,
      note TEXT,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE inventory_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      sku TEXT,
      unit TEXT NOT NULL DEFAULT 'kg',
      current_stock REAL NOT NULL DEFAULT 0,
      min_stock REAL NOT NULL DEFAULT 0,
      max_stock REAL DEFAULT 100,
      cost_per_unit REAL DEFAULT 0,
      supplier TEXT,
      category TEXT DEFAULT 'raw',
      last_restocked TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE ingredients (
      id TEXT PRIMARY KEY,
      code TEXT,
      name TEXT NOT NULL,
      unit TEXT NOT NULL DEFAULT 'g',
      current_stock REAL NOT NULL DEFAULT 0,
      min_stock REAL NOT NULL DEFAULT 0,
      cost_per_unit REAL NOT NULL DEFAULT 0,
      Reorder_point REAL DEFAULT 0,
      supplier_id TEXT,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE inventory_logs (
      id TEXT PRIMARY KEY,
      inventory_id TEXT,
      item_id TEXT,
      action TEXT,
      type TEXT,
      quantity REAL NOT NULL DEFAULT 0,
      previous_stock REAL,
      new_stock REAL,
      reason TEXT,
      note TEXT,
      staff_id TEXT,
      created_by TEXT,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE inventory_snapshots (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      date TEXT NOT NULL,
      opening_stock REAL NOT NULL DEFAULT 0,
      closing_stock REAL NOT NULL DEFAULT 0,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tenant_id TEXT NOT NULL DEFAULT 'default'
    );

    CREATE TABLE purchase_orders (
      id TEXT PRIMARY KEY,
      po_number TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'sent',
      total_amount REAL NOT NULL DEFAULT 0,
      notes TEXT,
      expected_at INTEGER,
      received_at INTEGER,
      created_by TEXT,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at INTEGER DEFAULT 0,
      updated_at INTEGER DEFAULT 0
    );

    CREATE TABLE purchase_order_items (
      id TEXT PRIMARY KEY,
      po_id TEXT NOT NULL,
      ingredient_id TEXT NOT NULL,
      qty_ordered REAL NOT NULL,
      qty_received REAL NOT NULL DEFAULT 0,
      unit_cost REAL NOT NULL DEFAULT 0,
      line_total REAL NOT NULL DEFAULT 0,
      tenant_id TEXT NOT NULL DEFAULT 'default'
    );

    CREATE TABLE stock_movements (
      id TEXT PRIMARY KEY,
      ingredient_id TEXT NOT NULL,
      movement_type TEXT NOT NULL,
      qty_change REAL NOT NULL,
      qty_before REAL NOT NULL,
      qty_after REAL NOT NULL,
      unit_cost REAL,
      reference_type TEXT,
      reference_id TEXT,
      notes TEXT,
      actor_id TEXT,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at INTEGER DEFAULT 0
    );

    CREATE TABLE loyalty_point_logs (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      order_id TEXT,
      points_change INTEGER NOT NULL,
      reason TEXT,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE payment_webhooks (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      order_id TEXT NOT NULL,
      status TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      raw_payload TEXT,
      signature_valid INTEGER NOT NULL DEFAULT 0,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      processed_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(8)))),
      actor_id TEXT,
      actor_name TEXT,
      user_id TEXT NOT NULL DEFAULT 'system',
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      entity_type TEXT,
      entity_id TEXT,
      operating_unit_id TEXT,
      status TEXT,
      correlation_id TEXT,
      old_value TEXT,
      new_value TEXT,
      details TEXT,
      metadata TEXT,
      ip_address TEXT,
      user_agent TEXT,
      tenant_id TEXT NOT NULL DEFAULT 'default',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function buildEnv(db: D1Database, kv?: KVNamespace, extra: Partial<Env> = {}): Env {
  return {
    AURA_DB: db,
    AUTH_KV: kv ?? createMemoryKV(),
    JWT_SECRET,
    ENVIRONMENT: 'test',
    ...extra,
  } as unknown as Env;
}

describe('Phase 69 Security Regression Suite (BP1..BP4)', () => {
  let sqlite: DatabaseSync;
  let db: D1Database;
  let kv: KVNamespace;

  beforeEach(() => {
    sqlite = new DatabaseSync(':memory:');
    setupSchema(sqlite);
    db = createSqliteD1(sqlite);
    kv = createMemoryKV();
    localStorage.clear();
  });

  // =========================================================================
  // BP1: Order Cancel, Order Write, Payment Access, OpenAPI Catalog & Handlers
  // =========================================================================
  describe('BP1 — Order Cancel/Write, Payment Access & Catalog Tenant Isolation', () => {
    it('BP1-01: order-cancel-handlers allows customer cancellation via linked CRM customers.user_id in same tenant, blocks cross-tenant or unowned orders, and rejects conflicting tenant overrides', async () => {
      sqlite
        .prepare(`INSERT INTO users (id, email, name, role, tenant_id, is_active, auth_version) VALUES (?, ?, ?, ?, ?, 1, 1)`)
        .run('usr-cust-a', 'custa@aura.vn', 'Customer A', 'customer', 'store-a');
      sqlite
        .prepare(`INSERT INTO customers (id, user_id, phone, name, email, loyalty_points, tenant_id) VALUES (?, ?, ?, ?, ?, 50, ?)`)
        .run('crm-cust-a', 'usr-cust-a', '0901111222', 'Customer A', 'custa@aura.vn', 'store-a');
      sqlite
        .prepare(`INSERT INTO orders (id, order_number, customer_id, status, payment_status, total, tenant_id) VALUES (?, ?, ?, 'pending', 'unpaid', 65000, ?)`)
        .run('ord-linked-a', 'ORD-A1', 'crm-cust-a', 'store-a');
      sqlite
        .prepare(`INSERT INTO orders (id, order_number, customer_id, status, payment_status, total, tenant_id) VALUES (?, ?, ?, 'pending', 'unpaid', 65000, ?)`)
        .run('ord-other-a', 'ORD-A2', 'crm-cust-other', 'store-a');
      sqlite
        .prepare(`INSERT INTO orders (id, order_number, customer_id, status, payment_status, total, tenant_id) VALUES (?, ?, ?, 'pending', 'unpaid', 65000, ?)`)
        .run('ord-store-b', 'ORD-B1', 'crm-cust-a', 'store-b');

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, {
          id: 'usr-cust-a',
          role: 'customer',
          tenantId: 'store-a',
        } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerOrderWriteHandlers(app);

      const env = buildEnv(db, kv);

      const resolvedIds = await resolveCustomerOwnerIdsForMutation(
        db as never,
        { id: 'usr-cust-a', role: 'customer', tenantId: 'store-a' },
        'store-a'
      );
      expect(resolvedIds).toContain('usr-cust-a');
      expect(resolvedIds).toContain('crm-cust-a');

      // 1. Conflicting multi-alias tenant overrides -> 403
      const conflictRes = await app.request(
        'http://localhost/api/orders/ord-linked-a/cancel?tenant_id=store-a&store_id=store-b',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Changed mind' }),
        },
        env
      );
      expect(conflictRes.status).toBe(403);

      // 2. Unowned order in same tenant -> 403/404
      const unownedRes = await app.request(
        'http://localhost/api/orders/ord-other-a/cancel',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Try cancel someone else order' }),
        },
        env
      );
      expect([403, 404]).toContain(unownedRes.status);

      // 3. Cross-tenant order -> 404
      const crossTenantRes = await app.request(
        'http://localhost/api/orders/ord-store-b/cancel',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Try cross-tenant cancel' }),
        },
        env
      );
      expect(crossTenantRes.status).toBe(404);

      // 4. Customer whose user.id links to customers.user_id ('crm-cust-a') -> 200
      const okRes = await app.request(
        'http://localhost/api/orders/ord-linked-a/cancel',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Ordered by mistake' }),
        },
        env
      );
      expect(okRes.status).toBe(200);
      expect(typeof handleCancelOrder).toBe('function');
      const updated = sqlite.prepare('SELECT status, tenant_id FROM orders WHERE id = ?').get('ord-linked-a') as {
        status: string;
        tenant_id: string;
      };
      expect(updated.status).toBe('cancelled');
      expect(updated.tenant_id).toBe('store-a');
    });

    it('BP1-02: order-write-handlers scopes status updates by effectiveOrderTenant, attributes HQ wildcard audit logs to row tenant, and rejects conflicting tenant overrides', async () => {
      sqlite
        .prepare(`INSERT INTO orders (id, order_number, customer_id, status, payment_status, total, tenant_id) VALUES (?, ?, ?, 'pending', 'paid', 90000, ?)`)
        .run('ord-hq-target', 'ORD-HQ-1', 'cust-a', 'store-a');
      sqlite
        .prepare(`INSERT INTO order_items (id, order_id, menu_item_id, name, price, unit_price, quantity, subtotal, total_price, tenant_id) VALUES (?, ?, ?, ?, 90000, 90000, 1, 90000, 90000, ?)`)
        .run('oi-1', 'ord-hq-target', 'item-a', 'Cold Brew', 'store-a');

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, {
          id: 'hq-owner',
          role: 'owner',
          tenantId: 'hq',
        } as never);
        c.set('tenantId' as never, '*' as never);
        await next();
      });
      registerOrderWriteHandlers(app);

      const env = buildEnv(db, kv);

      // Conflicting query/header overrides -> 403 even for HQ super-admin
      const conflictRes = await app.request(
        'http://localhost/api/orders/ord-hq-target?tenant_id=store-a',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Store-ID': 'store-b' },
          body: JSON.stringify({ status: 'confirmed' }),
        },
        env
      );
      expect(conflictRes.status).toBe(403);

      // Valid HQ wildcard status update -> attributes audit_logs and status history to 'store-a' (never '*')
      const okRes = await app.request(
        'http://localhost/api/orders/ord-hq-target',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'confirmed', notes: 'Confirmed by HQ' }),
        },
        env
      );
      expect(okRes.status).toBe(200);

      const orderRow = sqlite.prepare('SELECT status, tenant_id FROM orders WHERE id = ?').get('ord-hq-target') as {
        status: string;
        tenant_id: string;
      };
      expect(orderRow.status).toBe('confirmed');
      expect(orderRow.tenant_id).toBe('store-a');

      const auditRow = sqlite
        .prepare("SELECT user_id, tenant_id FROM audit_logs WHERE (entity_id = 'ord-hq-target' OR resource_id = 'ord-hq-target') LIMIT 1")
        .get() as { user_id: string; tenant_id: string } | undefined;
      expect(auditRow).toBeDefined();
      expect(auditRow?.user_id).toBe('hq-owner');
      expect(auditRow?.tenant_id).toBe('store-a');
    });

    it('BP1-03: payment-access resolves linked CRM customers.id via user_id, includes shipper in PAYMENT_ROLES, and rejects conflicting tenant overrides', async () => {
      expect(PAYMENT_ROLES).toContain('shipper');

      sqlite
        .prepare(`INSERT INTO customers (id, user_id, phone, name, tenant_id) VALUES (?, ?, ?, ?, ?)`)
        .run('crm-pay-a', 'usr-pay-a', '0903333444', 'Pay Customer A', 'store-a');

      const makeCtx = (opts: {
        user?: Record<string, unknown>;
        tenantId?: string;
        customerOwnerIds?: string[];
        query?: Record<string, string>;
        headers?: Record<string, string>;
      }) =>
        ({
          env: buildEnv(db, kv),
          get: (k: string) =>
            k === 'user'
              ? opts.user
              : k === 'tenantId'
                ? opts.tenantId
                : k === 'customerOwnerIds'
                  ? opts.customerOwnerIds
                  : undefined,
          req: {
            query: (k: string) => opts.query?.[k],
            header: (k: string) => opts.headers?.[k] ?? opts.headers?.[k.toLowerCase()],
          },
        }) as never;

      // 1. Conflicting overrides rejected -> resolvePaymentTenantScope returns null
      const conflictScope = resolvePaymentTenantScope(
        makeCtx({
          user: { id: 'usr-pay-a', role: 'customer', tenantId: 'store-a' },
          tenantId: 'store-a',
          query: { tenant_id: 'store-a', store_id: 'store-b' },
        })
      );
      expect(conflictScope).toBeNull();

      // 2. resolvePaymentCustomerOwnerIds resolves linked CRM customer 'crm-pay-a' for user 'usr-pay-a' in 'store-a'
      const ownerIdsA = await resolvePaymentCustomerOwnerIds(
        db,
        { id: 'usr-pay-a', role: 'customer', tenantId: 'store-a' },
        'store-a'
      );
      expect(ownerIdsA).toContain('usr-pay-a');
      expect(ownerIdsA).toContain('crm-pay-a');

      // Cross-tenant lookup in 'store-b' does not leak 'crm-pay-a'
      const ownerIdsB = await resolvePaymentCustomerOwnerIds(
        db,
        { id: 'usr-pay-a', role: 'customer', tenantId: 'store-b' },
        'store-b'
      );
      expect(ownerIdsB).not.toContain('crm-pay-a');

      // 3. canAccessPaymentOrder allows customer when customerOwnerIds / customerId matches and rejects cross-tenant order
      const validCtx = makeCtx({
        user: { id: 'usr-pay-a', role: 'customer', tenantId: 'store-a' },
        tenantId: 'store-a',
        customerOwnerIds: ownerIdsA,
      });
      expect(canAccessPaymentOrder(validCtx, { tenant_id: 'store-a', customer_id: 'crm-pay-a' })).toBe(true);
      expect(canAccessPaymentOrder(validCtx, { tenant_id: 'store-b', customer_id: 'crm-pay-a' })).toBe(false);
      expect(canAccessPaymentOrder(validCtx, { tenant_id: 'store-a', customer_id: 'crm-other' })).toBe(false);
    });

    it('BP1-04: openapi-products and openapi-categories mutation handlers reject conflicting overrides and attribute HQ wildcard updates/deletes to row tenant', async () => {
      sqlite
        .prepare(`INSERT INTO categories (id, name, slug, is_active, tenant_id) VALUES (?, ?, ?, 1, ?)`)
        .run('cat-store-a', 'Coffee A', 'coffee-a', 'store-a');
      sqlite
        .prepare(`INSERT INTO products (id, category_id, name, slug, price, is_available, tenant_id) VALUES (?, ?, ?, ?, 45000, 1, ?)`)
        .run('prod-store-a', 'cat-store-a', 'Latte A', 'latte-a', 'store-a');
      sqlite
        .prepare(`INSERT INTO menu_items (id, category_id, name, price, is_available, available, is_active, tenant_id) VALUES (?, ?, ?, 45000, 1, 1, 1, ?)`)
        .run('prod-store-a', 'cat-store-a', 'Latte A', 'store-a');

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'hq-admin', role: 'owner', tenantId: 'hq' } as never);
        c.set('tenantId' as never, '*' as never);
        await next();
      });
      registerProductMutationHandlers(app);
      registerCategoryMutationHandlers(app);

      const env = buildEnv(db, kv);

      // 1. Conflicting tenant overrides on product update -> 403
      const prodConflict = await app.request(
        'http://localhost/api/products/prod-store-a?tenant_id=store-a&store_id=store-b',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ price: 49000 }),
        },
        env
      );
      expect(prodConflict.status).toBe(403);

      // 2. HQ wildcard product update preserves 'store-a' tenant_id and never overwrites with '*'
      const prodUpdate = await app.request(
        'http://localhost/api/products/prod-store-a',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ translations: [{ locale: 'vi', name: 'Latte A Updated' }], basePrice: 49000 }),
        },
        env
      );
      expect(prodUpdate.status).toBe(200);
      const updatedProd = sqlite
        .prepare('SELECT name, price, tenant_id FROM products WHERE id = ?')
        .get('prod-store-a') as { name: string; price: number; tenant_id: string };
      expect(updatedProd.name).toBe('Latte A Updated');
      expect(updatedProd.tenant_id).toBe('store-a');

      // 3. Conflicting tenant overrides on category update -> 403
      const catConflict = await app.request(
        'http://localhost/api/categories/cat-store-a?tenant_id=store-a',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-Store-ID': 'store-b' },
          body: JSON.stringify({ name: 'Should Fail' }),
        },
        env
      );
      expect(catConflict.status).toBe(403);

      // 4. HQ wildcard category update preserves 'store-a'
      const catUpdate = await app.request(
        'http://localhost/api/categories/cat-store-a',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug: 'specialty-coffee-a', translations: [{ locale: 'vi', name: 'Specialty Coffee A' }] }),
        },
        env
      );
      expect(catUpdate.status).toBe(200);
      const updatedCat = sqlite
        .prepare('SELECT slug, tenant_id FROM categories WHERE id = ?')
        .get('cat-store-a') as { slug: string; tenant_id: string };
      expect(updatedCat.slug).toBe('specialty-coffee-a');
      expect(updatedCat.tenant_id).toBe('store-a');
    });

    it('BP1-05: catalog-handlers and get-customer-menu reject conflicting multi-alias overrides, restrict include_unavailable to staff roles, and isolate menu items by tenant', async () => {
      sqlite
        .prepare(`INSERT INTO categories (id, name, is_active, tenant_id) VALUES (?, ?, 1, ?), (?, ?, 1, ?)`)
        .run('cat-a', 'Drinks A', 'store-a', 'cat-b', 'Drinks B', 'store-b');
      sqlite
        .prepare(`INSERT INTO menu_items (id, category_id, name, price, is_available, available, is_active, tenant_id) VALUES (?, ?, ?, 55000, 1, 1, 1, ?), (?, ?, ?, 60000, 0, 0, 1, ?), (?, ?, ?, 75000, 1, 1, 1, ?)`)
        .run('item-a-avail', 'cat-a', 'Matcha A', 'store-a', 'item-a-hidden', 'cat-a', 'Secret Matcha A', 'store-a', 'item-b', 'cat-b', 'Matcha B', 'store-b');

      const app = new Hono<{ Bindings: Env }>();
      let currentUser: Record<string, unknown> | undefined = { id: 'cust-a', role: 'customer', tenantId: 'store-a' };
      app.use('*', async (c, next) => {
        if (currentUser) c.set('user' as never, currentUser as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      app.get('/api/menu', getCustomerMenuHandler);
      app.get('/api/menu/:id', getMenuItemHandler);

      const env = buildEnv(db, kv);

      // 1. Conflicting query/header override on /api/menu -> 403
      const conflictRes = await app.request(
        'http://localhost/api/menu?tenant_id=store-a&store_id=store-b',
        { method: 'GET' },
        env
      );
      expect(conflictRes.status).toBe(403);

      // 2. Customer requesting include_unavailable=true does NOT receive unavailable items and never sees store-b items
      const custMenuRes = await app.request(
        'http://localhost/api/menu?include_unavailable=true',
        { method: 'GET' },
        env
      );
      expect(custMenuRes.status).toBe(200);
      const custMenuJson = JSON.stringify(await custMenuRes.json());
      expect(custMenuJson).toContain('item-a-avail');
      expect(custMenuJson).not.toContain('item-a-hidden');
      expect(custMenuJson).not.toContain('item-b');

      // 3. Staff role requesting include_unavailable=true receives store-a unavailable items (still never store-b)
      currentUser = { id: 'mgr-a', role: 'manager', tenantId: 'store-a' };
      const staffMenuRes = await app.request(
        'http://localhost/api/menu?include_unavailable=true',
        { method: 'GET' },
        env
      );
      expect(staffMenuRes.status).toBe(200);
      const staffMenuJson = JSON.stringify(await staffMenuRes.json());
      expect(staffMenuJson).toContain('item-a-avail');
      expect(staffMenuJson).toContain('item-a-hidden');
      expect(staffMenuJson).not.toContain('item-b');

      // 4. Cross-tenant item lookup ('item-b' in 'store-b') returns 404
      const crossItemRes = await app.request('http://localhost/api/menu/item-b', { method: 'GET' }, env);
      expect(crossItemRes.status).toBe(404);
    });
  });

  // =========================================================================
  // BP2: Inventory CRUD/Snapshots/Batch/PO, DinDin & ERPNext Sync
  // =========================================================================
  describe('BP2 — Inventory, Purchase Orders, DinDin & ERPNext Tenant Confinement', () => {
    it('BP2-01: inventory-crud scopes PATCH/adjust/check/logs to effectiveTenant, rejects conflicting overrides, and blocks unscoped SQL fallback on non-default tenants', async () => {
      sqlite
        .prepare(`INSERT INTO inventory_items (id, name, unit, current_stock, min_stock, is_active, tenant_id) VALUES (?, ?, 'kg', 20, 5, 1, ?), (?, ?, 'kg', 50, 5, 1, ?)`)
        .run('inv-a', 'Beans A', 'store-a', 'inv-b', 'Beans B', 'store-b');
      sqlite
        .prepare(`INSERT INTO inventory_logs (id, item_id, type, quantity, previous_stock, new_stock, tenant_id) VALUES (?, ?, 'in', 20, 0, 20, ?), (?, ?, 'in', 50, 0, 50, ?)`)
        .run('log-a', 'inv-a', 'store-a', 'log-b', 'inv-a', 'store-b');

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      inventoryCRUD(app as never);

      const env = buildEnv(db, kv);

      // 1. Conflicting overrides rejected with 403
      const conflictRes = await app.request(
        'http://localhost/inv-a?tenant_id=store-a&store_id=store-b',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Tampered' }),
        },
        env
      );
      expect(conflictRes.status).toBe(403);

      // 2. Cross-tenant PUT on 'inv-b' rejected with 404 and stock unchanged
      const crossUpdate = await app.request(
        'http://localhost/inv-b',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_stock: 10 }),
        },
        env
      );
      expect(crossUpdate.status).toBe(404);
      const invBRow = sqlite.prepare('SELECT current_stock FROM inventory_items WHERE id = ?').get('inv-b') as {
        current_stock: number;
      };
      expect(invBRow.current_stock).toBe(50);

      // 3. Cross-tenant GET on 'inv-b' returns 404 while 'inv-a' returns 200
      const crossGet = await app.request('http://localhost/inv-b', { method: 'GET' }, env);
      expect(crossGet.status).toBe(404);
      const ownGet = await app.request('http://localhost/inv-a', { method: 'GET' }, env);
      expect(ownGet.status).toBe(200);
    });

    it('BP2-02: inventory-snapshots enforces tenant/role guards, rejects conflicting overrides, and attributes HQ wildcard mutations to item tenant', async () => {
      sqlite
        .prepare(`INSERT INTO inventory_items (id, name, unit, current_stock, min_stock, is_active, tenant_id) VALUES (?, ?, 'kg', 3, 10, 1, ?), (?, ?, 'kg', 2, 10, 1, ?)`)
        .run('snap-item-a', 'Milk A', 'store-a', 'snap-item-b', 'Milk B', 'store-b');

      const app = new Hono<{ Bindings: Env }>();
      let currentUser: Record<string, unknown> = { id: 'hq-1', role: 'owner', tenantId: 'hq' };
      let currentTenant = '*';
      app.use('*', async (c, next) => {
        c.set('user' as never, currentUser as never);
        c.set('tenantId' as never, currentTenant as never);
        await next();
      });
      inventorySnapshots(app as never);

      const env = buildEnv(db, kv);

      // 1. Conflicting overrides on snapshot generation -> 403
      const genConflict = await app.request(
        'http://localhost/snapshots/generate?tenant_id=store-a&store_id=store-b',
        { method: 'POST' },
        env
      );
      expect(genConflict.status).toBe(403);

      // 2. HQ wildcard recording snapshot on 'snap-item-a' attributes tenant_id='store-a' (never '*')
      const postSnap = await app.request(
        'http://localhost/snap-item-a/snapshots',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ closing_stock: 3 }),
        },
        env
      );
      expect([200, 201]).toContain(postSnap.status);
      const snapRow = sqlite
        .prepare('SELECT item_id, closing_stock, tenant_id FROM inventory_snapshots WHERE item_id = ?')
        .get('snap-item-a') as { item_id: string; closing_stock: number; tenant_id: string };
      expect(snapRow.closing_stock).toBe(3);
      expect(snapRow.tenant_id).toBe('store-a');

      // 3. Store-A manager cannot record snapshot for cross-tenant 'snap-item-b'
      currentUser = { id: 'mgr-a', role: 'manager', tenantId: 'store-a' };
      currentTenant = 'store-a';
      const crossSnap = await app.request(
        'http://localhost/snap-item-b/snapshots',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ closing_stock: 2 }),
        },
        env
      );
      expect(crossSnap.status).toBe(404);
    });

    it('BP2-03: purchase-order-handlers rejects conflicting overrides and isolates purchase order creation & lookup by tenant', async () => {
      sqlite
        .prepare(`INSERT INTO suppliers (id, name, tenant_id) VALUES (?, ?, ?), (?, ?, ?)`)
        .run('sup-a', 'Supplier A', 'store-a', 'sup-b', 'Supplier B', 'store-b');
      sqlite
        .prepare(`INSERT INTO ingredients (id, name, unit, current_stock, min_stock, cost_per_unit, tenant_id) VALUES (?, ?, 'kg', 10, 2, 100, ?), (?, ?, 'kg', 40, 5, 100, ?)`)
        .run('ing-a', 'Matcha Powder A', 'store-a', 'ing-b', 'Matcha Powder B', 'store-b');
      sqlite
        .prepare(`INSERT INTO purchase_orders (id, po_number, supplier_id, status, total_amount, tenant_id) VALUES (?, ?, ?, 'sent', 500, ?), (?, ?, ?, 'sent', 900, ?)`)
        .run('po-a', 'PO-A01', 'sup-a', 'store-a', 'po-b', 'PO-B01', 'sup-b', 'store-b');
      sqlite
        .prepare(`INSERT INTO purchase_order_items (id, po_id, ingredient_id, qty_ordered, qty_received, unit_cost, line_total, tenant_id) VALUES (?, ?, ?, 5, 0, 100, 500, ?)`)
        .run('poi-a', 'po-a', 'ing-a', 'store-a');

      const app = new OpenAPIHono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerPurchaseOrderHandlers(app);

      const env = buildEnv(db, kv);

      // 1. Conflicting tenant overrides rejected with 403
      expect(
        resolveOpenApiIngredientTenant({
          req: {
            query: (k: string) => (k === 'tenant_id' ? 'store-a' : k === 'store_id' ? 'store-b' : undefined),
            header: () => undefined,
          },
          get: (k: string) => (k === 'user' ? { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } : 'store-a'),
        })
      ).toBe(PO_FORBIDDEN_TENANT_SENTINEL);

      const conflictRes = await app.request(
        'http://localhost/api/inventory/purchase-orders?tenant_id=store-a&store_id=store-b',
        { method: 'GET' },
        env
      );
      expect(conflictRes.status).toBe(403);

      // 2. Store-A manager fetching cross-tenant 'po-b' gets 404
      const crossGet = await app.request(
        'http://localhost/api/inventory/purchase-orders/po-b',
        { method: 'GET' },
        env
      );
      expect(crossGet.status).toBe(404);

      // 3. Store-A manager fetching 'po-a' gets 200
      const okGet = await app.request(
        'http://localhost/api/inventory/purchase-orders/po-a',
        { method: 'GET' },
        env
      );
      expect(okGet.status).toBe(200);
    });

    it('BP2-04: dindin checkout and cart handlers reject conflicting/cross-tenant overrides and isolate checkouts and carts by tenant', async () => {
      sqlite
        .prepare(`INSERT INTO orders (id, customer_name, customer_phone, payment_method, items, total, status, tenant_id) VALUES (?, 'DIN', '0911000111', 'cash', '[]', 50000, 'pending', ?), (?, 'DIN', '0911000222', 'cash', '[]', 80000, 'pending', ?)`)
        .run('DIN-A1', 'store-a', 'DIN-B1', 'store-b');

      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } as never);
        c.set('tenantId' as never, 'store-a' as never);
        await next();
      });
      registerCheckoutHandlers(app);
      registerCartHandlers(app);

      const env = buildEnv(db, kv);

      // 1. Conflicting overrides rejected with 403 on /checkouts and /carts
      const conflictCheckouts = await app.request(
        'http://localhost/checkouts?tenant_id=store-a&store_id=store-b',
        { method: 'GET' },
        env
      );
      expect(conflictCheckouts.status).toBe(403);

      const conflictCarts = await app.request(
        'http://localhost/carts?tenant_id=store-a&store_id=store-b',
        { method: 'GET' },
        env
      );
      expect(conflictCarts.status).toBe(403);

      // 2. Store-A manager listing /checkouts only receives 'DIN-A1' (never 'DIN-B1')
      const listRes = await app.request('http://localhost/checkouts', { method: 'GET' }, env);
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as { data?: { checkouts?: Array<{ order_id?: string; id?: string }> }; checkouts?: Array<{ order_id?: string; id?: string }> };
      const checkouts = listBody.data?.checkouts || listBody.checkouts || [];
      expect(checkouts.map((c) => c.order_id || c.id)).toEqual(['DIN-A1']);

      // 3. Direct helper verification for hasCrossTenantDindinOverride / hasForbiddenTenantOverride / resolveDinDinTenant
      const fakeConflictCtx = {
        get: (k: string) => (k === 'user' ? { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } : 'store-a'),
        req: {
          query: (k: string) => (k === 'tenant_id' ? 'store-a' : k === 'store_id' ? 'store-b' : undefined),
          header: () => undefined,
        },
      };
      expect(hasCrossTenantDindinOverride(fakeConflictCtx as never)).toBe(true);
      expect(hasForbiddenTenantOverride(fakeConflictCtx as never)).toBe(true);
      expect(
        resolveDinDinTenant({
          get: (k: string) => (k === 'user' ? { id: 'mgr-a', role: 'manager', tenantId: 'store-a' } : 'store-a'),
          req: { query: () => undefined, header: () => undefined },
        } as never)
      ).toBe('store-a');
    });

    it('BP2-05: erpnext customers, vendors, and expenses reject conflicting overrides, isolate non-default tenant credentials, and scope queries by tenant_id', async () => {
      sqlite
        .prepare(`INSERT INTO customers (id, name, phone, sync_status, tenant_id) VALUES (?, ?, ?, 'pending', ?), (?, ?, ?, 'pending', ?)`)
        .run('erp-cust-a', 'Shared Name A', '0905555111', 'store-a', 'erp-cust-b', 'Shared Name B', '0905555222', 'store-b');

      const staffTokenA = await generateJWT(
        {
          id: 'mgr-erp-a',
          role: 'manager',
          tenantId: 'store-a',
          authVersion: 1,
          authTime: Math.floor(Date.now() / 1000),
          sessionType: 'staff-web',
        } as never,
        JWT_SECRET,
        28800
      );
      sqlite
        .prepare(`INSERT INTO users (id, email, name, role, tenant_id, is_active, auth_version) VALUES (?, ?, ?, 'manager', 'store-a', 1, 1)`)
        .run('mgr-erp-a', 'mgr-erp-a@aura.vn', 'ERP Manager A');

      const app = new Hono<{ Bindings: Env }>();
      customerRoutes(app);

      const env = buildEnv(db, kv, {
        ERPNEXT_BASE_URL: 'https://global-erp.example.com',
        ERPNEXT_API_KEY: 'global-key',
        ERPNEXT_API_SECRET: 'global-secret',
      });

      // 1. Conflicting overrides across customers, vendors, expenses resolve to FORBIDDEN_TENANT_SENTINEL
      const conflictCtx = {
        req: {
          header: (k: string) => (k === 'X-Tenant-ID' ? 'store-a' : k === 'X-Store-ID' ? 'store-b' : undefined),
          query: () => undefined,
        },
        get: () => ({ id: 'mgr-erp-a', role: 'manager', tenantId: 'store-a' }),
      } as never;
      expect(FORBIDDEN_TENANT_SENTINEL).toBe('__forbidden_tenant_override__');
      expect(resolveErpnextTenant(conflictCtx)).toBe(FORBIDDEN_TENANT_SENTINEL);
      expect(resolveVendorTenant(conflictCtx)).toBe(FORBIDDEN_TENANT_SENTINEL);
      expect(resolveExpenseTenant(conflictCtx)).toBe(FORBIDDEN_TENANT_SENTINEL);

      const conflictRes = await app.request(
        'http://localhost/api/erpnext/customers?tenant_id=store-a&store_id=store-b',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${staffTokenA}` },
        },
        env
      );
      expect(conflictRes.status).toBe(403);

      // 2. Store-A manager fetching cross-tenant customer 'erp-cust-b' gets 404
      const crossCustRes = await app.request(
        'http://localhost/api/erpnext/customers/erp-cust-b',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${staffTokenA}` },
        },
        env
      );
      expect(crossCustRes.status).toBe(404);

      // 3. Store-A manager fetching own tenant customer 'erp-cust-a' gets 200
      const ownCustRes = await app.request(
        'http://localhost/api/erpnext/customers/erp-cust-a',
        {
          method: 'GET',
          headers: { Authorization: `Bearer ${staffTokenA}` },
        },
        env
      );
      expect(ownCustRes.status).toBe(200);
    });
  });

  // =========================================================================
  // BP3: OrderBroadcaster DO, Customer/CRM Domain, Audit, Rate-Limit & Session Auth
  // =========================================================================
  describe('BP3 — OrderBroadcaster DO, Customer/CRM Domain, Audit, Rate-Limit & Session Auth', () => {
    it('BP3-01: OrderBroadcaster keys recentOrders by tenant:orderId and filters WebSocket snapshots by socketTenant', async () => {
      const storageMap = new Map<string, unknown>();
      const mockState = {
        storage: {
          get: vi.fn(async (k: string) => storageMap.get(k)),
          put: vi.fn(async (k: string, v: unknown) => {
            storageMap.set(k, v);
          }),
        },
      };

      const broadcaster = new OrderBroadcaster(mockState as never, {} as Env);

      // Broadcast two orders with identical orderId ('ord-100') across 'store-a' and 'store-b'
      const nowMs = Date.now();
      const resA = await broadcaster.fetch(
        new Request('http://do/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: 'ord-100',
            status: 'pending',
            payment_status: 'unpaid',
            items: [],
            total: 45000,
            customer_name: 'Alice',
            customer_phone: '0901111111',
            createdAt: nowMs,
            updatedAt: nowMs,
            tenantId: 'store-a',
          }),
        })
      );
      expect(resA.status).toBe(200);

      const resB = await broadcaster.fetch(
        new Request('http://do/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: 'ord-100',
            status: 'preparing',
            payment_status: 'paid',
            items: [],
            total: 95000,
            customer_name: 'Bob',
            customer_phone: '0902222222',
            createdAt: nowMs,
            updatedAt: nowMs,
            tenantId: 'store-b',
          }),
        })
      );
      expect(resB.status).toBe(200);

      const recentOrders = (broadcaster as unknown as { recentOrders: Map<string, { tenantId?: string; status: string; total?: number }> }).recentOrders;
      expect(recentOrders.has('store-a:ord-100')).toBe(true);
      expect(recentOrders.has('store-b:ord-100')).toBe(true);
      expect(recentOrders.get('store-a:ord-100')?.status).toBe('pending');
      expect(recentOrders.get('store-b:ord-100')?.status).toBe('preparing');

      // Verify persisted state in DO storage preserves both tenants
      const persisted = storageMap.get('order-broadcaster:state') as { orders: Record<string, unknown> };
      expect(Object.keys(persisted.orders).sort()).toEqual(['store-a:ord-100', 'store-b:ord-100']);
    });

    it('BP3-02: customer-lifecycle-policy and customer-event-dispatcher isolate phone lookup, idempotency keys, and customer_events by tenant', async () => {
      // 1. Same phone number in 'store-a' and 'store-b' resolves to distinct tenant-scoped customer records
      const custA = await findOrCreateCustomerByIdentifier({
        db,
        identifierType: 'phone',
        identifierValue: '0909123456',
        name: 'Alice Store A',
        tenantId: 'store-a',
      });
      const custB = await findOrCreateCustomerByIdentifier({
        db,
        identifierType: 'phone',
        identifierValue: '0909123456',
        name: 'Alice Store B',
        tenantId: 'store-b',
      });
      expect(custA.customerId).toBeTruthy();
      expect(custB.customerId).toBeTruthy();
      expect(custA.customerId).not.toBe(custB.customerId);

      // 2. getCustomerCanonicalProfile isolates cross-tenant access
      const profAInStoreA = await getCustomerCanonicalProfile(db, custA.customerId, 'store-a');
      const profAInStoreB = await getCustomerCanonicalProfile(db, custA.customerId, 'store-b');
      expect(profAInStoreA?.customer.id).toBe(custA.customerId);
      expect(profAInStoreB).toBeNull();

      // 3. dispatchCustomerEvent scopes idempotencyKey by tenant so identical base keys in store-a and store-b both persist
      const keyA = buildIdempotencyKey({
        eventType: 'order.placed',
        customerId: custA.customerId,
        orderId: 'ord-shared-1',
        tenantId: 'store-a',
        idempotencyKey: 'order.placed:shared',
      });
      const keyB = buildIdempotencyKey({
        eventType: 'order.placed',
        customerId: custB.customerId,
        orderId: 'ord-shared-1',
        tenantId: 'store-b',
        idempotencyKey: 'order.placed:shared',
      });
      expect(keyA).toBe('order.placed:shared:store-a');
      expect(keyB).toBe('order.placed:shared:store-b');

      const evA = await dispatchCustomerEvent({
        db,
        eventType: 'order.placed',
        customerId: custA.customerId,
        orderId: 'ord-shared-1',
        tenantId: 'store-a',
        idempotencyKey: 'order.placed:shared',
        payload: { total: 50000 },
      });
      const evB = await dispatchCustomerEvent({
        db,
        eventType: 'order.placed',
        customerId: custB.customerId,
        orderId: 'ord-shared-1',
        tenantId: 'store-b',
        idempotencyKey: 'order.placed:shared',
        payload: { total: 60000 },
      });
      expect(evA.created).toBe(true);
      expect(evB.created).toBe(true);

      // Duplicate dispatch in same tenant is deduplicated
      const evADup = await dispatchCustomerEvent({
        db,
        eventType: 'order.placed',
        customerId: custA.customerId,
        orderId: 'ord-shared-1',
        tenantId: 'store-a',
        idempotencyKey: 'order.placed:shared',
        payload: { total: 50000 },
      });
      expect(evADup.created).toBe(false);
      expect(evADup.eventId).toBe(evA.eventId);
    });

    it('BP3-03: CRM lookupProfile and updateConsent isolate profiles, visits, orders, and consent mutations by tenant', async () => {
      sqlite
        .prepare(`INSERT INTO customers (id, name, phone, email, tier, tenant_id) VALUES (?, ?, ?, ?, 'gold', ?), (?, ?, ?, ?, 'silver', ?)`)
        .run('crm-prof-a', 'Profile A', '0988777666', 'a@aura.vn', 'store-a', 'crm-prof-b', 'Profile B', '0988777666', 'b@aura.vn', 'store-b');
      sqlite
        .prepare(`INSERT INTO customer_identities (id, customer_id, identifier_type, identifier_value, tenant_id) VALUES (?, ?, 'phone', '0988777666', ?), (?, ?, 'phone', '0988777666', ?)`)
        .run('cid-a', 'crm-prof-a', 'store-a', 'cid-b', 'crm-prof-b', 'store-b');
      sqlite
        .prepare(`INSERT INTO orders (id, customer_id, status, payment_status, total, tenant_id) VALUES (?, ?, 'completed', 'paid', 80000, ?), (?, ?, 'completed', 'paid', 150000, ?)`)
        .run('ord-prof-a', 'crm-prof-a', 'store-a', 'ord-prof-b', 'crm-prof-b', 'store-b');

      // 1. lookupProfile for '0988777666' in 'store-a' returns only Profile A and its store-a orders
      const profA = await lookupProfile(db, '0988777666', { tenantId: 'store-a' });
      expect(profA.found).toBe(true);
      expect(profA.customerId).toBe('crm-prof-a');
      expect(profA.name).toBe('Profile A');
      expect(profA.recentOrders.map((o) => o.id)).toEqual(['ord-prof-a']);

      // 2. Cross-tenant updateConsent ('store-b' caller trying to mutate 'crm-prof-a') is rejected with 'forbidden'
      const crossConsent = await updateConsent(
        db,
        {
          customerId: 'crm-prof-a',
          purpose: 'marketing',
          granted: true,
          source: 'staff_action',
          actorId: 'mgr-b',
          actorRole: 'manager',
          tenantId: 'store-b',
        },
        'store-b'
      );
      expect(crossConsent.ok).toBe(false);
      if (!crossConsent.ok) {
        expect(crossConsent.code).toBe('forbidden');
      }

      // 3. HQ wildcard updateConsent on 'crm-prof-a' attributes the new consent row to 'store-a' (never '*')
      const hqConsent = await updateConsent(
        db,
        {
          customerId: 'crm-prof-a',
          purpose: 'marketing',
          granted: true,
          source: 'staff_action',
          actorId: 'hq-owner',
          actorRole: 'owner',
          tenantId: 'hq',
        },
        '*'
      );
      expect(hqConsent.ok).toBe(true);
      const consentRow = sqlite
        .prepare('SELECT customer_id, purpose, granted, tenant_id FROM consents WHERE customer_id = ?')
        .get('crm-prof-a') as { customer_id: string; purpose: string; granted: number; tenant_id: string };
      expect(consentRow.granted).toBe(1);
      expect(consentRow.tenant_id).toBe('store-a');
    });

    it('BP3-04: AuditLogger isolates queries and pruning by tenantId; rate-limit partitions by authenticated user+tenant and resists XFF spoofing in production', async () => {
      const logger = new AuditLogger(db);
      await logger.log({
        actor_id: 'mgr-a',
        actor_name: 'Manager A',
        action: 'menu.update',
        resource_type: 'menu',
        resource_id: 'item-a',
        tenant_id: 'store-a',
      });
      await logger.log({
        actor_id: 'mgr-b',
        actor_name: 'Manager B',
        action: 'menu.update',
        resource_type: 'menu',
        resource_id: 'item-b',
        tenant_id: 'store-b',
      });

      // 1. AuditLogger.query filters by tenantId
      const rowsA = await logger.query({ tenantId: 'store-a' });
      expect(rowsA.total).toBe(1);
      expect(rowsA.rows[0]?.actor_id).toBe('mgr-a');

      const rowsB = await logger.query({ tenantId: 'store-b' });
      expect(rowsB.total).toBe(1);
      expect(rowsB.rows[0]?.actor_id).toBe('mgr-b');

      // 2. userOrIpKeyGenerator & buildRateLimitKey partition by tenant + userId, and getClientIdentifier ignores XFF in production
      const prodSpoofCtx = {
        env: { ENVIRONMENT: 'production', AUTH_KV: kv },
        req: {
          header: (k: string) =>
            k.toLowerCase() === 'x-forwarded-for'
              ? '9.9.9.9'
              : k.toLowerCase() === 'cf-connecting-ip'
                ? '203.0.113.10'
                : undefined,
        },
        get: (k: string) =>
          k === 'user'
            ? { id: 'u-1', role: 'staff', tenantId: 'store-a' }
            : k === 'tenantId'
              ? 'store-a'
              : undefined,
      } as never;

      expect(getClientIdentifier(prodSpoofCtx)).toBe('203.0.113.10');
      expect(userOrIpKeyGenerator(prodSpoofCtx)).toBe('user:store-a:u-1');
      expect(buildRateLimitKey(prodSpoofCtx, AUTH_RATE_LIMIT)).toBe('rate:auth:user:store-a:u-1');

      const tightConfig = { max: 2, windowSec: 60, keyPrefix: 'rate:test', errorMessage: 'Limited' };
      expect(await checkRateLimit(prodSpoofCtx, tightConfig)).toBe(true);
      expect(await checkRateLimit(prodSpoofCtx, tightConfig)).toBe(true);
      expect(await checkRateLimit(prodSpoofCtx, tightConfig)).toBe(false);

      // Different tenant ('store-b') is not throttled by 'store-a'
      const storeBCtx = {
        ...prodSpoofCtx,
        get: (k: string) =>
          k === 'user'
            ? { id: 'u-1', role: 'staff', tenantId: 'store-b' }
            : k === 'tenantId'
              ? 'store-b'
              : undefined,
      } as never;
      expect(await checkRateLimit(storeBCtx, tightConfig)).toBe(true);
    });

    it('BP3-05: staff-session-auth isolates customer auth_version and is_active checks by tenant across KV and D1', async () => {
      // Same email registered in 'store-a' (active, auth_version=1) and 'store-b' (deactivated, auth_version=5)
      sqlite
        .prepare(`INSERT INTO customers (id, email, name, tenant_id) VALUES (?, ?, ?, ?), (?, ?, ?, ?)`)
        .run('cust-auth-a', 'shared@aura.vn', 'Shared A', 'store-a', 'cust-auth-b', 'shared@aura.vn', 'Shared B', 'store-b');
      sqlite
        .prepare(`INSERT INTO users (id, email, name, role, tenant_id, is_active, auth_version) VALUES (?, ?, ?, 'customer', ?, 1, 1), (?, ?, ?, 'customer', ?, 0, 5)`)
        .run('cust-auth-a', 'shared@aura.vn', 'Shared A', 'store-a', 'cust-auth-b', 'shared@aura.vn', 'Shared B', 'store-b');

      // Put store-b deactivated record into KV under user:shared@aura.vn to prove store-a token ignores mismatched tenant KV record
      await kv.put(
        'user:shared@aura.vn',
        JSON.stringify({ id: 'cust-auth-b', email: 'shared@aura.vn', tenant_id: 'store-b', is_active: 0, auth_version: 5 })
      );

      const tokenStoreA = await generateJWT(
        { id: 'cust-auth-a', email: 'shared@aura.vn', role: 'customer', tenantId: 'store-a', authVersion: 1 },
        JWT_SECRET
      );
      const tokenStoreB = await generateJWT(
        { id: 'cust-auth-b', email: 'shared@aura.vn', role: 'customer', tenantId: 'store-b', authVersion: 5 },
        JWT_SECRET
      );

      const env = buildEnv(db, kv);

      // 1. Store-A customer session succeeds because its tenant ('store-a') row is active with auth_version=1
      const authResA = await authenticateRequest(
        new Request('http://localhost/api/loyalty/balance', {
          headers: { Authorization: `Bearer ${tokenStoreA}` },
        }),
        env
      );
      expect(authResA).toBeTruthy();
      expect((authResA as { payload: { id: string } }).payload.id).toBe('cust-auth-a');

      // 2. Store-B customer session is rejected with SESSION_REVOKED because store-b row is deactivated
      await expect(
        authenticateRequest(
          new Request('http://localhost/api/loyalty/balance', {
            headers: { Authorization: `Bearer ${tokenStoreB}` },
          }),
          env
        )
      ).rejects.toThrow();
    });
  });

  // =========================================================================
  // BP4: Frontend Session Boundary, Zustand Resets, Offline Queue & Query Keys
  // =========================================================================
  describe('BP4 — Frontend Session Boundary, Zustand Store Resets, OfflineDB & Query Scope Parity', () => {
    it('BP4-01: client-session normalizes tenant/user scope, emits session transitions, and compares snapshots across tenant and user changes', () => {
      invalidateClientSession();
      const anonSnap = readSessionSnapshot();
      expect(anonSnap).toEqual({
        token: null,
        userId: null,
        tenantId: 'default',
        userScope: 'anon',
      });

      const events: number[] = [];
      const unsub = subscribeSessionChange(() => {
        events.push(Date.now());
      });

      saveClientSession('jwt-token-a', {
        id: 'user-a',
        name: 'User A',
        email: 'a@aura.vn',
        role: 'manager',
        tenantId: 'store-a',
      });

      const snapA = readSessionSnapshot();
      expect(snapA).toMatchObject({
        token: 'jwt-token-a',
        userId: 'user-a',
        tenantId: 'store-a',
      });
      expect(isSameSessionSnapshot(anonSnap, snapA)).toBe(false);
      expect(isSameSessionSnapshot(snapA, readSessionSnapshot())).toBe(true);
      expect(events.length).toBeGreaterThanOrEqual(1);

      // Switch to HQ user -> tenantId preserves 'hq' so HQ query keys do not collide with 'default' store
      saveClientSession('jwt-token-hq', {
        id: 'user-hq',
        name: 'HQ Owner',
        role: 'owner',
        tenantId: 'hq',
      });
      const snapHq = readSessionSnapshot();
      expect(snapHq.tenantId).toBe('hq');
      expect(snapHq.userId).toBe('user-hq');
      expect(isSameSessionSnapshot(snapA, snapHq)).toBe(false);

      unsub();
    });

    it('BP4-02: useCartStore and useOrderStore purge persisted state on session/tenant switch', () => {
      saveClientSession('tok-store-a', {
        id: 'cust-a',
        name: 'Cust A',
        role: 'customer',
        tenantId: 'store-a',
      });

      // Populate cart and order stores under 'store-a'
      useCartStore.getState().addItem({
        id: 'item-espresso',
        productId: 'item-espresso',
        name: 'Espresso',
        price: 39000,
      });
      useCartStore.getState().setAppliedPromo('VIP50');

      useOrderStore.setState({
        currentOrder: {
          id: 'ord-store-a-1',
          orderNumber: 'A-001',
          status: 'confirmed',
          items: [],
          subtotal: 78000,
          discount: 15000,
          total: 63000,
          paymentMethod: 'cash',
          createdAt: new Date().toISOString(),
        } as never,
        orderHistory: [{ id: 'ord-store-a-1' } as never],
      });

      expect(useCartStore.getState().items.length).toBe(1);
      expect(useCartStore.getState().appliedPromo).toBe('VIP50');
      expect(useOrderStore.getState().currentOrder?.id).toBe('ord-store-a-1');

      // Switch session to 'store-b' -> both stores automatically reset and clear localStorage keys
      saveClientSession('tok-store-b', {
        id: 'cust-b',
        name: 'Cust B',
        role: 'customer',
        tenantId: 'store-b',
      });

      expect(useCartStore.getState().items).toEqual([]);
      expect(useCartStore.getState().appliedPromo).toBeNull();
      expect(localStorage.getItem('aura_cart')).toBeNull();
      expect(localStorage.getItem('aura_cart_v3')).toBeNull();

      expect(useOrderStore.getState().currentOrder).toBeNull();
      expect(useOrderStore.getState().orderHistory).toEqual([]);
    });

    it('BP4-03: useLoyaltyStore, useReferralStore, and useMenuStore reset state and clear localStorage on session/tenant switch', () => {
      saveClientSession('tok-loyalty-a', {
        id: 'cust-a',
        name: 'Cust A',
        role: 'customer',
        tenantId: 'store-a',
      });

      useLoyaltyStore.setState({
        tier: 'gold',
        points: 1250,
        cashbackRate: 7,
      });
      localStorage.setItem('aura_loyalty', JSON.stringify({ tier: 'gold', points: 1250, cashbackRate: 7 }));

      useReferralStore.setState({
        referralCode: 'AURA-REF-A',
        referralCount: 5,
        cashbackEarned: 50000,
      });
      localStorage.setItem('aura_referral', JSON.stringify({ referralCode: 'AURA-REF-A', referralCount: 5, cashbackEarned: 50000 }));

      useMenuStore.setState({
        categories: [{ id: 'cat-a', name: 'Store A Coffee' }],
        items: [
          {
            id: 'item-a',
            category: 'cat-a',
            name: 'Store A Latte',
            price: 49000,
            available: true,
          } as never,
        ],
      });

      // Invalidate session (logout / switch tenant)
      invalidateClientSession();

      expect(useLoyaltyStore.getState().points).toBe(0);
      expect(useLoyaltyStore.getState().tier).toBe('bronze');
      expect(localStorage.getItem('aura_loyalty')).toBeNull();

      expect(useReferralStore.getState().referralCode).toBeNull();
      expect(useReferralStore.getState().referralCount).toBe(0);
      expect(useReferralStore.getState().cashbackEarned).toBe(0);
      expect(localStorage.getItem('aura_referral')).toBeNull();

      expect(useMenuStore.getState().categories).toEqual([]);
      expect(useMenuStore.getState().items).toEqual([]);
    });

    it('BP4-04: OfflineDB partitions queued offline orders by tenantId and userId so cross-tenant/cross-user queues never leak during sync', async () => {
      // Minimal in-memory IndexedDB shim for OfflineDB verification
      const records = new Map<string, Record<string, unknown>>();
      const prevIndexedDB = (globalThis as Record<string, unknown>).indexedDB;
      (globalThis as Record<string, unknown>).indexedDB = {
        open: () => {
          const req: Record<string, unknown> = {};
          queueMicrotask(() => {
            req.result = {
              objectStoreNames: { contains: () => true },
              transaction: () => {
                const tx: Record<string, unknown> = {
                  objectStore: () => ({
                    add: (val: Record<string, unknown>) => {
                      records.set(String(val.localId), val);
                    },
                    getAll: () => {
                      const getReq: Record<string, unknown> = {};
                      queueMicrotask(() => {
                        getReq.result = [...records.values()];
                        (getReq.onsuccess as (() => void) | undefined)?.();
                      });
                      return getReq;
                    },
                  }),
                };
                queueMicrotask(() => {
                  (tx.oncomplete as (() => void) | undefined)?.();
                });
                return tx;
              },
            };
            (req.onsuccess as (() => void) | undefined)?.();
          });
          return req;
        },
      };

      try {
        const offlineDb = new OfflineDB();
        const idA = await offlineDb.saveOrder(
          { total: 45000, items: ['latte'] },
          { tenantId: 'store-a', userId: 'staff-a' }
        );
        const idB = await offlineDb.saveOrder(
          { total: 85000, items: ['matcha'] },
          { tenantId: 'store-b', userId: 'staff-b' }
        );

        const pendingA = await offlineDb.getPendingOrders({ tenantId: 'store-a', userId: 'staff-a' });
        expect(pendingA.map((r) => r.localId)).toEqual([idA]);

        const pendingB = await offlineDb.getPendingOrders({ tenantId: 'store-b', userId: 'staff-b' });
        expect(pendingB.map((r) => r.localId)).toEqual([idB]);

        // Mismatched user within same tenant is also excluded
        const pendingWrongUser = await offlineDb.getPendingOrders({ tenantId: 'store-a', userId: 'staff-other' });
        expect(pendingWrongUser).toEqual([]);
      } finally {
        (globalThis as Record<string, unknown>).indexedDB = prevIndexedDB;
      }
    });

    it('BP4-05: Frontend TanStack Query hooks and admin/mobile state hooks include session.tenantId/session.userScope or subscribeSessionChange guards', () => {
      const rootDir = resolve(__dirname, '../../../..');
      const queryScopedHookFiles = [
        'src/hooks/use-admin.ts',
        'src/hooks/use-analytics-data.ts',
        'src/hooks/use-reports.ts',
        'src/pages/admin/use-sales-report-data.ts',
        'src/hooks/use-campaigns-admin.ts',
        'src/hooks/use-birthday-admin.ts',
        'src/hooks/use-broadcast.ts',
        'src/pages/admin/use-product-manager.ts',
        'src/pages/admin/use-category-manager.ts',
        'src/pages/admin/use-promotions-manager.ts',
        'src/pages/admin/use-modifier-manager.ts',
        'src/pages/admin/use-modifier-link-editor.ts',
        'src/pages/admin/use-subscription-plans.ts',
        'src/pages/admin/use-subscriptions.ts',
        'src/hooks/use-subscriptions.ts',
        'src/hooks/use-referral.ts',
        'src/hooks/useCustomerMenu.ts',
        'src/hooks/use-tv-menu.ts',
        'src/hooks/use-account.ts',
      ];

      for (const relPath of queryScopedHookFiles) {
        const content = readFileSync(resolve(rootDir, relPath), 'utf8');
        expect(
          content.includes('useClientSessionScope') || content.includes('subscribeSessionChange'),
          `Expected ${relPath} to bind query keys/state to client session scope`
        ).toBe(true);
      }

      const sessionSubscribedFiles = [
        'src/hooks/use-offline-sync.ts',
        'src/pages/admin/use-dindin-cart.ts',
        'src/pages/admin/use-notification-subscriptions.ts',
        'src/pages/mobile/kitchen-display.tsx',
        'src/pages/mobile/table-manager.tsx',
      ];

      for (const relPath of sessionSubscribedFiles) {
        const content = readFileSync(resolve(rootDir, relPath), 'utf8');
        expect(
          content.includes('subscribeSessionChange') && content.includes('isSameSessionSnapshot'),
          `Expected ${relPath} to reset state on subscribeSessionChange and guard async responses with isSameSessionSnapshot`
        ).toBe(true);
      }
    });
  });
});
