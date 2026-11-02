import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { getTenantId } from '../../middleware/tenant';
import { listSegments, buildSegment } from '@aura/domain-crm';

async function loadCustomerTenantMap(
  db: import('@cloudflare/workers-types').D1Database
): Promise<Map<string, string> | null> {
  try {
    const stmt = db.prepare('SELECT id, tenant_id FROM customers');
    const res = typeof stmt.all === 'function'
      ? await stmt.all<{ id: string; tenant_id?: string | null }>()
      : await stmt.bind().all<{ id: string; tenant_id?: string | null }>();
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
    const db = c.env.AURA_DB;
    const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    const tenantId = getTenantId(c as any);

    const segments = await listSegments(db, kv);
    if (tenantId === '*') {
      return c.json({ success: true, data: segments });
    }

    const tenantMap = await loadCustomerTenantMap(db);
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
        (cust) => (tenantMap.get(cust.id) ?? 'default') === tenantId
      );
      return {
        ...seg,
        count: customers.length,
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
    const db = c.env.AURA_DB;
    const kv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
    const key = c.req.param('key');

    if (!key) {
      return c.json({ success: false, error: 'segment key is required' }, 400);
    }

    const limitParam = c.req.query('limit');
    const offsetParam = c.req.query('offset');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;
    const tenantId = getTenantId(c as any);

    if (tenantId === '*') {
      const result = await buildSegment(db, key, kv, { limit, offset });
      return c.json({ success: true, data: result });
    }

    const full = await buildSegment(db, key, kv, { limit: 0 });
    const tenantMap = await loadCustomerTenantMap(db);
    if (!tenantMap) {
      if (tenantId !== 'default') {
        return c.json({
          success: true,
          data: { ...full, count: 0, customers: [] },
        });
      }
      const paginated = limit === 0 ? full.customers : full.customers.slice(offset, offset + limit);
      return c.json({
        success: true,
        data: { ...full, customers: paginated },
      });
    }

    const filtered = (full.customers || []).filter(
      (cust) => (tenantMap.get(cust.id) ?? 'default') === tenantId
    );
    const paginated = limit === 0 ? filtered : filtered.slice(offset, offset + limit);

    return c.json({
      success: true,
      data: {
        ...full,
        count: filtered.length,
        customers: paginated,
      },
    });
  });
}
