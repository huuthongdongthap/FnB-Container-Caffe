/**
 * Orders Core Router
 * Direct checkout, order split, latest timestamp, and status update commands.
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { createOrder, updateOrder, getLatestOrderTimestamp, splitOrders } from '@aura/domain-order';
import { requireAuth } from '../middleware/auth';
import { getTenantId } from '../middleware/tenant';
import type { Env } from '../types/env';

export const ordersCoreRouter = new Hono<{ Bindings: Env }>();

export const orderRateLimit: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const isProd = c.env?.ENVIRONMENT === 'production' || (c.env as Record<string, unknown>)?.NODE_ENV === 'production';
  if (!isProd) {
    const origin = c.req.header('origin') || c.req.header('referer') || '';
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return next();
    }
  }
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
  if (!isProd && (ip === '127.0.0.1' || ip === 'localhost' || ip === 'unknown')) {
    return next();
  }
  const kv = c.env?.AUTH_KV;
  if (!kv) {
    return next();
  }
  const key = `rate:order:${ip}`;
  try {
    const count = Number((await kv.get(key)) || 0);
    if (count >= 60) {
      return c.json({ ok: false, error: 'Quá nhiều đơn hàng. Vui lòng thử lại sau 10 phút.' }, 429);
    }
    await kv.put(key, String(count + 1), { expirationTtl: 600 });
  } catch {
    // Fail open on transient KV errors
  }
  await next();
};

export const handleCreateOrder = (c: import('hono').Context<{ Bindings: Env }>) => {
  let ctx: { waitUntil: (promise: Promise<unknown>) => void } | undefined;
  try {
    ctx = c.executionCtx;
  } catch {
    // No execution context in test environment
  }
  return createOrder(c.req.raw, c.env, ctx);
};

export const handleSyncOrders = async (c: import('hono').Context<{ Bindings: Env }>) => {
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

    return c.json(syncResponse, res.status as 200 | 201, res.headers.get('X-Cache') ? { 'X-Cache': 'HIT' } : undefined);
  }

  return res;
};

export const handleSplitOrders = (c: import('hono').Context<{ Bindings: Env }>) => splitOrders(c.req.raw, c.env);
export const handleLatestOrderTimestamp = (c: import('hono').Context<{ Bindings: Env }>) => getLatestOrderTimestamp(c.req.raw, c.env);
export const handleUpdateOrder = (c: import('hono').Context<{ Bindings: Env }>) => {
  const user = c.get('user');
  const orderId = c.req.param('id')!;
  return updateOrder(c.req.raw, c.env, orderId, user?.role, getTenantId(c));
};

ordersCoreRouter.post('/', orderRateLimit, handleCreateOrder);
ordersCoreRouter.post('/sync', orderRateLimit, handleSyncOrders);
ordersCoreRouter.post('/split', orderRateLimit, handleSplitOrders);
ordersCoreRouter.get('/latest', handleLatestOrderTimestamp);
ordersCoreRouter.patch('/:id', requireAuth(['owner', 'manager', 'staff', 'admin', 'waiter', 'kitchen', 'barista', 'chef', 'cashier']), handleUpdateOrder);
