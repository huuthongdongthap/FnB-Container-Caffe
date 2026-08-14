/**
 * Customers Routes — /api/customers
 * GET  /api/customers/me — current customer profile
 * PATCH /api/customers/me — update profile
 * GET  /api/customers/segments — customer segments with counts
 * GET  /api/customers    — admin customer list
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { verifyJWT } from './auth.js';
import { updateCustomerProfileSchema, zodErrorResponse } from '../lib/validators';

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  loyalty_tier: string;
  loyalty_points: number;
  lifetime_points: number;
  cashback_balance: number;
  total_spent: number;
  total_earned: number;
  visit_count: number;
  created_at: string;
}

export const customersRouter = new Hono<{ Bindings: Env }>();

// ── Segment definitions ──
const SEGMENTS = [
  { id: 'all', name: 'Tất cả khách hàng / All Customers' },
  { id: 'loyalty_bronze', name: 'Khách hàng Đồng / Bronze' },
  { id: 'loyalty_silver', name: 'Khách hàng Bạc / Silver' },
  { id: 'loyalty_gold', name: 'Khách hàng Vàng / Gold' },
  { id: 'loyalty_platinum', name: 'Khách hàng Bạch kim / Platinum' },
  { id: 'active_30d', name: 'Hoạt động 30 ngày / Active 30 Days' },
  { id: 'inactive_90d', name: 'Không hoạt động 90 ngày / Inactive 90 Days' },
  { id: 'birthday_this_month', name: 'Sinh nhật tháng này / Birthday This Month' }
] as const;

// ── Shared profile query (customers + cashback_wallets JOIN) ─────────
const PROFILE_SQL = `
  SELECT c.id, c.name, c.phone, c.email,
         c.loyalty_tier, c.loyalty_points, c.lifetime_points,
         c.created_at,
         COALESCE(cw.balance, 0) AS cashback_balance,
         COALESCE(cw.total_earned, 0) AS total_earned,
         COALESCE(cw.total_spent, 0) AS total_spent,
         (SELECT COUNT(*) FROM orders o WHERE o.customer_phone = c.phone) AS visit_count
  FROM customers c
  LEFT JOIN cashback_wallets cw ON cw.customer_id = c.id
`;

// GET /api/customers/segments — segment list with counts (admin)
customersRouter.get('/segments', async(c) => {
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
  if (role !== 'owner' && role !== 'staff') {
    return c.json({ success: false, error: 'Forbidden' }, 403);
  }

  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  try {
    const results = await Promise.all([
      db.prepare('SELECT COUNT(*) as count FROM customers').first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM customers WHERE loyalty_tier = \'bronze\'').first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM customers WHERE loyalty_tier = \'silver\'').first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM customers WHERE loyalty_tier = \'gold\'').first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM customers WHERE loyalty_tier = \'platinum\'').first<{ count: number }>(),
      db.prepare('SELECT COUNT(DISTINCT customer_phone) as count FROM orders WHERE created_at >= datetime(\'now\', \'-30 days\')').first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM customers c WHERE c.phone NOT IN (SELECT DISTINCT customer_phone FROM orders WHERE created_at >= datetime(\'now\', \'-90 days\')) AND c.phone IS NOT NULL').first<{ count: number }>(),
      db.prepare('SELECT COUNT(*) as count FROM customers WHERE birthday IS NOT NULL AND substr(birthday, 6, 2) = ?').bind(month).first<{ count: number }>()
    ]);

    const segments = SEGMENTS.map((seg, i) => ({
      id: seg.id,
      name: seg.name,
      count: results[i]?.count || 0
    }));

    return c.json({ success: true, data: segments });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

// GET /api/customers/me — get current customer by JWT
customersRouter.get('/me', async(c) => {
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

  const customerId = payload.customerId || payload.sub || payload.id;
  if (!customerId) {
    return c.json({ success: false, error: 'No customer ID in token' }, 400);
  }

  const customer = await db.prepare(
    `${PROFILE_SQL}WHERE c.id = ?`
  ).bind(customerId).first<CustomerRecord>();

  if (!customer) {
    return c.json({ success: false, error: 'Customer not found' }, 404);
  }

  return c.json({ success: true, data: customer });
});

// PATCH /api/customers/me — update current customer profile
customersRouter.patch('/me', async(c) => {
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

  const customerId = payload.customerId || payload.sub || payload.id;
  if (!customerId) {
    return c.json({ success: false, error: 'No customer ID in token' }, 400);
  }

  const body = await c.req.json() as Record<string, unknown>;
  const parsed = updateCustomerProfileSchema.safeParse(body);
  if (!parsed.success) {
    return zodErrorResponse(c, parsed.error);
  }
  const data = parsed.data;

  const updates: string[] = [];
  const params: unknown[] = [];
  if (data.name !== undefined) {
    updates.push('name = ?'); params.push(data.name);
  }
  if (data.phone !== undefined) {
    updates.push('phone = ?'); params.push(data.phone);
  }

  if (updates.length === 0) {
    return c.json({ success: false, error: 'Không có trường nào để cập nhật' }, 400);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(customerId);
  await db.prepare(
    `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...params).run();

  const customer = await db.prepare(
    `${PROFILE_SQL}WHERE c.id = ?`
  ).bind(customerId).first<CustomerRecord>();

  return c.json({ success: true, data: customer });
});

// GET /api/customers — admin customer list
customersRouter.get('/', async(c) => {
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
});
