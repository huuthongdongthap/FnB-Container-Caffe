/**
 * Order Stream — SSE endpoint for real-time order status updates.
 * Clients subscribe via EventSource to receive 'update_order' events.
 * Backend PATCH handlers write to KV to signal status changes.
 *
 * Architecture:
 *   PATCH handler → writes order_event:<orderId> to KV (TTL 60s)
 *   SSE endpoint   → polls KV for events, pushes updates to connected clients
 *   Frontend       → connects via EventSource, updates UI on 'update_order'
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';

interface OrderRecord {
  id: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  payment_method: string;
  total: number;
  items: string;
  created_at: string;
}

interface OrderEvent {
  orderId: string;
  status: string;
  timestamp: string;
}

// Max SSE connection duration: 120 seconds
const SSE_TIMEOUT_MS = 120_000;
// Poll KV/D1 every 3 seconds for changes
const POLL_INTERVAL_MS = 3_000;

export const orderStreamRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /api/orders/:id/events — SSE endpoint
 * Sends 'update_order' events when the order status changes.
 */
orderStreamRouter.get('/:id/events', async(c) => {
  const db = c.env.AURA_DB;
  const kv = c.env.AUTH_KV;
  const orderId = c.req.param('id');

  if (!kv) {
    return c.json({ error: 'KV not available' }, 500);
  }

  // Verify order exists
  const order = await db.prepare(
    'SELECT id FROM orders WHERE id = ?'
  ).bind(orderId).first<{ id: string }>();

  if (!order) {
    return c.json({ error: 'Order not found' }, 404);
  }

  // Track current status to detect changes
  let currentStatus = '';

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let closed = false;

      const send = (type: string, data: unknown) => {
        if (closed) {
          return;
        }
        try {
          controller.enqueue(encoder.encode(`event: ${type}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Initial: send current order state
      const initialOrder = await db.prepare(
        'SELECT * FROM orders WHERE id = ?'
      ).bind(orderId).first<OrderRecord>();
      if (initialOrder) {
        currentStatus = initialOrder.status;
        send('update_order', initialOrder);
      }

      // Polling loop: check for status changes
      const run = async() => {
        while (!closed) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));

          if (closed) {
            break;
          }

          try {
            // 1. Check KV for explicit event (fast path)
            const eventRaw = await kv.get(`order_event:${orderId}`);
            if (eventRaw) {
              const event: OrderEvent = JSON.parse(eventRaw);
              if (event.status !== currentStatus) {
                currentStatus = event.status;
                // Fetch full order from D1 for complete data
                const updatedOrder = await db.prepare(
                  'SELECT * FROM orders WHERE id = ?'
                ).bind(orderId).first<OrderRecord>();
                if (updatedOrder) {
                  send('update_order', updatedOrder);
                }
                continue;
              }
            }

            // 2. Fallback: check D1 directly (reliable)
            const dbOrder = await db.prepare(
              'SELECT id, status FROM orders WHERE id = ?'
            ).bind(orderId).first<{ id: string; status: string }>();
            if (dbOrder && dbOrder.status !== currentStatus) {
              currentStatus = dbOrder.status;
              const fullOrder = await db.prepare(
                'SELECT * FROM orders WHERE id = ?'
              ).bind(orderId).first<OrderRecord>();
              if (fullOrder) {
                send('update_order', fullOrder);
              }
            }
          } catch {
            // Polling error — continue silently
          }
        }
      };

      // Run polling loop in background
      const pollPromise = run();

      // Connection timeout
      const timeoutId = setTimeout(() => {
        send('timeout', { reason: 'connection closed after timeout' });
        closed = true;
        try {
          controller.close();
        } catch { /* ignore */ }
      }, SSE_TIMEOUT_MS);

      // Cleanup on client disconnect
      c.req.raw.signal.addEventListener('abort', () => {
        closed = true;
        clearTimeout(timeoutId);
        try {
          controller.close();
        } catch { /* ignore */ }
      });

      // Wait for polling to complete or timeout
      await Promise.race([
        pollPromise,
        new Promise((resolve) => setTimeout(resolve, SSE_TIMEOUT_MS))
      ]);
    },
    cancel() {
      // Cleanup when stream is cancelled
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  });
});
