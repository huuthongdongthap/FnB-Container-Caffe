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
import type { MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { Env } from '../../types/env';
import { createTastyIgniterClient } from '../../clients/tastyigniter-client';
import {
  syncTIToLocalMenu,
  bridgeOrderToTI,
  getTiMenuCache
} from '../../tree/integrations/tastyigniter/sync';
import { processTIWebhook, type TIWebhookPayload } from '../../tree/integrations/tastyigniter/webhook';
import { computeHmacSha256, timingSafeEqual } from '@aura/domain-security';
import { requireAuth } from '../../middleware/auth';
import { getTenantId, isHQSuperAdmin, resolvePilotStore } from '../../middleware/tenant';
import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'ti-gateway' });

export function hasCrossTenantOverride(c: {
  get: (_k: string) => unknown;
  req: { query: (_k: string) => string | undefined; header: (_k: string) => string | undefined };
}): boolean {
  const candidates = [
    c.req.query('tenant_id'),
    c.req.query('tenantId'),
    c.req.query('store_id'),
    c.req.query('storeId'),
    c.req.header('X-Tenant-ID'),
    c.req.header('x-tenant-id'),
    c.req.header('X-Store-ID'),
    c.req.header('x-store-id'),
  ]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  if (new Set(candidates).size > 1) {
    return true;
  }
  const user = c.get('user') as { role?: string; tenant_id?: string; tenantId?: string } | undefined;
  if (!user || isHQSuperAdmin(user)) return false;
  const rawUserTenant = (user.tenant_id || user.tenantId || '').trim();
  if (rawUserTenant === '*' || rawUserTenant.toLowerCase() === 'hq') {
    return true;
  }
  const userTenant = rawUserTenant || 'default';
  const requestedTenant = candidates[0] || '';
  const ctxTenant = (typeof c.get === 'function' ? (c.get('tenantId') as string | undefined) : undefined)?.trim() || '';
  if (
    (requestedTenant && (requestedTenant === '*' || requestedTenant.toLowerCase() === 'hq' || requestedTenant !== userTenant)) ||
    (ctxTenant && (ctxTenant === '*' || ctxTenant.toLowerCase() === 'hq' || ctxTenant !== userTenant))
  ) {
    return true;
  }
  return false;
}

