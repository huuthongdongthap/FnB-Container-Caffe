import type { Hono } from 'hono';
import type { Env } from '../../types/env';
import { verifyJWT } from '../auth';
import { createMetricsCollector } from '../../lib/metrics-collector';
import { requireAuth } from '../../middleware/auth';
import { audit } from '../../middleware/audit-log';
import { type OrderRecord } from './types';

export function registerQueryHandlers(app: Hono<{ Bindings: Env }>) {
  // GET /api/orders — list recent orders (no auth, for admin dashboard)
  app.get('/', async(c) => {
    const db = c.env.AURA_DB;
    const limit = parseInt(c.req.query('limit') || '20', 10);

    const { results } = await db.prepare(
      'SELECT * FROM orders ORDER BY created_at DESC LIMIT ?'
    ).bind(limit).all<OrderRecord>();

    return c.json({ success: true, data: results || [] });
  });

  // GET /api/orders/my-orders — current customer's order history (JWT)
  app.get('/my-orders', async(c) => {
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
      return c.json({ success: true, data: [] });
    }

    // Orders table links customers by phone, not customer_id.
    // Look up the customer's phone first.
    const customer = await db.prepare(
      'SELECT phone FROM customers WHERE id = ?'
    ).bind(customerId).first<{ phone: string }>();

    if (!customer || !customer.phone) {
      return c.json({ success: true, data: [] });
    }

    const limit = parseInt(c.req.query('limit') || '20', 10);

    const { results } = await db.prepare(
      'SELECT id, customer_name, items, total, status, payment_method, created_at FROM orders WHERE customer_phone = ? ORDER BY created_at DESC LIMIT ?'
    ).bind(customer.phone, limit).all<Record<string, unknown>>();

    return c.json({ success: true, data: results || [] });
  });

  // GET /api/orders/:id — get single order
  app.get('/:id', async(c) => {
    const db = c.env.AURA_DB;
    const id = c.req.param('id');

    const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first<OrderRecord>();
    if (!order) {
      return c.json({ success: false, error: 'Order not found' }, 404);
    }

    return c.json({ success: true, data: order });
  });
}