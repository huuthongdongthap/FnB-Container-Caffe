// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { ErpnextAccountingClient } from '../clients/erpnext-accounting-client';
import { mapOrderToInvoice } from '../erpnext/mapper/orders-sales-invoices';
import { erpnextSyncRoutes } from '../routes/erpnext-sync';
import { handleErpnextInvoicesRequest } from '../routes/erpnext-invoices';
import adminMetrics from '../routes/admin-metrics';
import { registerVitalsRoute } from '../routes/vitals';
import { registerExportHandler } from '../routes/admin-audit-logs-handlers/export-handler';
import { openApiInventoryRouter } from '../routes/openapi-inventory-handlers/routes';
import { generateJWT } from '../lib/jwt';
import { createMockEnv, createMockKV, TEST_JWT_SECRET } from './test-utils';
import type { Env } from '../types/env';

function createSqliteD1(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const stmt = {
        bind(...args: unknown[]) {
          bound = args;
          return stmt;
        },
        async first<T = Record<string, unknown>>() {
          const row = db.prepare(sql).get(...(bound as never[]));
          return (row as T | undefined) ?? null;
        },
        async all<T = Record<string, unknown>>() {
          const rows = db.prepare(sql).all(...(bound as never[]));
          return { results: rows as T[], success: true };
        },
        async run() {
          const res = db.prepare(sql).run(...(bound as never[]));
          return { success: true, meta: { changes: res.changes } };
        },
      };
      return stmt;
    },
  };
}

