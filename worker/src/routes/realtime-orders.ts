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

import { Hono } from 'hono';

export const realtimeOrdersRouter = new Hono();

realtimeOrdersRouter.get('/:channelId', async (c) => {
  const channelId = c.req.param('channelId');
  const env = c.env as Record<string, unknown>;
  const doNs = env.ORDER_BROADCASTER as
    | { get(id: string): { fetch(req: Request): Promise<Response> } }
    | undefined;

  if (!doNs) {
    return c.json({ error: 'Realtime not available — ORDER_BROADCASTER binding missing' }, 503);
  }

  // CF Workers upgrades WS natively via DO stub fetch.
  // DO constructor receives the WS upgrade request and manages clients.
  const stub = doNs.get(channelId);
  const response = await stub.fetch(c.req.raw);

  return response;
});
