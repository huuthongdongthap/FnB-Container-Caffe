/**
 * Frigate NVR Integration — /api/integrations/frigate
 *
 * Provides:
 * POST /events/sync — Poll Frigate events → persist to D1 (fire-and-forget)
 * GET /events — Read stored events from D1
 * GET /camera/:id/snapshot — Proxy a camera snapshot through the worker (mockable)
 *
 * Auth: owner + staff
 * Mock mode: returns 200 with mock:true when FRIGATE_SYNC_ENABLED=false
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { Env } from '../../types/env';
import { createFrigateClient } from '../../clients/frigate-client';
import { syncFrigateEvents, getFrigateEvents } from '../../tree/integrations/frigate/sync';
import { getOccupancyAnalytics } from '../../tree/integrations/frigate/occupancy';
import { requireAuth } from '../../middleware/auth';
import { getTenantId, isHQSuperAdmin } from '../../middleware/tenant';
import { matchesTenantRow } from '../../lib/db';
import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'frigate-gateway' });
const CAMERA_ID_REGEX = /^[a-zA-Z0-9_.-]{1,64}$/;

function hasCrossTenantOverride(c: {
  get: (_k: string) => unknown;
  req: { query: (_k: string) => string | undefined; header: (_k: string) => string | undefined };
}): boolean {
  const user = c.get('user') as { role?: string; tenant_id?: string; tenantId?: string } | undefined;
  if (!user || isHQSuperAdmin(user)) return false;
  const userTenant = (user.tenant_id || user.tenantId || '').trim() || 'default';
  if (userTenant === '*' || userTenant.toLowerCase() === 'hq') return true;
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
  return candidates.some((t) => t === '*' || t.toLowerCase() === 'hq' || t !== userTenant);
}

function resolveFrigateTenant(c: Parameters<typeof getTenantId>[0]): string {
  const raw = (getTenantId(c) || 'default').trim() || 'default';
  return raw.toLowerCase() === 'hq' ? '*' : raw;
}

async function verifyCameraTenant(
  env: Env,
  camera: string,
  tenantId: string
): Promise<boolean> {
  if (tenantId === '*') return true;
  const db = (env.AURA_DB ?? (env as unknown as Record<string, unknown>).DB) as D1Database | undefined;
  if (!db) return true;
  try {
    const res = await db
      .prepare('SELECT tenant_id FROM frigate_events WHERE camera = ? LIMIT 50')
      .bind(camera)
      .all<Record<string, unknown>>();
    const rows = res?.results || [];
    if (rows.length > 0) {
      return rows.some((r) => matchesTenantRow(r, tenantId));
    }
    const anyRes = await db
      .prepare('SELECT COUNT(*) as cnt FROM frigate_events')
      .first<{ cnt?: number }>()
      .catch(() => null);
    if (anyRes && Number(anyRes.cnt) > 0) {
      return false;
    }
  } catch {
    // frigate_events table or tenant_id column not present in mock mode
  }
  return true;
}

export function createFrigateRoutes() {
  const app = new Hono<{ Bindings: Env }>();

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

  // POST /api/integrations/frigate/events/sync
  app.post('/events/sync', allow, async(c) => {
    try {
      const camera = c.req.query('camera');
      if (camera && !CAMERA_ID_REGEX.test(camera)) {
        return c.json({ success: false, error: 'Invalid camera identifier', mock: false }, 400);
      }
      const limit = c.req.query('limit');
      const parsedLimit = limit ? Math.min(Math.max(1, parseInt(limit, 10) || 50), 500) : 50;

      const resolvedTenant = resolveFrigateTenant(c);
      const explicitOverride = (
        c.req.query('tenant_id') ||
        c.req.query('tenantId') ||
        c.req.query('store_id') ||
        c.req.query('storeId') ||
        c.req.header('X-Tenant-ID') ||
        c.req.header('x-tenant-id') ||
        c.req.header('X-Store-ID') ||
        c.req.header('x-store-id') ||
        ''
      ).trim();
      if (explicitOverride === '*' || explicitOverride.toLowerCase() === 'hq') {
        return c.json({ success: false, error: 'Concrete store tenant required for Frigate event sync', mock: false }, 400);
      }
      const syncTenant = resolvedTenant === '*' ? 'default' : resolvedTenant;
      const result = await syncFrigateEvents(
        c.env,
        { camera: camera ?? undefined, limit: parsedLimit, tenantId: syncTenant },
        c.executionCtx as unknown as ExecutionContext
      );
      return c.json({ success: true, ...result });
    } catch (err) {
      log.error('frigate_sync_error', { error: (err as Error).message });
      return c.json({ success: false, error: 'Failed to sync Frigate events', mock: false }, 500);
    }
  });

  // GET /api/integrations/frigate/events
  app.get('/events', allow, async(c) => {
    try {
      const camera = c.req.query('camera');
      if (camera && !CAMERA_ID_REGEX.test(camera)) {
        return c.json({ error: 'Invalid camera identifier', mock: false }, 400);
      }
      const limit = c.req.query('limit');
      const since = c.req.query('since');
      if (since !== undefined && since !== '' && (!Number.isFinite(Number(since)) || Number(since) < 0)) {
        return c.json({ error: 'Invalid since timestamp', mock: false }, 400);
      }
      const parsedLimit = limit ? Math.min(Math.max(1, parseInt(limit, 10) || 100), 500) : 100;

      const { events } = await getFrigateEvents(c.env, {
        camera: camera ?? undefined,
        since: since ?? undefined,
        limit: parsedLimit,
        tenantId: resolveFrigateTenant(c)
      });
      const client = createFrigateClient(c.env);
      return c.json({ events, mock: client === null ? true : undefined });
    } catch (err) {
      log.error('frigate_get_events_error', { error: (err as Error).message });
      return c.json({ error: 'Failed to fetch Frigate events', mock: false }, 500);
    }
  });

  // GET /api/integrations/frigate/camera/:id/snapshot
  // Proxies a JPG snapshot from Frigate through the worker.
  app.get('/camera/:id/snapshot', allow, async(c) => {
    try {
      const camera = c.req.param('id');
      if (!CAMERA_ID_REGEX.test(camera)) {
        return c.json({ error: 'Invalid camera identifier', mock: false }, 400);
      }

      const tenantId = resolveFrigateTenant(c);
      if (!(await verifyCameraTenant(c.env, camera, tenantId))) {
        return c.json({ error: 'Camera does not belong to current tenant', mock: false }, 403);
      }

      // If disabled, return an explicit mocked 200 with empty body
      const client = createFrigateClient(c.env);
      if (!client) {
        return c.json({ mock: true, message: 'Frigate not configured' }, 200);
      }

      const { snapshotUrl } = await client.getCameraSnap(camera);
      if (!snapshotUrl) {
        return c.json({ error: 'Snapshot URL unavailable', mock: false }, 503);
      }

      const imgRes = await fetch(snapshotUrl, { headers: client.getHeaders() });
      if (!imgRes.ok) {
        return c.json({ error: `Frigate camera ${camera} responded ${imgRes.status}`, mock: false }, 502);
      }

      const blob = await imgRes.blob();
      return new Response(blob, {
        headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' }
      });
    } catch (err) {
      log.error('frigate_snapshot_error', { error: (err as Error).message });
      return c.json({ error: 'Failed to fetch snapshot', mock: false }, 500);
    }
  });

  // GET /api/integrations/frigate/occupancy
  // Aggregated real-time customer occupancy and peak hour analytics.
  app.get('/occupancy', allow, async(c) => {
    try {
      const report = await getOccupancyAnalytics(c.env as Record<string, unknown>, resolveFrigateTenant(c));
      return c.json(report);
    } catch (err) {
      log.error('frigate_occupancy_error', { error: (err as Error).message });
      return c.json({ error: 'Failed to compute occupancy analytics', mock: false }, 500);
    }
  });

  return app;
}
