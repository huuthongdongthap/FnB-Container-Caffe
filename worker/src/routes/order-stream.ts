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

import { Hono, type Context } from 'hono';
import type { Env } from '../types/env';
import { isTerminal, canAccessOrder, projectCustomerOrderPayload } from '@aura/domain-order';
import { appendEventToLog, getEventsAfter, fetchOrderRecord } from './order-stream-log';
import { getAuthToken, verifyJWT } from '../lib/jwt';

interface OrderEvent {
  orderId: string;
  status: string;
  timestamp: string;
}

const SSE_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 3_000;

export const orderStreamRouter = new Hono<{ Bindings: Env }>();

export const handleOrderStreamEvents: (c: Context<{ Bindings: Env }>) => Promise<Response> = async (c) => {
  const db = c.env.AURA_DB;
  const kv = c.env.AUTH_KV;
  const orderId = c.req.param('id');
  const lastEventId = c.req.header('Last-Event-ID') || c.req.query('lastEventId');

  if (!kv) return c.json({ error: 'KV not available' }, 500);

  let order = await db.prepare('SELECT id, customer_id, status FROM orders WHERE id = ?').bind(orderId).first<{ id: string; customer_id?: string | null; status?: string }>();
  if (!order) {
    order = await db.prepare('SELECT id FROM orders WHERE id = ?').bind(orderId).first<{ id: string; customer_id?: string | null; status?: string }>();
  }
  if (!order) return c.json({ error: 'Order not found' }, 404);

  let user = c.get('user' as any) as { id?: string; role?: string } | undefined;
  if (!user) {
    const token = getAuthToken(c.req.raw);
    if (token && c.env.JWT_SECRET) {
      const payload = await verifyJWT(token, c.env.JWT_SECRET);
      if (payload) user = { id: payload.id || (payload as any).sub, role: payload.role };
    }
  }

  const access = canAccessOrder(user, order);
  if (!access.allowed) return c.json({ error: access.reason || 'Forbidden' }, 403);

  let currentStatus = '';

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

      let replayedCount = 0;
      if (lastEventId) {
        const replayedEvents = await getEventsAfter(kv, orderId, lastEventId);
        for (const ev of replayedEvents) {
          send(ev.type, ev.data, ev.eventId);
          if (ev.type === 'update_order' && typeof ev.data === 'object' && ev.data && 'status' in ev.data) {
            currentStatus = String((ev.data as { status: string }).status);
          }
          replayedCount++;
        }
      }

      const initialOrder = await fetchOrderRecord(db, orderId);
      if (initialOrder) {
        const safePayload = projectCustomerOrderPayload(initialOrder);
        if (replayedCount === 0 || safePayload.status !== currentStatus) {
          currentStatus = safePayload.status;
          const initialEventId = String(Date.now());
          send('update_order', safePayload, initialEventId);
          await appendEventToLog(kv, orderId, { eventId: initialEventId, orderId, type: 'update_order', data: safePayload, timestamp: new Date().toISOString() });
        }
      }

      if (isTerminal(currentStatus as any)) {
        closeStream();
        return;
      }

      const run = async () => {
        while (!closed) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
          if (closed) break;

          try {
            const eventRaw = await kv.get(`order_event:${orderId}`);
            let shouldFetch = false;
            if (eventRaw) {
              const event: OrderEvent = JSON.parse(eventRaw);
              if (event.status !== currentStatus) shouldFetch = true;
            }

            if (!shouldFetch) {
              const dbOrder = await db.prepare('SELECT id, status FROM orders WHERE id = ?').bind(orderId).first<{ id: string; status: string }>();
              if (dbOrder && dbOrder.status !== currentStatus) shouldFetch = true;
            }

            if (shouldFetch) {
              const updated = await fetchOrderRecord(db, orderId);
              if (updated) {
                const payload = projectCustomerOrderPayload(updated);
                currentStatus = payload.status;
                const eventId = String(Date.now());
                send('update_order', payload, eventId);
                await appendEventToLog(kv, orderId, { eventId, orderId, type: 'update_order', data: payload, timestamp: new Date().toISOString() });

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
    cancel() {},
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
