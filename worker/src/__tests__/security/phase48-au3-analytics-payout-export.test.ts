import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import type { Env } from '../../types/env';
import { registerMetricsHandlers } from '../../routes/analytics-handlers/metrics-handlers';
import { registerSummaryHandlers } from '../../routes/analytics-handlers/summary-handlers';
import { registerExportHandlers } from '../../routes/analytics-handlers/export-handlers';
import { getSummary, getSummaryCompare, getGrouped, resolveAnalyticsTenant } from '../../tree/analytics/summary';
import { getCustomerMetrics } from '../../tree/analytics/customer-metrics';
import { getTopProducts } from '../../tree/analytics/top-products';
import { getPeakHours } from '../../tree/analytics/peak-hours';
import { getZoneStats } from '../../tree/analytics/zone-analytics';
import { getOrdersInRange, formatCsvRows, escapeCsvField } from '../../tree/analytics/csv-export';
import { createMockEnv } from '../test-utils';

function makeStaffBearer(id: string, role: string, tenantId: string): string {
  const crypto = require('crypto');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      id,
      sub: id,
      role,
      tenantId,
      email: `${id}@test.aura`,
      name: `${role} ${tenantId}`,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      authVersion: 1,
      authTime: Math.floor(Date.now() / 1000),
      sessionType: 'staff-web',
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', 'test-jwt-secret-at-least-16-chars')
    .update(`${header}.${payload}`)
    .digest('base64url');
  return `Bearer ${header}.${payload}.${sig}`;
}

