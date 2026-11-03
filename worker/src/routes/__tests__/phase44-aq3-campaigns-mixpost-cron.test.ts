// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';
import { registerCampaignConfigHandlers } from '../campaigns-handlers/config-handlers';
import { registerCampaignStatsHandlers } from '../campaigns-handlers/stats-handlers';
import { mixpostRouter } from '../mixpost-handlers/routes';
import { openApiCronRouter } from '../openapi-cron-handlers/routes';
import { generateJWT } from '../../lib/jwt';
import { TEST_JWT_SECRET, staffSessionClaims } from '../../__tests__/test-utils';

function createSqliteD1() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      name TEXT,
      phone TEXT,
      role TEXT,
      tenant_id TEXT DEFAULT 'default',
      is_active INTEGER DEFAULT 1,
      auth_version INTEGER DEFAULT 1,
      email TEXT,
      password_hash TEXT,
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE campaign_configs (
      trigger TEXT PRIMARY KEY,
      is_active INTEGER NOT NULL DEFAULT 1,
      channels TEXT NOT NULL DEFAULT '["sms"]',
      timing TEXT,
      updated_at TEXT,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE tenant_campaign_configs (
      tenant_id TEXT NOT NULL,
      trigger TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      channels TEXT NOT NULL DEFAULT '["sms"]',
      timing TEXT,
      updated_at TEXT,
      PRIMARY KEY (tenant_id, trigger)
    );
    CREATE TABLE campaign_logs (
      id TEXT PRIMARY KEY,
      trigger TEXT NOT NULL,
      customer_id TEXT,
      channel TEXT,
      status TEXT NOT NULL,
      sent_at TEXT,
      tenant_id TEXT
    );
    CREATE TABLE customers (
      id TEXT PRIMARY KEY,
      name TEXT,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE promotions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT NOT NULL,
      percent REAL,
      discount_value REAL,
      value REAL,
      min_order REAL DEFAULT 0,
      active INTEGER DEFAULT 1,
      starts_at TEXT,
      ends_at TEXT,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      category_id INTEGER NOT NULL,
      description TEXT,
      is_available INTEGER DEFAULT 1,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE mixpost_posts (
      id TEXT PRIMARY KEY,
      mixpost_uuid TEXT,
      content TEXT NOT NULL,
      platforms TEXT NOT NULL,
      status TEXT NOT NULL,
      scheduled_at TEXT,
      published_at TEXT,
      created_at TEXT NOT NULL,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE locations (
      id TEXT PRIMARY KEY,
      name TEXT,
      tenant_id TEXT DEFAULT 'default'
    );
    CREATE TABLE cron_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      cron_expression TEXT NOT NULL,
      handler TEXT NOT NULL,
      payload TEXT,
      timeout_seconds INTEGER DEFAULT 300,
      max_retries INTEGER DEFAULT 3,
      retry_delay_seconds INTEGER DEFAULT 60,
      is_active INTEGER DEFAULT 1,
      status TEXT DEFAULT 'pending',
      location_id TEXT,
      created_by TEXT,
      last_run_at TEXT,
      next_run_at TEXT,
      success_count INTEGER DEFAULT 0,
      failure_count INTEGER DEFAULT 0,
      last_status TEXT,
      last_error TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT,
      updated_at TEXT
    );
    CREATE TABLE cron_runs (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      status TEXT NOT NULL,
      payload TEXT,
      error TEXT,
      duration_ms INTEGER,
      tenant_id TEXT DEFAULT 'default',
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT
    );
    CREATE TABLE audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT,
      entity_type TEXT,
      entity_id TEXT,
      metadata TEXT,
      tenant_id TEXT DEFAULT 'default',
      created_at TEXT
    );
  `);

  function prepare(sql: string): D1PreparedStatement {
    let args: unknown[] = [];
    const stmt = {
      bind(...values: unknown[]) {
        args = values;
        return stmt;
      },
      async first<T = Record<string, unknown>>() {
        const row = sqlite.prepare(sql).get(...(args as any[])) as T | undefined;
        return row ?? null;
      },
      async all<T = Record<string, unknown>>() {
        const results = sqlite.prepare(sql).all(...(args as any[])) as T[];
        return { results, success: true, meta: {} };
      },
      async run() {
        const before = Number((sqlite.prepare('SELECT total_changes() AS c').get() as any)?.c ?? 0);
        const res = sqlite.prepare(sql).run(...(args as any[]));
        const after = Number((sqlite.prepare('SELECT total_changes() AS c').get() as any)?.c ?? 0);
        return {
          success: true,
          meta: { changes: after - before, last_row_id: Number(res.lastInsertRowid) },
        };
      },
      async raw() {
        return [];
      },
    };
    return stmt as unknown as D1PreparedStatement;
  }

  return {
    sqlite,
    db: { prepare } as unknown as D1Database,
  };
}

async function mintStaffJwt(userId: string, role: string, tenantId: string): Promise<string> {
  return generateJWT(
    {
      id: userId,
      sub: userId,
      role: role as any,
      tenantId,
      email: `${userId}@test.aura`,
      ...staffSessionClaims(),
    } as any,
    TEST_JWT_SECRET,
    28800
  );
}

describe('Phase 44 Slice AQ3 — Campaigns, Mixpost & OpenAPI Cron Tenant Isolation', () => {
  describe('Campaigns config & stats isolation and hardening', () => {
    it('handles malformed and non-array channels JSON safely and enforces fail-closed write RBAC', async () => {
      const { sqlite, db } = createSqliteD1();
      sqlite.prepare(
        `INSERT INTO tenant_campaign_configs (tenant_id, trigger, is_active, channels, timing)
         VALUES ('tenant-b', 'birthday', 1, '{broken-json', 'Hang ngay'),
                ('tenant-b', 'winback', 1, '{"sms":true}', 'Hang ngay')`
      ).run();

      const createApp = (role: string | undefined, tenantId: string) => {
        const app = new Hono<{ Bindings: any }>();
        app.use('/*', async (c, next) => {
          if (role !== undefined) {
            c.set('user' as any, { id: `u_${role}`, role, tenantId });
          }
          c.set('tenantId' as any, tenantId);
          await next();
        });
        registerCampaignConfigHandlers(app);
        registerCampaignStatsHandlers(app);
        return app;
      };

      const supervisorApp = createApp('supervisor', 'tenant-b');
      const managerApp = createApp('manager', 'tenant-b');

      // GET / does not throw 500 on malformed or object JSON in channels
      const listRes = await supervisorApp.fetch(
        new Request('https://test.aura/'),
        { AURA_DB: db }
      );
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as any;
      const bday = listBody.data.find((d: any) => d.trigger === 'birthday');
      const winback = listBody.data.find((d: any) => d.trigger === 'winback');
      expect(bday.channels).toEqual(['push']);
      expect(winback.channels).toEqual(['push']);

      // PUT /:trigger with manager role succeeds even when existing channels is malformed
      const putRes = await managerApp.fetch(
        new Request('https://test.aura/birthday', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: 0 }),
        }),
        { AURA_DB: db }
      );
      expect(putRes.status).toBe(200);
      const putBody = (await putRes.json()) as any;
      expect(putBody.data.is_active).toBe(0);
      expect(putBody.data.channels).toEqual(['sms']);

      // DELETE /:trigger with manager role succeeds
      const delRes = await managerApp.fetch(
        new Request('https://test.aura/birthday', { method: 'DELETE' }),
        { AURA_DB: db }
      );
      expect(delRes.status).toBe(200);

      // Staff, supervisor, and missing-role requests are forbidden from PUT and DELETE
      const staffApp = createApp('staff', 'tenant-b');
      const staffPut = await staffApp.fetch(
        new Request('https://test.aura/birthday', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: 1 }),
        }),
        { AURA_DB: db }
      );
      expect(staffPut.status).toBe(403);

      const noRoleApp = createApp(undefined, 'tenant-b');
      const noRoleDel = await noRoleApp.fetch(
        new Request('https://test.aura/birthday', { method: 'DELETE' }),
        { AURA_DB: db }
      );
      expect(noRoleDel.status).toBe(403);
    });

    it('scopes campaign_logs by tenant in SQL for GET /stats/all without leaking across tenants', async () => {
      const { sqlite, db } = createSqliteD1();
      sqlite.prepare(
        `INSERT INTO customers (id, name, tenant_id)
         VALUES ('cust_a', 'Alice', 'tenant-a'), ('cust_b', 'Bob', 'tenant-b')`
      ).run();
      sqlite.prepare(
        `INSERT INTO campaign_logs (id, trigger, customer_id, status, sent_at, tenant_id)
         VALUES ('log_a1', 'birthday', 'cust_a', 'sent', '2026-10-01T10:00:00Z', 'tenant-a'),
                ('log_a2', 'birthday', 'cust_a', 'sent', '2026-10-02T10:00:00Z', 'tenant-a'),
                ('log_b1', 'birthday', 'cust_b', 'sent', '2026-10-03T10:00:00Z', NULL),
                ('log_b2', 'winback', 'cust_b', 'failed', '2026-10-04T10:00:00Z', 'tenant-b')`
      ).run();

      const app = new Hono<{ Bindings: any }>();
      app.use('/*', async (c, next) => {
        c.set('user' as any, { id: 'u_sup', role: 'supervisor', tenantId: 'tenant-b' });
        c.set('tenantId' as any, 'tenant-b');
        await next();
      });
      registerCampaignStatsHandlers(app);

      const res = await app.fetch(new Request('https://test.aura/stats/all'), { AURA_DB: db });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data.birthday.total_sent).toBe(1);
      expect(body.data.birthday.success_count).toBe(1);
      expect(body.data.winback.total_sent).toBe(1);
      expect(body.data.winback.success_count).toBe(0);
    });
  });

  describe('Mixpost generate & posts SQL tenant isolation and OpenAPI value fallback', () => {
    it('scopes promotions and products by tenant_id in SQL before LIMIT and falls back to promo.value', async () => {
      const { sqlite, db } = createSqliteD1();
      // Both tenants have promo code CAFE25; tenant-b uses OpenAPI value column (percent & discount_value NULL)
      sqlite.prepare(
        `INSERT INTO promotions (id, name, code, type, percent, discount_value, value, min_order, active, starts_at, tenant_id)
         VALUES ('p_a', 'Tenant A Promo', 'CAFE25', 'percent', 99, NULL, NULL, 0, 1, '2026-11-02T00:00:00Z', 'tenant-a'),
                ('p_b', 'Tenant B OpenAPI Promo', 'CAFE25', 'percent', NULL, NULL, 25, 40000, 1, '2026-11-01T00:00:00Z', 'tenant-b')`
      ).run();

      // tenant-a has 60 products that would starve tenant-b under unscoped LIMIT 50
      for (let i = 1; i <= 60; i++) {
        sqlite.prepare(
          `INSERT INTO products (id, name, price, category_id, description, is_available, tenant_id)
           VALUES (?, ?, ?, 1, 'Tenant A Item', 1, 'tenant-a')`
        ).run(`prod_a_${i}`, `Tenant A Coffee ${i}`, 10000 + i);
      }
      sqlite.prepare(
        `INSERT INTO products (id, name, price, category_id, description, is_available, tenant_id)
         VALUES ('prod_b_1', 'Saigon Phin Sua Da', 39000, 1, 'Signature', 1, 'tenant-b')`
      ).run();

      const app = new Hono<{ Bindings: any }>();
      app.use('/*', async (c, next) => {
        c.set('tenantId' as any, 'tenant-b');
        await next();
      });
      app.route('/api/mixpost', mixpostRouter);

      const promoRes = await app.fetch(
        new Request('https://test.aura/api/mixpost/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'promotion', id: 'CAFE25' }),
        }),
        { AURA_DB: db }
      );
      expect(promoRes.status).toBe(200);
      const promoData = (await promoRes.json()) as any;
      expect(promoData.data.content).toContain('CAFE25');
      expect(promoData.data.content).toContain('25%');
      expect(promoData.data.content).not.toContain('99%');

      const menuRes = await app.fetch(
        new Request('https://test.aura/api/mixpost/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'menu', category: 1 }),
        }),
        { AURA_DB: db }
      );
      expect(menuRes.status).toBe(200);
      const menuData = (await menuRes.json()) as any;
      expect(menuData.data.content).toContain('Saigon Phin Sua Da');
      expect(menuData.data.content).not.toContain('Tenant A Coffee');
    });

    it('scopes GET /api/mixpost/posts by tenant_id in SQL before LIMIT', async () => {
      const { sqlite, db } = createSqliteD1();
      for (let i = 1; i <= 5; i++) {
        sqlite.prepare(
          `INSERT INTO mixpost_posts (id, content, platforms, status, created_at, tenant_id)
           VALUES (?, ?, '["facebook"]', 'published', ?, 'tenant-a')`
        ).run(`post_a_${i}`, `Tenant A Post ${i}`, `2026-11-02T10:0${i}:00Z`);
      }
      sqlite.prepare(
        `INSERT INTO mixpost_posts (id, content, platforms, status, created_at, tenant_id)
         VALUES ('post_b_1', 'Tenant B Post 1', '["facebook"]', 'published', '2026-11-01T08:00:00Z', 'tenant-b')`
      ).run();

      const app = new Hono<{ Bindings: any }>();
      app.use('/*', async (c, next) => {
        c.set('tenantId' as any, 'tenant-b');
        await next();
      });
      app.route('/api/mixpost', mixpostRouter);

      const res = await app.fetch(
        new Request('https://test.aura/api/mixpost/posts?limit=2'),
        { AURA_DB: db }
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].id).toBe('post_b_1');
    });
  });

  describe('OpenAPI Cron SQL tenant scoping & orphan run protection', () => {
    it('isolates jobs, summary, and orphan run retry across tenants while preserving tenant_id in payload and audit logs', async () => {
      const { sqlite, db } = createSqliteD1();
      sqlite.prepare(
        `INSERT INTO users (id, name, role, tenant_id, is_active, auth_version)
         VALUES ('admin_a', 'Admin A', 'admin', 'default', 1, 1),
                ('admin_b', 'Admin B', 'admin', 'tenant-b', 1, 1)`
      ).run();

      const orphanRunId = '11111111-1111-4111-8111-111111111111';
      const deletedJobId = '22222222-2222-4222-8222-222222222222';

      // Insert an orphan failed run belonging to tenant-b (whose parent job was deleted)
      sqlite.prepare(
        `INSERT INTO cron_runs (id, job_id, status, payload, tenant_id, started_at, created_at)
         VALUES (?, ?, 'failed', '{"task":"cleanup"}', 'tenant-b', '2026-11-02T09:00:00Z', '2026-11-02T09:00:00Z')`
      ).run(orphanRunId, deletedJobId);

      const tokenDefault = await mintStaffJwt('admin_a', 'admin', 'default');
      const tokenTenantB = await mintStaffJwt('admin_b', 'admin', 'tenant-b');

      const env = { AURA_DB: db, JWT_SECRET: TEST_JWT_SECRET } as any;

      // Default tenant must NOT be able to view or retry tenant-b's orphan run
      const defaultGetOrphan = await openApiCronRouter.fetch(
        new Request(`https://test.aura/api/cron/runs/${orphanRunId}`, {
          headers: { Authorization: `Bearer ${tokenDefault}` },
        }),
        env
      );
      expect(defaultGetOrphan.status).toBe(404);

      const defaultRetryOrphan = await openApiCronRouter.fetch(
        new Request(`https://test.aura/api/cron/runs/${orphanRunId}/retry`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenDefault}` },
        }),
        env
      );
      expect(defaultRetryOrphan.status).toBe(404);

      // Tenant-b CAN retry its own orphan run, and the retried run payload embeds tenant_id = 'tenant-b'
      const tenantBRetry = await openApiCronRouter.fetch(
        new Request(`https://test.aura/api/cron/runs/${orphanRunId}/retry`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenTenantB}` },
        }),
        env
      );
      expect(tenantBRetry.status).toBe(200);
      const retryBody = (await tenantBRetry.json()) as any;
      expect(retryBody.success).toBe(true);
      const retriedPayload = JSON.parse(retryBody.data.payload);
      expect(retriedPayload.tenant_id).toBe('tenant-b');
      expect(retriedPayload.task).toBe('cleanup');

      // Verify audit_logs recorded tenant_id = 'tenant-b'
      const auditRow = sqlite
        .prepare("SELECT tenant_id, metadata FROM audit_logs WHERE action = 'cron_run_retry' LIMIT 1")
        .get() as any;
      expect(auditRow.tenant_id).toBe('tenant-b');
      expect(JSON.parse(auditRow.metadata).tenant_id).toBe('tenant-b');

      // Seed jobs for default and tenant-b to verify GET /api/cron/jobs and GET /api/cron/summary SQL scoping
      const jobAId = '33333333-3333-4333-8333-333333333333';
      const jobBId = '44444444-4444-4444-8444-444444444444';
      sqlite.prepare(
        `INSERT INTO cron_jobs (id, name, cron_expression, handler, is_active, status, tenant_id, created_at, updated_at)
         VALUES (?, 'Default Job', '0 * * * *', 'sync_inventory', 1, 'pending', 'default', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z'),
                (?, 'Tenant B Job', '0 * * * *', 'sync_inventory', 1, 'pending', 'tenant-b', '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z')`
      ).run(jobAId, jobBId);

      const listB = await openApiCronRouter.fetch(
        new Request('https://test.aura/api/cron/jobs', {
          headers: { Authorization: `Bearer ${tokenTenantB}` },
        }),
        env
      );
      expect(listB.status).toBe(200);
      const listBBody = (await listB.json()) as any;
      expect(listBBody.data.jobs).toHaveLength(1);
      expect(listBBody.data.jobs[0].id).toBe(jobBId);

      const summaryB = await openApiCronRouter.fetch(
        new Request('https://test.aura/api/cron/summary', {
          headers: { Authorization: `Bearer ${tokenTenantB}` },
        }),
        env
      );
      expect(summaryB.status).toBe(200);
      const summaryBBody = (await summaryB.json()) as any;
      expect(summaryBBody.data.totalJobs).toBe(1);
      expect(summaryBBody.data.activeJobs).toBe(1);
    });
  });
});
