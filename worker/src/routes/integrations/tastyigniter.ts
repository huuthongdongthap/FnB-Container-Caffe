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
  getTiMenuCache
} from '../../tree/integrations/tastyigniter/sync';
import { processTIWebhook, type TIWebhookPayload } from '../../tree/integrations/tastyigniter/webhook';
import { requireAuth } from '../../middleware/auth';
import { getTenantId } from '../../middleware/tenant';
import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'ti-gateway' });

function matchesTiOrderTenant(row: Record<string, unknown> | null | undefined, tenantId: string): boolean {
  if (tenantId === '*') return true;
  if (!row) return false;
  if ('tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null) {
    const rowTenant = String(row.tenant_id).trim() || 'default';
    return rowTenant === tenantId;
  }
  return tenantId === 'default';
}

async function verifyLocalOrderTenant(
  env: Env,
  localOrderId: string,
  tenantId: string
): Promise<boolean> {
  if (tenantId === '*') return true;
  const db = (env.AURA_DB ?? (env as unknown as Record<string, unknown>).DB) as D1Database | undefined;
  if (!db) return tenantId === 'default';
  try {
    const row = await db
      .prepare('SELECT id, tenant_id FROM orders WHERE id = ? LIMIT 1')
      .bind(localOrderId)
      .first<Record<string, unknown>>();
    return matchesTiOrderTenant(row, tenantId);
  } catch {
    try {
      const row = await db
        .prepare('SELECT id FROM orders WHERE id = ? LIMIT 1')
        .bind(localOrderId)
        .first<Record<string, unknown>>();
      return matchesTiOrderTenant(row, tenantId);
    } catch {
      return tenantId === 'default';
    }
  }
}

const SyncOrderSchema = z.object({
  localOrderId: z.string().min(1),
  orderData: z.object({
    customer_name: z.string().optional(),
    customer_phone: z.string().optional(),
    table_id: z.string().optional().nullable(),
    items: z.array(z.record(z.string(), z.unknown())).max(100),
    total: z.number(),
    payment_method: z.string().optional(),
    notes: z.string().optional()
  })
});

export function createTIRoutes() {
  const app = new Hono<{ Bindings: Env }>();

  // Middleware: owner, admin, manager, supervisor, staff only
  const allow = requireAuth(['owner', 'admin', 'manager', 'supervisor', 'staff']);

  // POST /api/integrations/tastyigniter/sync/menu
  // Pull menu from TI and cache locally (fire-and-forget).
  app.post('/sync/menu', allow, async(c) => {
    try {
      const result = await syncTIToLocalMenu(c.env, c.executionCtx as unknown as ExecutionContext);
      return c.json({ ...result, success: true });
    } catch (err) {
      log.error('ti_sync_menu_error', { error: (err as Error).message });
      return c.json({ success: false, error: 'Failed to sync TastyIgniter menu', mock: false }, 500);
    }
  });

  // POST /api/integrations/tastyigniter/sync/order
  // Push a single local order to TI.
  app.post('/sync/order', allow, async(c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const parsed = SyncOrderSchema.safeParse(body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return c.json({ error: `${first.path.join('.')}: ${first.message}` }, 400);
      }

      const { localOrderId, orderData } = parsed.data;
      const tenantId = getTenantId(c);
      if (!(await verifyLocalOrderTenant(c.env, localOrderId, tenantId))) {
        return c.json({ success: false, error: 'Order not found' }, 404);
      }
      const result = await bridgeOrderToTI(c.env, localOrderId, orderData, c.executionCtx as unknown as ExecutionContext);
      return c.json({ success: true, result });
    } catch (err) {
      log.error('ti_bridge_order_error', { error: (err as Error).message });
      return c.json({ success: false, error: 'Failed to bridge order to TastyIgniter', mock: false }, 500);
    }
  });

  // GET /api/integrations/tastyigniter/menu
  // Return cached menu from local DB.
  app.get('/menu', allow, async(c) => {
    try {
      const { items } = await getTiMenuCache(c.env);
      const client = createTastyIgniterClient(c.env);
      return c.json({ items, mock: client === null ? true : undefined });
    } catch (err) {
      log.error('ti_get_menu_cache_error', { error: (err as Error).message });
      return c.json({ error: 'Failed to fetch menu cache', mock: false }, 500);
    }
  });

  // POST /api/integrations/tastyigniter/webhook
  // Inbound webhook from TastyIgniter (order status updates).
  app.post('/webhook', async(c) => {
    try {
      const isProd = c.env?.ENVIRONMENT === 'production' || c.env?.NODE_ENV === 'production';
      const allowUnsignedDev = !isProd && (
        c.env?.ENVIRONMENT === 'development' ||
        c.env?.ENVIRONMENT === 'test' ||
        (c.env as Record<string, unknown>)?.TASTYIGNITER_SYNC_ENABLED === 'false'
      );
      const secret = (c.env.TASTYIGNITER_WEBHOOK_SECRET ?? '') as string;
      if (!secret && !allowUnsignedDev) {
        return c.json({ error: 'TastyIgniter webhook secret not configured' }, 503);
      }
      if (secret) {
        const sig =
          c.req.header('x-tastyigniter-signature') ??
          (!isProd ? (c.req.query('secret') ?? c.req.query('token')) : undefined);
        const enc = new TextEncoder();
        const aBytes = enc.encode(sig ?? '');
        const bBytes = enc.encode(secret);
        let diff = aBytes.length === bBytes.length ? 0 : 1;
        if (diff === 0) {
          for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
        }
        if (!sig || diff !== 0) {
          return c.json({ error: 'Unauthorized webhook signature' }, 401);
        }
      }

      const body = await c.req.json<TIWebhookPayload>();
      if (!body || typeof body !== 'object') {
        return c.json({ error: 'Invalid JSON payload' }, 400);
      }

      const result = await processTIWebhook(c.env as Record<string, unknown>, body);
      return c.json({ ...result, success: true });
    } catch (err) {
      log.error('ti_webhook_error', { error: (err as Error).message });
      return c.json({ success: false, error: 'Failed to process TastyIgniter webhook' }, 500);
    }
  });

  return app;
}