describe('Phase 48 Slice AU3 — Analytics Summary, Payout Financial Arithmetic, Top Products, Zone Stats & CSV Export Isolation', () => {
  describe('AU3-1: /api/analytics/payout financial arithmetic & tenant binding', () => {
    it('includes fulfilled/completed PayOS orders in payos_total and payment_status=refunded in refunded_total', async () => {
      const orders = [
        { id: 'o1', tenant_id: 'store-a', is_cod: 0, payment_method: 'payos', payment_status: 'paid', status: 'completed', total: 150000 },
        { id: 'o2', tenant_id: 'store-a', is_cod: 0, payment_method: 'payos', payment_status: 'paid', status: 'preparing', total: 80000 },
        { id: 'o3', tenant_id: 'store-a', is_cod: 0, payment_method: 'payos', payment_status: 'paid', status: 'ready', total: 70000 },
        { id: 'o4', tenant_id: 'store-a', is_cod: 1, payment_method: 'cod', payment_status: 'paid', status: 'completed', total: 100000 },
        { id: 'o5', tenant_id: 'store-a', is_cod: 0, payment_method: 'payos', payment_status: 'refunded', status: 'completed', total: 50000 },
        { id: 'o6', tenant_id: 'store-b', is_cod: 0, payment_method: 'payos', payment_status: 'paid', status: 'completed', total: 999000 },
      ];

      const capturedSqls: string[] = [];
      const db = {
        prepare: (sql: string) => ({
          bind: (...args: unknown[]) => ({
            first: async () => {
              if (/FROM users WHERE id = \?/i.test(sql)) {
                return { id: 'owner_a', name: 'Owner A', role: 'owner', tenant_id: 'store-a', is_active: 1, auth_version: 1 };
              }
              capturedSqls.push(sql);
              const targetTenant = String(args[0] || '');
              const scoped = orders.filter((o) => o.tenant_id === targetTenant);
              const cod_total = scoped
                .filter((o) => o.is_cod === 1 && o.payment_status === 'paid' && o.status === 'completed')
                .reduce((s, o) => s + o.total, 0);
              const acceptsFulfilledPayos =
                sql.includes("'completed'") && sql.includes("'preparing'") && sql.includes("'ready'");
              const payos_total = scoped
                .filter(
                  (o) =>
                    o.payment_method === 'payos' &&
                    o.payment_status === 'paid' &&
                    (acceptsFulfilledPayos
                      ? ['paid', 'Confirmed', 'preparing', 'ready', 'completed'].includes(o.status)
                      : o.status === 'paid')
                )
                .reduce((s, o) => s + o.total, 0);
              const checksPaymentStatusRefunded = /COALESCE\(payment_status,\s*''\)\s*=\s*'refunded'/i.test(sql);
              const refunded_total = scoped
                .filter((o) => o.status === 'refunded' || (checksPaymentStatusRefunded && o.payment_status === 'refunded'))
                .reduce((s, o) => s + o.total, 0);
              return { cod_total, payos_total, refunded_total, total_orders: scoped.length };
            },
          }),
        }),
      } as unknown as import('@cloudflare/workers-types').D1Database;

      const app = new Hono<{ Bindings: Env }>();
      registerMetricsHandlers(app);
      const env = createMockEnv({ AURA_DB: db });

      const res = await app.fetch(
        new Request('https://test.aura/payout', {
          headers: { Authorization: makeStaffBearer('owner_a', 'owner', 'store-a') },
        }),
        env
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        success: boolean;
        data: { cod: number; payos: number; refunded: number; net: number; total_orders: number };
      };
      expect(body.success).toBe(true);
      expect(body.data.cod).toBe(100000);
      expect(body.data.payos).toBe(300000);
      expect(body.data.refunded).toBe(50000);
      expect(body.data.net).toBe(350000);
      expect(body.data.total_orders).toBe(5);
      expect(capturedSqls[0]).toContain("status IN ('paid', 'Confirmed', 'preparing', 'ready', 'completed')");
      expect(capturedSqls[0]).toContain("COALESCE(payment_status, '') = 'refunded'");
    });

    it('rejects cross-tenant X-Tenant-ID and wildcard * overrides from franchise store owners with 403', async () => {
      const db = {
        prepare: (sql: string) => ({
          bind: () => ({
            first: async () =>
              /FROM users WHERE id = \?/i.test(sql)
                ? { id: 'owner_a', name: 'Owner A', role: 'owner', tenant_id: 'store-a', is_active: 1, auth_version: 1 }
                : { cod_total: 0, payos_total: 0, refunded_total: 0, total_orders: 0 },
          }),
        }),
      } as unknown as import('@cloudflare/workers-types').D1Database;

      const app = new Hono<{ Bindings: Env }>();
      registerMetricsHandlers(app);
      const env = createMockEnv({ AURA_DB: db });

      const crossRes = await app.fetch(
        new Request('https://test.aura/payout', {
          headers: {
            Authorization: makeStaffBearer('owner_a', 'owner', 'store-a'),
            'X-Tenant-ID': 'store-b',
          },
        }),
        env
      );
      expect(crossRes.status).toBe(403);

      const wildcardRes = await app.fetch(
        new Request('https://test.aura/payout?tenant_id=*', {
          headers: { Authorization: makeStaffBearer('owner_a', 'owner', 'store-a') },
        }),
        env
      );
      expect(wildcardRes.status).toBe(403);
    });
  });

  describe('AU3-2: Analytics revenue queries exclude refunded/failed/rejected/expired orders & isolate tenant joins', () => {
    it('excludes refunded, failed, rejected, and expired orders across summary, customer-metrics, top-products, peak-hours, and zone-analytics', async () => {
      const sqlLog: string[] = [];
      const mockDb = {
        prepare: (sql: string) => {
          sqlLog.push(sql);
          return {
            bind: () => ({
              first: async () => ({
                total_orders: 2,
                total_revenue: 90000,
                avg_order_value: 45000,
                total_customers: 2,
                new_30d: 1,
                repeat_rate: 0.5,
              }),
              all: async () => ({ results: [], success: true }),
            }),
            first: async () => ({ total_customers: 2, new_30d: 1, repeat_rate: 0.5, avg_order_value: 45000 }),
          };
        },
      } as unknown as import('@cloudflare/workers-types').D1Database;

      await getSummary(mockDb, 7, 'store-a');
      await getSummaryCompare(mockDb, 7, 'store-a');
      await getGrouped(mockDb, 'category', 7, 'store-a');
      await getCustomerMetrics(mockDb, 'store-a');
      await getTopProducts(mockDb, 5, 'store-a');
      await getPeakHours(mockDb, 7, 'store-a');
      await getZoneStats(mockDb, 7, 'store-a');

      const orderQueries = sqlLog.filter((s) => /FROM orders|JOIN orders/i.test(s));
      expect(orderQueries.length).toBeGreaterThanOrEqual(8);
      for (const q of orderQueries) {
        expect(q).toContain("status NOT IN ('cancelled', 'refunded', 'failed', 'rejected', 'expired')");
        expect(q).toMatch(/COALESCE\((?:o\.)?payment_status,\s*''\)\s*!=\s*'refunded'/);
      }

      const categoryQuery = sqlLog.find((s) => /JOIN categories c/i.test(s));
      expect(categoryQuery).toBeDefined();
      expect(categoryQuery).toContain(
        "COALESCE(NULLIF(TRIM(p.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')"
      );
      expect(categoryQuery).toContain(
        "COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = COALESCE(NULLIF(TRIM(o.tenant_id), ''), 'default')"
      );
    });

    it('enforces tenant binding in summary-handlers and metrics-handlers against cross-tenant headers', async () => {
      const app = new Hono<{ Bindings: Env }>();
      app.use('*', async (c, next) => {
        c.set('user', { id: 'mgr_a', email: 'm@a.test', name: 'Manager A', role: 'manager', tenantId: 'store-a' });
        await next();
      });
      registerSummaryHandlers(app);
      registerMetricsHandlers(app);
      const env = createMockEnv();

      const summaryCross = await app.fetch(
        new Request('https://test.aura/?days=7', { headers: { 'X-Tenant-ID': 'store-b' } }),
        env
      );
      expect(summaryCross.status).toBe(403);

      const topCross = await app.fetch(
        new Request('https://test.aura/top-products?tenant_id=store-b'),
        env
      );
      expect(topCross.status).toBe(403);

      const zoneWildcard = await app.fetch(
        new Request('https://test.aura/zones?days=7', { headers: { 'X-Tenant-ID': '*' } }),
        env
      );
      expect(zoneWildcard.status).toBe(403);

      expect(
        resolveAnalyticsTenant({
          get: (k: string) => (k === 'tenantId' ? '*' : undefined),
        })
      ).toEqual({ tenantId: 'default', forbidden: false });
    });
  });

  describe('AU3-3: /api/analytics/export RBAC, bounded range, ISO-8601 end-date inclusion & CR CSV escaping', () => {
    it('fails closed with 401 when user is missing and rejects supervisor with 403 on /export', async () => {
      const unauthApp = new Hono<{ Bindings: Env }>();
      registerExportHandlers(unauthApp);
      const env = createMockEnv();

      const unauthRes = await unauthApp.fetch(
        new Request('https://test.aura/export?start=2026-11-01&end=2026-11-03'),
        env
      );
      expect(unauthRes.status).toBe(401);

      const supApp = new Hono<{ Bindings: Env }>();
      supApp.use('*', async (c, next) => {
        c.set('user', { id: 'sup_1', email: 's@test', name: 'Sup', role: 'supervisor', tenantId: 'store-a' });
        await next();
      });
      registerExportHandlers(supApp);

      const supRes = await supApp.fetch(
        new Request('https://test.aura/export?start=2026-11-01&end=2026-11-03'),
        env
      );
      expect(supRes.status).toBe(403);
    });

    it('rejects cross-tenant export overrides (403) and invalid or >366-day date ranges (400)', async () => {
      const mgrApp = new Hono<{ Bindings: Env }>();
      mgrApp.use('*', async (c, next) => {
        c.set('user', { id: 'mgr_1', email: 'm@test', name: 'Mgr', role: 'manager', tenantId: 'store-a' });
        await next();
      });
      registerExportHandlers(mgrApp);
      const env = createMockEnv();

      const crossTenantRes = await mgrApp.fetch(
        new Request('https://test.aura/export?start=2026-11-01&end=2026-11-03', {
          headers: { 'X-Tenant-ID': 'store-b' },
        }),
        env
      );
      expect(crossTenantRes.status).toBe(403);

      const invertedRangeRes = await mgrApp.fetch(
        new Request('https://test.aura/export?start=2026-11-10&end=2026-11-01'),
        env
      );
      expect(invertedRangeRes.status).toBe(400);

      const overMaxRangeRes = await mgrApp.fetch(
        new Request('https://test.aura/export?start=2024-01-01&end=2026-11-03'),
        env
      );
      expect(overMaxRangeRes.status).toBe(400);

      const invalidCalendarRes = await mgrApp.fetch(
        new Request('https://test.aura/export?start=2026-02-31&end=2026-03-05'),
        env
      );
      expect(invalidCalendarRes.status).toBe(400);
    });

    it('includes ISO-8601 timestamps on the end date in getOrdersInRange and quotes bare CR (\\r) in escapeCsvField', async () => {
      const seedOrders = [
        {
          id: 'ORD_1',
          customer_name: 'Alice',
          customer_phone: '0901111111',
          total: 45000,
          status: 'completed',
          payment_method: 'payos',
          items: '[{"name":"Latte"}]',
          created_at: '2026-11-01 09:00:00',
          tenant_id: 'store-a',
        },
        {
          id: 'ORD_2_ISO_END',
          customer_name: 'Bob\rInjected,Col',
          customer_phone: '0902222222',
          total: 65000,
          status: 'completed',
          payment_method: 'payos',
          items: '[{"name":"Espresso"}]',
          created_at: '2026-11-03T14:20:00.000Z',
          tenant_id: 'store-a',
        },
        {
          id: 'ORD_3_AFTER_END',
          customer_name: 'Charlie',
          customer_phone: '0903333333',
          total: 50000,
          status: 'completed',
          payment_method: 'cash',
          items: '[]',
          created_at: '2026-11-04T00:00:00.000Z',
          tenant_id: 'store-a',
        },
      ];

      let capturedSql = '';
      const db = {
        prepare: vi.fn((sql: string) => {
          capturedSql = sql;
          return {
            bind: (...args: unknown[]) => ({
              all: async () => {
                const [start, end, tenant] = args as [string, string, string];
                const usesSubstr = /substr\(created_at,\s*1,\s*10\)\s*>=\s*\?\s*AND\s*substr\(created_at,\s*1,\s*10\)\s*<=\s*\?/i.test(
                  sql
                );
                const results = seedOrders.filter((o) => {
                  if (tenant && o.tenant_id !== tenant) return false;
                  if (usesSubstr) {
                    const day = o.created_at.slice(0, 10);
                    return day >= start && day <= end;
                  }
                  return o.created_at >= `${start} 00:00:00` && o.created_at <= `${end} 23:59:59`;
                });
                return { results };
              },
            }),
          };
        }),
      } as unknown as import('@cloudflare/workers-types').D1Database;

      const rows = await getOrdersInRange(db, '2026-11-01', '2026-11-03', 'store-a');
      expect(capturedSql).toContain('substr(created_at, 1, 10) >= ?');
      expect(capturedSql).toContain('substr(created_at, 1, 10) <= ?');
      expect(capturedSql).toContain('LIMIT 10000');
      expect(rows.map((r) => r.id)).toEqual(['ORD_1', 'ORD_2_ISO_END']);

      expect(escapeCsvField('Line1\rLine2')).toBe('"Line1\rLine2"');
      const csv = formatCsvRows(rows);
      expect(csv).toContain('ORD_2_ISO_END');
      expect(csv).toContain('"Bob\rInjected,Col"');
    });
  });
});
