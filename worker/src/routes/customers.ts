/**
 * Customers Routes — /api/customers
 * GET  /api/customers/me — current customer profile
 * GET  /api/customers    — admin customer list
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { verifyJWT } from './auth.js';

interface CustomerRecord {
  id: string;
  name: string;
  phone: string;
  email: string;
  birthday: string;
  tier: string;
  cashback_balance: number;
  total_spent: number;
  visit_count: number;
  created_at: string;
}

export const customersRouter = new Hono<{ Bindings: Env }>();

// GET /api/customers/me — get current customer by JWT
customersRouter.get('/me', async (c) => {
  const db = c.env.AURA_DB;
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  const payload = await verifyJWT(token, c.env.JWT_SECRET) as Record<string, any> | null;
  if (!payload) {
    return c.json({ success: false, error: 'Token không hợp lệ' }, 401);
  }

  const customerId = payload.customerId || payload.sub || payload.id;
  if (!customerId) {
    return c.json({ success: false, error: 'No customer ID in token' }, 400);
  }

  const customer = await db.prepare(
    'SELECT id, name, phone, email, birthday, tier, cashback_balance, total_spent, visit_count, created_at FROM customers WHERE id = ?'
  ).bind(customerId).first<CustomerRecord>();

  if (!customer) {
    return c.json({ success: false, error: 'Customer not found' }, 404);
  }

  return c.json({ success: true, data: customer });
});

// GET /api/customers — admin customer list
customersRouter.get('/', async (c) => {
  const db = c.env.AURA_DB;
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const search = c.req.query('search');
  const tier = c.req.query('tier');
  const offset = (page - 1) * limit;

  let countQuery = 'SELECT COUNT(*) as total FROM customers WHERE 1=1';
  let dataQuery = 'SELECT id, name, phone, email, tier, cashback_balance, total_spent, visit_count, created_at FROM customers WHERE 1=1';
  const params: unknown[] = [];

  if (search) {
    const clause = ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
    countQuery += clause;
    dataQuery += clause;
    const pattern = `%${search}%`;
    params.push(pattern, pattern, pattern);
  }
  if (tier) {
    countQuery += ' AND tier = ?';
    dataQuery += ' AND tier = ?';
    params.push(tier.toUpperCase());
  }

  dataQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';

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
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});
