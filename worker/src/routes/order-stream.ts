/**
 * Order Stream — Canonical SSE endpoint for real-time customer order tracking.
 *
 * Flow:
 *   ORDER STATE → ORDER EVENT → SSE STREAM → SPACE ORDER TRACKING
 *
 * Guarantees:
 * - Customer-safe payload (allowlist only, zero catalog lookups)
 * - Strict IDOR authorization (customer / guest scoping)
 * - Terminal states stop unnecessary streaming & close connections
 * - Reconnect resumes safely via Last-Event-ID or latest canonical state
 */

import { authenticateRequest } from '../lib/staff-session-auth';
import { StaffSessionError } from '../lib/staff-session';
import { getTenantId, resolvePublicTenantId, matchesTenantRow } from '../middleware/tenant';
import { Hono, type Context } from 'hono';
import type { Env } from '../types/env';
import { isTerminal, canAccessOrder, projectCustomerOrderPayload } from '@aura/domain-order';
import { appendEventToLog, replayEventsSince, fetchOrderRecord, type OrderStreamEvent } from './order-stream-log';

interface OrderEvent {
  orderId: string;
  status: string;
  timestamp: string;
  tenantId?: string;
}

const SSE_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 3_000;

export const orderStreamRouter = new Hono<{ Bindings: Env }>();

