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

// Event log entry stored in KV for replay
interface EventLogEntry {
  eventId: string; // monotonically increasing ID (timestamp)
  orderId: string;
  type: string; // 'update_order', etc.
  data: unknown;
  timestamp: string;
}

// Max SSE connection duration: 120 seconds
const SSE_TIMEOUT_MS = 120_000;
// Poll KV/D1 every 3 seconds for changes
const POLL_INTERVAL_MS = 3_000;

async function appendEventToLog(kv: { get: (k: string) => Promise<string | null>; put: (k: string, v: string, o?: { expirationTtl?: number }) => Promise<void> }, orderId: string, event: EventLogEntry) {
  try {
    const raw = await kv.get(`order_events_log:${orderId}`);
    const list: EventLogEntry[] = raw ? JSON.parse(raw) : [];
    list.push(event);
    const trimmed = list.slice(-20);
    await kv.put(`order_events_log:${orderId}`, JSON.stringify(trimmed), { expirationTtl: 3600 });
  } catch {
    // Ignore KV write errors
  }
}

async function getEventsAfter(kv: { get: (k: string) => Promise<string | null> }, orderId: string, afterEventId: string): Promise<EventLogEntry[]> {
  try {
    const raw = await kv.get(`order_events_log:${orderId}`);
    if (!raw) return [];
    const list: EventLogEntry[] = JSON.parse(raw);
    const index = list.findIndex(e => e.eventId === afterEventId);
    if (index === -1) {
      const afterTs = Number(afterEventId) || new Date(afterEventId).getTime();
      if (!isNaN(afterTs)) {
        return list.filter(e => {
          const itemTs = Number(e.eventId) || new Date(e.timestamp).getTime();
          return itemTs > afterTs;
        });
      }
      return list;
    }
    return list.slice(index + 1);
  } catch {
    return [];
  }
}

export const orderStreamRouter = new Hono<{ Bindings: Env }>();

/**
 * GET /api/orders/:id/events — SSE endpoint
 * Sends 'update_order' events when the order status changes.
 * Supports Last-Event-ID header and query param for event replay.
 */
orderStreamRouter.get('/:id/events', async(c) => {
  const db = c.env.AURA_DB;
  const kv = c.env.AUTH_KV;
  const orderId = c.req.param('id');
  const lastEventId = c.req.header('Last-Event-ID') || c.req.query('lastEventId');

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

      const send = (type: string, data: unknown, eventId?: string) => {
        if (closed) {
          return;
        }
        try {
          const id = eventId || String(Date.now());
          controller.enqueue(encoder.encode(`id: ${id}\n`));
          controller.enqueue(encoder.encode(`event: ${type}\n`));
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // ── Event Replay Buffer: replay missed events if Last-Event-ID is provided ──
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

      // Initial: send current order state if not already replayed
      const initialOrder = await db.prepare(
        'SELECT * FROM orders WHERE id = ?'
      ).bind(orderId).first<OrderRecord>();
      if (initialOrder) {
        if (replayedCount === 0 || initialOrder.status !== currentStatus) {
          currentStatus = initialOrder.status;
          const initialEventId = String(Date.now());
          send('update_order', initialOrder, initialEventId);
          await appendEventToLog(kv, orderId, {
            eventId: initialEventId,
            orderId,
            type: 'update_order',
            data: initialOrder,
            timestamp: new Date().toISOString()
          });
        }
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
                  const eventId = String(Date.now());
                  send('update_order', updatedOrder, eventId);
                  await appendEventToLog(kv, orderId, {
                    eventId,
                    orderId,
                    type: 'update_order',
                    data: updatedOrder,
                    timestamp: new Date().toISOString()
                  });
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
                const eventId = String(Date.now());
                send('update_order', fullOrder, eventId);
                await appendEventToLog(kv, orderId, {
                  eventId,
                  orderId,
                  type: 'update_order',
                  data: fullOrder,
                  timestamp: new Date().toISOString()
                });
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
