import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { verifyJWT } from '../auth.js';
import { createLogger } from '../../middleware/logger';
import { type CustomerRecord, SEGMENTS, PROFILE_SQL } from './types';

const log = createLogger({ route: 'customers-admin' });

export function registerAdminHandlers(router: Hono<{ Bindings: Env }>): void {
  // GET /api/customers/segments — segment list with counts (admin)
  router.get('/segments', async (c) => {
    const db = c.env.AURA_DB;
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }
    const token = authHeader.substring(7);
    const payload = await verifyJWT(token, c.env.JWT_SECRET) as unknown as Record<string, unknown> | null;
    if (!payload) {
      return c.json({ success: false, error: 'Token không hợp lệ' }, 401);
    }
    const role = payload.role as string;
    if (role !== 'owner' && role !== 'manager' && role !== 'staff') {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    try {
      let birthdayCount = 0;
      try {
        const bRow = await db.prepare('SELECT COUNT(*) as count FROM customers WHERE date_of_birth IS NOT NULL AND substr(date_of_birth, 6, 2) = ?').bind(month).first<{ count: number }>();
        birthdayCount = bRow?.count || 0;
      } catch {
        try {
          const bRow = await db.prepare('SELECT COUNT(*) as count FROM customers WHERE birthday IS NOT NULL AND substr(birthday, 6, 2) = ?').bind(month).first<{ count: number }>();
          birthdayCount = bRow?.count || 0;
        } catch {
          birthdayCount = 0;
        }
      }

      const results = await Promise.all([
        db.prepare('SELECT COUNT(*) as count FROM customers').first<{ count: number }>(),
        db.prepare('SELECT COUNT(*) as count FROM customers WHERE loyalty_tier = \'bronze\'').first<{ count: number }>(),
        db.prepare('SELECT COUNT(*) as count FROM customers WHERE loyalty_tier = \'silver\'').first<{ count: number }>(),
        db.prepare('SELECT COUNT(*) as count FROM customers WHERE loyalty_tier = \'gold\'').first<{ count: number }>(),
        db.prepare('SELECT COUNT(*) as count FROM customers WHERE loyalty_tier = \'platinum\'').first<{ count: number }>(),
        db.prepare('SELECT COUNT(DISTINCT customer_phone) as count FROM orders WHERE created_at >= datetime(\'now\', \'-30 days\')').first<{ count: number }>(),
        db.prepare('SELECT COUNT(*) as count FROM customers c WHERE c.phone NOT IN (SELECT DISTINCT customer_phone FROM orders WHERE created_at >= datetime(\'now\', \'-90 days\')) AND c.phone IS NOT NULL').first<{ count: number }>(),
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
  router.get('/', async (c) => {
    const isProd = c.env?.ENVIRONMENT === 'production' || c.env?.NODE_ENV === 'production';
    const authHeader = c.req.header('Authorization');
    if (isProd || authHeader) {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ success: false, error: 'Unauthorized' }, 401);
      }
      const token = authHeader.substring(7);
      const payload = await verifyJWT(token, c.env.JWT_SECRET) as unknown as Record<string, unknown> | null;
      if (!payload) {
        return c.json({ success: false, error: 'Token không hợp lệ' }, 401);
      }
      const role = payload.role as string;
      if (role !== 'owner' && role !== 'manager' && role !== 'staff') {
        return c.json({ success: false, error: 'Forbidden' }, 403);
      }
    }

    const db = c.env.AURA_DB;
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = parseInt(c.req.query('limit') || '50', 10);
    const search = c.req.query('search');
    const tierParam = c.req.query('tier');
    const offset = (page - 1) * limit;

    let countQuery = 'SELECT COUNT(*) as total FROM customers WHERE 1=1';
    let dataQuery = `${PROFILE_SQL}WHERE 1=1`;
    const params: unknown[] = [];

    if (search) {
      const clause = ' AND (c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)';
      countQuery += clause;
      dataQuery += clause;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }
    if (tierParam) {
      countQuery += ' AND c.loyalty_tier = ?';
      dataQuery += ' AND c.loyalty_tier = ?';
      params.push(tierParam.toUpperCase());
    }

    dataQuery += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';

    try {
      const countStmt = params.length
        ? db.prepare(countQuery).bind(...params)
        : db.prepare(countQuery);
      const { results: countResults } = await countStmt.all<{ total: number }>();
      const total = countResults?.[0]?.total || 0;

      const dataStmt = db.prepare(dataQuery).bind(...params, limit, offset);
      const { results } = await dataStmt.all<CustomerRecord>();

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
