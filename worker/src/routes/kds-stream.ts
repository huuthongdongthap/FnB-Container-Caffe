/**
 * KDS Stream — Server-Sent Events endpoint for the Kitchen Display System.
 * Clients subscribe via EventSource to receive full 'snapshot' payloads of
 * active kitchen orders (pending + preparing), replacing 5s polling per client
 * with one shared connection.
 *
 * Architecture (mirrors order-stream.ts):
 *   GET /kds/orders/stream → poll D1 every POLL_INTERVAL_MS,
 *   emit a snapshot whenever the result set changes, close after timeout;
 *   EventSource auto-reconnects on close.
 *
 * Snapshot-based (not event-based): KDS is a state dashboard — each tick
 * re-reads the authoritative D1 rows, so no events can be missed and there
 * is no KV TTL race between create and status-update producers.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';

// Max SSE connection duration: 120s — client reconnects naturally after.
const SSE_TIMEOUT_MS = 120_000;
// Poll D1 every 3 seconds for changes.
const POLL_INTERVAL_MS = 3_000;

interface KdsStreamOrder {
  id: string;
  customer_name: string;
  table_id: string | null;
  items: unknown[];
  status: string;
  elapsed_minutes: number;
  created_at: string;
}

interface OrderRecord {
  id: string;
  customer_name: string;
  table_id: string | null;
  items: string;
  status: string;
  created_at: string;
}

export const kdsStreamRouter = new Hono<{ Bindings: Env }>();

function mapKdsOrder(order: OrderRecord): KdsStreamOrder {
  let items: unknown[] = [];
  try {
    items = JSON.parse(order.items);
  } catch { /* keep empty */ }

  const elapsed = Math.round(
    (Date.now() - new Date(order.created_at).getTime()) / 60000
  );

  return {
    id: order.id,
    customer_name: order.customer_name,
    table_id: order.table_id,
    items,
    status: order.status,
    elapsed_minutes: elapsed,
    created_at: order.created_at
  };
}

/**
 * GET /kds/orders/stream — SSE endpoint (mounted under /api/kds/orders,
 * behind requireAuth(['owner', 'staff']) in index.ts).
 */
kdsStreamRouter.get('/stream', async(c) => {
  const db = c.env.AURA_DB;
  if (!db) {
    return c.json({ error: 'DB not available' }, 500);
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) {
          return;
        }
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      };

      const queryActiveOrders = async(): Promise<KdsStreamOrder[]> => {
        const { results } = await db.prepare(
          `SELECT id, customer_name, table_id, items, status, created_at FROM orders
           WHERE status IN ('pending', 'preparing')
           ORDER BY created_at ASC LIMIT 50`
        ).all<OrderRecord>();
        return (results || []).map(mapKdsOrder);
      };

      try {
        // Initial snapshot so the client renders immediately on connect.
        send('snapshot', await queryActiveOrders());
      } catch {
        send('error', { message: 'initial snapshot failed' });
      }

      // Polling loop: emit only when the payload actually changes.
      let lastPayload = '';
      const run = async() => {
        while (!closed) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
          if (closed) {
            break;
          }
          try {
            const orders = await queryActiveOrders();
            const payload = JSON.stringify(orders);
            if (payload !== lastPayload) {
              lastPayload = payload;
              send('snapshot', orders);
            }
          } catch {
            // Polling error — keep the connection alive, retry next tick.
          }
        }
      };

      const pollPromise = run();

      // Connection timeout — close cleanly; EventSource reconnects.
      setTimeout(() => {
        closed = true;
        try {
          controller.close();
        } catch { /* ignore */ }
      }, SSE_TIMEOUT_MS);

      // Cleanup on client disconnect.
      c.req.raw.signal.addEventListener('abort', () => {
        closed = true;
        try {
          controller.close();
        } catch { /* ignore */ }
      });

      await Promise.race([
        pollPromise,
        new Promise((resolve) => setTimeout(resolve, SSE_TIMEOUT_MS))
      ]);
    },
    cancel() {
      closed = true;
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
