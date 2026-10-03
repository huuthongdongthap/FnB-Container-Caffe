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

ordersCoreRouter.post('/', orderRateLimit, (c) => {
  let ctx: { waitUntil: (promise: Promise<unknown>) => void } | undefined;
  try {
    ctx = c.executionCtx;
  } catch {
    // No execution context in test environment
  }
  return createOrder(c.req.raw, c.env, ctx);
});

ordersCoreRouter.post('/sync', async (c) => {
  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ success: false, error: 'Invalid JSON body' }, 400);
  }

  const localId = (body.localId as string) || c.req.header('X-Local-ID') || c.req.header('Idempotency-Key');

  // Support both wrapped ({ localId, orderData: { ... } }) and flat ({ localId, items: [...] }) payloads
  const orderPayload = (body.orderData && typeof body.orderData === 'object')
    ? { ...(body.orderData as Record<string, unknown>) }
    : { ...body };

  // Strip sync-specific fields
  delete orderPayload.localId;
  delete orderPayload.orderData;
  delete orderPayload.createdAt;
  delete orderPayload.offlineCreatedAt;

  // KV Idempotency cache check
  const authKv = c.env.AUTH_KV as import('@cloudflare/workers-types').KVNamespace | undefined;
  const idemKey = localId ? `order:idempotency:offline:${localId}` : undefined;

  if (idemKey && authKv) {
    const cached = await authKv.get(idemKey, 'json');
    if (cached) {
      return c.json({
        success: true,
        ok: true,
        cached: true,
        localId,
        ...(cached as Record<string, unknown>),
      }, 200, { 'X-Cache': 'HIT' });
    }
  }

  // Inject Idempotency-Key header for createOrder
  const headers = new Headers(c.req.raw.headers);
  headers.set('Content-Type', 'application/json');
  if (localId && !headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', `offline:${localId}`);
  }

  const req = new Request(c.req.raw.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(orderPayload),
  });

  let ctx: { waitUntil: (promise: Promise<unknown>) => void } | undefined;
  try {
    ctx = c.executionCtx;
  } catch {
    // No execution context in test environment
  }

  const res = await createOrder(req, c.env, ctx);
  if (res.ok) {
    const resData = await res.json() as Record<string, unknown>;
    const syncResponse = {
      success: true,
      ok: true,
      localId: localId ?? null,
      data: resData.data ?? resData,
      order: resData.data ?? resData,
    };

    if (idemKey && authKv) {
      await authKv.put(idemKey, JSON.stringify(syncResponse), { expirationTtl: 86400 });
    }

    return c.json(syncResponse, res.status as 200 | 201);
  }

  return res;
});
ordersCoreRouter.post('/split', (c) => splitOrders(c.req.raw, c.env));
ordersCoreRouter.get('/latest', (c) => getLatestOrderTimestamp(c.req.raw, c.env));
ordersCoreRouter.patch('/:id', requireAuth(['owner', 'staff']), (c) => {
  const user = c.get('user');
  return updateOrder(c.req.raw, c.env, c.req.param('id'), user?.role);
});