describe('PR-8 regression tests (#190, #191, #193)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('#190 ERPNext Invoices & Sync', () => {
    it('retries failed invoice mapping instead of short-circuiting and records first-attempt failure via INSERT', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE erpnext_mappings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          local_type TEXT,
          local_id TEXT,
          erpnext_id TEXT,
          erpnext_model TEXT,
          sync_status TEXT,
          error_message TEXT,
          attempts INTEGER DEFAULT 0,
          last_synced_at TEXT,
          created_at TEXT,
          updated_at TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      const d1 = createSqliteD1(sqlite);

      const mockClient = {
        url: 'https://erp.example.com',
        getAuthHeader: () => 'token k:s',
        list: vi.fn().mockResolvedValue({ data: [] }),
        create: vi
          .fn()
          .mockRejectedValueOnce(new Error('ERPNext 503'))
          .mockResolvedValueOnce({ data: { name: 'SINV-2026-001' } }),
        read: vi.fn(),
        update: vi.fn(),
      };

      const accounting = new ErpnextAccountingClient(
        mockClient as unknown as ConstructorParameters<typeof ErpnextAccountingClient>[0],
        d1 as unknown as ConstructorParameters<typeof ErpnextAccountingClient>[1],
      );

      // 1st attempt fails -> must INSERT a failed mapping row (not lose it)
      await expect(
        accounting.processOrderToInvoice({ id: 'ord-1', total: 50000, items: [] }, { AURA_DB: d1 as never }, 'default')
      ).rejects.toThrow('ERPNext 503');

      const failedRow = sqlite.prepare("SELECT sync_status, attempts, error_message FROM erpnext_mappings WHERE local_id = 'ord-1'").get() as {
        sync_status: string;
        attempts: number;
        error_message: string;
      };
      expect(failedRow).toBeDefined();
      expect(failedRow.sync_status).toBe('failed');
      expect(failedRow.attempts).toBe(1);
      expect(failedRow.error_message).toContain('ERPNext 503');

      // 2nd attempt retries failed mapping -> must call create() again and mark synced
      const retryRes = await accounting.processOrderToInvoice(
        { id: 'ord-1', total: 50000, items: [] },
        { AURA_DB: d1 as never },
        'default',
      );
      expect(retryRes.success).toBe(true);
      expect(retryRes.fromCache).toBeUndefined();
      expect(retryRes.erpnextInvoiceId).toBe('SINV-2026-001');

      const syncedRow = sqlite.prepare("SELECT sync_status, erpnext_id, attempts FROM erpnext_mappings WHERE local_id = 'ord-1'").get() as {
        sync_status: string;
        erpnext_id: string;
        attempts: number;
      };
      expect(syncedRow.sync_status).toBe('synced');
      expect(syncedRow.erpnext_id).toBe('SINV-2026-001');
      expect(syncedRow.attempts).toBe(2);
    });

    it('does not fabricate 10% tax when order.tax is omitted', () => {
      const invoice = mapOrderToInvoice(
        { id: 'ord-2', subtotal: 45000, total_amount: 45000 } as never,
        [{ product_name: 'Cà phê sữa', quantity: 1, price_unit: 45000 }] as never,
        { customer_name: 'Walk-in Customer' } as never,
      );
      expect(invoice.total_taxes_and_charges).toBe(0);
      expect(invoice.grand_total).toBe(45000);
      expect(invoice.taxes).toHaveLength(0);
    });

    it('returns 501 not_configured on ERPNext sync triggers when credentials are absent', async () => {
      const issuedAt = Math.floor(Date.now() / 1000);
      const token = await generateJWT(
        { id: 'admin-1', email: 'admin@aura.test', name: 'Admin', role: 'admin', tenantId: 'default', tenant_id: 'default', authVersion: 1, authTime: issuedAt, sessionType: 'staff-web' },
        TEST_JWT_SECRET,
        28800,
        issuedAt,
      );
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, phone TEXT, role TEXT, status TEXT DEFAULT 'active', is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default');`);
      sqlite.prepare("INSERT INTO users (id, name, phone, role, status, is_active, auth_version, tenant_id) VALUES ('admin-1', 'Admin', '0901000001', 'admin', 'active', 1, 1, 'default')").run();
      const d1 = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      erpnextSyncRoutes(app);

      const res = await app.fetch(
        new Request('https://api.test/api/admin/erpnext-sync/orders', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }),
        { ...createMockEnv(), AUTH_KV: createMockKV(), AURA_DB: d1 as unknown as D1Database } as unknown as Env,
      );
      expect(res.status).toBe(501);
      const body = (await res.json()) as { success: boolean; status: string };
      expect(body.success).toBe(false);
      expect(body.status).toBe('not_configured');
    });
  });

  describe('#191 Observability & Audit', () => {
    it('queries same-day UTC _metrics rows using space-separated SQLite datetime format and preserves tail latency in p95/p99', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE _metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          value REAL NOT NULL,
          tags TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      // Insert same-day UTC rows (space separator) with fast + slow tail latencies
      const insert = sqlite.prepare("INSERT INTO _metrics (name, value, tags, created_at) VALUES (?, ?, ?, datetime('now'))");
      for (let i = 1; i <= 19; i++) {
        insert.run('request', 1, JSON.stringify({ duration: i * 10, status: 200, path: '/api/menu', tenant_id: 'default' }));
      }
      insert.run('request', 1, JSON.stringify({ duration: 2500, status: 200, path: '/api/menu', tenant_id: 'default' }));

      const d1 = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user' as never, { id: 'admin-1', role: 'admin', tenantId: 'default' } as never);
        await next();
      });
      app.route('/api/admin/metrics', adminMetrics);

      const res = await app.fetch(
        new Request('https://api.test/api/admin/metrics?range=24h&filter=request_duration_ms'),
        { AURA_DB: d1 as unknown as D1Database } as Env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as { p50: number; p95: number; p99: number };
      expect(body.p50).toBeGreaterThan(0);
      expect(body.p95).toBe(2500);
      expect(body.p99).toBe(2500);
    });

    it('ignores spoofed body.tenant_id on POST /api/vitals', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE _metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          value REAL NOT NULL,
          tags TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      const d1 = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      registerVitalsRoute(app);

      const res = await app.fetch(
        new Request('https://api.test/api/vitals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '198.51.100.12' },
          body: JSON.stringify({ name: 'LCP', value: 1200, rating: 'good', tenant_id: 'victim-tenant' }),
        }),
        { AURA_DB: d1 as unknown as D1Database } as Env,
      );
      expect(res.status).toBe(204);
      const row = sqlite.prepare('SELECT tags FROM _metrics LIMIT 1').get() as { tags: string };
      expect(row.tags).not.toContain('victim-tenant');
      expect(row.tags).toContain('"tenant_id":"default"');
    });

    it('exports audit log CSV for cookie-auth supervisor with uppercase CREATE action filter', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_id TEXT,
          actor_name TEXT,
          action TEXT,
          resource_type TEXT,
          resource_id TEXT,
          details TEXT,
          ip_address TEXT,
          tenant_id TEXT DEFAULT 'default',
          created_at TEXT DEFAULT (datetime('now'))
        );
      `);
      sqlite
        .prepare("INSERT INTO audit_logs (actor_id, actor_name, action, resource_type, resource_id, details, ip_address, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run('u1', 'Supervisor A', 'orders.post', 'order', 'ord-99', 'created', '127.0.0.1', 'default');

      const d1 = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        // Cookie auth (no Authorization header)
        c.set('user' as never, { id: 'u1', role: 'supervisor', tenantId: 'default' } as never);
        await next();
      });
      registerExportHandler(app);

      const res = await app.fetch(
        new Request('https://api.test/export?action=CREATE', {
          headers: { Cookie: 'aura_session=valid-cookie' },
        }),
        { AURA_DB: d1 as unknown as D1Database } as Env,
      );
      expect(res.status).toBe(200);
      const csv = await res.text();
      expect(csv).toContain('orders.post');
      expect(csv).toContain('ord-99');
    });
  });

  describe('#193 Inventory RBAC & KPI summary', () => {
    it('allows kitchen role on GET /api/inventory/ingredients and returns full-catalog summary', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, phone TEXT, role TEXT, status TEXT DEFAULT 'active', is_active INTEGER DEFAULT 1, auth_version INTEGER DEFAULT 1, tenant_id TEXT DEFAULT 'default');
        CREATE TABLE ingredients (
          id TEXT PRIMARY KEY,
          name TEXT,
          sku TEXT,
          category TEXT,
          unit TEXT,
          cost_per_unit REAL,
          current_stock REAL,
          min_stock REAL,
          is_active INTEGER DEFAULT 1,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      sqlite.prepare("INSERT INTO users (id, name, phone, role, status, is_active, auth_version, tenant_id) VALUES ('chef-1', 'Chef', '0901000002', 'kitchen', 'active', 1, 1, 'default')").run();
      const ins = sqlite.prepare('INSERT INTO ingredients (id, name, sku, category, unit, cost_per_unit, current_stock, min_stock, tenant_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
      ins.run('i1', 'Coffee', 'SKU-1', 'coffee', 'g', 350, 100, 50, 'default');
      ins.run('i2', 'Milk', 'SKU-2', 'dairy', 'ml', 40, 20, 50, 'default');
      ins.run('i3', 'Sugar', 'SKU-3', 'syrup', 'ml', 30, 0, 50, 'default');

      const issuedAt = Math.floor(Date.now() / 1000);
      const token = await generateJWT(
        { id: 'chef-1', email: 'chef@aura.test', name: 'Chef', role: 'kitchen', tenantId: 'default', tenant_id: 'default', authVersion: 1, authTime: issuedAt, sessionType: 'staff-web' },
        TEST_JWT_SECRET,
        28800,
        issuedAt,
      );
      const d1 = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      app.route('/', openApiInventoryRouter);

      const res = await app.fetch(
        new Request('https://api.test/api/inventory/ingredients?limit=1', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        { ...createMockEnv(), AUTH_KV: createMockKV(), AURA_DB: d1 as unknown as D1Database, DB: d1 as unknown as D1Database } as unknown as Env,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        data: unknown[];
        summary?: { totalItems: number; lowStockCount: number; outOfStockCount: number; totalValue: number };
      };
      expect(body.data).toHaveLength(1);
      expect(body.summary).toEqual({
        totalItems: 3,
        lowStockCount: 1,
        outOfStockCount: 1,
        totalValue: 35800,
      });
    });
  });

  describe('Round 1 security regressions', () => {
    it('ignores ?tenant_id= query param on POST /api/vitals so unauthenticated beacons cannot spoof victim tenant', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE _metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          value REAL,
          tags TEXT,
          created_at TEXT
        );
      `);
      const d1 = createSqliteD1(sqlite);
      const app = new Hono<{ Bindings: Env }>();
      registerVitalsRoute(app);
      const env = { ...createMockEnv(), AURA_DB: d1 as unknown as D1Database };

      const res = await app.fetch(
        new Request('https://test.aura/api/vitals?tenant_id=victim-tenant&store_id=victim-tenant', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'CF-Connecting-IP': '198.51.100.42',
          },
          body: JSON.stringify({ name: 'LCP', value: 1100, rating: 'good', tenant_id: 'victim-tenant' }),
        }),
        env,
      );
      expect(res.status).toBe(204);

      const row = sqlite.prepare('SELECT tags FROM _metrics LIMIT 1').get() as { tags: string } | undefined;
      expect(row).toBeDefined();
      const tags = JSON.parse(row!.tags) as { tenant_id?: string };
      expect(tags.tenant_id).not.toBe('victim-tenant');
      expect(tags.tenant_id).toBe('default');
    });

    it('rejects HTML upstream responses with 502 and decodes encoded invoice IDs with nosniff header on PDF proxy', async () => {
      const sqlite = new DatabaseSync(':memory:');
      sqlite.exec(`
        CREATE TABLE erpnext_mappings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          local_type TEXT,
          local_id TEXT,
          erpnext_id TEXT,
          tenant_id TEXT DEFAULT 'default'
        );
      `);
      sqlite.prepare(
        "INSERT INTO erpnext_mappings (local_type, local_id, erpnext_id, tenant_id) VALUES ('order', 'ord-enc', 'ACC-SINV/2026/001', 'default')"
      ).run();
      const d1 = createSqliteD1(sqlite);

      const token = await generateJWT(
        { sub: 'admin-1', role: 'admin', tenant_id: 'default', tenantId: 'default' },
        TEST_JWT_SECRET,
      );

      const env = {
        ...createMockEnv(),
        AURA_DB: d1 as unknown as D1Database,
        ERPNEXT_URL: 'https://erp.example.com',
        ERPNEXT_API_KEY: 'key',
        ERPNEXT_API_SECRET: 'secret',
      };

      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      // 1. HTML upstream response must be rejected with 502
      fetchSpy.mockResolvedValueOnce(
        new Response('<html><body>ERPNext Login</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        }),
      );
      const htmlRes = await handleErpnextInvoicesRequest(
        new Request('https://test.aura/api/erpnext-invoices/ACC-SINV%2F2026%2F001/pdf', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        }),
        env as never,
      );
      expect(htmlRes.status).toBe(502);

      // 2. Valid PDF with encoded invoice ID returns 200 with hardcoded application/pdf + nosniff
      fetchSpy.mockResolvedValueOnce(
        new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]), {
          status: 200,
          headers: { 'Content-Type': 'application/pdf; charset=binary' },
        }),
      );
      const pdfRes = await handleErpnextInvoicesRequest(
        new Request('https://test.aura/api/erpnext-invoices/ACC-SINV%2F2026%2F001/pdf', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        }),
        env as never,
      );
      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers.get('Content-Type')).toBe('application/pdf');
      expect(pdfRes.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(fetchSpy).toHaveBeenLastCalledWith(
        expect.stringContaining('name=ACC-SINV%2F2026%2F001'),
        expect.objectContaining({ redirect: 'manual' }),
      );
    });
  });
});
