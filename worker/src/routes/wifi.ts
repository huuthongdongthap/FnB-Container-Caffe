/**
 * WiFi Captive Portal Router — /api/wifi
 *
 * Endpoints:
 *  GET  /status       — Check client MAC authorization status
 *  POST /login        — Guest captive portal login (MAC + Phone + optional Name)
 *  POST /authorize    — Staff/Owner manual grant or revoke override
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import {
  checkWifiSessionStatus,
  loginWifiGuest,
  authorizeWifiOverride
} from '../tree/wifi/session';
import { requireAuth, optionalAuth } from '../middleware/auth';
import { getTenantId } from '../middleware/tenant';
import { createLogger } from '../middleware/logger';

const log = createLogger({ route: 'wifi-routes' });

const MAX_WIFI_DURATION_SECONDS = 86400;
const MIN_WIFI_DURATION_SECONDS = 60;

const WifiLoginSchema = z.object({
  mac: z.string().min(1),
  phone: z.string().min(9),
  name: z.string().optional(),
  ip_address: z.string().optional(),
  duration_seconds: z.number().int().min(MIN_WIFI_DURATION_SECONDS).max(MAX_WIFI_DURATION_SECONDS).optional()
});

const WifiAuthorizeSchema = z.object({
  mac: z.string().min(1),
  action: z.enum(['grant', 'revoke']),
  duration_seconds: z.number().int().min(MIN_WIFI_DURATION_SECONDS).max(MAX_WIFI_DURATION_SECONDS).optional(),
  notes: z.string().optional()
});

function resolvePortalTenantId(c: {
  get?: (_k: string) => unknown;
  req: { query: (_k: string) => string | undefined; header: (_k: string) => string | undefined };
}): string {
  const user = typeof c.get === 'function' ? c.get('user') : undefined;
  if (user) {
    return getTenantId(c as Parameters<typeof getTenantId>[0]);
  }
  const raw = (c.req.query('tenant_id') || c.req.header('x-tenant-id') || '').trim();
  if (!raw || raw === '*') return 'default';
  return raw;
}

export function createWifiRoutes() {
  const app = new Hono<{ Bindings: Env }>();

  // GET /api/wifi/status?mac=...
  // Public captive portal check
  app.get('/status', optionalAuth(), async(c) => {
    try {
      const mac = c.req.query('mac');
      if (!mac) {
        return c.json({ error: 'Missing mac query parameter' }, 400);
      }

      const tenantId = resolvePortalTenantId(c);
      const result = await checkWifiSessionStatus(c.env as Record<string, unknown>, mac, tenantId);
      return c.json(result);
    } catch (err) {
      log.error('wifi_status_error', { error: (err as Error).message });
      return c.json({ error: 'Failed to check WiFi status', authorized: false }, 500);
    }
  });

  // POST /api/wifi/login
  // Public captive portal guest submission
  app.post('/login', optionalAuth(), async(c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const parsed = WifiLoginSchema.safeParse(body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return c.json({ error: `${first.path.join('.')}: ${first.message}` }, 400);
      }

      const tenantId = resolvePortalTenantId(c);
      const result = await loginWifiGuest(c.env as Record<string, unknown>, parsed.data, tenantId);
      return c.json(result);
    } catch (err) {
      const msg = (err as Error).message || '';
      log.error('wifi_login_error', { error: msg });
      const safeError = msg === 'Invalid Vietnamese phone number format'
        ? msg
        : 'Unable to authorize WiFi session';
      return c.json({ success: false, error: safeError }, 400);
    }
  });

  // POST /api/wifi/authorize
  // Staff/Supervisor/Manager/Admin/Owner manual MAC grant/revoke override
  app.post('/authorize', requireAuth(['owner', 'admin', 'manager', 'supervisor', 'staff']), async(c) => {
    try {
      const body = await c.req.json<Record<string, unknown>>();
      const parsed = WifiAuthorizeSchema.safeParse(body);
      if (!parsed.success) {
        const first = parsed.error.issues[0];
        return c.json({ error: `${first.path.join('.')}: ${first.message}` }, 400);
      }

      const tenantId = getTenantId(c);
      const result = await authorizeWifiOverride(c.env as Record<string, unknown>, parsed.data, tenantId);
      return c.json(result);
    } catch (err) {
      log.error('wifi_authorize_error', { error: (err as Error).message });
      return c.json({ error: 'Failed to authorize WiFi session' }, 500);
    }
  });

  return app;
}
