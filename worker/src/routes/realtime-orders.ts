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

const STAFF_REALTIME_ROLES = new Set([
  'owner',
  'admin',
  'manager',
  'supervisor',
  'staff',
  'kitchen',
  'barista',
  'chef',
  'cashier',
  'waiter',
]);

function isStoreWideChannel(channelId: string, tenantId: string): boolean {
  const trimmed = channelId.trim();
  if (!trimmed) return true;
  if (tenantId && trimmed === tenantId) return true;
  const suffix = trimmed.includes(':') ? trimmed.split(':').slice(1).join(':') : trimmed;
  return /^(kds|orders|all|kitchen|pos|store|stream)$/i.test(suffix);
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

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

  const actorRole = String(actor?.role || '').trim().toLowerCase();
  const isStaffActor = STAFF_REALTIME_ROLES.has(actorRole);
  const rawOrderId = channelId.includes(':') ? channelId.split(':').slice(1).join(':') : channelId;

  // Store-wide feeds require authenticated staff whenever auth runtime (JWT_SECRET) is configured
  if (Boolean(env.JWT_SECRET) && isStoreWideChannel(channelId, tenantId)) {
    if (!actor) {
      return c.json({ error: 'Unauthorized: staff session required for store realtime channel' }, 401);
    }
    if (!isStaffActor) {
      return c.json({ error: 'Forbidden: staff role required for store realtime channel' }, 403);
    }
  }

  // Non-staff single-order tracking channel: verify guest_token_hash / customer_id when row exists
  const db = (env.AURA_DB ?? env.DB) as
    | {
        prepare?: (sql: string) => {
          bind?: (...args: unknown[]) => { first?: <T>() => Promise<T | null> };
        };
      }
    | undefined;
  if (!isStaffActor && db && typeof db.prepare === 'function') {
    let orderRow: {
      id?: string;
      customer_id?: string | null;
      guest_token_hash?: string | null;
      tenant_id?: string | null;
    } | null = null;
    let queryExecuted = false;
    let queryFailed = false;
    try {
      const stmt = db.prepare(
        'SELECT id, customer_id, guest_token_hash, tenant_id FROM orders WHERE id = ? LIMIT 1'
      );
      if (stmt && typeof stmt.bind === 'function') {
        const bound = stmt.bind(rawOrderId);
        if (bound && typeof bound.first === 'function') {
          orderRow = await bound.first();
          queryExecuted = true;
        }
      }
    } catch (err) {
      if (/no such column:\s*guest_token_hash/i.test(String(err))) {
        try {
          const fallbackStmt = db.prepare('SELECT id, customer_id, tenant_id FROM orders WHERE id = ? LIMIT 1');
          const fallbackBound = fallbackStmt?.bind?.(rawOrderId);
          if (fallbackBound && typeof fallbackBound.first === 'function') {
            orderRow = await fallbackBound.first();
            queryExecuted = true;
          }
        } catch (fallbackErr) {
          if (!/no such table:\s*orders/i.test(String(fallbackErr))) {
            queryFailed = true;
          }
          orderRow = null;
        }
      } else if (!/no such table:\s*orders/i.test(String(err))) {
        queryFailed = true;
        orderRow = null;
      } else {
        orderRow = null;
      }
    }

    if (queryFailed) {
      return c.json({ error: 'Order ownership verification unavailable', retryable: true }, 503);
    }

    if (queryExecuted && !orderRow) {
      return c.json({ error: 'Order not found' }, 404);
    }

    if (orderRow) {
      const rowTenant = String(orderRow.tenant_id || '').trim() || 'default';
      if (tenantId && tenantId !== '*' && rowTenant !== tenantId) {
        return c.json({ error: 'Forbidden: cross-tenant realtime channel' }, 403);
      }
      const actorRec = actor as { id?: string; customerId?: string; customer_id?: string } | null;
      const actorCandidateIds = [actorRec?.id, actorRec?.customerId, actorRec?.customer_id]
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean);
      const ordCustId = orderRow.customer_id ? String(orderRow.customer_id).trim() : '';
      let customerOwnsOrder = Boolean(ordCustId) && actorCandidateIds.includes(ordCustId);
      if (!customerOwnsOrder && ordCustId && actorRec?.id) {
        try {
          const linkStmt = db.prepare(
            "SELECT id FROM customers WHERE id = ? AND user_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
          );
          const linkRow = await linkStmt?.bind?.(ordCustId, actorRec.id, rowTenant)?.first?.<{ id?: string }>();
          customerOwnsOrder = Boolean(linkRow?.id);
        } catch {
          // Optional customers.user_id linkage
        }
      }
      if (!customerOwnsOrder) {
        if (orderRow.guest_token_hash) {
          const providedToken = (
            c.req.header('X-Order-Token') ||
            c.req.header('x-order-token') ||
            c.req.query('order_token') ||
            ''
          ).trim();
          if (!providedToken) {
            return c.json({ error: 'Unauthorized: order tracking token required' }, 401);
          }
          const candidateHash = await sha256Hex(providedToken);
          if (!timingSafeHexEqual(candidateHash, String(orderRow.guest_token_hash))) {
            return c.json({ error: 'Forbidden: invalid order tracking token' }, 403);
          }
        } else if (ordCustId) {
          return c.json(
            { error: actor ? 'Forbidden: order belongs to another customer' : 'Unauthorized' },
            actor ? 403 : 401
          );
        }
      }
    }
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
  const audience: 'staff' | 'guest' = isStaffActor ? 'staff' : 'guest';
  let forwardReq = c.req.raw;
  if (c.req.raw) {
    try {
      const url = new URL(c.req.raw.url);
      if (
        tenantId &&
        (url.searchParams.has('tenant_id') ||
          url.searchParams.has('tenantId') ||
          url.searchParams.has('store_id') ||
          url.searchParams.has('storeId') ||
          tenantId === '*')
      ) {
        url.searchParams.set('tenant_id', tenantId);
      }
      const headers = new Headers(c.req.raw.headers);
      if (tenantId) headers.set('X-Tenant-ID', tenantId);
      headers.set('X-Realtime-Audience', audience);
      if (audience === 'guest') {
        headers.set('X-Realtime-Order-ID', rawOrderId);
      }
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
