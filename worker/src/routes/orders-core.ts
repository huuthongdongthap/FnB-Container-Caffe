/**
 * Orders Core Router
 * Direct checkout, order split, latest timestamp, and status update commands.
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { createOrder, updateOrder, getLatestOrderTimestamp, splitOrders } from '@aura/domain-order';
import { requireAuth } from '../middleware/auth';
import type { Env } from '../types/env';

export const ordersCoreRouter = new Hono<{ Bindings: Env }>();

const orderRateLimit: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  if (ip === '127.0.0.1' || ip === 'localhost') {
    return next();
  }
  const key = `rate:order:${ip}`;
  const count = Number(await c.env.AUTH_KV.get(key) || 0);
  if (count >= 5) {
    return c.json({ ok: false, error: 'Quá nhiều đơn hàng. Vui lòng thử lại sau 10 phút.' }, 429);
  }
  await c.env.AUTH_KV.put(key, String(count + 1), { expirationTtl: 600 });
  await next();
};

ordersCoreRouter.post('/', orderRateLimit, (c) => createOrder(c.req.raw, c.env, c.executionCtx));
ordersCoreRouter.post('/split', (c) => splitOrders(c.req.raw, c.env));
ordersCoreRouter.get('/latest', (c) => getLatestOrderTimestamp(c.req.raw, c.env));
ordersCoreRouter.patch('/:id', requireAuth(['owner', 'staff']), (c) => {
  const user = c.get('user');
  return updateOrder(c.req.raw, c.env, c.req.param('id'), user?.role);
});
