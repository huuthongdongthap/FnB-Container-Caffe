import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { getTenantId, matchesTenantRow } from '../../lib/db';
import { isHQSuperAdmin } from '../../middleware/tenant';
import { createLogger } from '../../middleware/logger';
import { type CustomerRecord, SEGMENTS, PROFILE_SQL, LEGACY_PROFILE_SQL } from './types';

const log = createLogger({ route: 'customers-admin' });

function resolveRequestTenant(c: unknown): string {
  return getTenantId(c as Parameters<typeof getTenantId>[0]);
}

function resolveAdminTenantScope(c: {
  get: (k: string) => unknown;
  req: { query: (k: string) => string | undefined; header: (k: string) => string | undefined };
}): { tenantId: string; forbidden: boolean } {
  const user = c.get('user') as { role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const userTenant = String(user?.tenantId ?? user?.tenant_id ?? '').trim();
  const boundTenant = userTenant || 'default';
  const queryTenant = String(
    c.req.query('tenant_id') ||
    c.req.query('tenantId') ||
    c.req.query('store_id') ||
    c.req.query('storeId') ||
    ''
  ).trim();
  const headerTenant = String(
    c.req.header('X-Tenant-ID') ||
    c.req.header('x-tenant-id') ||
    c.req.header('X-Store-ID') ||
    c.req.header('x-store-id') ||
    ''
  ).trim();
  const reqTenant = queryTenant || headerTenant;
  const ctxTenant = String((c.get('tenantId') as string | undefined) || '').trim();
  const hqAdmin = isHQSuperAdmin(user);
  const resolved = resolveRequestTenant(c).trim() || 'default';

  if (queryTenant && headerTenant && queryTenant !== headerTenant) {
    return { tenantId: boundTenant, forbidden: true };
  }

  if (!hqAdmin) {
    if (
      userTenant === '*' ||
      userTenant.toLowerCase() === 'hq' ||
      reqTenant === '*' ||
      reqTenant.toLowerCase() === 'hq' ||
      ctxTenant === '*' ||
      ctxTenant.toLowerCase() === 'hq' ||
      (queryTenant && queryTenant !== boundTenant) ||
      (headerTenant && headerTenant !== boundTenant) ||
      (ctxTenant && ctxTenant !== boundTenant) ||
      resolved !== boundTenant
    ) {
      return { tenantId: boundTenant, forbidden: true };
    }
    return { tenantId: boundTenant, forbidden: false };
  }

  const effective = reqTenant || ctxTenant || resolved;
  return {
    tenantId: effective.toLowerCase() === 'hq' ? '*' : effective,
    forbidden: false,
  };
}

function matchesStrictCustomerTenantRow(row: unknown, tenantId: string): boolean {
  if (!row || typeof row !== 'object') return false;
  const normalizedTenant = (tenantId && String(tenantId).trim()) || 'default';
  if (normalizedTenant === '*') return true;
  const r = row as Record<string, unknown>;
  if ('tenant_id' in r && r.tenant_id !== undefined) {
    const rowTenant = (r.tenant_id && String(r.tenant_id).trim()) || 'default';
    return rowTenant === normalizedTenant;
  }
  return normalizedTenant === 'default' && matchesTenantRow(row, normalizedTenant);
}

const CRM_MANAGEMENT_ROLES = new Set(['owner', 'admin', 'manager', 'supervisor', 'staff']);

export function registerAdminHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/customers/segments — segment list with counts (admin)
  router.get('/segments', requireAuth(['owner', 'admin', 'manager', 'supervisor', 'staff']), async (c) => {
    const user = c.get('user' as never) as { role?: string } | undefined;
    if (user?.role && !CRM_MANAGEMENT_ROLES.has(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const scope = resolveAdminTenantScope(c as unknown as Parameters<typeof resolveAdminTenantScope>[0]);
    if (scope.forbidden) {
      return c.json({ success: false, error: 'Cross-tenant customer access denied' }, 403);
    }
    const db = c.env.AURA_DB;
    const tenantId = scope.tenantId;
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    try {
      let birthdayCount = 0;
      try {
        const bRow = await db.prepare(
          "SELECT COUNT(*) as count FROM customers WHERE date_of_birth IS NOT NULL AND substr(date_of_birth, 6, 2) = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
        ).bind(month, tenantId, tenantId).first<{ count: number }>();
        birthdayCount = bRow?.count || 0;
      } catch {
        try {
          const bRow = await db.prepare(
            "SELECT COUNT(*) as count FROM customers WHERE birthday IS NOT NULL AND substr(birthday, 6, 2) = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)"
          ).bind(month, tenantId, tenantId).first<{ count: number }>();
          birthdayCount = bRow?.count || 0;
        } catch {
          if (tenantId === 'default') {
            try {
              const bRow = await db.prepare(
                'SELECT COUNT(*) as count FROM customers WHERE birthday IS NOT NULL AND substr(birthday, 6, 2) = ?'
              ).bind(month).first<{ count: number }>();
              birthdayCount = bRow?.count || 0;
            } catch {
              birthdayCount = 0;
            }
          } else {
            birthdayCount = 0;
          }
        }
      }

      const validOrderFilter =
        "AND LOWER(COALESCE(status, '')) NOT IN ('cancelled', 'canceled', 'rejected', 'failed', 'expired', 'refunded') AND LOWER(COALESCE(payment_status, '')) NOT IN ('failed', 'expired', 'cancelled', 'canceled', 'refunded')";
      const results = await Promise.all([
        db.prepare("SELECT COUNT(*) as count FROM customers WHERE (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)").bind(tenantId, tenantId).first<{ count: number }>(),
        db.prepare("SELECT COUNT(*) as count FROM customers WHERE LOWER(loyalty_tier) = 'bronze' AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)").bind(tenantId, tenantId).first<{ count: number }>(),
        db.prepare("SELECT COUNT(*) as count FROM customers WHERE LOWER(loyalty_tier) = 'silver' AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)").bind(tenantId, tenantId).first<{ count: number }>(),
        db.prepare("SELECT COUNT(*) as count FROM customers WHERE LOWER(loyalty_tier) = 'gold' AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)").bind(tenantId, tenantId).first<{ count: number }>(),
        db.prepare("SELECT COUNT(*) as count FROM customers WHERE LOWER(loyalty_tier) = 'platinum' AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)").bind(tenantId, tenantId).first<{ count: number }>(),
        db.prepare(`SELECT COUNT(DISTINCT customer_phone) as count FROM orders WHERE customer_phone IS NOT NULL AND created_at >= datetime('now', '-30 days') ${validOrderFilter} AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`).bind(tenantId, tenantId).first<{ count: number }>().catch(() =>
          db.prepare("SELECT COUNT(DISTINCT customer_phone) as count FROM orders WHERE customer_phone IS NOT NULL AND created_at >= datetime('now', '-30 days') AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)").bind(tenantId, tenantId).first<{ count: number }>()
        ),
        db.prepare(`SELECT COUNT(*) as count FROM customers c WHERE c.phone NOT IN (SELECT DISTINCT customer_phone FROM orders WHERE customer_phone IS NOT NULL AND created_at >= datetime('now', '-90 days') ${validOrderFilter} AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)) AND c.phone IS NOT NULL AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)`).bind(tenantId, tenantId, tenantId, tenantId).first<{ count: number }>().catch(() =>
          db.prepare("SELECT COUNT(*) as count FROM customers c WHERE c.phone NOT IN (SELECT DISTINCT customer_phone FROM orders WHERE customer_phone IS NOT NULL AND created_at >= datetime('now', '-90 days') AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)) AND c.phone IS NOT NULL AND (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)").bind(tenantId, tenantId, tenantId, tenantId).first<{ count: number }>()
        ),
      ]);

      const counts = [
        results[0]?.count || 0,
        results[1]?.count || 0,
        results[2]?.count || 0,
        results[3]?.count || 0,
        results[4]?.count || 0,
        results[5]?.count || 0,
        results[6]?.count || 0,
        birthdayCount,
      ];

      const segments = SEGMENTS.map((seg, i) => ({
        id: seg.id,
        name: seg.name,
        count: counts[i] || 0
      }));

      return c.json({ success: true, data: segments });
    } catch (err) {
      log.error('Customer segments query error:', { message: (err as Error).message });
      return c.json({ success: false, error: 'Failed to load customer segments' }, 500);
    }
  });

  // GET /api/customers — admin customer list
  router.get('/', requireAuth(['owner', 'admin', 'manager', 'supervisor', 'staff']), async (c) => {
    const user = c.get('user' as never) as { role?: string } | undefined;
    if (user?.role && !CRM_MANAGEMENT_ROLES.has(user.role)) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }
    const scope = resolveAdminTenantScope(c as unknown as Parameters<typeof resolveAdminTenantScope>[0]);
    if (scope.forbidden) {
      return c.json({ success: false, error: 'Cross-tenant customer access denied' }, 403);
    }
    const db = c.env.AURA_DB;
    const tenantId = scope.tenantId;
    const rawPage = parseInt(c.req.query('page') || '1', 10);
    const rawLimit = parseInt(c.req.query('limit') || '50', 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;
    const search = c.req.query('search');
    const tierParam = c.req.query('tier');
    const offset = (page - 1) * limit;

    let countQuery = "SELECT COUNT(*) as total FROM customers c WHERE (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)";
    let dataQuery = `${PROFILE_SQL}WHERE (? = '*' OR COALESCE(NULLIF(TRIM(c.tenant_id), ''), 'default') = ?)`;
    const params: unknown[] = [tenantId, tenantId];

    if (search) {
      const clause = ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
      countQuery += clause;
      dataQuery += clause;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }
    if (tierParam) {
      countQuery += ' AND LOWER(c.loyalty_tier) = LOWER(?)';
      dataQuery += ' AND LOWER(c.loyalty_tier) = LOWER(?)';
      params.push(tierParam);
    }

    dataQuery += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';

    try {
      const countStmt = db.prepare(countQuery).bind(...params);
      const { results: countResults } = await countStmt.all<{ total: number }>();
      const total = countResults?.[0]?.total || 0;

      let results: CustomerRecord[] | undefined;
      try {
        const dataStmt = db.prepare(dataQuery).bind(...params, limit, offset);
        const res = await dataStmt.all<CustomerRecord>();
        results = res.results;
      } catch {
        try {
          const legacyQuery = dataQuery.replace(PROFILE_SQL, LEGACY_PROFILE_SQL);
          const legacyStmt = db.prepare(legacyQuery).bind(...params, limit, offset);
          const res = await legacyStmt.all<CustomerRecord>();
          results = res.results;
        } catch {
          const fallbackQuery = dataQuery.replace(PROFILE_SQL, 'SELECT c.* FROM customers c ');
          const fallbackStmt = db.prepare(fallbackQuery).bind(...params, limit, offset);
          const res = await fallbackStmt.all<CustomerRecord>();
          results = res.results;
        }
      }

      const filtered = (results || []).filter((r) => matchesStrictCustomerTenantRow(r, tenantId));
      return c.json({
        success: true,
        data: filtered,
        customers: filtered,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } catch (err) {
      log.error('Customer list query error:', { message: (err as Error).message });
      return c.json({ success: false, error: 'Failed to load customers' }, 500);
    }
  });
}
