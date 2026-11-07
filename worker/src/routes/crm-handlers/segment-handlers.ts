import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';
import { listSegments, buildSegment } from '@aura/domain-crm';

function hasCrmSegmentTenantMismatch(c: any): boolean {
  const user = c.get?.('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const queryTenant = String(
    c.req?.query?.('tenant_id') ||
    c.req?.query?.('tenantId') ||
    c.req?.query?.('store_id') ||
    c.req?.query?.('storeId') ||
    ''
  ).trim();
  const headerTenant = String(
    c.req?.header?.('X-Tenant-ID') ||
    c.req?.header?.('x-tenant-id') ||
    c.req?.header?.('X-Store-ID') ||
    c.req?.header?.('x-store-id') ||
    ''
  ).trim();
  if (queryTenant && headerTenant && queryTenant !== headerTenant) return true;
  const reqTenant = queryTenant || headerTenant;
  if (!user) {
    return reqTenant === '*' || reqTenant.toLowerCase() === 'hq';
  }
  if (isHQSuperAdmin(user)) return false;
  const userTenant = String(user.tenantId ?? user.tenant_id ?? '').trim();
  const boundTenant = userTenant || 'default';
  if (
    userTenant === '*' ||
    userTenant.toLowerCase() === 'hq' ||
    reqTenant === '*' ||
    reqTenant.toLowerCase() === 'hq'
  ) {
    return true;
  }
  return Boolean(reqTenant && reqTenant !== boundTenant);
}

function resolveCrmSegmentTenantId(c: any): string {
  const user = c.get?.('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const raw = getTenantId(c).trim() || 'default';
  return raw.toLowerCase() === 'hq' && isHQSuperAdmin(user) ? '*' : raw;
}

async function loadCustomerTenantMap(
  db: import('@cloudflare/workers-types').D1Database,
  tenantId: string
): Promise<Map<string, string> | null> {
  try {
    const stmt = db.prepare(
      "SELECT id, tenant_id FROM customers WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?) LIMIT 10000"
    );
    const res = await stmt
      .bind(tenantId, tenantId)
      .all<{ id: string; tenant_id?: string | null }>()
      .catch(async () => {
        if (tenantId === 'default' || tenantId === '*') {
          const fallbackStmt = db.prepare('SELECT id, tenant_id FROM customers LIMIT 10000');
          return typeof fallbackStmt.all === 'function'
            ? fallbackStmt.all<{ id: string; tenant_id?: string | null }>()
            : fallbackStmt.bind().all<{ id: string; tenant_id?: string | null }>();
        }
        return { results: [] as { id: string; tenant_id?: string | null }[] };
      });
    const rows = res?.results || [];
    if (rows.length === 0) return null;
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r && r.id) {
        map.set(r.id, (r.tenant_id && String(r.tenant_id).trim()) || 'default');
      }
    }
    return map;
  } catch {
    return null;
  }
}

export function registerSegmentHandlers(router: Hono<{ Bindings: Env }>): void {
  /**
   * GET /api/crm/segments
   * List all segment definitions with counts (no member list).
   * Auth: owner, manager, supervisor or staff only.
   */
  router.get('/segments', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin']), async (c) => {
    if (hasCrmSegmentTenantMismatch(c)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const db = c.env.AURA_DB;
    const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    const tenantId = resolveCrmSegmentTenantId(c);

    const segments = await listSegments(db, kv, new Date(), { tenantId });
    if (tenantId === '*') {
      return c.json({ success: true, data: segments });
    }

    const tenantMap = await loadCustomerTenantMap(db, tenantId);
    if (!tenantMap) {
      if (tenantId !== 'default') {
        return c.json({
          success: true,
          data: segments.map((s) => ({ ...s, count: 0, customers: [] })),
        });
      }
      return c.json({ success: true, data: segments });
    }

    const scoped = segments.map((seg) => {
      const customers = (seg.customers || []).filter(
        (cust) => tenantMap.get(cust.id) === tenantId
      );
      const rejected = (seg.customers || []).length - customers.length;
      return {
        ...seg,
        count: Math.max(0, (seg.count ?? customers.length) - rejected),
        customers,
      };
    });

    return c.json({ success: true, data: scoped });
  });

  /**
   * GET /api/crm/segments/:key/customers
   * Paginated member list for a segment.
   * Auth: owner, manager, supervisor or staff only.
   */
  router.get('/segments/:key/customers', requireAuth(['owner', 'manager', 'supervisor', 'staff', 'admin']), async (c) => {
    if (hasCrmSegmentTenantMismatch(c)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const db = c.env.AURA_DB;
    const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    const key = c.req.param('key');

    if (!key) {
      return c.json({ success: false, error: 'segment key is required' }, 400);
    }

    const limitParam = c.req.query('limit');
    const offsetParam = c.req.query('offset');
    const rawLimit = limitParam !== undefined ? parseInt(limitParam, 10) : 50;
    const rawOffset = offsetParam !== undefined ? parseInt(offsetParam, 10) : 0;
    const limit = Math.min(Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 50), 200);
    const offset = Math.max(0, Number.isFinite(rawOffset) ? rawOffset : 0);
    const tenantId = resolveCrmSegmentTenantId(c);

    if (tenantId === '*') {
      const result = await buildSegment(db, key, kv, { limit, offset });
      return c.json({ success: true, data: result });
    }

    const full = await buildSegment(db, key, kv, { limit: 0, tenantId });
    const tenantMap = await loadCustomerTenantMap(db, tenantId);
    if (!tenantMap) {
      if (tenantId !== 'default') {
        return c.json({
          success: true,
          data: { ...full, count: 0, customers: [] },
        });
      }
      const paginated = full.customers.slice(offset, offset + limit);
      return c.json({
        success: true,
        data: { ...full, customers: paginated },
      });
    }

    const allCustomers = full.customers || [];
    const filtered = allCustomers.filter(
      (cust) => tenantMap.get(cust.id) === tenantId
    );
    const rejected = allCustomers.length - filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return c.json({
      success: true,
      data: {
        ...full,
        count: Math.max(0, (full.count ?? filtered.length) - rejected),
        customers: paginated,
      },
    });
  });
}