export function resolveTiTenant(c: import('hono').Context<{ Bindings: Env }>): string {
  const raw = getTenantId(c).trim() || 'default';
  const user = c.get('user' as never) as { role?: string; tenant_id?: string; tenantId?: string } | undefined;
  if (user && isHQSuperAdmin(user)) {
    return raw.toLowerCase() === 'hq' ? '*' : raw;
  }
  return raw;
}

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
): Promise<{ allowed: boolean; orderTenantId: string }> {
  const fallbackTenant = !tenantId || tenantId === '*' || tenantId.toLowerCase() === 'hq' ? 'default' : tenantId;
  const db = (env.AURA_DB ?? (env as unknown as Record<string, unknown>).DB) as D1Database | undefined;
  if (!db) {
    return {
      allowed: tenantId === '*' || tenantId === 'default',
      orderTenantId: fallbackTenant,
    };
  }
  try {
    const row = await db
      .prepare('SELECT id, tenant_id FROM orders WHERE id = ? LIMIT 1')
      .bind(localOrderId)
      .first<Record<string, unknown>>();
    if (!row) {
      return {
        allowed: tenantId === '*',
        orderTenantId: fallbackTenant,
      };
    }
    const rowTenantRaw =
      'tenant_id' in row && row.tenant_id !== undefined && row.tenant_id !== null
        ? String(row.tenant_id).trim()
        : '';
    const resolvedOrderTenant =
      rowTenantRaw && rowTenantRaw !== '*' && rowTenantRaw.toLowerCase() !== 'hq'
        ? rowTenantRaw
        : 'default';
    return {
      allowed: matchesTiOrderTenant(row, tenantId),
      orderTenantId: tenantId === '*' ? resolvedOrderTenant : fallbackTenant,
    };
  } catch {
    try {
      const row = await db
        .prepare('SELECT id FROM orders WHERE id = ? LIMIT 1')
        .bind(localOrderId)
        .first<Record<string, unknown>>();
      if (!row) {
        return {
          allowed: tenantId === '*',
          orderTenantId: fallbackTenant,
        };
      }
      return {
        allowed: matchesTiOrderTenant(row, tenantId),
        orderTenantId: fallbackTenant,
      };
    } catch {
      return {
        allowed: tenantId === '*' || tenantId === 'default',
        orderTenantId: fallbackTenant,
      };
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
  const baseAllow = requireAuth(['owner', 'admin', 'manager', 'supervisor', 'staff']);
  const allow: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
    let crossTenant = false;
    const authRes = await baseAllow(c, async () => {
      if (hasCrossTenantOverride(c as unknown as Parameters<typeof hasCrossTenantOverride>[0])) {
        crossTenant = true;
        return;
      }
      await next();
    });
    if (crossTenant) {
      return c.json({ error: 'Cross-tenant access denied', mock: false }, 403);
    }
    return authRes;
  };

  // POST /api/integrations/tastyigniter/sync/menu
  // Pull menu from TI and cache locally (fire-and-forget).
  app.post('/sync/menu', allow, async(c) => {
    try {
      const tenantId = resolveTiTenant(c);
      let execCtx: ExecutionContext | undefined;
      try {
        execCtx = c.executionCtx as unknown as ExecutionContext;
      } catch {
        execCtx = undefined;
      }
      const result = await syncTIToLocalMenu(c.env, execCtx, tenantId);
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
      const tenantId = resolveTiTenant(c);
      const verification = await verifyLocalOrderTenant(c.env, localOrderId, tenantId);
      if (!verification.allowed) {
        return c.json({ success: false, error: 'Order not found' }, 404);
      }
      const effectiveOrderTenant = tenantId === '*' ? verification.orderTenantId : tenantId;
      const result = await bridgeOrderToTI(
        c.env,
        localOrderId,
        { ...orderData, tenant_id: effectiveOrderTenant },
        c.executionCtx as unknown as ExecutionContext,
        effectiveOrderTenant
      );
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
      const tenantId = resolveTiTenant(c);
      const { items } = await getTiMenuCache(c.env, tenantId);
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
        c.env?.ENVIRONMENT === 'test'
      );
      const secret = (c.env.TASTYIGNITER_WEBHOOK_SECRET ?? '') as string;
      if (!secret && !allowUnsignedDev) {
        return c.json({ error: 'TastyIgniter webhook secret not configured' }, 503);
      }
      const rawBody = await c.req.text().catch(() => '');
      if (secret) {
        if (c.req.query('secret') || c.req.query('token')) {
          return c.json({ error: 'Query secret is not supported; pass X-TastyIgniter-Signature header' }, 401);
        }
        const sig =
          c.req.header('x-tastyigniter-signature') ??
          c.req.header('X-TastyIgniter-Signature');
        if (!sig) {
          return c.json({ error: 'Unauthorized webhook signature' }, 401);
        }
        const directMatch = await timingSafeEqual(sig, secret);
        let hmacMatch = false;
        if (!directMatch) {
          const hmacHex = await computeHmacSha256(rawBody, secret);
          const normalizedSig = sig.replace(/^sha256=/i, '').trim().toLowerCase();
          hmacMatch = await timingSafeEqual(normalizedSig, hmacHex.toLowerCase());
        }
        if (!directMatch && !hmacMatch) {
          return c.json({ error: 'Unauthorized webhook signature' }, 401);
        }
      }

      let body: TIWebhookPayload | null = null;
      try {
        body = JSON.parse(rawBody) as TIWebhookPayload;
      } catch {
        return c.json({ error: 'Invalid JSON payload' }, 400);
      }
      if (!body || typeof body !== 'object') {
        return c.json({ error: 'Invalid JSON payload' }, 400);
      }

      const webhookTenantCandidates = [
        c.req.header('X-Tenant-ID'),
        c.req.header('x-tenant-id'),
        c.req.header('X-Store-ID'),
        c.req.header('x-store-id'),
        c.req.query('tenant_id'),
        c.req.query('tenantId'),
        c.req.query('store_id'),
        c.req.query('storeId'),
      ]
        .map((v) => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean);
      const bodyTenant = typeof body.tenant_id === 'string' ? body.tenant_id.trim() : '';
      const dataTenant =
        body.data && typeof body.data === 'object' && typeof (body.data as Record<string, unknown>).tenant_id === 'string'
          ? String((body.data as Record<string, unknown>).tenant_id).trim()
          : '';
      for (const candidate of [...webhookTenantCandidates, bodyTenant, dataTenant]) {
        if (candidate && (candidate === '*' || candidate.toLowerCase() === 'hq' || !/^[a-zA-Z0-9_-]{1,64}$/.test(candidate))) {
          return c.json({ error: 'Invalid tenant identifier' }, 400);
        }
      }
      if (new Set(webhookTenantCandidates).size > 1) {
        return c.json({ error: 'Cross-tenant webhook target denied' }, 403);
      }
      const rawWebhookTenant = webhookTenantCandidates[0] || '';
      if (bodyTenant && dataTenant && bodyTenant !== dataTenant) {
        return c.json({ error: 'Cross-tenant webhook target denied' }, 403);
      }
      const payloadTenant = bodyTenant || dataTenant;
      if (rawWebhookTenant && payloadTenant && rawWebhookTenant !== payloadTenant) {
        return c.json({ error: 'Cross-tenant webhook target denied' }, 403);
      }
      const configuredWebhookTenantRaw = (
        (typeof (c.env as Record<string, unknown>)?.TASTYIGNITER_WEBHOOK_TENANT === 'string'
          ? String((c.env as Record<string, unknown>).TASTYIGNITER_WEBHOOK_TENANT).trim()
          : '') ||
        resolvePilotStore(c.env) ||
        'default'
      ).trim();
      const configuredWebhookTenant =
        !configuredWebhookTenantRaw || configuredWebhookTenantRaw === '*' || configuredWebhookTenantRaw.toLowerCase() === 'hq'
          ? 'default'
          : configuredWebhookTenantRaw;
      const requestedTenant = rawWebhookTenant || payloadTenant;
      if (requestedTenant && requestedTenant !== configuredWebhookTenant) {
        return c.json({ error: 'Cross-tenant webhook target denied' }, 403);
      }
      const explicitTenant = configuredWebhookTenant;
      const result = await processTIWebhook(c.env as Record<string, unknown>, body, explicitTenant);
      return c.json({ ...result, success: true });
    } catch (err) {
      log.error('ti_webhook_error', { error: (err as Error).message });
      return c.json({ success: false, error: 'Failed to process TastyIgniter webhook' }, 500);
    }
  });

  return app;
}
