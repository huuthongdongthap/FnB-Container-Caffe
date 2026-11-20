// @vitest-environment node
/**
 * SaaS v3.1 CSV Export Audit Logging & Tenant Scoping Integration Suite
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { app } from '../index';
import { buildEnv, createMigratedD1, dummyCtx, seedTenantOrders, signupTenant } from './helpers/saas-v3-1-sqlite-fixture';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SaaS v3.1 — CSV Export Audit Logging & Tenant Scoping', () => {
  it('persists CSV export audit entries into audit_logs for reports and analytics (orders + revenue) endpoints', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);
    const tenant = await signupTenant(env, {
      slug: 'quan-export-audit',
      shopName: 'Quán Export Audit',
      ownerEmail: 'export@example.com',
    });
    seedTenantOrders(sqlite, tenant.tenantId, 1, '2026-11-10T10:00:00.000Z', 'ord_exp');
    const authHeaders = { Authorization: `Bearer ${tenant.token}`, 'X-Tenant-ID': tenant.tenantId };

    const reportsOrders = await app.fetch(
      new Request('https://auraspace.cafe/api/reports/export?type=orders&from=2026-11-01&to=2026-11-19', { headers: authHeaders }),
      env,
      dummyCtx
    );
    expect(reportsOrders.status).toBe(200);
    expect(reportsOrders.headers.get('content-type')).toContain('text/csv');

    const reportsRevenue = await app.fetch(
      new Request('https://auraspace.cafe/api/reports/export?type=revenue&from=2026-11-01&to=2026-11-19', { headers: authHeaders }),
      env,
      dummyCtx
    );
    expect(reportsRevenue.status).toBe(200);
    expect(reportsRevenue.headers.get('content-type')).toContain('text/csv');

    const analyticsOrders = await app.fetch(
      new Request('https://auraspace.cafe/api/analytics/export?start=2026-11-01&end=2026-11-19&type=orders', { headers: authHeaders }),
      env,
      dummyCtx
    );
    expect(analyticsOrders.status).toBe(200);
    expect(analyticsOrders.headers.get('content-type')).toContain('text/csv');

    const analyticsRevenue = await app.fetch(
      new Request('https://auraspace.cafe/api/analytics/export?start=2026-11-01&end=2026-11-19&type=revenue', { headers: authHeaders }),
      env,
      dummyCtx
    );
    expect(analyticsRevenue.status).toBe(200);
    expect(analyticsRevenue.headers.get('content-type')).toContain('text/csv');
    expect(analyticsRevenue.headers.get('content-disposition')).toContain('revenue-export-2026-11-01-to-2026-11-19.csv');

    const auditRows = sqlite
      .prepare("SELECT actor, actor_id, action, resource_type, tenant_id, details FROM audit_logs WHERE action = 'export_csv' ORDER BY rowid ASC")
      .all() as Array<{ actor: string; actor_id: string; action: string; resource_type: string; tenant_id: string; details: string }>;

    expect(auditRows).toHaveLength(4);
    expect(auditRows[0]).toMatchObject({ resource_type: 'orders', tenant_id: tenant.tenantId });
    expect(JSON.parse(auditRows[0]!.details)).toMatchObject({ route: 'reports.export', actor_role: 'owner', type: 'orders' });
    expect(auditRows[1]).toMatchObject({ resource_type: 'revenue', tenant_id: tenant.tenantId });
    expect(JSON.parse(auditRows[1]!.details)).toMatchObject({ route: 'reports.export', actor_role: 'owner', type: 'revenue' });
    expect(auditRows[2]).toMatchObject({ resource_type: 'orders', tenant_id: tenant.tenantId });
    expect(JSON.parse(auditRows[2]!.details)).toMatchObject({
      route: 'analytics.export',
      actor_role: 'owner',
      type: 'orders',
      tenant_id: tenant.tenantId,
      row_count: 1,
    });
    expect(auditRows[3]).toMatchObject({ resource_type: 'revenue', tenant_id: tenant.tenantId });
    expect(JSON.parse(auditRows[3]!.details)).toMatchObject({
      route: 'analytics.export',
      actor_role: 'owner',
      type: 'revenue',
      tenant_id: tenant.tenantId,
      row_count: 1,
    });
  });

  it('retains tenant_id and actor_role in details on minimal audit_logs fallback schema', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);
    const tenant = await signupTenant(env, { slug: 'export-fallback', shopName: 'Export Fallback', ownerEmail: 'fb@ex.com' });
    seedTenantOrders(sqlite, tenant.tenantId, 1, '2026-11-10T10:00:00.000Z', 'ord_fb');

    sqlite.exec(`
      DROP TABLE audit_logs;
      CREATE TABLE audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id TEXT,
        action TEXT NOT NULL,
        resource_type TEXT,
        resource_id TEXT,
        details TEXT,
        tenant_id TEXT DEFAULT 'default',
        created_at TEXT DEFAULT (datetime('now'))
      );
    `);

    const authHeaders = { Authorization: `Bearer ${tenant.token}`, 'X-Tenant-ID': tenant.tenantId };
    const revRes = await app.fetch(
      new Request('https://auraspace.cafe/api/analytics/export?start=2026-11-01&end=2026-11-19&type=revenue', { headers: authHeaders }),
      env,
      dummyCtx
    );
    expect(revRes.status).toBe(200);

    const ordRes = await app.fetch(
      new Request('https://auraspace.cafe/api/analytics/export?start=2026-11-01&end=2026-11-19&type=orders', { headers: authHeaders }),
      env,
      dummyCtx
    );
    expect(ordRes.status).toBe(200);

    const rows = sqlite
      .prepare("SELECT id, actor_id, action, resource_type, resource_id, details, tenant_id FROM audit_logs WHERE action = 'export_csv' ORDER BY id ASC")
      .all() as Array<{ id: number; actor_id: string; action: string; resource_type: string; resource_id: string; details: string; tenant_id: string }>;

    expect(rows).toHaveLength(2);
    expect(typeof rows[0]!.id).toBe('number');
    expect(rows[0]).toMatchObject({
      actor_id: tenant.ownerId,
      action: 'export_csv',
      resource_type: 'revenue',
      resource_id: '2026-11-01..2026-11-19',
      tenant_id: tenant.tenantId,
    });
    expect(JSON.parse(rows[0]!.details)).toMatchObject({
      route: 'analytics.export',
      actor_role: 'owner',
      type: 'revenue',
      tenant_id: tenant.tenantId,
      row_count: 1,
    });
    expect(rows[1]).toMatchObject({
      actor_id: tenant.ownerId,
      action: 'export_csv',
      resource_type: 'orders',
      tenant_id: tenant.tenantId,
    });
    expect(JSON.parse(rows[1]!.details)).toMatchObject({
      route: 'analytics.export',
      actor_role: 'owner',
      type: 'orders',
      tenant_id: tenant.tenantId,
      row_count: 1,
    });
  });

  it('rejects cross-tenant CSV exports with 403 and writes no export audit rows', async () => {
    const { db, sqlite } = createMigratedD1();
    const env = buildEnv(db);
    const tenantA = await signupTenant(env, { slug: 'export-a', shopName: 'Export A', ownerEmail: 'ea@ex.com' });
    const tenantB = await signupTenant(env, { slug: 'export-b', shopName: 'Export B', ownerEmail: 'eb@ex.com' });
    const crossHeaders = { Authorization: `Bearer ${tenantA.token}`, 'X-Tenant-ID': tenantB.tenantId };

    expect((await app.fetch(new Request('https://auraspace.cafe/api/reports/export?type=orders', { headers: crossHeaders }), env, dummyCtx)).status).toBe(403);
    expect(
      (await app.fetch(new Request('https://auraspace.cafe/api/analytics/export?start=2026-11-01&end=2026-11-19&type=orders', { headers: crossHeaders }), env, dummyCtx)).status
    ).toBe(403);
    expect(
      (await app.fetch(new Request('https://auraspace.cafe/api/analytics/export?start=2026-11-01&end=2026-11-19&type=revenue', { headers: crossHeaders }), env, dummyCtx)).status
    ).toBe(403);

    const auditCount = (sqlite.prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'export_csv'").get() as { c: number }).c;
    expect(auditCount).toBe(0);
  });
});
