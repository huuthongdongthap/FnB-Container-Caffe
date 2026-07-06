/**
 * TastyIgniter Integration — /api/integrations/tastyigniter
 *
 * Provides:
 *  POST /sync/menu   — Pull TastyIgniter menu → local cache (fire-and-forget)
 *  POST /sync/order  — Bridge a local order to TastyIgniter (fire-and-forget)
 *  GET  /menu        — Read cached menu from local DB
 *
 * Auth: owner + staff
 * Mock mode: returns 200 with mock:true when TASTYIGNITER_SYNC_ENABLED=false
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../types/env';
import { createTastyIgniterClient } from '../../clients/tastyigniter-client';
import {
  syncTIToLocalMenu,
  bridgeOrderToTI,
  getTiMenuCache,
} from '../../tree/integrations/tastyigniter/sync';
import { requireAuth } from '../../middleware/auth';
import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'ti-gateway' });

const SyncOrderSchema = z.object({
  localOrderId: z.string().min(1),
  orderData: z.object({
    customer_name: z.string().optional(),
    customer_phone: z.string().optional(),
    table_id: z.string().optional().nullable(),
    items: z.array(z.record(z.unknown())),
    total: z.number(),
    payment_method: z.string().optional(),
    notes: z.string().optional(),
  }),
});

export function createTIRoutes() {
  const app = new Hono<{ Bindings: Env }>();

  // Middleware: owner+staff only
  const allow = requireAuth(['owner', 'staff']);

  // POST /api/integrations/tastyigniter/sync/menu
  // Pull menu from TI and cache locally (fire-and-forget).
  app.post('/sync/menu', allow, async (c) => {
    try {
      const result = await syncTIToLocalMenu(c.env, c.executionCtx);
      return c.json({ success: true, ...result });
    } catch (err) {
      log.error('ti_sync_menu_error', { error: (err as Error).message });
      return c.json({ success: false, error: (err as Error).message, mock: false }, 500);
    }
  });

  // POST /api/integrations/tastyigniter/sync/order
  // Push a single local order to TI.
  app.post('/sync/order', allow, async (c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const parsed = SyncOrderSchema.safeParse(body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return c.json({ error: `${first.path.join('.')}: ${first.message}` }, 400);
      }

      const { localOrderId, orderData } = parsed.data;
      const result = await bridgeOrderToTI(c.env, localOrderId, orderData, c.executionCtx);
      return c.json({ success: true, result });
    } catch (err) {
      log.error('ti_bridge_order_error', { error: (err as Error).message });
      return c.json({ success: false, error: (err as Error).message, mock: false }, 500);
    }
  });

  // GET /api/integrations/tastyigniter/menu
  // Return cached menu from local DB.
  app.get('/menu', allow, async (c) => {
    try {
      const { items } = await getTiMenuCache(c.env);
      const client = createTastyIgniterClient(c.env);
      return c.json({ items, mock: client === null ? true : undefined });
    } catch (err) {
      log.error('ti_get_menu_cache_error', { error: (err as Error).message });
      return c.json({ error: 'Failed to fetch menu cache', mock: false }, 500);
    }
  });

  return app;
}
