/**
 * Realtime Orders — WebSocket endpoint for order broadcast via Durable Object.
 *
 * Mount: GET /api/realtime/:channelId
 *
 * Protocol:
 * 1. Client connects with channelId (= orderId).
 * 2. WS is upgraded, forwarded to OrderBroadcaster DO.
 * 3. DO broadcasts new order events to all connected WS clients.
 * 4. On disconnect, client is unregistered from DO state.
 *
 * Error handling:
 * - CF throws RangeError if DO is unavailable (quota exceeded, etc.).
 * - Caught by caller (createOrder), logged to KV key broadcast:fail:<id>.
 */

import { Hono, type Context } from 'hono';
import { authenticateRequest } from '../middleware/auth';
import type { Env } from '../types/env';

export const realtimeOrdersRouter = new Hono();

export async function handleRealtimeChannel(c: Context) {
  const channelId = c.req.param('channelId') || '';
  if (!channelId) {
    return c.json({ error: 'channelId required' }, 400);
  }
  const env = (c.env || {}) as Record<string, unknown>;
  const doNs = env.ORDER_BROADCASTER as
    | {
        idFromName?: (name: string) => DurableObjectId;
        get(id: DurableObjectId | string): { fetch(req: Request): Promise<Response> };
      }
    | undefined;

  const ctxTenant = (c.get('tenantId' as never) as string | undefined)?.trim();
  let user = c.get('user' as never) as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const staff = c.get('staff' as never) as { id?: string; role?: string; tenantId?: string; tenant_id?: string } | undefined;
  const rawAuthHeader = c.req.header('Authorization') || c.req.header('authorization') || '';
  const queryToken = (c.req.query('token') || '').trim();
  if (!user && !staff && (rawAuthHeader || queryToken)) {
    if (!c.req.raw || !env.JWT_SECRET) {
      return c.json({ error: 'Unauthorized' }, 401);
    }
    const authReq =
      !rawAuthHeader && queryToken
        ? new Request(c.req.raw.url, {
            method: c.req.raw.method,
            headers: new Headers([
              ...Array.from(c.req.raw.headers.entries()),
              ['Authorization', `Bearer ${queryToken}`],
            ]),
          })
        : c.req.raw;
    try {
      const session = await authenticateRequest(authReq, c.env as Env);
      if (!session || 'blocked' in session || !('payload' in session)) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      const jti = (session.payload as { jti?: string }).jti;
      const kv = env.AUTH_KV as { get?: (key: string) => Promise<string | null> } | undefined;
      if (jti && kv && typeof kv.get === 'function') {
        const revokedJti = await kv.get(`revoked:${jti}`);
        if (revokedJti) {
          return c.json({ error: 'Unauthorized' }, 401);
        }
      }
      user = {
        id: session.payload.id,
        role: session.payload.role,
        tenantId: session.payload.tenantId,
      };
    } catch {
      return c.json({ error: 'Unauthorized' }, 401);
    }
  }

  const candidateOverrides = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);
  if (new Set(candidateOverrides).size > 1) {
    return c.json({ error: 'Forbidden: cross-tenant realtime channel' }, 403);
  }
  const requestedTenant = candidateOverrides[0] || '';
  const actor = user || staff;
  let tenantId = '';
  if (actor) {
    const actorRole = String(actor.role || '').trim().toLowerCase();
    const rawActorTenant = actor.tenantId ?? actor.tenant_id;
    const actorTenant = (rawActorTenant && String(rawActorTenant).trim()) || 'default';
    const isHq =
      (actorRole === 'owner' || actorRole === 'admin') &&
      (actorTenant.toLowerCase() === 'hq' || actorTenant === '*');
    if (!isHq) {
      if (
        actorTenant === '*' ||
        actorTenant.toLowerCase() === 'hq' ||
        requestedTenant === '*' ||
        requestedTenant.toLowerCase() === 'hq' ||
        ctxTenant === '*' ||
        (ctxTenant && ctxTenant.toLowerCase() === 'hq') ||
        (requestedTenant && requestedTenant !== actorTenant) ||
        (ctxTenant && ctxTenant !== actorTenant) ||
        channelId === '*' ||
        channelId.startsWith('*:') ||
        channelId.toLowerCase() === 'hq' ||
        channelId.toLowerCase().startsWith('hq:')
      ) {
        return c.json({ error: 'Forbidden: cross-tenant realtime channel' }, 403);
      }
      tenantId = actorTenant;
    } else {
      const rawTarget =
        requestedTenant ||
        (ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' ? ctxTenant : '') ||
        actorTenant;
      tenantId = rawTarget === '*' || rawTarget.toLowerCase() === 'hq' ? '*' : rawTarget;
    }
  } else {
    tenantId = String(ctxTenant || requestedTenant || '').trim();
    if (
      tenantId === '*' ||
      tenantId.toLowerCase() === 'hq' ||
      channelId === '*' ||
      channelId.startsWith('*:') ||
      channelId.toLowerCase() === 'hq' ||
      channelId.toLowerCase().startsWith('hq:')
    ) {
      return c.json({ error: 'Forbidden: cross-tenant realtime channel' }, 403);
    }
  }

  if (tenantId && tenantId !== '*' && channelId.includes(':')) {
    const [prefix] = channelId.split(':');
    if (prefix !== tenantId) {
      return c.json({ error: 'Forbidden: cross-tenant realtime channel' }, 403);
    }
  }

  if (!doNs) {
    return c.json({ error: 'Realtime not available — ORDER_BROADCASTER binding missing' }, 503);
  }

  const normalizedChannel =
    tenantId === '*' && channelId.toLowerCase().startsWith('hq:')
      ? `*:${channelId.slice(3)}`
      : tenantId === '*' && channelId.toLowerCase() === 'hq'
        ? '*'
        : channelId;

  const scopedChannel =
    tenantId &&
    tenantId !== 'default' &&
    tenantId !== '*' &&
    normalizedChannel !== tenantId &&
    !normalizedChannel.startsWith(`${tenantId}:`)
      ? `${tenantId}:${normalizedChannel}`
      : normalizedChannel;

  const ns = doNs as unknown as {
    idFromName?: (name: string) => DurableObjectId;
    get: (id: DurableObjectId | string) => { fetch: (req: Request) => Promise<Response> };
  };
  const targetId = typeof ns.idFromName === 'function' ? ns.idFromName(scopedChannel) : scopedChannel;
  const stub = ns.get(targetId);
  let forwardReq = c.req.raw;
  if (tenantId && c.req.raw) {
    try {
      const url = new URL(c.req.raw.url);
      if (
        url.searchParams.has('tenant_id') ||
        url.searchParams.has('tenantId') ||
        url.searchParams.has('store_id') ||
        url.searchParams.has('storeId') ||
        tenantId === '*'
      ) {
        url.searchParams.set('tenant_id', tenantId);
      }
      const headers = new Headers(c.req.raw.headers);
      headers.set('X-Tenant-ID', tenantId);
      forwardReq = new Request(url.toString(), {
        method: c.req.raw.method,
        headers,
      });
    } catch {
      forwardReq = c.req.raw;
    }
  }
  return stub.fetch(forwardReq);
}

realtimeOrdersRouter.get('/:channelId', handleRealtimeChannel);
realtimeOrdersRouter.get('/api/realtime/:channelId', handleRealtimeChannel);
