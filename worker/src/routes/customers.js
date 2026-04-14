/**
 * Customers Routes — /api/customers
 * Loyalty data from D1
 */

import { Hono } from 'hono';
import { verifyJWT } from './auth.js';

export const customersRouter = new Hono();

// GET /api/customers/me — fetch authenticated customer's loyalty data
customersRouter.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const token = authHeader.substring(7);

  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ success: false, error: 'Token không hợp lệ hoặc đã hết hạn' }, 401);
  }

  let customer = await c.env.AURA_DB.prepare(
    'SELECT id, email, name, phone, loyalty_points, loyalty_tier, created_at FROM customers WHERE email = ?'
  ).bind(payload.email).first();

  if (!customer) {
    // Auto-create customer record if missing (edge case for legacy registrations)
    const newId = 'CUS_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const now = new Date().toISOString();
    await c.env.AURA_DB.prepare(
      'INSERT INTO customers (id, email, name, phone, loyalty_points, loyalty_tier, created_at, updated_at) VALUES (?, ?, ?, ?, 0, \'silver\', ?, ?)'
    ).bind(newId, payload.email, payload.name || '', '', now, now).run();

    customer = { id: newId, email: payload.email, name: payload.name || '', phone: '', loyalty_points: 0, loyalty_tier: 'silver', created_at: now };
  }

  return c.json({ success: true, data: customer });
});