export const handleOrderStreamEvents: (c: Context<{ Bindings: Env }>) => Promise<Response> = async (c) => {
  const db = c.env.AURA_DB;
  const kv = c.env.AUTH_KV;
  const orderId = c.req.param('id')!;
  const lastEventId = c.req.header('Last-Event-ID') || c.req.query('lastEventId') || '';

  if (!kv) return c.json({ error: 'KV not available' }, 500);

  const user = c.get('user') as {
    id?: string;
    role?: string;
    tenantId?: string;
    tenant_id?: string;
    customerId?: string;
    customer_id?: string;
  } | undefined;
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
    return c.json({ error: 'Cross-tenant access denied' }, 403);
  }
  const explicitHeaderOrQuery = candidateOverrides[0] || '';
  const ctxTenant = String((c.get('tenantId' as never) as string | undefined) || '').trim();

  let tenantId: string;
  if (user && user.role !== 'customer') {
    const role = String(user.role || '').toLowerCase();
    const userTenant = String(user.tenantId ?? user.tenant_id ?? '').trim();
    const isHq = (role === 'owner' || role === 'admin') && (userTenant === '*' || userTenant.toLowerCase() === 'hq');
    const boundTenant = userTenant || 'default';
    const reqTenant = explicitHeaderOrQuery;
    const resolved = (getTenantId(c as any) || boundTenant || 'default').trim() || 'default';
    if (!isHq) {
      if (
        userTenant === '*' ||
        userTenant.toLowerCase() === 'hq' ||
        reqTenant === '*' ||
        reqTenant.toLowerCase() === 'hq' ||
        ctxTenant === '*' ||
        ctxTenant.toLowerCase() === 'hq' ||
        (reqTenant && reqTenant !== boundTenant) ||
        (ctxTenant && ctxTenant !== boundTenant) ||
        resolved !== boundTenant
      ) {
        return c.json({ error: 'Cross-tenant access denied' }, 403);
      }
      tenantId = boundTenant;
    } else {
      const rawTarget =
        reqTenant ||
        (ctxTenant && ctxTenant !== '*' && ctxTenant.toLowerCase() !== 'hq' ? ctxTenant : '') ||
        (resolved && resolved !== '*' && resolved.toLowerCase() !== 'hq' ? resolved : '') ||
        '*';
      tenantId = rawTarget === '*' || rawTarget.toLowerCase() === 'hq' ? '*' : rawTarget;
    }
  } else {
    const userTenant = String(user?.tenantId ?? user?.tenant_id ?? '').trim();
    if (
      userTenant === '*' ||
      userTenant.toLowerCase() === 'hq' ||
      explicitHeaderOrQuery === '*' ||
      explicitHeaderOrQuery.toLowerCase() === 'hq' ||
      ctxTenant === '*' ||
      ctxTenant.toLowerCase() === 'hq'
    ) {
      return c.json({ error: 'Cross-tenant access denied' }, 403);
    }
    const resolvedPublic = String((await (resolvePublicTenantId as any)(c as any, c.env.AURA_DB)) || '').trim();
    if (user?.role === 'customer' && userTenant) {
      if (
        (explicitHeaderOrQuery && explicitHeaderOrQuery !== userTenant) ||
        (ctxTenant && ctxTenant !== 'default' && ctxTenant !== userTenant)
      ) {
        return c.json({ error: 'Cross-tenant access denied' }, 403);
      }
      tenantId = userTenant;
    } else if (user?.role === 'customer' && !userTenant && (!resolvedPublic || resolvedPublic === 'default') && explicitHeaderOrQuery) {
      tenantId = explicitHeaderOrQuery;
    } else {
      const fallbackTenant = resolvedPublic || (getTenantId(c as any) || 'default').trim() || 'default';
      if (fallbackTenant === '*' || fallbackTenant.toLowerCase() === 'hq') {
        return c.json({ error: 'Cross-tenant access denied' }, 403);
      }
      tenantId = explicitHeaderOrQuery || fallbackTenant;
    }
  }

  let order: { id: string; customer_id?: string | null; status: string; tenant_id?: string | null } | null = null;
  try {
    order = await db.prepare(
      `SELECT id, customer_id, status, tenant_id FROM orders WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`
    ).bind(orderId, tenantId, tenantId).first<{ id: string; customer_id?: string | null; status: string; tenant_id?: string | null }>();
    if (!order && tenantId === 'default') {
      order = await db.prepare(
        `SELECT id, customer_id, status FROM orders WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`
      ).bind(orderId, tenantId, tenantId).first<{ id: string; customer_id?: string | null; status: string; tenant_id?: string | null }>();
    }
  } catch {
    if (tenantId === 'default' || tenantId === '*') {
      order = await db.prepare('SELECT id, customer_id, status, tenant_id FROM orders WHERE id = ?')
        .bind(orderId)
        .first<{ id: string; customer_id?: string | null; status: string; tenant_id?: string | null }>()
        .catch(() =>
          db.prepare('SELECT id, customer_id, status FROM orders WHERE id = ?')
            .bind(orderId)
            .first<{ id: string; customer_id?: string | null; status: string; tenant_id?: string | null }>()
        );
    } else {
      order = null;
    }
  }
  if (order && !matchesTenantRow(order, tenantId)) {
    order = null;
  }
  if (!order) return c.json({ error: 'Order not found' }, 404);

  const rawOrderTenant = order.tenant_id && String(order.tenant_id).trim() ? String(order.tenant_id).trim() : '';
  const orderTenant =
    rawOrderTenant && rawOrderTenant !== '*' && rawOrderTenant.toLowerCase() !== 'hq'
      ? rawOrderTenant
      : tenantId !== '*' && tenantId.toLowerCase() !== 'hq'
        ? tenantId
        : 'default';

  let effectiveUser = user;
  if (effectiveUser && String(effectiveUser.role || '').toLowerCase() === 'customer' && order.customer_id) {
    const ordCustId = String(order.customer_id).trim();
    const directIds = [effectiveUser.id, effectiveUser.customerId, effectiveUser.customer_id]
      .map((v) => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
    let matched = directIds.includes(ordCustId);
    if (!matched && effectiveUser.id) {
      const linkedRow = await db
        .prepare(
          "SELECT id FROM customers WHERE id = ? AND user_id = ? AND COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ? LIMIT 1"
        )
        .bind(ordCustId, effectiveUser.id, orderTenant)
        .first<{ id?: string }>()
        .catch(() =>
          orderTenant === 'default'
            ? db
                .prepare('SELECT id FROM customers WHERE id = ? AND user_id = ? LIMIT 1')
                .bind(ordCustId, effectiveUser!.id)
                .first<{ id?: string }>()
                .catch(() => null)
            : null
        );
      matched = Boolean(linkedRow?.id);
    }
    if (matched) {
      effectiveUser = { ...effectiveUser, id: ordCustId };
    }
  }

  const access = canAccessOrder(effectiveUser, order);
  if (!access.allowed) return c.json({ error: access.reason || 'Forbidden' }, 403);

  let currentStatus = order.status || '';

  let cancelStream = () => {};
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const send = (type: string, data: unknown, eventId?: string) => {
        if (closed) return;
        try {
          const id = eventId || String(Date.now());
          controller.enqueue(encoder.encode(`id: ${id}\n`));
          controller.enqueue(encoder.encode(`event: ${type}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { closed = true; }
      };

      const closeStream = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* ignore */ }
      };

      const checkSession = async () => {
        if (!user) return true;
        try {
          const live = await authenticateRequest(c.req.raw, c.env);
          if (!live || 'blocked' in live) {
            send('auth_error', { code: 'SESSION_EXPIRED' });
            closeStream();
            return false;
          }
          return true;
        } catch (error) {
          send('auth_error', { code: error instanceof StaffSessionError ? error.code : 'AUTH_STATE_UNAVAILABLE' });
          closeStream(); return false;
        }
      };
      if (!await checkSession()) return;

      cancelStream = closeStream;
      let replayedCount = 0;
      if (lastEventId) {
        const replayedEvents = await replayEventsSince(kv, orderId, lastEventId, orderTenant);
        for (const ev of replayedEvents) {
          if (ev.tenantId && String(ev.tenantId).trim() !== orderTenant) {
            continue;
          }
          const eventId: string = ev.eventId;
          send(ev.type, ev.data, eventId);
          if (ev.type === 'update_order' && typeof ev.data === 'object' && ev.data && 'status' in ev.data) {
            currentStatus = String((ev.data as { status: string }).status);
          }
          replayedCount++;
        }
      }

      const initialOrder = await fetchOrderRecord(db, orderId, tenantId === '*' ? orderTenant : tenantId);
      if (initialOrder) {
        const safePayload = projectCustomerOrderPayload(initialOrder);
        if (replayedCount === 0 || safePayload.status !== currentStatus) {
          currentStatus = safePayload.status;
          const initialEventId = String(Date.now());
          send('update_order', safePayload, initialEventId);
          const streamEvent: OrderStreamEvent = {
            eventId: initialEventId,
            orderId,
            type: 'update_order',
            data: safePayload,
            timestamp: new Date().toISOString(),
            tenantId: orderTenant,
          };
          await appendEventToLog(kv, orderId, streamEvent, orderTenant);
        }
      }

      if (!initialOrder && tenantId !== '*') { closeStream(); return; }
      if (isTerminal(currentStatus as any)) {
        closeStream();
        return;
      }

      const run = async () => {
        while (!closed) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
          if (closed || !await checkSession()) break;

          try {
            const eventKey = orderTenant && orderTenant !== 'default' && orderTenant !== '*'
              ? `order_event:${orderTenant}:${orderId}`
              : `order_event:${orderId}`;
            const eventRaw =
              (await kv.get(eventKey)) ??
              (orderTenant && orderTenant !== '*' ? await kv.get(`order_status:${orderTenant}:${orderId}`) : null) ??
              (eventKey !== `order_event:${orderId}` ? await kv.get(`order_event:${orderId}`) : null) ??
              (orderTenant === 'default' ? await kv.get(`order_status:${orderId}`) : null);
            let shouldFetch = false;
            if (eventRaw) {
              try {
                const event = JSON.parse(eventRaw) as OrderEvent & { tenant_id?: string };
                const evTenant = (event.tenantId || event.tenant_id || '').trim();
                const eventTenantMatches = !evTenant || evTenant === orderTenant;
                if (eventTenantMatches && event.status && event.status !== currentStatus) shouldFetch = true;
              } catch {
                if (eventRaw !== currentStatus) shouldFetch = true;
              }
            }

            if (!shouldFetch) {
              let dbOrder: { id: string; status: string; payment_status?: string; updated_at?: string; tenant_id?: string | null } | null = null;
              try {
                dbOrder = await db.prepare(
                  `SELECT id, status, payment_status, updated_at, tenant_id FROM orders WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`
                ).bind(orderId, orderTenant, orderTenant).first();
                if (!dbOrder && orderTenant === 'default') {
                  dbOrder = await db.prepare(
                    `SELECT id, status, payment_status, updated_at FROM orders WHERE id = ? AND (? = '*' OR COALESCE(NULLIF(TRIM(tenant_id), ''), 'default') = ?)`
                  ).bind(orderId, orderTenant, orderTenant).first();
                }
              } catch {
                if (orderTenant === 'default' || tenantId === '*') {
                  dbOrder = await db.prepare('SELECT id, status, payment_status, updated_at, tenant_id FROM orders WHERE id = ?')
                    .bind(orderId)
                    .first<{ id: string; status: string; payment_status?: string; updated_at?: string; tenant_id?: string | null }>()
                    .catch(() =>
                      db.prepare('SELECT id, status, payment_status, updated_at FROM orders WHERE id = ?')
                        .bind(orderId)
                        .first<{ id: string; status: string; payment_status?: string; updated_at?: string; tenant_id?: string | null }>()
                    )
                    .catch(() => db.prepare('SELECT id, status FROM orders WHERE id = ?').bind(orderId).first<{ id: string; status: string; payment_status?: string; updated_at?: string; tenant_id?: string | null }>());
                } else {
                  dbOrder = null;
                }
              }
              if (dbOrder && !matchesTenantRow(dbOrder, orderTenant)) dbOrder = null;
              if (!dbOrder && tenantId !== '*') { closeStream(); break; }
              if (dbOrder && (dbOrder.status ?? '') !== currentStatus) shouldFetch = true;
            }

            if (shouldFetch) {
              const updated = await fetchOrderRecord(db, orderId, tenantId === '*' ? orderTenant : tenantId);
              if (!updated && tenantId !== '*') { closeStream(); break; }
              if (updated) {
                const payload = projectCustomerOrderPayload(updated);
                currentStatus = payload.status;
                const eventId = String(Date.now());
                send('update_order', payload, eventId);
                await appendEventToLog(kv, orderId, { eventId, orderId, type: 'update_order', data: payload, timestamp: new Date().toISOString(), tenantId: orderTenant }, orderTenant);

                if (isTerminal(currentStatus as any)) {
                  closeStream();
                  break;
                }
              }
            }
          } catch { /* Polling error — continue */ }
        }
      };

      const pollPromise = run();
      const timeoutId = setTimeout(() => {
        send('timeout', { reason: 'connection closed after timeout' });
        closeStream();
      }, SSE_TIMEOUT_MS);

      c.req.raw.signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        closeStream();
      });

      await Promise.race([pollPromise, new Promise((resolve) => setTimeout(resolve, SSE_TIMEOUT_MS))]);
    },
    cancel() { cancelStream(); },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
};

orderStreamRouter.get('/:id/events', handleOrderStreamEvents);
