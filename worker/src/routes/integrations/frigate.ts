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
import type { Env } from '../../types/env';
import { createFrigateClient } from '../../clients/frigate-client';
import { syncFrigateEvents, getFrigateEvents } from '../../tree/integrations/frigate/sync';
import { getOccupancyAnalytics } from '../../tree/integrations/frigate/occupancy';
import { requireAuth } from '../../middleware/auth';
import { getTenantId } from '../../middleware/tenant';
import { createLogger } from '../../middleware/logger';

const log = createLogger({ route: 'frigate-gateway' });
const CAMERA_ID_REGEX = /^[a-zA-Z0-9_.-]{1,64}$/;

export function createFrigateRoutes() {
  const app = new Hono<{ Bindings: Env }>();

  const allow = requireAuth(['owner', 'admin', 'manager', 'supervisor', 'staff']);

  // POST /api/integrations/frigate/events/sync
  app.post('/events/sync', allow, async(c) => {
    try {
      const camera = c.req.query('camera');
      if (camera && !CAMERA_ID_REGEX.test(camera)) {
        return c.json({ success: false, error: 'Invalid camera identifier', mock: false }, 400);
      }
      const limit = c.req.query('limit');
      const parsedLimit = limit ? Math.min(Math.max(1, parseInt(limit, 10) || 50), 500) : 50;

      const result = await syncFrigateEvents(
        c.env,
        { camera: camera ?? undefined, limit: parsedLimit, tenantId: getTenantId(c) },
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
        tenantId: getTenantId(c)
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
      const report = await getOccupancyAnalytics(c.env as Record<string, unknown>, getTenantId(c));
      return c.json(report);
    } catch (err) {
      log.error('frigate_occupancy_error', { error: (err as Error).message });
      return c.json({ error: 'Failed to compute occupancy analytics', mock: false }, 500);
    }
  });

  return app;
}
