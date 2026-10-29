import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { requireAuth } from '../../middleware/auth';
import { resolvePilotStore } from '../../lib/pilot-store';
import { createLogger } from '../../middleware/logger';
import { type CustomerRecord, SEGMENTS, PROFILE_SQL } from './types';

const log = createLogger({ route: 'customers-admin' });

function resolveRequestTenant(c: { get: (k: string) => unknown; env: Env }): string {
  const user = c.get('user') as { tenantId?: string; role?: string } | undefined;
  if (user?.tenantId) {
    return user.tenantId;
  }
  try {
    return resolvePilotStore(c.env);
  } catch {
    return 'default';
  }
}

export function registerAdminHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/customers/segments — segment list with counts (admin)
  router.get('/segments', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin']), async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = resolveRequestTenant(c as unknown as { get: (k: string) => unknown; env: Env });
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    try {
      let birthdayCount = 0;
      try {
        const bRow = await db.prepare(
          "SELECT COUNT(*) as count FROM customers WHERE date_of_birth IS NOT NULL AND substr(date_of_birth, 6, 2) = ? AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?"
        ).bind(month, tenantId).first<{ count: number }>();
        birthdayCount = bRow?.count || 0;
      } catch {
        try {
          const bRow = await db.prepare(
            'SELECT COUNT(*) as count FROM customers WHERE birthday IS NOT NULL AND substr(birthday, 6, 2) = ?'
          ).bind(month).first<{ count: number }>();
          birthdayCount = bRow?.count || 0;
        } catch {
          birthdayCount = 0;
        }
      }

      const results = await Promise.all([
        db.prepare("SELECT COUNT(*) as count FROM customers WHERE COALESCE(NULLIF(tenant_id, ''), 'default') = ?").bind(tenantId).first<{ count: number }>(),
        db.prepare("SELECT COUNT(*) as count FROM customers WHERE loyalty_tier = 'bronze' AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?").bind(tenantId).first<{ count: number }>(),
        db.prepare("SELECT COUNT(*) as count FROM customers WHERE loyalty_tier = 'silver' AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?").bind(tenantId).first<{ count: number }>(),
        db.prepare("SELECT COUNT(*) as count FROM customers WHERE loyalty_tier = 'gold' AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?").bind(tenantId).first<{ count: number }>(),
        db.prepare("SELECT COUNT(*) as count FROM customers WHERE loyalty_tier = 'platinum' AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?").bind(tenantId).first<{ count: number }>(),
        db.prepare("SELECT COUNT(DISTINCT customer_phone) as count FROM orders WHERE created_at >= datetime('now', '-30 days') AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?").bind(tenantId).first<{ count: number }>(),
        db.prepare("SELECT COUNT(*) as count FROM customers c WHERE c.phone NOT IN (SELECT DISTINCT customer_phone FROM orders WHERE created_at >= datetime('now', '-90 days') AND COALESCE(NULLIF(tenant_id, ''), 'default') = ?) AND c.phone IS NOT NULL AND COALESCE(NULLIF(c.tenant_id, ''), 'default') = ?").bind(tenantId, tenantId).first<{ count: number }>(),
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
  router.get('/', requireAuth(['owner', 'manager', 'staff', 'waiter', 'cashier', 'admin']), async (c) => {
    const db = c.env.AURA_DB;
    const tenantId = resolveRequestTenant(c as unknown as { get: (k: string) => unknown; env: Env });
    const rawPage = parseInt(c.req.query('page') || '1', 10);
    const rawLimit = parseInt(c.req.query('limit') || '50', 10);
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;
    const search = c.req.query('search');
    const tierParam = c.req.query('tier');
    const offset = (page - 1) * limit;

    let countQuery = "SELECT COUNT(*) as total FROM customers c WHERE COALESCE(NULLIF(c.tenant_id, ''), 'default') = ?";
    let dataQuery = `${PROFILE_SQL}WHERE COALESCE(NULLIF(c.tenant_id, ''), 'default') = ?`;
    const params: unknown[] = [tenantId];

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
        const fallbackQuery = dataQuery.replace(PROFILE_SQL, 'SELECT c.* FROM customers c ');
        const fallbackStmt = db.prepare(fallbackQuery).bind(...params, limit, offset);
        const res = await fallbackStmt.all<CustomerRecord>();
        results = res.results;
      }

      return c.json({
        success: true,
        data: results || [],
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
      });
    } catch (err) {
      log.error('Customer list query error:', { message: (err as Error).message });
      return c.json({ success: false, error: 'Failed to load customers' }, 500);
    }
  });
}
