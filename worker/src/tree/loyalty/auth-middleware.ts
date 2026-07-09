// Auth middleware for loyalty routes — extracted from routes/loyalty.ts

import type { MiddlewareHandler } from 'hono';
import type { Env } from '../../types/env';
import { verifyJWT } from '../../lib/jwt';
import type { Customer } from '../../types/models';

export const authCustomer: MiddlewareHandler<{ Bindings: Env }> = async(c, next) => {
  const pubPaths = ['/phone-auth', '/tiers', '/active-campaign', '/lookup'];
  const pathSegments = c.req.path.split('/').filter(Boolean);
  const relPath = `/${pathSegments.slice(2).join('/')}`;
  if (pubPaths.includes(relPath)) {
    await next();
    return;
  }
  const auth = c.req.header('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }
  const payload = await verifyJWT(auth.substring(7), c.env.JWT_SECRET);
  if (!payload) {
    return c.json({ success: false, error: 'Token không hợp lệ' }, 401);
  }
  const customer = await c.env.AURA_DB.prepare(
    'SELECT id, email, name, phone, loyalty_points, lifetime_points, loyalty_tier, created_at FROM customers WHERE email = ?'
  ).bind(payload.email).first<Customer>();
  if (!customer) {
    return c.json({ success: false, error: 'Customer not found' }, 404);
  }
  c.set('customer', customer as unknown as Record<string, unknown>);
  await next();
};
